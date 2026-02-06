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

  // Override with custom permissions from JSON field
  if (customPermissions?.permissions) {
    const perms = typeof customPermissions.permissions === 'string'
      ? JSON.parse(customPermissions.permissions)
      : customPermissions.permissions;

    Object.entries(perms).forEach(([key, value]) => {
      if (value !== null) {
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

    // Get or create the user in the database
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    // If user doesn't exist in database, create them (new signup)
    if (!user) {
      const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      });

      if (clerkUser.ok) {
        const clerkData = await clerkUser.json();
        user = await prisma.user.create({
          data: {
            clerkId: userId,
            email: clerkData.email_addresses?.[0]?.email_address || '',
            name: `${clerkData.first_name || ''} ${clerkData.last_name || ''}`.trim() || null,
          },
          select: {
            id: true,
            currentOrganizationId: true,
          },
        });
      } else {
        // If we can't create user, return Free plan permissions
        return NextResponse.json({
          permissions: {
            // Return the Free plan permissions from below
          },
          subscriptionInfo: null,
        });
      }
    }

    // If no current organization, return minimal permissions
    // User must create/join an organization to access features
    if (!user.currentOrganizationId) {
      return NextResponse.json({
        permissions: {
          // No feature tabs for users without organization
          hasGenerateTab: false,
          hasContentTab: false,
          hasVaultTab: false,
          hasTrainingTab: false,
          hasInstagramTab: false,
          hasPlanningTab: false,
          hasPipelineTab: false,
          hasAnalyticsTab: false,
          hasFeedTab: false,
          hasMarketplaceTab: false,
          hasReferenceBank: false,
          // No generate features
          canTextToImage: false,
          canImageToVideo: false,
          canImageToImage: false,
          canTextToVideo: false,
          canFaceSwap: false,
          canFluxKontext: false,
          canVideoFpsBoost: false,
          canSkinEnhancement: false,
          canStyleTransfer: false,
          canSkinEnhancer: false,
          canImageToImageSkinEnhancer: false,
          canSeeDreamTextToImage: false,
          canSeeDreamImageToImage: false,
          canSeeDreamTextToVideo: false,
          canSeeDreamImageToVideo: false,
          canKlingTextToVideo: false,
          canKlingImageToVideo: false,
          canKlingMultiImageToVideo: false,
          canKlingMotionControl: false,
          // No training features
          canTrainLoRA: false,
          canShareLoRA: false,
          canAccessMarketplace: false,
          // No Instagram features
          canAutoSchedule: false,
          canBulkUpload: false,
          canCaptionBank: false,
          canHashtagBank: false,
          canStoryPlanner: false,
          canReelPlanner: false,
          canFeedPostPlanner: false,
          canContentPipeline: false,
          canPerformanceMetrics: false,
          // No vault features
          canShareFolders: false,
          canCreateFolders: false,
          maxVaultFolders: 0,
          // No collaboration features
          canApproveContent: false,
          canCommentOnContent: false,
          canAssignTasks: false,
          canMentionTeam: false,
          // No advanced features
          canExportData: false,
          canAccessAPI: false,
          canWhiteLabel: false,
          canCustomBranding: false,
          canWebhooks: false,
        },
        subscriptionInfo: {
          planName: 'none',
          planDisplayName: 'No Organization',
          status: 'inactive',
          maxMembers: 0,
          maxProfiles: 0,
          maxWorkspaces: 0,
          maxStorageGB: 0,
          monthlyCredits: 0,
          currentStorageGB: 0,
          creditsUsedThisMonth: 0,
        },
      });
    }

    // Get organization with plan and custom permissions
    const organization = await prisma.organization.findUnique({
      where: { id: user.currentOrganizationId },
      include: {
        subscriptionPlan: true,
        customPermissions: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Build plan features map (now stored as JSON)
    const planFeatures: Record<string, any> = {};
    if (organization.subscriptionPlan?.features) {
      const features = typeof organization.subscriptionPlan.features === 'string'
        ? JSON.parse(organization.subscriptionPlan.features)
        : organization.subscriptionPlan.features;

      Object.assign(planFeatures, features);
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
