import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('Managers API called');
    const { userId } = await auth();
    console.log('Auth userId:', userId);
    
    if (!userId) {
      console.log('No userId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the requesting user is an admin
    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    console.log('Requesting user:', requestingUser);

    if (!requestingUser || requestingUser.role !== 'ADMIN') {
      console.log('User not admin or not found');
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Fetch all users with MANAGER role
    const managers = await prisma.user.findMany({
      where: {
        role: 'MANAGER'
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

    console.log('Found managers:', managers.length);
    return NextResponse.json(managers);
  } catch (error) {
    console.error('Error fetching managers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch managers' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}