import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Get current user's organization with member details
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json({ organization: null });
    }

    // Get the user's team membership to check role
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.currentOrganizationId,
        },
      },
      select: {
        role: true,
      },
    });

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: user.currentOrganizationId },
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

    if (!organization) {
      return NextResponse.json({ organization: null });
    }

    // Check if user can manage organization (OWNER or ADMIN)
    const canManage = teamMember?.role === 'OWNER' || teamMember?.role === 'ADMIN';

    return NextResponse.json({
      success: true,
      organization: {
        ...organization,
        memberRole: teamMember?.role,
        canManage,
      },
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PATCH - Update organization details (OWNER/ADMIN only)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    // Check if user has permission (OWNER or ADMIN)
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.currentOrganizationId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!teamMember || (teamMember.role !== 'OWNER' && teamMember.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'You do not have permission to update organization settings' },
        { status: 403 }
      );
    }

    // Update organization
    const updatedOrganization = await prisma.organization.update({
      where: { id: user.currentOrganizationId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
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
        ...updatedOrganization,
        memberRole: teamMember.role,
        canManage: true,
      },
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}
