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

    const { planId } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get the subscription plan from database
    // Try to find by name first (from pricing-data.ts), then by ID
    let plan = await prisma.subscriptionPlan.findUnique({
      where: { name: planId },
    });

    // If not found by name, try by ID
    if (!plan) {
      plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });
    }

    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: 'Invalid plan or Stripe price not configured' }, { status: 400 });
    }

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

    if (!currentOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if organization already has an active subscription
    const hasActiveSubscription = currentOrg.stripeSubscriptionId &&
      (currentOrg.subscriptionStatus === 'ACTIVE' || currentOrg.subscriptionStatus === 'TRIAL');

    // If changing plans, update the existing subscription instead of creating checkout
    if (hasActiveSubscription && currentOrg.stripeSubscriptionId) {
      try {
        // Get the current subscription
        const subscription = await stripe.subscriptions.retrieve(currentOrg.stripeSubscriptionId);

        // Update the subscription to change at period end
        const updatedSubscription = await stripe.subscriptions.update(
          currentOrg.stripeSubscriptionId,
          {
            items: [
              {
                id: subscription.items.data[0].id,
                price: plan.stripePriceId,
              },
            ],
            proration_behavior: 'create_prorations', // Creates prorations for immediate upgrade
            billing_cycle_anchor: 'unchanged', // Keeps the same billing cycle
          }
        );

        // Update the organization's plan in the database
        await prisma.organization.update({
          where: { id: currentOrg.id },
          data: {
            subscriptionPlanId: plan.id,
          },
        });

        // Get the origin for redirect
        const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_APP_URL;

        return NextResponse.json({
          sessionId: null,
          url: `${origin}/${currentOrg.slug}/billing?plan_changed=true`,
          message: 'Plan updated successfully. Changes will take effect immediately.'
        });
      } catch (error) {
        console.error('Error updating subscription:', error);
        // If update fails, fall through to create new checkout session
      }
    }

    // Create or retrieve Stripe customer (for new subscriptions)
    let customerId = currentOrg.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          organizationId: currentOrg.id,
          userId: userId,
        },
      });
      customerId = customer.id;

      // Update organization with Stripe customer ID
      await prisma.organization.update({
        where: { id: currentOrg.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Get the origin from the request headers to support any domain
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_APP_URL;

    // Create Stripe checkout session (for new subscriptions only)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/${currentOrg.slug}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${currentOrg.slug}/billing?canceled=true`,
      metadata: {
        organizationId: currentOrg.id,
        planId: plan.id,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    console.error('Error creating checkout session:', error);

    // Provide more detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
