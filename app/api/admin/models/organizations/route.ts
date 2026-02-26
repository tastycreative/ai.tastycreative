import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

/**
 * GET /api/admin/models/organizations
 * Fetches all organizations for sharing dropdown
 */
export async function GET() {
  try {
    await requireAdminAccess();

    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        _count: {
          select: {
            members: true,
            instagramProfiles: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the response to match expected format
    const formattedOrganizations = organizations.map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      _count: {
        members: org._count.members,
        profiles: org._count.instagramProfiles,
      },
    }));

    return NextResponse.json({
      success: true,
      data: { organizations: formattedOrganizations },
    });
  } catch (error: any) {
    console.error('Error fetching organizations:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
