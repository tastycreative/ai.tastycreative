'use client';

import { useQuery } from '@tanstack/react-query';

export const VAULT_FOLDERS_KEY = 'vault-folders';

async function fetchVaultFolders(profileId: string): Promise<any[]> {
  const response = await fetch(`/api/vault/folders?profileId=${profileId}`);
  if (!response.ok) {
    throw new Error('Failed to load vault folders');
  }
  return response.json();
}

export function useVaultFolders(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [VAULT_FOLDERS_KEY, profileId],
    queryFn: () => fetchVaultFolders(profileId!),
    enabled: !!profileId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 15,    // 15 minutes
    refetchOnWindowFocus: false,
  });
}
