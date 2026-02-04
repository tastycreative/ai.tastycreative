import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/database';
import { CREDIT_PACKAGES } from '@/lib/credit-packages';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { packageId } = await req.json();

    if (!packageId) {
      return NextResponse.json({ error: 'Package ID is required' }, { status: 400 });
    }

    // Find the credit package
    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);

    if (!creditPackage || !creditPackage.stripePriceId) {
      return NextResponse.json({ error: 'Invalid package or Stripe price not configured' }, { status: 400 });
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

    // Create or retrieve Stripe customer
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

    // Get the origin from the request headers
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_APP_URL;

    // Calculate total credits including bonus
    const totalCredits = creditPackage.credits + (creditPackage.bonus || 0);

    // Create Stripe checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment', // One-time payment, not subscription
      payment_method_types: ['card'],
      line_items: [
        {
          price: creditPackage.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/${currentOrg.slug}/billing?credits_purchased=true`,
      cancel_url: `${origin}/${currentOrg.slug}/billing?canceled=true`,
      metadata: {
        organizationId: currentOrg.id,
        packageId: creditPackage.id,
        credits: totalCredits.toString(),
        type: 'credit_purchase', // Important: identifies this as credit purchase
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    console.error('Error creating credit purchase session:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to create credit purchase session',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
