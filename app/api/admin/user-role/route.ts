import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's highest team role from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { 
        id: true,
        teamMemberships: {
          select: {
            role: true
          }
        }
      }
    });

    // If user doesn't exist in database or has no team memberships, return default role
    if (!user || user.teamMemberships.length === 0) {
      return NextResponse.json({ role: 'MEMBER' });
    }

    // Get the highest role from all team memberships
    // Priority: OWNER > ADMIN > MANAGER > MEMBER > VIEWER
    const roleHierarchy = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
    let highestRole = 'VIEWER';
    
    for (const membership of user.teamMemberships) {
      const currentRoleIndex = roleHierarchy.indexOf(membership.role);
      const highestRoleIndex = roleHierarchy.indexOf(highestRole);
      
      if (currentRoleIndex < highestRoleIndex) {
        highestRole = membership.role;
      }
    }

    return NextResponse.json({ role: highestRole });

  } catch (error) {
    console.error('Error fetching user role:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user role' },
      { status: 500 }
    );
  }
}