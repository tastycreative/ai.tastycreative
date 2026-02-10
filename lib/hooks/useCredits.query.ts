'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface CreditsInfo {
  availableCredits: number;
  organizationName: string;
  organizationId: string;
  isLowCredits: boolean;
  isOutOfCredits: boolean;
}

async function fetchCredits(): Promise<CreditsInfo> {
  const response = await fetch('/api/credits/check');
  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }
  return response.json();
}

export function useCredits() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: fetchCredits,
    enabled: !!user,
    // staleTime: 1000 * 30, // 30 seconds - check frequently for credits
    // gcTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    // refetchInterval: 1000 * 60, // Refetch every minute
  });

  /**
   * Refresh credit balance and organization data
   * Call this after any action that modifies credits (generation, purchase, etc.)
   */
  const refreshCredits = () => {
    queryClient.invalidateQueries({ queryKey: ['credits'] });
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
  };

  return {
    ...query,
    refreshCredits,
    availableCredits: query.data?.availableCredits ?? 0,
    isLowCredits: query.data?.isLowCredits ?? false,
    isOutOfCredits: query.data?.isOutOfCredits ?? false,
  };
}
