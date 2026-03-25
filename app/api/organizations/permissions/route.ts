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
          hasSpacesTab: false,
          hasSchedulersTab: false,
          hasGenerateTab: false,
          hasAIToolsTab: false,
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
          availableCredits: 0,
        },
      });
    }

    // Get organization with plan, custom permissions, the user's TeamMember row,
    // and whether the org uses teams at all.
    const [organization, teamMember, orgTeamCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: user.currentOrganizationId },
        include: {
          subscriptionPlan: true,
          customPermissions: true,
        },
      }),
      prisma.teamMember.findFirst({
        where: { organizationId: user.currentOrganizationId, user: { clerkId: userId } },
        select: {
          role: true,
          orgTeamMemberships: {
            include: {
              team: { select: { tabPermissions: true } },
            },
          },
        },
      }),
      prisma.orgTeam.count({
        where: { organizationId: user.currentOrganizationId },
      }),
    ]);

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
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

    // Default new tab keys to true for backward compatibility
    // (existing plans in DB may not have these keys yet)
    const TAB_DEFAULTS: Record<string, boolean> = {
      hasSpacesTab: true,
      hasSchedulersTab: true,
      hasAIToolsTab: true,
      hasContentTab: true,
    };
    for (const [key, val] of Object.entries(TAB_DEFAULTS)) {
      if (permissions[key] === undefined) {
        permissions[key] = val;
      }
    }

    // ── Team tab restriction layer ────────────────────────────────────────────
    // OWNER / ADMIN / MANAGER bypass team restrictions.
    // Users not in any team get no extra access (same as {} — zero tabs granted).
    // Otherwise intersect the plan permissions with the union of all their teams' tabPermissions.
    const BYPASS_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
    const userRole = teamMember?.role ?? 'MEMBER';
    const teamMemberships = teamMember?.orgTeamMemberships ?? [];
    // The org uses teams if at least one OrgTeam exists.
    // If the org has teams but this user isn't in any, they get zero-tab access
    // (same as being in a team with {} permissions).
    const orgUsesTeams = orgTeamCount > 0;

    if (!BYPASS_ROLES.includes(userRole) && orgUsesTeams) {
      // Tab permission keys that exist in PLAN_FEATURES with category === 'tab'
      const TAB_KEYS = [
        'hasSpacesTab', 'hasSchedulersTab',
        'hasContentTab', 'hasVaultTab', 'hasReferenceBank', 'canCaptionBank',
        'hasInstagramTab', 'hasGenerateTab', 'hasFeedTab', 'hasTrainingTab',
        'hasAIToolsTab', 'hasMarketplaceTab',
      ];

      // Build union of all teams' whitelisted tabs
      const allowedTabs = new Set<string>();
      for (const membership of teamMemberships) {
        const teamPerms = membership.team.tabPermissions as Record<string, unknown>;
        for (const key of TAB_KEYS) {
          if (teamPerms[key] === true) {
            allowedTabs.add(key);
          }
        }
      }

      // Apply restriction: only show tabs explicitly whitelisted by at least one team.
      // {} means "no tabs granted" — all tab keys become false.
      for (const key of TAB_KEYS) {
        if (!allowedTabs.has(key)) {
          permissions[key] = false;
        }
      }

      // ── Derived sub-permissions ─────────────────────────────────────────────
      // When a parent tab is restricted, also restrict its child features so
      // direct URL navigation and API calls are blocked.

      // Content Studio → planning, pipeline, analytics, content management
      if (!allowedTabs.has('hasInstagramTab')) {
        permissions['hasPlanningTab'] = false;
        permissions['hasPipelineTab'] = false;
        permissions['hasAnalyticsTab'] = false;
        permissions['canContentPipeline'] = false;
        permissions['canStoryPlanner'] = false;
        permissions['canReelPlanner'] = false;
        permissions['canFeedPostPlanner'] = false;
        permissions['canPerformanceMetrics'] = false;
        permissions['canHashtagBank'] = false;
        permissions['canAutoSchedule'] = false;
        permissions['canBulkUpload'] = false;
      }

      // Generate Content → all generation sub-features
      if (!allowedTabs.has('hasGenerateTab')) {
        permissions['canTextToImage'] = false;
        permissions['canImageToVideo'] = false;
        permissions['canImageToImage'] = false;
        permissions['canTextToVideo'] = false;
        permissions['canFaceSwap'] = false;
        permissions['canFluxKontext'] = false;
        permissions['canVideoFpsBoost'] = false;
        permissions['canSkinEnhancement'] = false;
        permissions['canStyleTransfer'] = false;
        permissions['canSkinEnhancer'] = false;
        permissions['canImageToImageSkinEnhancer'] = false;
        permissions['canAIVoice'] = false;
        permissions['canSeeDreamTextToImage'] = false;
        permissions['canSeeDreamImageToImage'] = false;
        permissions['canSeeDreamTextToVideo'] = false;
        permissions['canSeeDreamImageToVideo'] = false;
        permissions['canKlingTextToVideo'] = false;
        permissions['canKlingImageToVideo'] = false;
        permissions['canKlingMultiImageToVideo'] = false;
        permissions['canKlingMotionControl'] = false;
      }

      // Train Models → training features
      if (!allowedTabs.has('hasTrainingTab')) {
        permissions['canTrainLoRA'] = false;
        permissions['canShareLoRA'] = false;
      }

      // Vault → vault sub-features
      if (!allowedTabs.has('hasVaultTab')) {
        permissions['canShareFolders'] = false;
        permissions['canCreateFolders'] = false;
        permissions['maxVaultFolders'] = 0;
      }

      // Marketplace → marketplace access
      if (!allowedTabs.has('hasMarketplaceTab')) {
        permissions['canAccessMarketplace'] = false;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Build subscription info
    const subscriptionInfo = {
      planName: organization.subscriptionPlan?.name || 'Free',
      planDisplayName: organization.subscriptionPlan?.displayName || 'Free Plan',
      status: organization.subscriptionStatus,
      maxMembers: organization.customMaxMembers || organization.subscriptionPlan?.maxMembers || 1,
      maxProfiles: organization.customMaxProfiles || organization.subscriptionPlan?.maxProfiles || 1,
      maxWorkspaces: organization.customMaxWorkspaces || organization.subscriptionPlan?.maxWorkspaces || 0,
      maxStorageGB: (organization.customMaxStorageGB || organization.subscriptionPlan?.maxStorageGB || 5) + (organization.additionalStorageGB ?? 0),
      monthlyCredits: organization.customMonthlyCredits || organization.subscriptionPlan?.monthlyCredits || 100,
      currentStorageGB: organization.currentStorageGB,
      creditsUsedThisMonth: organization.creditsUsedThisMonth,
      availableCredits: organization.availableCredits,
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
