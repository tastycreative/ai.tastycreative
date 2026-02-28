'use client';

import { useQuery } from '@tanstack/react-query';

export const SEEDREAM_I2I_HISTORY_KEY = 'seedream-i2i-history';

async function fetchHistory(apiClient: any, profileId: string | null): Promise<any[]> {
  const url = profileId
    ? `/api/generate/seedream-image-to-image?profileId=${profileId}`
    : '/api/generate/seedream-image-to-image';
  const response = await apiClient.get(url);
  if (!response.ok) {
    throw new Error('Failed to load generation history');
  }
  const data = await response.json();
  const images = data.images || [];
  console.log('📋 Loaded I2I generation history:', images.length, 'images for profile:', profileId);
  return images;
}

export function useSeeDreamI2IHistory(apiClient: any, profileId: string | null | undefined) {
  return useQuery({
    queryKey: [SEEDREAM_I2I_HISTORY_KEY, profileId ?? null],
    queryFn: () => fetchHistory(apiClient, profileId ?? null),
    enabled: !!apiClient,
    staleTime: 1000 * 60 * 2,  // 2 minutes
    gcTime: 1000 * 60 * 5,     // 5 minutes
    refetchOnWindowFocus: false,
  });
}
