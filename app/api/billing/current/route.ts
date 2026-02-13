import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization with subscription plan
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

    // Calculate usage limits
    const baseMemberLimit = currentOrg.customMaxMembers ?? currentOrg.subscriptionPlan?.maxMembers ?? 1;
    const maxMembers = baseMemberLimit + (currentOrg.additionalMemberSlots ?? 0);
    const baseProfileLimit = currentOrg.customMaxProfiles ?? currentOrg.subscriptionPlan?.maxProfiles ?? 1;
    const maxProfiles = baseProfileLimit + (currentOrg.additionalContentProfileSlots ?? 0);
    const baseStorageGB = currentOrg.subscriptionPlan?.maxStorageGB ?? 5;
    const additionalStorageGB = currentOrg.additionalStorageGB ?? currentOrg.customMaxStorageGB ?? 0;
    const maxStorageGB = baseStorageGB + additionalStorageGB;
    const monthlyCredits = currentOrg.customMonthlyCredits ?? currentOrg.subscriptionPlan?.monthlyCredits ?? 100;

    // Get member count
    const memberCount = await prisma.teamMember.count({
      where: { organizationId: currentOrg.id },
    });

    // Get content profile count (Instagram profiles)
    const profileCount = await prisma.instagramProfile.count({
      where: { organizationId: currentOrg.id },
    });

    // Get payment method info from Stripe if customer exists
    let paymentMethod = null;
    if (currentOrg.stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(currentOrg.stripeCustomerId, {
          expand: ['invoice_settings.default_payment_method'],
        });
        
        if (customer && !customer.deleted) {
          const defaultPaymentMethod = (customer as any).invoice_settings?.default_payment_method;
          
          if (defaultPaymentMethod && typeof defaultPaymentMethod === 'object') {
            const pm = defaultPaymentMethod;
            if (pm.type === 'card' && pm.card) {
              paymentMethod = {
                type: 'card',
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
              };
            }
          } else if (defaultPaymentMethod && typeof defaultPaymentMethod === 'string') {
            // Payment method ID was returned, need to fetch it
            const pm = await stripe.paymentMethods.retrieve(defaultPaymentMethod);
            if (pm.type === 'card' && pm.card) {
              paymentMethod = {
                type: 'card',
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
              };
            }
          }
          
          // If no default payment method, try to get from subscriptions
          if (!paymentMethod && currentOrg.stripeSubscriptionId) {
            try {
              const subscription = await stripe.subscriptions.retrieve(currentOrg.stripeSubscriptionId, {
                expand: ['default_payment_method'],
              });
              
              const subPaymentMethod = subscription.default_payment_method;
              if (subPaymentMethod && typeof subPaymentMethod === 'object') {
                const pm = subPaymentMethod as any;
                if (pm.type === 'card' && pm.card) {
                  paymentMethod = {
                    type: 'card',
                    brand: pm.card.brand,
                    last4: pm.card.last4,
                    expMonth: pm.card.exp_month,
                    expYear: pm.card.exp_year,
                  };
                }
              }
            } catch (subError) {
              console.log('Could not fetch subscription payment method:', subError);
            }
          }
        }
      } catch (stripeError) {
        console.log('Could not fetch payment method from Stripe:', stripeError);
      }
    }

    return NextResponse.json({
      organization: {
        id: currentOrg.id,
        name: currentOrg.name,
        subscriptionStatus: currentOrg.subscriptionStatus,
        currentPeriodStart: currentOrg.currentPeriodStart,
        currentPeriodEnd: currentOrg.currentPeriodEnd,
        cancelAtPeriodEnd: currentOrg.cancelAtPeriodEnd,
        trialEndsAt: currentOrg.trialEndsAt,
      },
      plan: currentOrg.subscriptionPlan,
      usage: {
        members: {
          current: memberCount,
          max: maxMembers,
          percentage: (memberCount / maxMembers) * 100,
          baseLimit: baseMemberLimit,
          additionalSlots: currentOrg.additionalMemberSlots ?? 0,
          memberSlotPrice: currentOrg.memberSlotPrice ?? 5.00,
        },
        profiles: {
          current: profileCount,
          max: maxProfiles,
          percentage: (profileCount / maxProfiles) * 100,
          baseLimit: baseProfileLimit,
          additionalSlots: currentOrg.additionalContentProfileSlots ?? 0,
          contentProfileSlotPrice: currentOrg.contentProfileSlotPrice ?? 10.00,
        },
        storage: {
          current: currentOrg.currentStorageGB || 0,
          max: maxStorageGB,
          percentage: ((currentOrg.currentStorageGB || 0) / maxStorageGB) * 100,
          baseGB: baseStorageGB,
          additionalGB: additionalStorageGB,
          storageSlotPrice: currentOrg.storageSlotPrice ?? 0.50,
        },
        credits: {
          used: currentOrg.creditsUsedThisMonth,
          max: monthlyCredits,
          remaining: currentOrg.availableCredits,
          available: currentOrg.availableCredits,
          percentage: currentOrg.availableCredits > 0 ? ((monthlyCredits - currentOrg.availableCredits) / monthlyCredits) * 100 : 100,
        },
      },
      paymentMethod,
    });
  } catch (error: unknown) {
    console.error('Error fetching billing info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing information' },
      { status: 500 }
    );
  }
}
