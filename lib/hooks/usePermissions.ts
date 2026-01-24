'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { useOrganization } from './useOrganization';

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

interface UsePermissionsReturn {
  permissions: Permissions;
  subscriptionInfo: SubscriptionInfo | null;
  loading: boolean;
  canAccessFeature: (featureKey: keyof Permissions) => boolean;
  hasReachedLimit: (limitType: 'members' | 'profiles' | 'workspaces' | 'storage' | 'credits') => boolean;
}

// Empty permissions - used as initial state while loading
const LOADING_PERMISSIONS: Permissions = {
  // No tabs while loading
  hasGenerateTab: false,
  hasVaultTab: false,
  hasTrainingTab: false,
  hasInstagramTab: false,
  hasPlanningTab: false,
  hasPipelineTab: false,
  hasAnalyticsTab: false,
  hasFeedTab: false,
  hasMarketplaceTab: false,

  // Generate features
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

  // Training features
  canTrainLoRA: false,
  canShareLoRA: false,
  canAccessMarketplace: false,

  // Instagram features
  canAutoSchedule: false,
  canBulkUpload: false,
  canCaptionBank: false,
  canHashtagBank: false,
  canStoryPlanner: false,
  canReelPlanner: false,
  canFeedPostPlanner: false,
  canContentPipeline: false,
  canPerformanceMetrics: false,

  // Vault features
  canShareFolders: false,
  canCreateFolders: false,
  maxVaultFolders: 0,

  // Collaboration features
  canApproveContent: false,
  canCommentOnContent: false,
  canAssignTasks: false,
  canMentionTeam: false,

  // Advanced features
  canExportData: false,
  canAccessAPI: false,
  canWhiteLabel: false,
  canCustomBranding: false,
  canWebhooks: false,
};

// Default permissions for solo users (no organization)
// Only show core account management tabs - users must create/join an organization to access features
const DEFAULT_SOLO_PERMISSIONS: Permissions = {
  // No feature tabs for solo users
  hasGenerateTab: false,
  hasVaultTab: false,
  hasTrainingTab: false,
  hasInstagramTab: false,
  hasPlanningTab: false,
  hasPipelineTab: false,
  hasAnalyticsTab: false,
  hasFeedTab: false,
  hasMarketplaceTab: false,

  // No generate features
  canTextToImage: false,
  canImageToVideo: false,
  canImageToImage: false,
  canTextToVideo: false,
  canFaceSwap: false,
  canFluxKontext: false,
  canVideoFpsBoost: false,
  canSkinEnhancement: false,

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
};

export function usePermissions(): UsePermissionsReturn {
  const { user } = useUser();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  // Start with empty permissions to prevent flash of unauthorized content
  const [permissions, setPermissions] = useState<Permissions>(LOADING_PERMISSIONS);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      console.log('🔄 Fetching permissions...', { userId: user?.id, orgId: currentOrganization?.id, orgLoading, hasInitialized });

      if (!user) {
        console.log('⚠️ No user, stopping permissions fetch');
        setLoading(false);
        setHasInitialized(true);
        return;
      }

      try {
        const response = await fetch('/api/organizations/permissions');
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Permissions API response:', data);
          setPermissions(data.permissions || DEFAULT_SOLO_PERMISSIONS);
          setSubscriptionInfo(data.subscriptionInfo || null);
        } else {
          console.error('❌ Permissions API error:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Error fetching permissions:', error);
        setPermissions(DEFAULT_SOLO_PERMISSIONS);
      } finally {
        setLoading(false);
        setHasInitialized(true);
        console.log('✅ Permissions loading complete');
      }
    };

    // Only fetch permissions after org loading is complete and only once
    console.log('🔍 Permission effect check:', { orgLoading, hasInitialized, willFetch: !orgLoading && !hasInitialized });
    if (!orgLoading && !hasInitialized) {
      fetchPermissions();
    }
  }, [user?.id, currentOrganization?.id, orgLoading, hasInitialized]);

  const canAccessFeature = (featureKey: keyof Permissions): boolean => {
    return Boolean(permissions[featureKey]);
  };

  const hasReachedLimit = (limitType: 'members' | 'profiles' | 'workspaces' | 'storage' | 'credits'): boolean => {
    if (!subscriptionInfo) return false;

    switch (limitType) {
      case 'storage':
        return subscriptionInfo.currentStorageGB >= subscriptionInfo.maxStorageGB;
      case 'credits':
        return subscriptionInfo.creditsUsedThisMonth >= subscriptionInfo.monthlyCredits;
      // For members, profiles, workspaces - would need separate API calls to check current counts
      default:
        return false;
    }
  };

  return {
    permissions,
    subscriptionInfo,
    loading: loading || orgLoading,
    canAccessFeature,
    hasReachedLimit,
  };
}
