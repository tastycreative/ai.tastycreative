'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface CaptionQueueItem {
  id: string;
  clerkId: string;
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
}

// Urgency priority mapping for proper sorting
const urgencyPriority: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

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
    select: (data) => {
      // Sort by sortOrder first if exists, then by urgency priority, then by releaseDate
      return [...data].sort((a, b) => {
        // If both have sortOrder, use that
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        
        const urgencyDiff = (urgencyPriority[b.urgency] || 0) - (urgencyPriority[a.urgency] || 0);
        if (urgencyDiff !== 0) return urgencyDiff;
        
        // If same urgency, sort by releaseDate (earliest first)
        return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      });
    },
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
