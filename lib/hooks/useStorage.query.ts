'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface StorageBreakdown {
  organizationId: string;
  totalGB: number;
  totalBytes: number;
  byType: {
    images: { count: number; bytes: number; gb: number };
    videos: { count: number; bytes: number; gb: number };
    vault: { count: number; bytes: number; gb: number };
  };
  byStorage: {
    awsS3: { count: number; bytes: number; gb: number };
    database: { count: number; bytes: number; gb: number };
    other: { count: number; bytes: number; gb: number };
  };
  byUser: Array<{
    userId: string;
    userName: string | null;
    bytes: number;
    gb: number;
    imageCount: number;
    videoCount: number;
    vaultCount: number;
  }>;
}

export interface StorageLimits {
  isWithinLimit: boolean;
  currentGB: number;
  maxGB: number;
  percentageUsed: number;
  bytesRemaining: number;
}

interface StorageData {
  breakdown: StorageBreakdown;
  limits: StorageLimits;
}

async function fetchStorageData(): Promise<StorageData> {
  const response = await fetch('/api/billing/storage');
  if (!response.ok) {
    throw new Error('Failed to fetch storage data');
  }
  return response.json();
}

async function recalculateStorage(): Promise<{
  success: boolean;
  storageGB: number;
  limits: StorageLimits;
  message: string;
}> {
  const response = await fetch('/api/billing/storage/recalculate', {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to recalculate storage');
  }
  return response.json();
}

/**
 * Hook to fetch storage breakdown and limits
 */
export function useStorageData() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['storage', 'data', user?.id],
    queryFn: fetchStorageData,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to recalculate organization storage
 */
export function useRecalculateStorage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recalculateStorage,
    onSuccess: () => {
      // Invalidate storage and billing queries
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}
