import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/admin/plans - List all subscription plans
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get all subscription plans with organization count
    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        _count: {
          select: { organizations: true },
        },
      },
      orderBy: [
        { price: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      plans: plans.map(plan => ({
        ...plan,
        organizationsCount: plan._count.organizations,
      })),
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
}
