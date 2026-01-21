import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

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
                name: true,
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
