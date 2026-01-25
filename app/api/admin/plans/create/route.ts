import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST /api/admin/plans/create - Create a new subscription plan
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      displayName,
      description,
      price,
      billingInterval,
      maxMembers,
      maxProfiles,
      maxWorkspaces,
      maxStorageGB,
      monthlyCredits,
      stripePriceId,
      stripeProductId,
      isActive,
      isPublic,
      features,
    } = body;

    // Validate required fields
    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      );
    }

    // Check if plan name already exists
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { name },
    });

    if (existingPlan) {
      return NextResponse.json(
        { error: 'A plan with this name already exists' },
        { status: 409 }
      );
    }

    // Create the plan with features (features are now stored as JSON)
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        displayName,
        description: description || null,
        price: price || 0,
        billingInterval: billingInterval || 'MONTHLY',
        maxMembers: maxMembers || 1,
        maxProfiles: maxProfiles || 1,
        maxWorkspaces: maxWorkspaces || 0,
        maxStorageGB: maxStorageGB || 5,
        monthlyCredits: monthlyCredits || 100,
        stripePriceId: stripePriceId || null,
        stripeProductId: stripeProductId || null,
        isActive: isActive !== undefined ? isActive : true,
        isPublic: isPublic !== undefined ? isPublic : true,
        features: features || {},
      },
    });

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription plan' },
      { status: 500 }
    );
  }
}
