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

    const { numberOfGB } = await req.json();

    if (!numberOfGB || numberOfGB < 1) {
      return NextResponse.json({ error: 'Invalid amount of storage' }, { status: 400 });
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

    // Define storage pricing (default $0.50/month per GB)
    const pricePerGB = 0.50;

    // Use hardcoded Stripe Price ID if available, otherwise create dynamically
    const storageSlotPriceId = process.env.STRIPE_STORAGE_SLOT_PRICE_ID;

    let storageSlotPrice;

    if (storageSlotPriceId) {
      // Use pre-configured price from environment
      storageSlotPrice = { id: storageSlotPriceId };
    } else {
      // Dynamically create or find the product/price
      let storageSlotProduct;

      // Check if storage slot product exists by searching metadata
      const products = await stripe.products.search({
        query: 'metadata[\'type\']:\'storage_slot_addon\'',
        limit: 1,
      });

      if (products.data.length > 0) {
        storageSlotProduct = products.data[0];
      } else {
        // Create the product if it doesn't exist
        storageSlotProduct = await stripe.products.create({
          name: 'Additional Storage (1 GB)',
          description: 'Add extra storage capacity to your subscription plan',
          metadata: {
            type: 'storage_slot_addon',
          },
        });
      }

      // Get or create price for the product
      const prices = await stripe.prices.list({
        product: storageSlotProduct.id,
        active: true,
        limit: 1,
      });

      if (prices.data.length > 0) {
        storageSlotPrice = prices.data[0];
      } else {
        // Create price if it doesn't exist
        storageSlotPrice = await stripe.prices.create({
          product: storageSlotProduct.id,
          unit_amount: Math.round(pricePerGB * 100), // Convert to cents
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

    // Check for existing storage subscription
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    const existingStorageSub = existingSubscriptions.data.find((sub) =>
      sub.items.data.some((item) => item.price.id === storageSlotPrice.id)
    );

    if (existingStorageSub) {
      // Found existing subscription - update quantity instead of creating new one
      console.log('📝 Found existing storage subscription, updating quantity...');
      const storageSlotItem = existingStorageSub.items.data.find(
        (item) => item.price.id === storageSlotPrice.id
      );

      if (storageSlotItem) {
        const currentQuantity = storageSlotItem.quantity || 0;
        const newQuantity = currentQuantity + numberOfGB;

        console.log(`   Current quantity: ${currentQuantity}`);
        console.log(`   Adding: ${numberOfGB}`);
        console.log(`   New quantity: ${newQuantity}`);

        // Update the subscription item quantity
        await stripe.subscriptionItems.update(storageSlotItem.id, {
          quantity: newQuantity,
          proration_behavior: 'create_prorations',
        });

        // Update organization's storage limit
        await prisma.organization.update({
          where: { id: currentOrg.id },
          data: {
            additionalStorageGB: (currentOrg.additionalStorageGB || 0) + numberOfGB,
          },
        });

        // Create transaction record for the storage add-on
        const pricePerGB = currentOrg.storageSlotPrice || 0.50;
        await prisma.billingTransaction.create({
          data: {
            organizationId: currentOrg.id,
            userId: user.id,
            type: 'SUBSCRIPTION_PAYMENT',
            status: 'COMPLETED',
            amount: numberOfGB * pricePerGB,
            currency: 'usd',
            description: `Added ${numberOfGB} GB additional storage`,
            planName: 'Storage Add-on',
            metadata: {
              numberOfGB: numberOfGB,
              pricePerGB: pricePerGB,
              type: 'storage_addon',
              subscriptionId: existingStorageSub.id,
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Successfully added ${numberOfGB} GB of storage`,
          newStorageGB: (currentOrg.additionalStorageGB || 0) + numberOfGB,
        });
      }
    }

    // No existing subscription - create new checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai.tastycreative.xyz';
    const successUrl = `${baseUrl}/billing?storage_success=true`;
    const cancelUrl = `${baseUrl}/billing?storage_cancelled=true`;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: storageSlotPrice.id,
          quantity: numberOfGB,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organizationId: currentOrg.id,
        userId: user.id,
        type: 'storage_addon',
        numberOfGB: numberOfGB.toString(),
      },
      subscription_data: {
        metadata: {
          organizationId: currentOrg.id,
          type: 'storage_addon',
        },
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    console.error('Error purchasing storage slots:', error);
    return NextResponse.json(
      { error: 'Failed to process storage purchase' },
      { status: 500 }
    );
  }
}
