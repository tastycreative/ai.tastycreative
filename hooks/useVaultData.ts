import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { convertS3ToCdnUrl } from '@/lib/cdnUtils';

// ==================== Types ====================

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault?: boolean;
  hasShares?: boolean;
  isOwnedProfile?: boolean;
  ownerName?: string | null;
  parentId?: string | null;
  subfolders?: Array<{ id: string }>;
  organizationSlug?: string | null;
  order?: number;
}

interface SharedVaultFolder {
  id: string;
  folderId: string;
  folderName: string;
  profileId: string;
  profileName: string;
  profileUsername?: string | null;
  profileImageUrl?: string | null;
  isDefault: boolean;
  itemCount: number;
  permission: 'VIEW' | 'EDIT';
  sharedBy: string;
  ownerClerkId: string;
  ownerName: string;
  ownerImageUrl?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Url: string;
  createdAt: Date;
  updatedAt: Date;
  folderId: string;
  profileId: string;
  metadata?: any | null;
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

// ==================== Query Keys ====================

export const vaultKeys = {
  all: ['vault'] as const,
  folders: (profileId?: string, organizationSlug?: string | null) => 
    ['vault', 'folders', profileId, organizationSlug] as const,
  items: (profileId?: string, folderId?: string, organizationSlug?: string | null, sharedFolderId?: string) => 
    ['vault', 'items', profileId, folderId, organizationSlug, sharedFolderId] as const,
  sharedFolders: () => ['vault', 'sharedFolders'] as const,
};

// ==================== Hooks ====================

/**
 * Hook to fetch folders for a specific profile with caching
 */
export function useVaultFolders(profileId: string | null | undefined, organizationSlug?: string | null) {
  return useQuery({
    queryKey: vaultKeys.folders(profileId || undefined, organizationSlug),
    queryFn: async (): Promise<VaultFolder[]> => {
      if (!profileId) return [];
      
      const url = organizationSlug
        ? `/api/vault/folders?profileId=${profileId}&organizationSlug=${organizationSlug}`
        : `/api/vault/folders?profileId=${profileId}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load folders');
      
      return response.json();
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch items for a specific folder/profile with caching
 */
export function useVaultItems(
  profileId: string | null | undefined,
  folderId?: string | null,
  organizationSlug?: string | null,
  sharedFolderId?: string
) {
  return useQuery({
    queryKey: vaultKeys.items(
      profileId || undefined,
      folderId || undefined,
      organizationSlug,
      sharedFolderId
    ),
    queryFn: async (): Promise<VaultItem[]> => {
      // Handle shared folder query
      if (sharedFolderId) {
        const response = await fetch(`/api/vault/items?sharedFolderId=${sharedFolderId}`);
        if (!response.ok) throw new Error('Failed to load shared folder items');
        
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          awsS3Url: convertS3ToCdnUrl(item.awsS3Url),
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }));
      }

      // Handle "all profiles" view
      if (profileId === 'all') {
        const url = organizationSlug
          ? `/api/vault/items?profileId=all&organizationSlug=${organizationSlug}`
          : '/api/vault/items?profileId=all';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load items');
        
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          awsS3Url: convertS3ToCdnUrl(item.awsS3Url),
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }));
      }

      // Handle normal profile + folder query
      if (!profileId) return [];

      const url = organizationSlug
        ? `/api/vault/items?profileId=${profileId}&organizationSlug=${organizationSlug}`
        : `/api/vault/items?profileId=${profileId}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load items');

      const data = await response.json();
      return data.map((item: any) => ({
        ...item,
        awsS3Url: convertS3ToCdnUrl(item.awsS3Url),
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      }));
    },
    enabled: !!profileId || !!sharedFolderId,
    staleTime: 3 * 60 * 1000, // 3 minutes (items may update more frequently)
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch shared folders with caching
 */
export function useSharedFolders() {
  return useQuery({
    queryKey: vaultKeys.sharedFolders(),
    queryFn: async (): Promise<SharedVaultFolder[]> => {
      const response = await fetch('/api/vault/folders/shared');
      if (!response.ok) throw new Error('Failed to load shared folders');

      const data = await response.json();
      return data.shares.map((share: any) => ({
        ...share,
        createdAt: new Date(share.createdAt),
        updatedAt: new Date(share.updatedAt),
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to create a new folder with automatic cache invalidation
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      profileId: string;
      name: string;
      isDefault?: boolean;
      organizationSlug?: string | null;
    }) => {
      const response = await fetch('/api/vault/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) throw new Error('Failed to create folder');
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate folders cache for this profile
      queryClient.invalidateQueries({
        queryKey: vaultKeys.folders(variables.profileId, variables.organizationSlug),
      });
      // Also invalidate "all" folders if applicable
      queryClient.invalidateQueries({
        queryKey: vaultKeys.folders('all', variables.organizationSlug),
      });
    },
  });
}

/**
 * Hook to delete items with automatic cache invalidation
 */
export function useDeleteItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const response = await fetch('/api/vault/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });

      if (!response.ok) throw new Error('Failed to delete items');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all items queries to refresh the view
      queryClient.invalidateQueries({
        queryKey: ['vault', 'items'],
      });
    },
  });
}

/**
 * Hook to update folder with automatic cache invalidation
 */
export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      folderId: string;
      name: string;
      organizationSlug?: string | null;
    }) => {
      const response = await fetch(`/api/vault/folders/${params.folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          organizationSlug: params.organizationSlug,
        }),
      });

      if (!response.ok) throw new Error('Failed to update folder');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all folder queries
      queryClient.invalidateQueries({
        queryKey: ['vault', 'folders'],
      });
    },
  });
}

/**
 * Hook to delete folder with automatic cache invalidation
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      folderId: string;
      organizationSlug?: string | null;
    }) => {
      const url = params.organizationSlug
        ? `/api/vault/folders/${params.folderId}?organizationSlug=${params.organizationSlug}`
        : `/api/vault/folders/${params.folderId}`;

      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete folder');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all folder and item queries
      queryClient.invalidateQueries({
        queryKey: ['vault', 'folders'],
      });
      queryClient.invalidateQueries({
        queryKey: ['vault', 'items'],
      });
    },
  });
}

/**
 * Hook to manually invalidate vault caches (useful after uploads)
 */
export function useInvalidateVaultCache() {
  const queryClient = useQueryClient();

  return {
    invalidateFolders: (profileId?: string, organizationSlug?: string | null) => {
      if (profileId) {
        queryClient.invalidateQueries({
          queryKey: vaultKeys.folders(profileId, organizationSlug),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ['vault', 'folders'],
        });
      }
    },
    invalidateItems: (profileId?: string, folderId?: string, organizationSlug?: string | null) => {
      if (profileId || folderId) {
        queryClient.invalidateQueries({
          queryKey: vaultKeys.items(profileId, folderId, organizationSlug),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ['vault', 'items'],
        });
      }
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({
        queryKey: ['vault'],
      });
    },
  };
}
