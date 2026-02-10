import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { numberOfSlots } = await req.json();

    if (!numberOfSlots || numberOfSlots < 1) {
      return NextResponse.json({ error: 'Invalid number of slots' }, { status: 400 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        teamMemberships: {
          include: {
            organization: {
              include: {
                subscriptionPlan: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const currentOrg = user.teamMemberships.find(
      (m) => m.organizationId === user.currentOrganizationId
    )?.organization;

    if (!currentOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Calculate current limits
    const baseMemberLimit = currentOrg.customMaxMembers ?? currentOrg.subscriptionPlan?.maxMembers ?? 1;
    const currentAdditionalSlots = currentOrg.additionalMemberSlots ?? 0;

    // Check if trying to remove more slots than exist
    if (numberOfSlots > currentAdditionalSlots) {
      return NextResponse.json(
        { error: `Cannot remove ${numberOfSlots} slots. Only ${currentAdditionalSlots} additional slots exist.` },
        { status: 400 }
      );
    }

    // Calculate new limits after removal
    const newAdditionalSlots = currentAdditionalSlots - numberOfSlots;
    const newMaxMembers = baseMemberLimit + newAdditionalSlots;

    // Get current member count
    const memberCount = await prisma.teamMember.count({
      where: { organizationId: currentOrg.id },
    });

    // CRITICAL: Prevent removal if it would cause member overflow
    if (memberCount > newMaxMembers) {
      return NextResponse.json(
        {
          error: 'Cannot remove member slots',
          message: `You currently have ${memberCount} members, but removing ${numberOfSlots} slot${numberOfSlots > 1 ? 's' : ''} would reduce your limit to ${newMaxMembers}. Please remove ${memberCount - newMaxMembers} member${memberCount - newMaxMembers > 1 ? 's' : ''} before cancelling these slots.`,
          currentMembers: memberCount,
          newLimit: newMaxMembers,
          membersToRemove: memberCount - newMaxMembers,
        },
        { status: 400 }
      );
    }

    // Find and cancel the Stripe subscription for member slots
    if (!currentOrg.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this organization' },
        { status: 400 }
      );
    }

    // Find active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: currentOrg.stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    // Find member slot subscription(s)
    const memberSlotSubscriptions = subscriptions.data.filter((sub) => {
      return sub.items.data.some((item) => {
        // Check if this is a member slot subscription by metadata or product
        return sub.metadata?.type === 'member_slot_addon';
      });
    });

    if (memberSlotSubscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No active member slot subscription found' },
        { status: 404 }
      );
    }

    // For simplicity, we'll cancel/update the first matching subscription
    // In a production environment, you might need more sophisticated logic
    const subscriptionToUpdate = memberSlotSubscriptions[0];

    // Get the current quantity of member slots in the subscription
    const memberSlotItem = subscriptionToUpdate.items.data.find(
      (item) => item.price.id === subscriptionToUpdate.items.data[0].price.id
    );

    if (!memberSlotItem) {
      return NextResponse.json(
        { error: 'Could not find member slot line item' },
        { status: 404 }
      );
    }

    const currentQuantity = memberSlotItem.quantity || 0;
    const newQuantity = currentQuantity - numberOfSlots;

    if (newQuantity <= 0) {
      // Cancel the entire subscription if removing all slots
      await stripe.subscriptions.cancel(subscriptionToUpdate.id);

      // Update organization
      await prisma.organization.update({
        where: { id: currentOrg.id },
        data: {
          additionalMemberSlots: 0,
        },
      });

      // Create transaction record
      await prisma.billingTransaction.create({
        data: {
          organizationId: currentOrg.id,
          userId: user.id,
          type: 'SUBSCRIPTION_REFUND',
          status: 'COMPLETED',
          amount: 0,
          currency: 'usd',
          description: `Cancelled all member slot subscriptions (${currentQuantity} slots)`,
          planName: 'Member Slot Add-on',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully cancelled all ${currentQuantity} member slot${currentQuantity > 1 ? 's' : ''}`,
        newTotalSlots: baseMemberLimit,
      });
    } else {
      // Update quantity in the subscription
      await stripe.subscriptionItems.update(memberSlotItem.id, {
        quantity: newQuantity,
      });

      // Update organization
      await prisma.organization.update({
        where: { id: currentOrg.id },
        data: {
          additionalMemberSlots: newQuantity,
        },
      });

      // Create transaction record
      await prisma.billingTransaction.create({
        data: {
          organizationId: currentOrg.id,
          userId: user.id,
          type: 'PLAN_CHANGE',
          status: 'COMPLETED',
          amount: 0,
          currency: 'usd',
          description: `Removed ${numberOfSlots} member slot${numberOfSlots > 1 ? 's' : ''} (${currentQuantity} → ${newQuantity})`,
          planName: 'Member Slot Add-on',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully removed ${numberOfSlots} member slot${numberOfSlots > 1 ? 's' : ''}`,
        remainingAdditionalSlots: newQuantity,
        newTotalSlots: baseMemberLimit + newQuantity,
      });
    }
  } catch (error: unknown) {
    console.error('Error cancelling member slots:', error);
    return NextResponse.json(
      { error: 'Failed to cancel member slots' },
      { status: 500 }
    );
  }
}
