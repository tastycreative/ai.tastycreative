import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        teamMemberships: {
          include: {
            organization: true,
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

    if (!currentOrg || !currentOrg.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Handle different actions
    switch (action) {
      case 'cancel':
        // Cancel at period end
        await stripe.subscriptions.update(currentOrg.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        await prisma.organization.update({
          where: { id: currentOrg.id },
          data: { cancelAtPeriodEnd: true },
        });

        return NextResponse.json({ success: true, message: 'Subscription will be canceled at period end' });

      case 'resume':
        // Resume subscription (undo cancel)
        await stripe.subscriptions.update(currentOrg.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });

        await prisma.organization.update({
          where: { id: currentOrg.id },
          data: { cancelAtPeriodEnd: false },
        });

        return NextResponse.json({ success: true, message: 'Subscription resumed' });

      case 'cancel_now':
        // Cancel immediately
        await stripe.subscriptions.cancel(currentOrg.stripeSubscriptionId);

        await prisma.organization.update({
          where: { id: currentOrg.id },
          data: {
            subscriptionStatus: 'CANCELLED',
            cancelAtPeriodEnd: false,
          },
        });

        return NextResponse.json({ success: true, message: 'Subscription canceled immediately' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error managing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to manage subscription' },
      { status: 500 }
    );
  }
}
