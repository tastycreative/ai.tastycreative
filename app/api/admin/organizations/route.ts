import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
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
                clerkId: true,
                firstName: true,
                lastName: true,
                name: true,
                email: true,
                imageUrl: true,
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

    // Collect all unique Clerk IDs from members that are missing names
    const unnamedClerkIds = Array.from(
      new Set(
        organizations.flatMap((org) =>
          org.members
            .filter((m) => !m.user.firstName && !m.user.lastName && !m.user.name)
            .map((m) => m.user.clerkId)
        )
      )
    );

    // Batch-fetch missing names from Clerk
    const clerkNameMap = new Map<string, { firstName: string | null; lastName: string | null; imageUrl: string | null }>();
    if (unnamedClerkIds.length > 0) {
      try {
        const clerk = await clerkClient();
        const clerkUsers = await clerk.users.getUserList({ userId: unnamedClerkIds, limit: 500 });
        for (const cu of clerkUsers.data) {
          clerkNameMap.set(cu.id, {
            firstName: cu.firstName,
            lastName: cu.lastName,
            imageUrl: cu.imageUrl,
          });
        }
      } catch (clerkError) {
        console.warn('Could not enrich member names from Clerk:', clerkError);
      }
    }

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
        members: org.members.map((m) => {
          const clerkData = clerkNameMap.get(m.user.clerkId);
          return {
            ...m,
            user: {
              ...m.user,
              firstName: m.user.firstName ?? clerkData?.firstName ?? null,
              lastName: m.user.lastName ?? clerkData?.lastName ?? null,
              avatarUrl: m.user.avatarUrl ?? m.user.imageUrl ?? clerkData?.imageUrl ?? null,
            },
          };
        }),
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
