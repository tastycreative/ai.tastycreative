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

// Default permissions for solo users (no organization)
const DEFAULT_SOLO_PERMISSIONS: Permissions = {
  // All tabs accessible for solo users
  hasGenerateTab: true,
  hasVaultTab: true,
  hasTrainingTab: true,
  hasInstagramTab: true,
  hasPlanningTab: true,
  hasPipelineTab: true,
  hasAnalyticsTab: true,
  hasFeedTab: true,
  hasMarketplaceTab: true,

  // Generate features
  canTextToImage: true,
  canImageToVideo: true,
  canImageToImage: true,
  canTextToVideo: true,
  canFaceSwap: true,
  canFluxKontext: true,
  canVideoFpsBoost: true,
  canSkinEnhancement: true,

  // Training features
  canTrainLoRA: true,
  canShareLoRA: true,
  canAccessMarketplace: true,

  // Instagram features
  canAutoSchedule: true,
  canBulkUpload: true,
  canCaptionBank: true,
  canHashtagBank: true,
  canStoryPlanner: true,
  canReelPlanner: true,
  canFeedPostPlanner: true,
  canContentPipeline: true,
  canPerformanceMetrics: true,

  // Vault features
  canShareFolders: true,
  canCreateFolders: true,
  maxVaultFolders: 999,

  // Collaboration features
  canApproveContent: true,
  canCommentOnContent: true,
  canAssignTasks: true,
  canMentionTeam: true,

  // Advanced features
  canExportData: true,
  canAccessAPI: false,
  canWhiteLabel: false,
  canCustomBranding: false,
  canWebhooks: false,
};

export function usePermissions(): UsePermissionsReturn {
  const { user } = useUser();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_SOLO_PERMISSIONS);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // If no organization, use default solo permissions
      if (!currentOrganization) {
        setPermissions(DEFAULT_SOLO_PERMISSIONS);
        setSubscriptionInfo(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/organizations/permissions');
        if (response.ok) {
          const data = await response.json();
          setPermissions(data.permissions || DEFAULT_SOLO_PERMISSIONS);
          setSubscriptionInfo(data.subscriptionInfo || null);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions(DEFAULT_SOLO_PERMISSIONS);
      } finally {
        setLoading(false);
      }
    };

    if (!orgLoading) {
      fetchPermissions();
    }
  }, [user, currentOrganization, orgLoading]);

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
