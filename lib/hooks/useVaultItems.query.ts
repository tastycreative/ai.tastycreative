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
  creatorName?: string;
  creatorId?: string;
  folder?: {
    id: string;
    name: string;
    isDefault?: boolean;
  };
  profile?: {
    id: string;
    name: string;
    instagramUsername?: string | null;
  };
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
  };
}
