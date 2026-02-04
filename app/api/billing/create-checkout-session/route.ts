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

    // Check if organization already has an active PAID subscription
    // IMPORTANT: TRIAL subscriptions must go through checkout to collect payment
    const hasActiveSubscription = currentOrg.stripeSubscriptionId &&
      currentOrg.subscriptionStatus === 'ACTIVE';

    // If changing plans, update the existing subscription instead of creating checkout
    // This only applies to ACTIVE (paid) subscriptions, not TRIAL
    if (hasActiveSubscription && currentOrg.stripeSubscriptionId) {
      try {
        console.log(`🔄 Attempting to update subscription for organization ${currentOrg.id}`);
        console.log(`   Current plan: ${currentOrg.subscriptionPlanId}`);
        console.log(`   New plan: ${plan.id}`);

        // Get the current subscription
        const subscription = await stripe.subscriptions.retrieve(currentOrg.stripeSubscriptionId);

        if (!subscription || subscription.status === 'canceled') {
          console.error('❌ Subscription not found or canceled');
          return NextResponse.json(
            { error: 'Your subscription is not active. Please subscribe to a new plan.' },
            { status: 400 }
          );
        }

        // Check if customer has a valid payment method
        const customer = await stripe.customers.retrieve(subscription.customer as string) as any;
        if (!customer.invoice_settings?.default_payment_method && !customer.default_source) {
          console.error('❌ No payment method on file');
          return NextResponse.json(
            { error: 'No payment method on file. Please add a payment method first.' },
            { status: 400 }
          );
        }

        // Update the subscription in Stripe
        // The webhook will handle updating the database and adding credits
        console.log('📝 Updating subscription in Stripe...');
        const updatedSubscription = await stripe.subscriptions.update(
          currentOrg.stripeSubscriptionId,
          {
            items: [
              {
                id: subscription.items.data[0].id,
                price: plan.stripePriceId,
              },
            ],
            proration_behavior: 'always_invoice', // Immediately charge/credit the prorated amount
          }
        );

        console.log(`✅ Subscription updated in Stripe: ${updatedSubscription.id}`);
        console.log(`   Status: ${updatedSubscription.status}`);

        // NOTE: We don't update the database here
        // The webhook (customer.subscription.updated) will handle:
        // 1. Updating subscriptionPlanId
        // 2. Adding credits only after payment succeeds
        // 3. Updating period dates

        // Get the origin for redirect
        const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_APP_URL;

        return NextResponse.json({
          sessionId: null,
          url: `${origin}/${currentOrg.slug}/billing?plan_changed=true`,
          message: 'Plan updated successfully. Changes will take effect immediately.'
        });
      } catch (error: any) {
        console.error('❌ Error updating subscription:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeCardError') {
          return NextResponse.json(
            { error: `Payment failed: ${error.message}` },
            { status: 402 }
          );
        } else if (error.type === 'StripeInvalidRequestError') {
          return NextResponse.json(
            { error: `Invalid request: ${error.message}` },
            { status: 400 }
          );
        } else if (error.statusCode === 404) {
          return NextResponse.json(
            { error: 'Subscription not found. Please contact support.' },
            { status: 404 }
          );
        }

        // For other errors, return a generic message
        console.error('Falling back to checkout due to error');
        return NextResponse.json(
          {
            error: 'Unable to update subscription automatically. Please try again or contact support.',
            details: error.message
          },
          { status: 500 }
        );
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
        userId: user.id, // Track who initiated the purchase
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
