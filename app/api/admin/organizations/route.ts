import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdminAccess } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  try {
    // Check super admin access
    await requireSuperAdminAccess();

    // Get all organizations with member count and subscription info
    const organizations = await prisma.organization.findMany({
      include: {
        subscriptionPlan: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        members: {
          select: {
            id: true,
            role: true,
            userId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            workspaces: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        subscriptionStatus: org.subscriptionStatus,
        subscriptionPlan: org.subscriptionPlan,
        memberCount: org._count.members,
        workspaceCount: org._count.workspaces,
        currentStorageGB: org.currentStorageGB,
        creditsUsedThisMonth: org.creditsUsedThisMonth,
        trialEndsAt: org.trialEndsAt,
        currentPeriodEnd: org.currentPeriodEnd,
        createdAt: org.createdAt,
        members: org.members,
      })),
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
