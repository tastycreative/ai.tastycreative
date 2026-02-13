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
      return NextResponse.json({ error: 'Invalid amount of storage to remove' }, { status: 400 });
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

    // Check current storage usage
    const baseStorage = currentOrg.subscriptionPlan?.maxStorageGB || 5;
    const additionalStorage = currentOrg.additionalStorageGB || 0;
    const currentLimit = baseStorage + additionalStorage;
    const newLimit = currentLimit - numberOfGB;

    // Get current storage usage from organization
    const currentUsageGB = currentOrg.currentStorageGB || 0;

    // Prevent removal if it would cause storage to exceed limit
    if (currentUsageGB > newLimit) {
      return NextResponse.json(
        {
          error: 'Cannot remove storage - current usage exceeds new limit',
          currentUsageGB: Number(currentUsageGB).toFixed(2),
          newLimitGB: newLimit,
          requiredToFree: (currentUsageGB - newLimit).toFixed(2),
        },
        { status: 400 }
      );
    }

    // Cannot remove more than what was added
    if (numberOfGB > additionalStorage) {
      return NextResponse.json(
        {
          error: 'Cannot remove more storage than what was added',
          additionalStorageGB: additionalStorage,
          requestedRemoval: numberOfGB,
        },
        { status: 400 }
      );
    }

    const stripeCustomerId = currentOrg.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
    }

    // Find the storage subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    // Find storage addon subscription
    let storageSubscription = null;
    let storageSlotItem = null;

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const product = await stripe.products.retrieve(item.price.product as string);
        if (product.metadata.type === 'storage_slot_addon') {
          storageSubscription = sub;
          storageSlotItem = item;
          break;
        }
      }
      if (storageSlotItem) break;
    }

    if (!storageSubscription || !storageSlotItem) {
      // No Stripe subscription found, just update database
      console.log('No Stripe storage subscription found, updating database only');
      await prisma.organization.update({
        where: { id: currentOrg.id },
        data: {
          additionalStorageGB: Math.max(0, additionalStorage - numberOfGB),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully removed ${numberOfGB} GB of storage`,
        newStorageGB: Math.max(0, additionalStorage - numberOfGB),
      });
    }

    const currentQuantity = storageSlotItem.quantity || 0;
    const newQuantity = currentQuantity - numberOfGB;

    console.log('📝 Updating storage subscription...');
    console.log(`   Current quantity: ${currentQuantity}`);
    console.log(`   Removing: ${numberOfGB}`);
    console.log(`   New quantity: ${newQuantity}`);

    if (newQuantity <= 0) {
      // Remove the entire subscription item (or cancel if it's the only item)
      if (storageSubscription.items.data.length === 1) {
        // Cancel the entire subscription
        await stripe.subscriptions.cancel(storageSubscription.id, {
          prorate: true,
        });
        console.log('   Cancelled entire storage subscription');
      } else {
        // Just delete the storage item
        await stripe.subscriptionItems.del(storageSlotItem.id, {
          proration_behavior: 'create_prorations',
        });
        console.log('   Removed storage item from subscription');
      }
    } else {
      // Update the quantity
      await stripe.subscriptionItems.update(storageSlotItem.id, {
        quantity: newQuantity,
        proration_behavior: 'create_prorations',
      });
      console.log(`   Updated quantity to ${newQuantity}`);
    }

    // Update organization's storage limit
    await prisma.organization.update({
      where: { id: currentOrg.id },
      data: {
        additionalStorageGB: Math.max(0, additionalStorage - numberOfGB),
      },
    });

    // Create transaction record for the storage removal
    const pricePerGB = currentOrg.storageSlotPrice || 0.50;
    await prisma.billingTransaction.create({
      data: {
        organizationId: currentOrg.id,
        userId: user.id,
        type: 'SUBSCRIPTION_REFUND',
        status: 'COMPLETED',
        amount: numberOfGB * pricePerGB, // Prorated credit amount
        currency: 'usd',
        description: `Removed ${numberOfGB} GB additional storage (prorated credit)`,
        planName: 'Storage Add-on',
        metadata: {
          numberOfGB: numberOfGB,
          pricePerGB: pricePerGB,
          type: 'storage_addon_removal',
          subscriptionId: storageSubscription.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${numberOfGB} GB of storage`,
      newStorageGB: Math.max(0, additionalStorage - numberOfGB),
    });
  } catch (error: unknown) {
    console.error('Error cancelling storage slots:', error);
    return NextResponse.json(
      { error: 'Failed to remove storage' },
      { status: 500 }
    );
  }
}
