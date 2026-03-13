import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({
        isAuthenticated: false,
        isSuperAdmin: false,
        isAdmin: false,
      }, { status: 401 });
    }

    // Get user role from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true, isAdmin: true },
    });

    const role = user?.role || 'USER';

    // Track daily activity (non-blocking)
    if (user) {
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      Promise.all([
        prisma.user.update({
          where: { clerkId: userId },
          data: { lastLoginAt: now },
        }),
        prisma.userDailyActivity.upsert({
          where: { userId_date: { userId: user.id, date: todayDate } },
          create: { userId: user.id, date: todayDate },
          update: {},
        }),
      ]).catch(() => {});
    }

    // Check if super admin: has SUPER_ADMIN role only
    const isSuperAdmin = role === 'SUPER_ADMIN';

    // Check if any kind of admin: SUPER_ADMIN, ADMIN role, or isAdmin boolean (backwards compatibility)
    const isAdmin = role === 'ADMIN' ||
                   role === 'SUPER_ADMIN' ||
                   user?.isAdmin === true;

    return NextResponse.json({
      isAuthenticated: true,
      role,
      isSuperAdmin,
      isAdmin,
    });
  } catch (error) {
    console.error('Error checking user role:', error);

    // Return safe defaults instead of error during transition
    return NextResponse.json({
      isAuthenticated: true,
      role: 'USER',
      isSuperAdmin: false,
      isAdmin: false,
    });
  }
}
