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

    // Define member slot pricing (default $5/month per slot)
    const pricePerSlot = currentOrg.memberSlotPrice ?? 5.00;

    // Use hardcoded Stripe Price ID if available, otherwise create dynamically
    const memberSlotPriceId = process.env.STRIPE_MEMBER_SLOT_PRICE_ID;

    let memberSlotPrice;

    if (memberSlotPriceId) {
      // Use pre-configured price from environment
      memberSlotPrice = { id: memberSlotPriceId };
    } else {
      // Dynamically create or find the product/price
      let memberSlotProduct;

      // Check if member slot product exists by searching metadata
      const products = await stripe.products.search({
        query: 'metadata[\'type\']:\'member_slot_addon\'',
        limit: 1,
      });

      if (products.data.length > 0) {
        memberSlotProduct = products.data[0];
      } else {
        // Create the product if it doesn't exist
        memberSlotProduct = await stripe.products.create({
          name: 'Additional Team Member Slot',
          description: 'Add extra team member capacity to your subscription plan',
          metadata: {
            type: 'member_slot_addon',
          },
        });
      }

      // Get or create price for the product
      const prices = await stripe.prices.list({
        product: memberSlotProduct.id,
        active: true,
        limit: 1,
      });

      if (prices.data.length > 0) {
        memberSlotPrice = prices.data[0];
      } else {
        // Create price if it doesn't exist
        memberSlotPrice = await stripe.prices.create({
          product: memberSlotProduct.id,
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
          userId: user.id,
        },
      });

      stripeCustomerId = customer.id;

      // Update organization with Stripe customer ID
      await prisma.organization.update({
        where: { id: currentOrg.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    // Create Stripe Checkout Session for subscription add-on
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: memberSlotPrice.id,
          quantity: numberOfSlots,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/ai-content-team/admin/members?member_slots_added=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/ai-content-team/admin/members?member_slots_canceled=true`,
      metadata: {
        organizationId: currentOrg.id,
        userId: user.id,
        type: 'member_slot_addon',
        numberOfSlots: numberOfSlots.toString(),
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: unknown) {
    console.error('Error creating member slot purchase:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase session' },
      { status: 500 }
    );
  }
}
