/**
 * Lightweight hook to check storage availability before generation
 * Uses cached data from permissions/billing info to avoid expensive queries
 */

import { usePermissions } from './usePermissions.query';
import { useBillingInfo } from './useBilling.query';

export interface StorageStatus {
  isStorageFull: boolean;
  currentGB: number;
  maxGB: number;
  availableGB: number;
  percentageUsed: number;
  loading: boolean;
  /**
   * Check if there's enough space for an estimated file size
   * @param estimatedSizeGB - Estimated size in GB (e.g., 0.01 for 10MB)
   */
  hasSpaceFor: (estimatedSizeGB: number) => boolean;
  /**
   * Refresh storage data from the server
   */
  refresh: () => void;
}

export function useStorageCheck(): StorageStatus {
  const { subscriptionInfo, loading: permissionsLoading, hasReachedLimit } = usePermissions();
  const { data: billingInfo, isLoading: billingLoading, refetch } = useBillingInfo();

  // Get storage data from billing info (more accurate) or fall back to subscription info
  const currentGB = billingInfo?.usage?.storage?.current ?? subscriptionInfo?.currentStorageGB ?? 0;
  const maxGB = billingInfo?.usage?.storage?.max ?? subscriptionInfo?.maxStorageGB ?? 5;
  const availableGB = Math.max(0, maxGB - currentGB);
  const percentageUsed = maxGB > 0 ? (currentGB / maxGB) * 100 : 0;

  // Check if storage is full (>= 100% or using hasReachedLimit)
  const isStorageFull = hasReachedLimit('storage') || currentGB >= maxGB;

  const loading = permissionsLoading || billingLoading;

  const hasSpaceFor = (estimatedSizeGB: number): boolean => {
    if (loading) return true; // Assume space is available while loading
    return availableGB >= estimatedSizeGB;
  };

  const refresh = () => {
    refetch();
  };

  return {
    isStorageFull,
    currentGB,
    maxGB,
    availableGB,
    percentageUsed,
    loading,
    hasSpaceFor,
    refresh,
  };
}

/**
 * Estimated file sizes in GB for different generation types
 * These are rough estimates used for pre-generation checks
 */
export const ESTIMATED_FILE_SIZES = {
  // Images (in GB)
  image2K: 0.002, // ~2MB
  image4K: 0.008, // ~8MB
  imageAverage: 0.005, // ~5MB

  // Videos (in GB)
  videoShort: 0.02, // ~20MB for short clips
  videoMedium: 0.05, // ~50MB for medium videos
  videoLong: 0.1, // ~100MB for longer videos
  videoHD: 0.15, // ~150MB for HD videos

  // Audio
  audioShort: 0.005, // ~5MB
  audioLong: 0.02, // ~20MB
};

/**
 * Get estimated storage needed for a generation job
 */
export function getEstimatedStorageNeeded(
  generationType: string,
  options?: {
    resolution?: '2K' | '4K';
    imageCount?: number;
    videoDuration?: number; // in seconds
  }
): number {
  const count = options?.imageCount ?? 1;
  
  switch (generationType) {
    case 'text-to-image':
    case 'image-to-image':
    case 'style-transfer':
    case 'skin-enhancer':
    case 'face-swap':
    case 'flux-kontext':
      const sizePerImage = options?.resolution === '4K' 
        ? ESTIMATED_FILE_SIZES.image4K 
        : ESTIMATED_FILE_SIZES.image2K;
      return sizePerImage * count;

    case 'text-to-video':
    case 'image-to-video':
      // Estimate based on duration if provided
      if (options?.videoDuration) {
        // Roughly 5MB per second of video
        return (options.videoDuration * 0.005);
      }
      return ESTIMATED_FILE_SIZES.videoMedium;

    case 'fps-boost':
      return ESTIMATED_FILE_SIZES.videoHD;

    case 'ai-voice':
      return ESTIMATED_FILE_SIZES.audioShort;

    default:
      return ESTIMATED_FILE_SIZES.imageAverage;
  }
}
