import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

/**
 * GET /api/admin/models/creators
 * Fetches all users with CREATOR role for assignment dropdown
 */
export async function GET() {
  try {
    await requireAdminAccess();

    // Fetch all team members with CREATOR role
    const creatorMembers = await prisma.teamMember.findMany({
      where: {
        role: 'CREATOR',
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        user: {
          firstName: 'asc',
        },
      },
    });

    // Deduplicate users (a user might be CREATOR in multiple organizations)
    const uniqueCreators = new Map<string, {
      id: string;
      clerkId: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      imageUrl: string | null;
      organizations: Array<{ id: string; name: string; slug: string }>;
    }>();

    for (const member of creatorMembers) {
      const existing = uniqueCreators.get(member.user.clerkId);
      if (existing) {
        existing.organizations.push(member.organization);
      } else {
        uniqueCreators.set(member.user.clerkId, {
          id: member.user.id,
          clerkId: member.user.clerkId,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          email: member.user.email,
          imageUrl: member.user.imageUrl,
          organizations: [member.organization],
        });
      }
    }

    const creators = Array.from(uniqueCreators.values());

    return NextResponse.json({
      success: true,
      data: { creators },
    });
  } catch (error: any) {
    console.error('Error fetching creators:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch creators' },
      { status: 500 }
    );
  }
}
