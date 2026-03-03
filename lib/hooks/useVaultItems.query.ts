'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface VaultItemMetadata {
  source?: string;
  generationType?: string;
  model?: string;
  prompt?: string;
  size?: string;
  resolution?: string;
  aspectRatio?: string;
  watermark?: boolean;
  numReferenceImages?: number;
  referenceImageUrl?: string | null;
  referenceImageUrls?: string[];
  referenceVideoUrl?: string | null;
  sourceImageUrls?: string[];
  imageUrl?: string | null;
  generatedAt?: string;
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  sampler?: string;
  generatedByClerkId?: string;
  generatedByName?: string;
  generatedByImageUrl?: string | null;
  [key: string]: any;
}

export interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Url: string;
  createdAt: Date;
  updatedAt: Date;
  folderId: string;
  profileId: string;
  metadata?: VaultItemMetadata | null;
  deletedAt?: Date | null;
  deletedFromFolderId?: string | null;
  creatorName?: string;
  creatorId?: string;
  folder?: {
    id: string;
    name: string;
    isDefault?: boolean;
    deletedAt?: Date | null;
  };
  profile?: {
    id: string;
    name: string;
    instagramUsername?: string | null;
  };
  // Trash-specific enrichment fields
  daysSinceDeleted?: number;
  daysRemaining?: number;
  originalFolderName?: string;
  originalFolderExists?: boolean;
}

interface FetchVaultItemsParams {
  profileId: string;
  organizationSlug?: string;
  sharedFolderId?: string;
}

async function fetchVaultItems({
  profileId,
  organizationSlug,
  sharedFolderId,
}: FetchVaultItemsParams): Promise<VaultItem[]> {
  let url: string;

  if (sharedFolderId) {
    url = `/api/vault/items?sharedFolderId=${sharedFolderId}`;
  } else if (profileId === 'all') {
    url = organizationSlug
      ? `/api/vault/items?profileId=all&organizationSlug=${organizationSlug}`
      : '/api/vault/items?profileId=all';
  } else {
    url = organizationSlug
      ? `/api/vault/items?profileId=${profileId}&organizationSlug=${organizationSlug}`
      : `/api/vault/items?profileId=${profileId}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load vault items');
  }

  const data = await response.json();
  return data.map((item: any) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  }));
}

/**
 * Hook to fetch vault items with automatic caching
 * Data is cached by profileId, so switching folders won't cause refetch
 */
export function useVaultItems(
  profileId: string | null,
  organizationSlug?: string,
  options?: {
    enabled?: boolean;
  }
) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['vault', 'items', profileId, organizationSlug, user?.id],
    queryFn: () =>
      fetchVaultItems({
        profileId: profileId!,
        organizationSlug,
      }),
    enabled: !!user && !!profileId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
    gcTime: 1000 * 60 * 10, // 10 minutes - cache retention
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

/**
 * Hook to fetch shared folder items with automatic caching
 */
export function useSharedFolderItems(
  sharedFolderId: string | null,
  options?: {
    enabled?: boolean;
  }
) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['vault', 'shared-items', sharedFolderId, user?.id],
    queryFn: () =>
      fetchVaultItems({
        profileId: '', // Not used for shared folders
        sharedFolderId: sharedFolderId!,
      }),
    enabled: !!user && !!sharedFolderId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

export interface ContentCreator {
  id: string;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface ContentCreatorData {
  contentCreators: ContentCreator[];
  items: VaultItem[];
  selectedContentCreator: ContentCreator | null;
  folders: Array<{
    id: string;
    name: string;
    profileId: string;
    isDefault: boolean;
    itemCount: number;
    profileName: string;
  }>;
  profiles: Array<{
    id: string;
    name: string;
    instagramUsername?: string | null;
  }>;
}

async function fetchContentCreatorItems(
  creatorId?: string
): Promise<ContentCreatorData> {
  const url = creatorId
    ? `/api/vault/admin/content-creator-items?contentCreatorId=${creatorId}`
    : '/api/vault/admin/content-creator-items';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch content creator items');
  }

  const data = await response.json();
  return {
    contentCreators: data.contentCreators || [],
    items: (data.items || []).map((item: any) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
    selectedContentCreator: data.selectedContentCreator || null,
    folders: data.folders || [],
    profiles: data.profiles || [],
  };
}

/**
 * Hook to fetch content creator items (admin only) with automatic caching
 * Data is cached by creatorId, so switching folders won't cause refetch
 */
export function useContentCreatorItems(
  creatorId?: string,
  options?: {
    enabled?: boolean;
  }
) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['vault', 'creator-items', creatorId, user?.id],
    queryFn: () => fetchContentCreatorItems(creatorId),
    enabled: !!user && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
    gcTime: 1000 * 60 * 10, // 10 minutes - cache retention
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch trashed items for the Trash Bin view
 */
export interface TrashItem extends VaultItem {
  daysSinceDeleted: number;
  daysRemaining: number;
  originalFolderName: string;
  originalFolderExists: boolean;
}

async function fetchTrashItems(profileId?: string | null): Promise<TrashItem[]> {
  const url = profileId && profileId !== 'all'
    ? `/api/vault/trash?profileId=${profileId}`
    : '/api/vault/trash';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load trash items');
  }

  const data = await response.json();
  return data.map((item: any) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
  }));
}

export function useTrashItems(profileId?: string | null) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['vault', 'trash', profileId, user?.id],
    queryFn: () => fetchTrashItems(profileId),
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to restore items from trash
 */
export function useRestoreTrashItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const response = await fetch('/api/vault/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });
      if (!response.ok) throw new Error('Failed to restore items');
      return response.json();
    },
    onSuccess: () => {
      // API is done — now sync with server for consistency
      // Use refetch instead of invalidate to avoid flicker
      queryClient.invalidateQueries({ queryKey: ['vault', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['vault', 'trash'] });
    },
  });
}

/**
 * Hook to permanently delete items from trash
 */
export function usePermanentlyDeleteTrashItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const response = await fetch('/api/vault/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });
      if (!response.ok) throw new Error('Failed to permanently delete items');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'trash'] });
    },
  });
}

/**
 * Hook to empty entire trash
 */
export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/vault/trash/empty', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to empty trash');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

/**
 * Hook to restore a folder from trash
 */
export function useRestoreTrashFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      const response = await fetch('/api/vault/trash/folders/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      if (!response.ok) throw new Error('Failed to restore folder');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

/**
 * Hook to invalidate vault items cache after mutations
 */
export function useInvalidateVaultItems() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
    invalidateProfile: (profileId: string) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'items', profileId] });
    },
    invalidateShared: (sharedFolderId: string) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'shared-items', sharedFolderId] });
    },
    invalidateCreator: (creatorId?: string) => {
      if (creatorId) {
        queryClient.invalidateQueries({ queryKey: ['vault', 'creator-items', creatorId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['vault', 'creator-items'] });
      }
    },
    invalidateTrash: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'trash'] });
    },
    /**
     * Optimistically remove items from cache so they disappear instantly,
     * then invalidate in the background for a fresh server fetch.
     */
    optimisticRemoveItems: (itemIds: string[]) => {
      const idSet = new Set(itemIds);
      queryClient.setQueriesData<VaultItem[]>(
        { queryKey: ['vault', 'items'] },
        (old) => old ? old.filter((item) => !idSet.has(item.id)) : [],
      );
      queryClient.setQueriesData<VaultItem[]>(
        { queryKey: ['vault', 'shared-items'] },
        (old) => old ? old.filter((item) => !idSet.has(item.id)) : [],
      );
    },
    /**
     * Optimistically move items from trash cache back into vault items cache
     * so they appear instantly in both views without a server round-trip.
     * Does NOT invalidate — the mutation's onSuccess handles that after the API completes.
     */
    optimisticRestoreItems: (itemIds: string[]) => {
      const idSet = new Set(itemIds);

      // 1. Grab the full item data from trash cache before removing
      const restoredItems: VaultItem[] = [];
      const allTrashData = queryClient.getQueriesData<TrashItem[]>({
        queryKey: ['vault', 'trash'],
      });
      for (const [, data] of allTrashData) {
        if (data) {
          restoredItems.push(
            ...data
              .filter((item) => idSet.has(item.id))
              .map(({ daysSinceDeleted, daysRemaining, originalFolderName, originalFolderExists, deletedAt, deletedFromFolderId, ...rest }) => ({
                ...rest,
                deletedAt: null,
                deletedFromFolderId: null,
              })),
          );
        }
      }

      // 2. Remove from trash cache instantly
      queryClient.setQueriesData<TrashItem[]>(
        { queryKey: ['vault', 'trash'] },
        (old) => old ? old.filter((item) => !idSet.has(item.id)) : [],
      );

      // 3. Inject restored items into vault items cache (all matching queries)
      if (restoredItems.length > 0) {
        queryClient.setQueriesData<VaultItem[]>(
          { queryKey: ['vault', 'items'] },
          (old) => {
            if (!old) return restoredItems;
            const existingIds = new Set(old.map((i) => i.id));
            const newItems = restoredItems.filter((i) => !existingIds.has(i.id));
            return [...newItems, ...old];
          },
        );
      }
      // No invalidation here — wait for the API to finish first
    },
  };
}
