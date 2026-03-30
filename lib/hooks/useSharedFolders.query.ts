'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useOrganization } from './useOrganization.query';

// Types
export interface SharedFolder {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  itemCount: number;
  permission: 'VIEW' | 'USE' | 'EDIT';
  sharedBy: string;
  organizationId: string;
  orgTeamId: string | null;
  createdAt: string;
}

export interface FolderShare {
  id: string;
  folderId: string;
  organizationId: string;
  sharedByClerkId: string;
  permission: 'VIEW' | 'USE' | 'EDIT';
  orgTeamId: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  } | null;
  orgTeam: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface OrgTeam {
  id: string;
  name: string;
  color: string | null;
}

// Query keys
export const sharedFolderKeys = {
  all: ['shared-folders'] as const,
  list: (orgId?: string) => [...sharedFolderKeys.all, 'list', orgId] as const,
  items: (folderId: string) => [...sharedFolderKeys.all, 'items', folderId] as const,
  folderShares: (folderId: string) => [...sharedFolderKeys.all, 'folder-shares', folderId] as const,
  orgTeams: (orgId: string) => ['org-teams', orgId] as const,
};

// Fetch shared folders available to the current user
async function fetchSharedFolders(organizationId?: string) {
  const params = new URLSearchParams();
  if (organizationId) params.set('organizationId', organizationId);

  const response = await fetch(`/api/reference-bank/shared?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch shared folders');
  return response.json();
}

// Fetch items from a shared folder
async function fetchSharedFolderItems(folderId: string) {
  const response = await fetch(`/api/reference-bank/shared?folderId=${folderId}`);
  if (!response.ok) throw new Error('Failed to fetch shared folder items');
  return response.json();
}

// Fetch existing shares for a folder (owner view)
async function fetchFolderShares(folderId: string): Promise<{ shares: FolderShare[] }> {
  const response = await fetch(`/api/reference-bank/folders/${folderId}/share`);
  if (!response.ok) throw new Error('Failed to fetch folder shares');
  return response.json();
}

// Fetch org teams
async function fetchOrgTeams(orgId: string): Promise<{ teams: OrgTeam[] }> {
  const response = await fetch(`/api/organizations/${orgId}/teams`);
  if (!response.ok) throw new Error('Failed to fetch teams');
  return response.json();
}

/** Hook: list shared folders available to the current user */
export function useSharedFolders() {
  const { user } = useUser();
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: sharedFolderKeys.list(currentOrganization?.id),
    queryFn: () => fetchSharedFolders(currentOrganization?.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/** Hook: fetch items from a specific shared folder */
export function useSharedFolderItems(folderId: string | null) {
  return useQuery({
    queryKey: sharedFolderKeys.items(folderId || ''),
    queryFn: () => fetchSharedFolderItems(folderId!),
    enabled: !!folderId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

/** Hook: get existing shares for a folder (owner managing shares) */
export function useFolderShares(folderId: string | null) {
  return useQuery({
    queryKey: sharedFolderKeys.folderShares(folderId || ''),
    queryFn: () => fetchFolderShares(folderId!),
    enabled: !!folderId,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: false,
  });
}

/** Hook: get org teams for sharing */
export function useOrgTeams(orgId: string | null) {
  return useQuery({
    queryKey: sharedFolderKeys.orgTeams(orgId || ''),
    queryFn: () => fetchOrgTeams(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/** Mutation: share a folder */
export function useShareFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folderId,
      organizationId,
      orgTeamId,
      permission,
    }: {
      folderId: string;
      organizationId: string;
      orgTeamId?: string | null;
      permission?: 'VIEW' | 'USE' | 'EDIT';
    }) => {
      const response = await fetch(`/api/reference-bank/folders/${folderId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, orgTeamId, permission }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to share folder');
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: sharedFolderKeys.folderShares(variables.folderId),
      });
      queryClient.invalidateQueries({ queryKey: sharedFolderKeys.all });
    },
  });
}

/** Mutation: remove a share */
export function useUnshareFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folderId,
      shareId,
    }: {
      folderId: string;
      shareId: string;
    }) => {
      const response = await fetch(
        `/api/reference-bank/folders/${folderId}/share?shareId=${shareId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to remove share');
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: sharedFolderKeys.folderShares(variables.folderId),
      });
      queryClient.invalidateQueries({ queryKey: sharedFolderKeys.all });
    },
  });
}
