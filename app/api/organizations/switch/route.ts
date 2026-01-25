import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';


export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the user is a member of this organization
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organizationId,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            subscriptionStatus: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    // Update the user's current organization
    await prisma.user.update({
      where: { id: user.id },
      data: { currentOrganizationId: organizationId },
    });

    // Update last active timestamp for the membership
    await prisma.teamMember.update({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organizationId,
        },
      },
      data: { lastActiveAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        logoUrl: membership.organization.logoUrl,
        subscriptionStatus: membership.organization.subscriptionStatus,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error('Error switching organization:', error);
    return NextResponse.json(
      { error: 'Failed to switch organization' },
      { status: 500 }
    );
  }
}
