'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useOrganization } from './useOrganization.query';

export interface Permissions {
  // Tab Access
  hasGenerateTab: boolean;
  hasVaultTab: boolean;
  hasTrainingTab: boolean;
  hasInstagramTab: boolean;
  hasPlanningTab: boolean;
  hasPipelineTab: boolean;
  hasAnalyticsTab: boolean;
  hasFeedTab: boolean;
  hasMarketplaceTab: boolean;

  // Generate Features
  canTextToImage: boolean;
  canImageToVideo: boolean;
  canImageToImage: boolean;
  canTextToVideo: boolean;
  canFaceSwap: boolean;
  canFluxKontext: boolean;
  canVideoFpsBoost: boolean;
  canSkinEnhancement: boolean;
  canStyleTransfer: boolean;
  canSkinEnhancer: boolean;
  canImageToImageSkinEnhancer: boolean;
  canAIVoice: boolean;

  // SeeDream 4.5 Features
  canSeeDreamTextToImage: boolean;
  canSeeDreamImageToImage: boolean;
  canSeeDreamTextToVideo: boolean;
  canSeeDreamImageToVideo: boolean;

  // Kling AI Features
  canKlingTextToVideo: boolean;
  canKlingImageToVideo: boolean;
  canKlingMultiImageToVideo: boolean;
  canKlingMotionControl: boolean;

  // Training Features
  canTrainLoRA: boolean;
  canShareLoRA: boolean;
  canAccessMarketplace: boolean;

  // Instagram Features
  canAutoSchedule: boolean;
  canBulkUpload: boolean;
  canCaptionBank: boolean;
  canHashtagBank: boolean;
  canStoryPlanner: boolean;
  canReelPlanner: boolean;
  canFeedPostPlanner: boolean;
  canContentPipeline: boolean;
  canPerformanceMetrics: boolean;

  // Vault Features
  canShareFolders: boolean;
  canCreateFolders: boolean;
  maxVaultFolders: number;

  // Collaboration Features
  canApproveContent: boolean;
  canCommentOnContent: boolean;
  canAssignTasks: boolean;
  canMentionTeam: boolean;

  // Advanced Features
  canExportData: boolean;
  canAccessAPI: boolean;
  canWhiteLabel: boolean;
  canCustomBranding: boolean;
  canWebhooks: boolean;
}

export interface SubscriptionInfo {
  planName: string;
  planDisplayName: string;
  status: string;
  maxMembers: number;
  maxProfiles: number;
  maxWorkspaces: number;
  maxStorageGB: number;
  monthlyCredits: number;
  currentStorageGB: number;
  creditsUsedThisMonth: number;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
}

interface PermissionsResponse {
  permissions: Permissions;
  subscriptionInfo: SubscriptionInfo | null;
}

async function fetchPermissions(): Promise<PermissionsResponse> {
  const response = await fetch('/api/organizations/permissions');
  if (!response.ok) {
    throw new Error('Failed to fetch permissions');
  }
  return response.json();
}

// Loading permissions - all features disabled while loading
const LOADING_PERMISSIONS: Permissions = {
  hasGenerateTab: false,
  hasVaultTab: false,
  hasTrainingTab: false,
  hasInstagramTab: false,
  hasPlanningTab: false,
  hasPipelineTab: false,
  hasAnalyticsTab: false,
  hasFeedTab: false,
  hasMarketplaceTab: false,
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
  canTrainLoRA: false,
  canShareLoRA: false,
  canAccessMarketplace: false,
  canAutoSchedule: false,
  canBulkUpload: false,
  canCaptionBank: false,
  canHashtagBank: false,
  canStoryPlanner: false,
  canReelPlanner: false,
  canFeedPostPlanner: false,
  canContentPipeline: false,
  canPerformanceMetrics: false,
  canShareFolders: false,
  canCreateFolders: false,
  maxVaultFolders: 0,
  canApproveContent: false,
  canCommentOnContent: false,
  canAssignTasks: false,
  canMentionTeam: false,
  canExportData: false,
  canAccessAPI: false,
  canWhiteLabel: false,
  canCustomBranding: false,
  canWebhooks: false,
  canAIVoice: false,
};

export function usePermissions() {
  const { user } = useUser();
  const { currentOrganization, loading: orgLoading } = useOrganization();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['permissions', user?.id, currentOrganization?.id],
    queryFn: fetchPermissions,
    enabled: !!user && !orgLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnMount: false, // Don't refetch on mount if we have data
    refetchOnWindowFocus: false,
  });

  const canAccessFeature = (featureKey: keyof Permissions): boolean => {
    return Boolean(data?.permissions[featureKey]);
  };

  const hasReachedLimit = (
    limitType: 'members' | 'profiles' | 'workspaces' | 'storage' | 'credits'
  ): boolean => {
    if (!data?.subscriptionInfo) return false;

    switch (limitType) {
      case 'storage':
        return data.subscriptionInfo.currentStorageGB >= data.subscriptionInfo.maxStorageGB;
      case 'credits':
        return data.subscriptionInfo.creditsUsedThisMonth >= data.subscriptionInfo.monthlyCredits;
      default:
        return false;
    }
  };

  // Show loading permissions while fetching to prevent flash
  const isActuallyLoading = isLoading || orgLoading || (!data && isFetching);

  return {
    permissions: isActuallyLoading ? LOADING_PERMISSIONS : (data?.permissions ?? LOADING_PERMISSIONS),
    subscriptionInfo: data?.subscriptionInfo ?? null,
    loading: isActuallyLoading,
    error,
    canAccessFeature,
    hasReachedLimit,
  };
}
