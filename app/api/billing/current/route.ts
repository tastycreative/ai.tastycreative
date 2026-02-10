import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization with subscription plan
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        teamMemberships: {
          include: {
            organization: {
              include: {
                subscriptionPlan: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const currentOrg = user.teamMemberships.find(
      (m) => m.organizationId === user.currentOrganizationId
    )?.organization;

    if (!currentOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Calculate usage limits
    const baseMemberLimit = currentOrg.customMaxMembers ?? currentOrg.subscriptionPlan?.maxMembers ?? 1;
    const maxMembers = baseMemberLimit + (currentOrg.additionalMemberSlots ?? 0);
    const maxProfiles = currentOrg.customMaxProfiles ?? currentOrg.subscriptionPlan?.maxProfiles ?? 1;
    const maxStorageGB = currentOrg.customMaxStorageGB ?? currentOrg.subscriptionPlan?.maxStorageGB ?? 5;
    const monthlyCredits = currentOrg.customMonthlyCredits ?? currentOrg.subscriptionPlan?.monthlyCredits ?? 100;

    // Get member count
    const memberCount = await prisma.teamMember.count({
      where: { organizationId: currentOrg.id },
    });

    // Get profile count
    const profileCount = await prisma.instagramProfile.count({
      where: { organizationId: currentOrg.id },
    });

    return NextResponse.json({
      organization: {
        id: currentOrg.id,
        name: currentOrg.name,
        subscriptionStatus: currentOrg.subscriptionStatus,
        currentPeriodStart: currentOrg.currentPeriodStart,
        currentPeriodEnd: currentOrg.currentPeriodEnd,
        cancelAtPeriodEnd: currentOrg.cancelAtPeriodEnd,
        trialEndsAt: currentOrg.trialEndsAt,
      },
      plan: currentOrg.subscriptionPlan,
      usage: {
        members: {
          current: memberCount,
          max: maxMembers,
          percentage: (memberCount / maxMembers) * 100,
          baseLimit: baseMemberLimit,
          additionalSlots: currentOrg.additionalMemberSlots ?? 0,
          memberSlotPrice: currentOrg.memberSlotPrice ?? 5.00,
        },
        profiles: {
          current: profileCount,
          max: maxProfiles,
          percentage: (profileCount / maxProfiles) * 100,
        },
        storage: {
          current: currentOrg.currentStorageGB,
          max: maxStorageGB,
          percentage: (currentOrg.currentStorageGB / maxStorageGB) * 100,
        },
        credits: {
          used: currentOrg.creditsUsedThisMonth,
          max: monthlyCredits,
          remaining: currentOrg.availableCredits,
          available: currentOrg.availableCredits,
          percentage: currentOrg.availableCredits > 0 ? ((monthlyCredits - currentOrg.availableCredits) / monthlyCredits) * 100 : 100,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching billing info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing information' },
      { status: 500 }
    );
  }
}
