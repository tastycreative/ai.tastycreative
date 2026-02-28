'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface CaptionQueueAssignee {
  clerkId: string;
}

export interface CaptionQueueContentItem {
  id: string;
  url: string;
  sourceType: string;
  fileName?: string | null;
  fileType?: string | null;
  sortOrder: number;
  captionText?: string | null;
}

export interface CaptionQueueItem {
  id: string;
  clerkId: string;
  organizationId: string | null;
  profileId: string | null;
  modelName: string;
  modelAvatar: string;
  profileImageUrl: string | null;
  description: string;
  contentTypes: string[];
  messageTypes: string[];
  urgency: string;
  releaseDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: string | null;
  completedAt: string | null;
  captionText: string | null;
  contentUrl?: string | null;
  contentSourceType?: string | null;
  sortOrder?: number;
  /** Creators assigned to this ticket */
  assignees: CaptionQueueAssignee[];
  /** Individual content pieces, each with its own caption */
  contentItems: CaptionQueueContentItem[];
}



async function fetchCaptionQueue(): Promise<CaptionQueueItem[]> {
  const response = await fetch('/api/caption-queue');
  if (!response.ok) {
    throw new Error('Failed to fetch caption queue');
  }
  const data = await response.json();
  return data.items || [];
}

async function deleteQueueItem(id: string): Promise<void> {
  const response = await fetch(`/api/caption-queue/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete queue item');
  }
}

async function updateQueueItem(params: { id: string; data: Partial<CaptionQueueItem> }): Promise<CaptionQueueItem> {
  const response = await fetch(`/api/caption-queue/${params.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.data),
  });
  if (!response.ok) {
    throw new Error('Failed to update queue item');
  }
  const result = await response.json();
  return result.item;
}

async function reorderQueueItems(items: Array<{ id: string; sortOrder: number }>): Promise<void> {
  const response = await fetch('/api/caption-queue/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) {
    throw new Error('Failed to reorder queue items');
  }
}

export function useCaptionQueue() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['caption-queue', user?.id],
    queryFn: fetchCaptionQueue,
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    // Order is handled server-side (personal per-user sort via CaptionQueueUserOrder).
    // Do not re-sort here so that the server's order is respected and optimistic
    // drag-and-drop reorders are rendered immediately without being reversed.
  });
}

export function useDeleteQueueItem() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: deleteQueueItem,
    // Optimistic update
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['caption-queue', user?.id] });

      // Snapshot the previous value
      const previousItems = queryClient.getQueryData<CaptionQueueItem[]>(['caption-queue', user?.id]);

      // Optimistically update to the new value
      queryClient.setQueryData<CaptionQueueItem[]>(
        ['caption-queue', user?.id],
        (old) => old?.filter((item) => item.id !== deletedId) ?? []
      );

      // Return context with snapshot
      return { previousItems };
    },
    // If mutation fails, use context to rollback
    onError: (_err, _deletedId, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['caption-queue', user?.id], context.previousItems);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
    },
  });
}

export function useUpdateQueueItem() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: updateQueueItem,
    // Optimistic update
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['caption-queue', user?.id] });

      const previousItems = queryClient.getQueryData<CaptionQueueItem[]>(['caption-queue', user?.id]);

      queryClient.setQueryData<CaptionQueueItem[]>(
        ['caption-queue', user?.id],
        (old) =>
          old?.map((item) =>
            item.id === id ? { ...item, ...data } : item
          ) ?? []
      );

      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['caption-queue', user?.id], context.previousItems);
      }
    },
    // Don't refetch on every update - only on error or when explicitly needed
    // This prevents queue reordering during auto-save
  });
}

export function useReorderQueueItems() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: reorderQueueItems,
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ['caption-queue', user?.id] });

      const previousItems = queryClient.getQueryData<CaptionQueueItem[]>(['caption-queue', user?.id]);

      // Create a map of id to new sortOrder
      const orderMap = new Map(newOrder.map((item) => [item.id, item.sortOrder]));

      queryClient.setQueryData<CaptionQueueItem[]>(
        ['caption-queue', user?.id],
        (old) => {
          if (!old) return [];
          return [...old]
            .map((item) => ({
              ...item,
              sortOrder: orderMap.get(item.id) ?? item.sortOrder,
            }))
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        }
      );

      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['caption-queue', user?.id], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
    },
  });
}

/**
 * Mutation to update the captionText of a single CaptionQueueContentItem.
 */
export function useUpdateContentItemCaption() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: async (params: { itemId: string; captionText: string }) => {
      const response = await fetch(`/api/caption-queue/items/${params.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captionText: params.captionText }),
      });
      if (!response.ok) throw new Error('Failed to update item caption');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
    },
  });
}
