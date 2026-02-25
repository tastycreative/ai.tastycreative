import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/* ------------------------------------------------------------------ */
/*  GET /api/organization/members — fetch all organization members    */
/* ------------------------------------------------------------------ */

export async function GET() {
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

    // Fetch all users in the same organization
    const members = await prisma.user.findMany({
      where: {
        currentOrganizationId: user.currentOrganizationId,
      },
      select: {
        id: true,
        clerkId: true,
        name: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization members' },
      { status: 500 }
    );
  }
}
