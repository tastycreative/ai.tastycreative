import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdminAccess } from '@/lib/adminAuth';

// GET /api/admin/plans - List all subscription plans
export async function GET(req: NextRequest) {
  try {
    // Check super admin access
    await requireSuperAdminAccess();

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
