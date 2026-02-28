'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface OrgCreator {
  id: string;
  clerkId: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}

async function fetchOrgCreators(): Promise<OrgCreator[]> {
  const response = await fetch('/api/caption-queue/creators');
  if (!response.ok) {
    throw new Error('Failed to fetch creators');
  }
  const data = await response.json();
  return data.creators ?? [];
}

/**
 * Fetches all CREATOR-role members in the current user's organization.
 * Only usable by OWNER / ADMIN / MANAGER (enforced on the server).
 */
export function useOrgCreators(enabled = true) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['org-creators', user?.id],
    queryFn: fetchOrgCreators,
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}
