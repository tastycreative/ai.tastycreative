import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/* ------------------------------------------------------------------ */
/*  GET /api/organization/members/search — search organization members */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json({ error: 'User not in an organization' }, { status: 404 });
    }

    // Get search query from URL
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();

    if (!query) {
      return NextResponse.json([]);
    }

    // Search users in the same organization by name or email
    const members = await prisma.user.findMany({
      where: {
        currentOrganizationId: user.currentOrganizationId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        clerkId: true,
        name: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      take: 10, // Limit to 10 results
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error searching organization members:', error);
    return NextResponse.json(
      { error: 'Failed to search members' },
      { status: 500 }
    );
  }
}
