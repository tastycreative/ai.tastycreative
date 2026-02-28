import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canCreateQueue, type OrgRole } from '@/lib/rbac';

/**
 * GET /api/caption-queue/creators
 * Returns all CREATOR-role members in the requester's current organization.
 * Only accessible by OWNER, ADMIN, or MANAGER.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve current user + org
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json({ error: 'User is not part of an organization' }, { status: 400 });
    }

    // Check requester's role — only managers and above can call this
    const requesterMembership = await prisma.teamMember.findFirst({
      where: { userId: user.id, organizationId: user.currentOrganizationId },
      select: { role: true },
    });

    if (!canCreateQueue(requesterMembership?.role as OrgRole | undefined)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all CREATOR-role team members in the org
    const creatorMembers = await prisma.teamMember.findMany({
      where: {
        organizationId: user.currentOrganizationId,
        role: 'CREATOR',
      },
      select: {
        user: {
          select: {
            id: true,
            clerkId: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const creators = creatorMembers.map(({ user }) => ({
      id: user.id,
      clerkId: user.clerkId,
      name: user.name ?? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email),
      email: user.email,
      imageUrl: user.imageUrl,
    }));

    return NextResponse.json({ creators });
  } catch (error) {
    console.error('Error fetching caption queue creators:', error);
    return NextResponse.json({ error: 'Failed to fetch creators' }, { status: 500 });
  }
}
