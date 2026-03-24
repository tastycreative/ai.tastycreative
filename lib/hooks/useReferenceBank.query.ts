"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useReferenceBankStore } from "@/lib/reference-bank/store";
import {
  referenceBankAPI,
  type ReferenceItem,
  type ReferenceFolder,
  type Stats,
} from "@/lib/reference-bank/api";
import { registerQueryClient } from "@/lib/reference-bank/queryClientBridge";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const rbKeys = {
  all: ["reference-bank"] as const,
  data: (params: Record<string, unknown>) =>
    [...rbKeys.all, "data", params] as const,
  storage: () => [...rbKeys.all, "storage"] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CacheData = {
  items: ReferenceItem[];
  folders: ReferenceFolder[];
  stats: Stats;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Apply an optimistic patcher to every matching query entry in the cache. */
function patchAllCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  patcher: (data: CacheData) => CacheData
): Array<[unknown, unknown]> {
  const snapshots = queryClient.getQueriesData<CacheData>({
    queryKey: rbKeys.all,
  });
  snapshots.forEach(([key, data]) => {
    if (data?.items) {
      queryClient.setQueryData(key, patcher(data));
    }
  });
  return snapshots as Array<[unknown, unknown]>;
}

function rollback(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: Array<[unknown, unknown]>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshots.forEach(([key, data]) => queryClient.setQueryData(key as any, data));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Main data query — automatically refetches when filter state in the Zustand
 * store changes (filter values are encoded in the query key) and caches the
 * result so navigating away and back within staleTime skips the loading state.
 */
export function useReferenceBankData() {
  const queryClient = useQueryClient();

  // Register the queryClient in the bridge once (stable ref after first call)
  useEffect(() => {
    registerQueryClient(queryClient);
  }, [queryClient]);

  const selectedFolderId = useReferenceBankStore((s) => s.selectedFolderId);
  const showFavoritesOnly = useReferenceBankStore((s) => s.showFavoritesOnly);
  const showRecentlyUsed = useReferenceBankStore((s) => s.showRecentlyUsed);
  const filterType = useReferenceBankStore((s) => s.filterType);
  const searchQuery = useReferenceBankStore((s) => s.searchQuery);

  const params = {
    folderId: selectedFolderId,
    favorites: showFavoritesOnly,
    fileType: filterType,
    search: searchQuery,
    recentlyUsed: showRecentlyUsed,
  };

  return useQuery({
    queryKey: rbKeys.data(params as Record<string, unknown>),
    queryFn: () => referenceBankAPI.fetchData(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    // Keep showing previous data while new data loads (avoids flash)
    placeholderData: (prev) => prev,
  });
}

/** Storage-quota query — fetched once and cached for 5 minutes. */
export function useStorageQuotaQuery() {
  return useQuery({
    queryKey: rbKeys.storage(),
    queryFn: () => referenceBankAPI.getStorageQuota(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      referenceBankAPI.updateItem(id, { isFavorite }),
    onMutate: async ({ id, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: rbKeys.all });
      const snapshots = patchAllCaches(queryClient, (d) => ({
        ...d,
        items: d.items.map((i) => (i.id === id ? { ...i, isFavorite } : i)),
        stats: {
          ...d.stats,
          favorites: d.stats.favorites + (isFavorite ? 1 : -1),
        },
      }));
      return { snapshots };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshots) rollback(queryClient, ctx.snapshots);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rbKeys.all }),
  });
}

export function useDeleteItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => referenceBankAPI.deleteItem(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: rbKeys.all });
      const snapshots = patchAllCaches(queryClient, (d) => ({
        ...d,
        items: d.items.filter((i) => i.id !== id),
        stats: { ...d.stats, total: Math.max(0, d.stats.total - 1) },
      }));
      return { snapshots };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshots) rollback(queryClient, ctx.snapshots);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rbKeys.all }),
  });
}

export function useUpdateItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof referenceBankAPI.updateItem>[1];
    }) => referenceBankAPI.updateItem(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: rbKeys.all });
      const snapshots = patchAllCaches(queryClient, (d) => ({
        ...d,
        items: d.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
      return { snapshots };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshots) rollback(queryClient, ctx.snapshots);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rbKeys.all }),
  });
}

export function useMoveItemsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemIds,
      targetFolderId,
    }: {
      itemIds: string[];
      targetFolderId: string | null;
    }) => referenceBankAPI.bulkMove(itemIds, targetFolderId),
    onMutate: async ({ itemIds, targetFolderId }) => {
      await queryClient.cancelQueries({ queryKey: rbKeys.all });

      // Collect the items being moved from any cache entry (deduplicated)
      const allCached = queryClient.getQueriesData<CacheData>({ queryKey: rbKeys.all });
      const movingItems = new Map<string, ReferenceItem>();
      allCached.forEach(([, d]) => {
        d?.items?.forEach((i) => {
          if (itemIds.includes(i.id) && !movingItems.has(i.id)) {
            movingItems.set(i.id, i);
          }
        });
      });

      // Standard patch: update folderId on moved items across every cache entry
      const snapshots = patchAllCaches(queryClient, (d) => ({
        ...d,
        items: d.items.map((i) =>
          itemIds.includes(i.id) ? { ...i, folderId: targetFolderId } : i
        ),
      }));

      // Also inject moved items into the target folder's cache entry so that
      // navigating there shows the result immediately (no wait for refetch)
      allCached.forEach(([key]) => {
        const params = (key as unknown[])[2] as Record<string, unknown> | undefined;
        if (params?.folderId !== targetFolderId) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const current = queryClient.getQueryData<CacheData>(key as any);
        if (!current?.items) return;
        const existingIds = new Set(current.items.map((i) => i.id));
        const toAdd = [...movingItems.values()]
          .filter((i) => !existingIds.has(i.id))
          .map((i) => ({ ...i, folderId: targetFolderId }));
        if (toAdd.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          queryClient.setQueryData(key as any, {
            ...current,
            items: [...current.items, ...toAdd],
          });
        }
      });

      return { snapshots };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshots) rollback(queryClient, ctx.snapshots);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rbKeys.all }),
  });
}

export function useBulkDeleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) =>
      Promise.all(itemIds.map((id) => referenceBankAPI.deleteItem(id))),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: rbKeys.all });
      const snapshots = patchAllCaches(queryClient, (d) => ({
        ...d,
        items: d.items.filter((i) => !itemIds.includes(i.id)),
        stats: {
          ...d.stats,
          total: Math.max(0, d.stats.total - itemIds.length),
        },
      }));
      return { snapshots };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshots) rollback(queryClient, ctx.snapshots);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rbKeys.all }),
  });
}

export function useBulkFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemIds,
      isFavorite,
    }: {
      itemIds: string[];
      isFavorite: boolean;
    }) => referenceBankAPI.bulkFavorite(itemIds, isFavorite),
    onMutate: async ({ itemIds, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: rbKeys.all });
      const snapshots = patchAllCaches(queryClient, (d) => ({
        ...d,
        items: d.items.map((i) =>
          itemIds.includes(i.id) ? { ...i, isFavorite } : i
        ),
      }));
      return { snapshots };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshots) rollback(queryClient, ctx.snapshots);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rbKeys.all }),
  });
}

export function useBulkAddTagsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemIds,
      tags,
    }: {
      itemIds: string[];
      tags: string[];
    }) => referenceBankAPI.bulkAddTags(itemIds, tags),
    onSettled: () => queryClient.invalidateQueries({ queryKey: rbKeys.all }),
  });
}
