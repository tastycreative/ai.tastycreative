import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, description } = body;

    // Validation
    if (!name || name.trim().length < 3) {
      return NextResponse.json(
        { error: 'Organization name must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!slug || slug.length < 3) {
      return NextResponse.json(
        { error: 'Organization slug must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'This organization name is already taken' },
        { status: 409 }
      );
    }

    // Get the user's database record
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create organization and add user as owner in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: {
          name: name.trim(),
          slug: slug,
          description: description?.trim() || null,
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        },
      });

      // Add user as the owner
      await tx.teamMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
          canInviteMembers: true,
          canManageBilling: true,
          canManageMembers: true,
        },
      });

      // Update user's current organization
      await tx.user.update({
        where: { id: user.id },
        data: {
          currentOrganizationId: organization.id,
        },
      });

      return organization;
    });

    // Fetch the complete organization with members
    const organization = await prisma.organization.findUnique({
      where: { id: result.id },
      include: {
        members: {
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' },
          ],
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        ...organization,
        memberRole: 'OWNER',
        canManage: true,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
