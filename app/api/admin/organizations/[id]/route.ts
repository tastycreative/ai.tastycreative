import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

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

    const { id: organizationId } = await params;
    const body = await req.json();
    const {
      name,
      slug,
      logoUrl,
      subscriptionPlanId,
      subscriptionStatus,
      customMaxMembers,
      customMaxProfiles,
      customMaxWorkspaces,
      customMaxStorageGB,
      customMonthlyCredits,
    } = body;

    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // If slug is being changed, check it's not taken
    if (slug && slug !== existingOrg.slug) {
      const slugTaken = await prisma.organization.findUnique({
        where: { slug },
      });

      if (slugTaken) {
        return NextResponse.json(
          { error: 'Slug already exists' },
          { status: 400 }
        );
      }
    }

    // Update organization
    const updatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(subscriptionPlanId !== undefined && { subscriptionPlanId }),
        ...(subscriptionStatus && { subscriptionStatus }),
        ...(customMaxMembers !== undefined && { customMaxMembers }),
        ...(customMaxProfiles !== undefined && { customMaxProfiles }),
        ...(customMaxWorkspaces !== undefined && { customMaxWorkspaces }),
        ...(customMaxStorageGB !== undefined && { customMaxStorageGB }),
        ...(customMonthlyCredits !== undefined && { customMonthlyCredits }),
      },
      include: {
        subscriptionPlan: true,
      },
    });

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

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

    const { id: organizationId } = await params;

    // Delete organization (cascade will handle related records)
    await prisma.organization.delete({
      where: { id: organizationId },
    });

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
