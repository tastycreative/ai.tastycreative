import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's role from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    // If user doesn't exist in database, return default role
    if (!user) {
      return NextResponse.json({ role: 'USER' });
    }

    return NextResponse.json({ role: user.role });

  } catch (error) {
    console.error('Error fetching user role:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user role' },
      { status: 500 }
    );
  }
}