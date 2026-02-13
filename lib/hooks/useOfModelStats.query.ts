'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface OfModelStatsData {
  counts: {
    total: number;
    active: number;
    inactive: number;
    dropped: number;
    pending: number;
  };
  totalAssets: number;
  totalGuaranteedRevenue: number;
  recentModelsCount: number;
  highRevenueCount: number;
  recentModels?: Array<{
    id: string;
    name: string;
    displayName: string;
    slug: string;
    status: string;
    profileImageUrl: string | null;
    createdAt: string;
  }>;
}

interface StatsResponse {
  data: OfModelStatsData;
}

async function fetchOfModelStats(): Promise<OfModelStatsData> {
  const response = await fetch('/api/of-models/stats');

  if (!response.ok) {
    throw new Error('Failed to fetch OF model stats');
  }

  const result: StatsResponse = await response.json();
  return result.data;
}

export function useOfModelStats() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['of-model-stats'],
    queryFn: fetchOfModelStats,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes (stats don't change as frequently)
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
