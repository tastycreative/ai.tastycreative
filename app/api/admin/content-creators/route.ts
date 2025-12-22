import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('Content Creators API called');
    const { userId } = await auth();
    console.log('Auth userId:', userId);
    
    if (!userId) {
      console.log('No userId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the requesting user is an admin or manager
    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    console.log('Requesting user:', requestingUser);

    if (!requestingUser || !['ADMIN', 'MANAGER'].includes(requestingUser.role)) {
      console.log('User not admin/manager or not found');
      return NextResponse.json({ error: 'Forbidden - Admin/Manager access required' }, { status: 403 });
    }

    // Fetch all users with CONTENT_CREATOR role
    const contentCreators = await prisma.user.findMany({
      where: {
        role: 'CONTENT_CREATOR'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    console.log('Found content creators:', contentCreators.length);
    return NextResponse.json(contentCreators);
  } catch (error) {
    console.error('Error fetching content creators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content creators' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
