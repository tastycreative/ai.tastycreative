import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// PATCH /api/admin/plans/[id] - Update a subscription plan
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: planId } = await params;
    const body = await req.json();
    const {
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

    // Check if plan exists
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    // Update the plan (features are now stored as JSON)
    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(billingInterval !== undefined && { billingInterval }),
        ...(maxMembers !== undefined && { maxMembers }),
        ...(maxProfiles !== undefined && { maxProfiles }),
        ...(maxWorkspaces !== undefined && { maxWorkspaces }),
        ...(maxStorageGB !== undefined && { maxStorageGB }),
        ...(monthlyCredits !== undefined && { monthlyCredits }),
        ...(stripePriceId !== undefined && { stripePriceId }),
        ...(stripeProductId !== undefined && { stripeProductId }),
        ...(isActive !== undefined && { isActive }),
        ...(isPublic !== undefined && { isPublic }),
        ...(features !== undefined && { features }),
      },
    });

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription plan' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/plans/[id] - Delete a subscription plan
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: planId } = await params;

    // Check if plan has any organizations using it
    const organizationsCount = await prisma.organization.count({
      where: { subscriptionPlanId: planId },
    });

    if (organizationsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete plan: ${organizationsCount} organization(s) are using this plan` },
        { status: 409 }
      );
    }

    // Delete the plan (features will be deleted via cascade)
    await prisma.subscriptionPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription plan deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription plan' },
      { status: 500 }
    );
  }
}
