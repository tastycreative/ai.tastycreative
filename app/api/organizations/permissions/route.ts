import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';


// Helper function to merge plan features with custom permissions
function mergePermissions(
  planFeatures: Record<string, string>,
  customPermissions: any
): Record<string, any> {
  const merged: Record<string, any> = {};

  // Start with plan defaults
  Object.entries(planFeatures).forEach(([key, value]) => {
    // Convert string value to appropriate type
    if (value === 'true') merged[key] = true;
    else if (value === 'false') merged[key] = false;
    else if (!isNaN(Number(value))) merged[key] = Number(value);
    else merged[key] = value;
  });

  // Override with custom permissions (if not null)
  if (customPermissions) {
    Object.entries(customPermissions).forEach(([key, value]) => {
      if (value !== null && key !== 'id' && key !== 'organizationId' && key !== 'createdAt' && key !== 'updatedAt') {
        merged[key] = value;
      }
    });
  }

  return merged;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If no current organization, return default solo permissions
    if (!user.currentOrganizationId) {
      return NextResponse.json({
        permissions: {
          // All features enabled for solo users
          hasGenerateTab: true,
          hasVaultTab: true,
          hasTrainingTab: true,
          hasInstagramTab: true,
          hasPlanningTab: true,
          hasPipelineTab: true,
          hasAnalyticsTab: true,
          hasFeedTab: true,
          hasMarketplaceTab: true,
          canTextToImage: true,
          canImageToVideo: true,
          canImageToImage: true,
          canTextToVideo: true,
          canFaceSwap: true,
          canFluxKontext: true,
          canVideoFpsBoost: true,
          canSkinEnhancement: true,
          canTrainLoRA: true,
          canShareLoRA: true,
          canAccessMarketplace: true,
          canAutoSchedule: true,
          canBulkUpload: true,
          canCaptionBank: true,
          canHashtagBank: true,
          canStoryPlanner: true,
          canReelPlanner: true,
          canFeedPostPlanner: true,
          canContentPipeline: true,
          canPerformanceMetrics: true,
          canShareFolders: true,
          canCreateFolders: true,
          maxVaultFolders: 999,
          canApproveContent: true,
          canCommentOnContent: true,
          canAssignTasks: true,
          canMentionTeam: true,
          canExportData: true,
          canAccessAPI: false,
          canWhiteLabel: false,
          canCustomBranding: false,
          canWebhooks: false,
        },
        subscriptionInfo: null,
      });
    }

    // Get organization with plan and custom permissions
    const organization = await prisma.organization.findUnique({
      where: { id: user.currentOrganizationId },
      include: {
        subscriptionPlan: {
          include: {
            planFeatures: true,
          },
        },
        customPermissions: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Build plan features map
    const planFeatures: Record<string, string> = {};
    if (organization.subscriptionPlan?.planFeatures) {
      organization.subscriptionPlan.planFeatures.forEach((feature) => {
        planFeatures[feature.featureKey] = feature.featureValue;
      });
    }

    // Merge with custom permissions
    const permissions = mergePermissions(
      planFeatures,
      organization.customPermissions
    );

    // Build subscription info
    const subscriptionInfo = {
      planName: organization.subscriptionPlan?.name || 'Free',
      planDisplayName: organization.subscriptionPlan?.displayName || 'Free Plan',
      status: organization.subscriptionStatus,
      maxMembers: organization.customMaxMembers || organization.subscriptionPlan?.maxMembers || 1,
      maxProfiles: organization.customMaxProfiles || organization.subscriptionPlan?.maxProfiles || 1,
      maxWorkspaces: organization.customMaxWorkspaces || organization.subscriptionPlan?.maxWorkspaces || 0,
      maxStorageGB: organization.customMaxStorageGB || organization.subscriptionPlan?.maxStorageGB || 5,
      monthlyCredits: organization.customMonthlyCredits || organization.subscriptionPlan?.monthlyCredits || 100,
      currentStorageGB: organization.currentStorageGB,
      creditsUsedThisMonth: organization.creditsUsedThisMonth,
      trialEndsAt: organization.trialEndsAt,
      currentPeriodEnd: organization.currentPeriodEnd,
    };

    return NextResponse.json({
      permissions,
      subscriptionInfo,
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
