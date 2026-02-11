import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/billing/cancel-content-profile-slots
 * Cancel/reduce additional content profile slots for an organization
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { numberOfSlots } = body;

    if (!numberOfSlots || numberOfSlots < 1) {
      return NextResponse.json(
        { error: 'Invalid number of slots' },
        { status: 400 }
      );
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

    const currentAdditionalSlots = currentOrg.additionalContentProfileSlots ?? 0;

    if (currentAdditionalSlots < numberOfSlots) {
      return NextResponse.json(
        { error: `You only have ${currentAdditionalSlots} additional content profile slots` },
        { status: 400 }
      );
    }

    const newAdditionalSlots = currentAdditionalSlots - numberOfSlots;
    const baseProfileLimit = currentOrg.customMaxProfiles ?? currentOrg.subscriptionPlan?.maxProfiles ?? 1;
    const newMaxProfiles = baseProfileLimit + newAdditionalSlots;

    // Calculate new limits after removal
    // Get current content profile count (Instagram profiles)
    const profileCount = await prisma.instagramProfile.count({
      where: { organizationId: currentOrg.id },
    });

    // CRITICAL: Prevent removal if it would cause profile overflow
    if (profileCount > newMaxProfiles) {
      return NextResponse.json(
        {
          error: 'Cannot remove content profile slots',
          message: `You currently have ${profileCount} content profiles, but removing ${numberOfSlots} slot(s) would reduce your limit to ${newMaxProfiles}. Please delete ${profileCount - newMaxProfiles} content profile(s) before cancelling these slots.`,
          currentProfiles: profileCount,
          newLimit: newMaxProfiles,
          profilesToRemove: profileCount - newMaxProfiles,
        },
        { status: 400 }
      );
    }

    // Get Stripe customer ID
    const stripeCustomerId = currentOrg.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 404 }
      );
    }

    // Get content profile slot price ID
    const contentProfileSlotPriceId = process.env.STRIPE_CONTENT_PROFILE_SLOT_PRICE_ID;

    if (!contentProfileSlotPriceId) {
      return NextResponse.json(
        { error: 'Content profile slot price ID not configured' },
        { status: 500 }
      );
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    // Find content profile slot subscription(s) by checking the price ID
    const contentProfileSlotSubscriptions = subscriptions.data.filter((sub) => {
      return sub.items.data.some((item) => {
        // Check if this subscription item uses the content profile slot price ID
        return item.price.id === contentProfileSlotPriceId;
      });
    });

    console.log('🔍 DEBUG: Found content profile slot subscriptions:', contentProfileSlotSubscriptions.length);
    contentProfileSlotSubscriptions.forEach((sub, index) => {
      const contentProfileSlotItem = sub.items.data.find(item => item.price.id === contentProfileSlotPriceId);
      console.log(`   Subscription ${index + 1}: ID=${sub.id}, Quantity=${contentProfileSlotItem?.quantity || 0}`);
    });

    if (contentProfileSlotSubscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No active content profile slot subscription found' },
        { status: 404 }
      );
    }

    // CRITICAL: Handle multiple subscriptions properly
    // Calculate total quantity across ALL subscriptions
    let totalStripeQuantity = 0;
    contentProfileSlotSubscriptions.forEach(sub => {
      const item = sub.items.data.find(i => i.price.id === contentProfileSlotPriceId);
      totalStripeQuantity += item?.quantity || 0;
    });


    // For removal, we'll update/cancel subscriptions starting from the most recent
    const subscriptionToUpdate = contentProfileSlotSubscriptions[contentProfileSlotSubscriptions.length - 1];

    // Get the current quantity of content profile slots in the subscription
    const contentProfileSlotItem = subscriptionToUpdate.items.data.find(
      (item) => item.price.id === contentProfileSlotPriceId
    );

    if (!contentProfileSlotItem) {
      return NextResponse.json(
        { error: 'Could not find content profile slot line item' },
        { status: 404 }
      );
    }

    const currentQuantity = contentProfileSlotItem.quantity || 0;
    const newQuantity = currentQuantity - numberOfSlots;

    console.log(`📊 Current Quantity in Stripe: ${currentQuantity}`);
    console.log(`📊 Removing: ${numberOfSlots}`);
    console.log(`📊 New Quantity in Stripe: ${newQuantity}`);
    console.log(`💾 Current DB additionalContentProfileSlots: ${currentAdditionalSlots}`);
    console.log(`💾 New DB additionalContentProfileSlots: ${newAdditionalSlots}`);

    if (newQuantity <= 0) {
      // Cancel the entire subscription
      console.log(`❌ Cancelling entire subscription ${subscriptionToUpdate.id}`);
      await stripe.subscriptions.cancel(subscriptionToUpdate.id);

      // Update organization
      await prisma.organization.update({
        where: { id: currentOrg.id },
        data: {
          additionalContentProfileSlots: newAdditionalSlots,
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
          description: `Cancelled all ${currentQuantity} content profile slot${currentQuantity > 1 ? 's' : ''}`,
          planName: 'Content Profile Slot Add-on',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully cancelled all ${currentQuantity} content profile slot${currentQuantity > 1 ? 's' : ''}`,
        newTotalSlots: baseProfileLimit,
      });
    } else {
      // Update quantity in the subscription
      console.log(`🔄 Updating Stripe subscription item ${contentProfileSlotItem.id} from ${currentQuantity} to ${newQuantity}`);
      await stripe.subscriptionItems.update(contentProfileSlotItem.id, {
        quantity: newQuantity,
      });

      // Update organization - use newAdditionalSlots (calculated from DB) not newQuantity (from Stripe)
      console.log(`💾 Updating database: additionalContentProfileSlots from ${currentAdditionalSlots} to ${newAdditionalSlots}`);
      const updatedOrg = await prisma.organization.update({
        where: { id: currentOrg.id },
        data: {
          additionalContentProfileSlots: newAdditionalSlots,
        },
      });
      console.log(`✅ Database updated successfully. New value: ${updatedOrg.additionalContentProfileSlots}`);

      // Create transaction record
      await prisma.billingTransaction.create({
        data: {
          organizationId: currentOrg.id,
          userId: user.id,
          type: 'PLAN_CHANGE',
          status: 'COMPLETED',
          amount: 0,
          currency: 'usd',
          description: `Removed ${numberOfSlots} content profile slot${numberOfSlots > 1 ? 's' : ''} (${currentAdditionalSlots} → ${newAdditionalSlots})`,
          planName: 'Content Profile Slot Add-on',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully removed ${numberOfSlots} content profile slot${numberOfSlots > 1 ? 's' : ''}`,
        remainingAdditionalSlots: newAdditionalSlots,
        newTotalSlots: baseProfileLimit + newAdditionalSlots,
      });
    }
  } catch (error: unknown) {
    console.error('Error cancelling content profile slots:', error);
    return NextResponse.json(
      { error: 'Failed to cancel content profile slots' },
      { status: 500 }
    );
  }
}
