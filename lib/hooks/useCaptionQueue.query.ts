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
  // Per-item QA fields
  requiresCaption: boolean;
  captionStatus: string;
  qaRejectionReason?: string | null;
  qaRejectedAt?: string | null;
  qaRejectedBy?: string | null;
  qaApprovedAt?: string | null;
  qaApprovedBy?: string | null;
  revisionCount: number;
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
  boardItemId?: string | null;
  /** Creators assigned to this ticket */
  assignees: CaptionQueueAssignee[];
  /** Individual content pieces, each with its own caption */
  contentItems: CaptionQueueContentItem[];
  /** Reason left by QA when the ticket was rejected (null if never rejected) */
  qaRejectionReason?: string | null;
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

export interface CreateCaptionTicketInput {
  modelName: string;
  modelAvatar: string;
  profileImageUrl?: string | null;
  profileId?: string | null;
  description: string;
  contentTypes: string[];
  messageTypes: string[];
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  releaseDate: string;
  boardItemId?: string | null;
  contentItems?: Array<{
    url: string;
    sourceType: 'upload' | 'gdrive';
    fileName?: string | null;
    fileType?: 'image' | 'video' | null;
    sortOrder?: number;
  }>;
}

async function createCaptionTicket(input: CreateCaptionTicketInput): Promise<CaptionQueueItem> {
  const response = await fetch('/api/caption-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create caption ticket');
  }
  const data = await response.json();
  return data.item;
}

/**
 * Create a new caption queue ticket, e.g. from a wall-post board item.
 * Automatically invalidates the queue list on success.
 */
export function useCreateCaptionTicket() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: createCaptionTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
    },
  });
}

// ─── Push to Caption Workspace (from Wall Post Board) ───────────────

export interface PushToCaptionInput {
  boardItemId: string;
  assignedCreatorClerkIds?: string[];
  urgency?: 'urgent' | 'high' | 'medium' | 'low';
  releaseDate?: string;
  description?: string;
}

async function pushToCaptionWorkspace(
  input: PushToCaptionInput,
): Promise<{ item: CaptionQueueItem; boardItemId: string; wallPostStatus: string }> {
  const response = await fetch('/api/caption-queue/from-board-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to push to Caption Workspace');
  }
  return response.json();
}

/**
 * Push a Wall Post board item to the Caption Workspace.
 * Creates a CaptionQueueTicket from the board item's media and metadata.
 * Invalidates both the caption queue and the board items cache.
 */
export function usePushToCaptionWorkspace() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: pushToCaptionWorkspace,
    onSuccess: (_data, variables) => {
      // Invalidate caption queue
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
      // Invalidate board items so the status badge updates
      queryClient.invalidateQueries({ queryKey: ['boardItems'] });
      // Invalidate the specific board item if there's a cache entry
      queryClient.invalidateQueries({
        queryKey: ['boardItems', 'detail', variables.boardItemId],
      });
    },
  });
}

// ─── QA Approve / Reject ────────────────────────────────────────────

export interface QAActionInput {
  ticketId: string;
  action: 'approve' | 'reject';
  reason?: string;
}

async function performQAAction(
  input: QAActionInput,
): Promise<{ item: CaptionQueueItem; action: string; wallPostStatus: string; reason?: string }> {
  const response = await fetch(`/api/caption-queue/${input.ticketId}/qa`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: input.action, reason: input.reason }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to process QA action');
  }
  return response.json();
}

/**
 * Approve or reject a caption ticket during QA review.
 * - approve → ticket completed, wallPostStatus = COMPLETED
 * - reject  → ticket re-opened, wallPostStatus = REVISION_REQUIRED
 */
export function useQAAction() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: performQAAction,
    onSuccess: () => {
      // Invalidate caption queue
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
      // Invalidate board items so status badges update
      queryClient.invalidateQueries({ queryKey: ['boardItems'] });
    },
  });
}

// ─── Per-Item QA Approve / Reject ───────────────────────────────────

export interface QAItemActionInput {
  ticketId: string;
  items: Array<{
    contentItemId: string;
    action: 'approve' | 'reject' | 'revert';
    reason?: string;
  }>;
}

async function performQAItemAction(
  input: QAItemActionInput,
): Promise<{
  ticket: CaptionQueueItem;
  results: Array<{ contentItemId: string; action: string; captionStatus: string }>;
  ticketStatus: string;
  wallPostStatus: string;
  captionItems?: Array<{
    url: string;
    fileName: string | null;
    captionText: string | null;
    captionStatus: string;
    qaRejectionReason: string | null;
  }>;
}> {
  const response = await fetch(`/api/caption-queue/${input.ticketId}/qa/items`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: input.items }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to process per-item QA action');
  }
  return response.json();
}

/**
 * Approve or reject individual content items during QA review.
 * Supports partial approval — only rejected items go back to the captioner.
 */
export function useQAItemAction() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: performQAItemAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['boardItems'] });
    },
  });
}

// ─── Re-push Rejected Items to Caption Workspace ─────────────────────

async function performRepushRejected(
  ticketId: string,
): Promise<{
  ticket: CaptionQueueItem;
  wallPostStatus: string;
  ticketStatus: string;
  captionItems: Array<{
    contentItemId: string;
    url: string;
    fileName: string | null;
    captionText: string | null;
    captionStatus: string;
    qaRejectionReason: string | null;
  }>;
  repushedCount: number;
}> {
  const response = await fetch(`/api/caption-queue/${ticketId}/qa/repush`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to re-push rejected items');
  }
  return response.json();
}

/**
 * Explicitly re-push rejected items back to the caption workspace.
 * Flips rejected → pending and moves ticket to in_revision.
 */
export function useRepushRejected() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: performRepushRejected,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-queue', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['boardItems'] });
    },
  });
}
