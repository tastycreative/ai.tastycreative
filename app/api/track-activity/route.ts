import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    await Promise.all([
      prisma.user.update({
        where: { clerkId },
        data: { lastLoginAt: now },
      }),
      prisma.userDailyActivity.upsert({
        where: { userId_date: { userId: user.id, date: todayDate } },
        create: { userId: user.id, date: todayDate },
        update: {},
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error tracking activity:', error);
    return NextResponse.json({ error: 'Failed to track activity' }, { status: 500 });
  }
}
