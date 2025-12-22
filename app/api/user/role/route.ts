import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Fetch current user's role from database
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    // Get user role from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true, id: true, email: true }
    });

    if (!user) {
      // User doesn't exist in database yet - return default USER role
      return NextResponse.json({
        success: true,
        role: 'USER',
        inDatabase: false
      });
    }

    return NextResponse.json({
      success: true,
      role: user.role,
      inDatabase: true
    });
  } catch (error) {
    console.error('❌ Error fetching user role:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch user role',
      },
      { status: 500 }
    );
  }
}
