import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/database';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  console.log('🔔 Webhook received!');

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('❌ No signature in webhook request');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
    console.log(`✅ Webhook verified: ${event.type}`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('⚠️  Webhook signature verification failed.', errorMessage);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the event
  try {
    console.log(`📦 Processing event: ${event.type}`);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Error handling webhook event:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('💳 Processing checkout.session.completed');

  const organizationId = session.metadata?.organizationId;
  const planId = session.metadata?.planId;

  console.log(`   Organization ID: ${organizationId}`);
  console.log(`   Plan ID: ${planId}`);
  console.log(`   Customer: ${session.customer}`);
  console.log(`   Subscription: ${session.subscription}`);

  if (!organizationId || !planId) {
    console.error('❌ Missing metadata in checkout session');
    return;
  }

  const subscriptionData: any = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // Extract period dates from the subscription items
  const firstItem = subscriptionData.items?.data?.[0];
  const periodStart = firstItem?.current_period_start;
  const periodEnd = firstItem?.current_period_end;

  console.log(`   Subscription details:`, {
    id: subscriptionData.id,
    status: subscriptionData.status,
    current_period_start: periodStart ? new Date(periodStart * 1000) : 'MISSING',
    current_period_end: periodEnd ? new Date(periodEnd * 1000) : 'MISSING',
  });

  if (!periodStart || !periodEnd) {
    console.error(`❌ Missing period dates in subscription data`);
    return;
  }

  // Get the subscription plan to get monthly credits
  const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    select: { monthlyCredits: true },
  });

  // Get current organization to add credits
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      availableCredits: true,
      customMonthlyCredits: true,
    },
  });

  if (!organization || !subscriptionPlan) {
    console.error('❌ Organization or subscription plan not found');
    return;
  }

  // Calculate credits to add (use custom credits if set, otherwise plan credits)
  const creditsToAdd = organization.customMonthlyCredits ?? subscriptionPlan.monthlyCredits;
  const newAvailableCredits = organization.availableCredits + creditsToAdd;

  console.log(`   Adding ${creditsToAdd} credits to organization`);
  console.log(`   Current credits: ${organization.availableCredits}`);
  console.log(`   New total: ${newAvailableCredits}`);

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      subscriptionPlanId: planId,
      subscriptionStatus: 'ACTIVE',
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscriptionData.id,
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      billingEmail: session.customer_details?.email || null,
      billingName: session.customer_details?.name || null,
      availableCredits: newAvailableCredits,
      lastCreditReset: new Date(),
    },
  });

  console.log(`✅ Subscription activated for organization ${organizationId}`);
  console.log(`   Organization name: ${updated.name}`);
  console.log(`   Subscription status: ${updated.subscriptionStatus}`);
  console.log(`   Available credits: ${updated.availableCredits}`);
}

async function handleSubscriptionUpdated(subscription: any) {
  const organization = await prisma.organization.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!organization) {
    console.error(`Organization not found for subscription ${subscription.id}`);
    return;
  }

  const status = subscription.status;
  let subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED' =
    'ACTIVE';

  if (status === 'past_due') {
    subscriptionStatus = 'PAST_DUE';
  } else if (status === 'canceled' || status === 'unpaid') {
    subscriptionStatus = 'CANCELLED';
  } else if (status === 'paused') {
    subscriptionStatus = 'PAUSED';
  } else if (status === 'trialing') {
    subscriptionStatus = 'TRIAL';
  }

  // Extract period dates from subscription items
  const firstItem = subscription.items?.data?.[0];
  const periodStart = firstItem?.current_period_start;
  const periodEnd = firstItem?.current_period_end;

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  console.log(`✅ Subscription updated for organization ${organization.id}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  const organization = await prisma.organization.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!organization) {
    console.error(`Organization not found for subscription ${subscription.id}`);
    return;
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: 'CANCELLED',
      cancelAtPeriodEnd: false,
    },
  });

  console.log(`✅ Subscription cancelled for organization ${organization.id}`);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const organization = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
    include: {
      subscriptionPlan: {
        select: { monthlyCredits: true },
      },
    },
  });

  if (!organization) {
    console.error(`Organization not found for customer ${customerId}`);
    return;
  }

  // Calculate credits to add (use custom credits if set, otherwise plan credits)
  const creditsToAdd = organization.customMonthlyCredits ?? organization.subscriptionPlan?.monthlyCredits ?? 0;
  const newAvailableCredits = organization.availableCredits + creditsToAdd;

  console.log(`💰 Adding credits for monthly renewal`);
  console.log(`   Adding ${creditsToAdd} credits to organization ${organization.id}`);
  console.log(`   Current credits: ${organization.availableCredits}`);
  console.log(`   New total: ${newAvailableCredits}`);

  // Add monthly credits on successful payment (renewal)
  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      availableCredits: newAvailableCredits,
      lastCreditReset: new Date(),
    },
  });

  console.log(`✅ Invoice paid and credits added for organization ${organization.id}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const organization = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!organization) {
    console.error(`Organization not found for customer ${customerId}`);
    return;
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: 'PAST_DUE',
    },
  });

  console.log(`❌ Invoice payment failed for organization ${organization.id}`);
}
