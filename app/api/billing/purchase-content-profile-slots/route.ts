import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/billing/purchase-content-profile-slots
 * Purchase additional content profile slots for an organization
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

    // Define content profile slot pricing (default $10/month per slot)
    const pricePerSlot = currentOrg.contentProfileSlotPrice ?? 10.00;

    // Use hardcoded Stripe Price ID if available, otherwise create dynamically
    const contentProfileSlotPriceId = process.env.STRIPE_CONTENT_PROFILE_SLOT_PRICE_ID;

    let contentProfileSlotPrice;

    if (contentProfileSlotPriceId) {
      // Use pre-configured price from environment
      contentProfileSlotPrice = { id: contentProfileSlotPriceId };
    } else {
      // Dynamically create or find the product/price
      let contentProfileSlotProduct;

      // Check if content profile slot product exists by searching metadata
      const products = await stripe.products.search({
        query: 'metadata[\'type\']:\'content_profile_slot_addon\'',
        limit: 1,
      });

      if (products.data.length > 0) {
        contentProfileSlotProduct = products.data[0];
      } else {
        // Create the product if it doesn't exist
        contentProfileSlotProduct = await stripe.products.create({
          name: 'Additional Content Profile Slot',
          description: 'Add extra content profile capacity to your subscription plan',
          metadata: {
            type: 'content_profile_slot_addon',
          },
        });
      }

      // Get or create price for the product
      const prices = await stripe.prices.list({
        product: contentProfileSlotProduct.id,
        active: true,
        limit: 1,
      });

      if (prices.data.length > 0) {
        contentProfileSlotPrice = prices.data[0];
      } else {
        // Create price if it doesn't exist
        contentProfileSlotPrice = await stripe.prices.create({
          product: contentProfileSlotProduct.id,
          unit_amount: Math.round(pricePerSlot * 100), // Convert to cents
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
        });
      }
    }

    // Create or get Stripe customer
    let stripeCustomerId = currentOrg.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: currentOrg.billingEmail || user.email || undefined,
        name: currentOrg.billingName || currentOrg.name,
        metadata: {
          organizationId: currentOrg.id,
        },
      });

      stripeCustomerId = customer.id;

      // Update organization with Stripe customer ID
      await prisma.organization.update({
        where: { id: currentOrg.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    // CRITICAL FIX: Check for existing content profile slot subscription
    // If one exists, update its quantity instead of creating a new subscription
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    const existingContentProfileSlotSub = existingSubscriptions.data.find((sub) =>
      sub.items.data.some((item) => item.price.id === contentProfileSlotPrice.id)
    );

    if (existingContentProfileSlotSub) {
      // Found existing subscription - update quantity instead of creating new one
      console.log('📝 Found existing content profile slot subscription, updating quantity...');
      const contentProfileSlotItem = existingContentProfileSlotSub.items.data.find(
        (item) => item.price.id === contentProfileSlotPrice.id
      );

      if (contentProfileSlotItem) {
        const currentQuantity = contentProfileSlotItem.quantity || 0;
        const newQuantity = currentQuantity + numberOfSlots;

        console.log(`   Current quantity: ${currentQuantity}`);
        console.log(`   Adding: ${numberOfSlots}`);
        console.log(`   New quantity: ${newQuantity}`);

        // Update the subscription item quantity
        await stripe.subscriptionItems.update(contentProfileSlotItem.id, {
          quantity: newQuantity,
        });

        // Update organization database
        const currentAdditionalSlots = currentOrg.additionalContentProfileSlots ?? 0;
        const newTotalSlots = currentAdditionalSlots + numberOfSlots;

        await prisma.organization.update({
          where: { id: currentOrg.id },
          data: {
            additionalContentProfileSlots: newTotalSlots,
          },
        });

        // Create transaction record
        await prisma.billingTransaction.create({
          data: {
            organizationId: currentOrg.id,
            userId: user.id,
            type: 'SUBSCRIPTION_PAYMENT',
            status: 'COMPLETED',
            amount: pricePerSlot * numberOfSlots,
            currency: 'usd',
            description: `Added ${numberOfSlots} content profile slot${numberOfSlots > 1 ? 's' : ''} (${currentQuantity} → ${newQuantity} in Stripe)`,
            planName: 'Content Profile Slot Add-on',
            metadata: {
              subscriptionId: existingContentProfileSlotSub.id,
              numberOfSlots: numberOfSlots,
              pricePerSlot: pricePerSlot,
              type: 'content_profile_slot_addon_update',
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Successfully added ${numberOfSlots} content profile slot${numberOfSlots > 1 ? 's' : ''}`,
          url: null, // No checkout needed, updated existing subscription
        });
      }
    }

    // No existing subscription found - create new checkout session
    console.log('🆕 No existing content profile slot subscription found, creating new checkout session...');

    // Create Stripe Checkout Session for subscription add-on
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: contentProfileSlotPrice.id,
          quantity: numberOfSlots,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/ai-content-team/billing?content_profile_slots_added=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/ai-content-team/billing?canceled=true`,
      metadata: {
        organizationId: currentOrg.id,
        userId: user.id,
        type: 'content_profile_slot_addon',
        numberOfSlots: numberOfSlots.toString(),
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error('Error creating content profile slot purchase session:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
