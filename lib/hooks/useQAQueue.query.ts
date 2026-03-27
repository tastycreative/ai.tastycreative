'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { boardItemKeys } from './useBoardItems.query';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QAQueueFlyerAsset {
  id: string;
  boardItemId: string | null;
  profileId: string;
  fileName: string;
  fileType: string;
  url: string;
  fileSize: number | null;
  createdAt: string;
}

export interface QAQueueModelProfile {
  id: string;
  name: string;
  profileImageUrl: string | null;
  pageStrategy: string | null;
  modelBible: Record<string, unknown> | null;
}

export interface QAQueueBoardColumn {
  id: string;
  name: string;
  boardId: string;
  position: number;
}

export interface QAQueueComment {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface QAQueueHistoryEntry {
  id: string;
  userId: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface QAQueueItem {
  id: string;
  itemNo: number;
  title: string;
  description: string | null;
  priority: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  columnId: string;
  columnName: string;
  boardId: string;
  spaceId: string;
  spaceSlug: string;
  spaceName: string;
  workflowType: string;
  metadata: Record<string, unknown>;
  media: { id: string; url: string; type: string; name?: string | null; size?: number | null }[];
  _count: { comments: number; media: number };
  modelProfile: QAQueueModelProfile | null;
  flyerAssets: QAQueueFlyerAsset[];
  boardColumns: QAQueueBoardColumn[];
  comments: QAQueueComment[];
  history: QAQueueHistoryEntry[];
}

/* ------------------------------------------------------------------ */
/*  Query keys                                                         */
/* ------------------------------------------------------------------ */

export const qaQueueKeys = {
  all: ['qa-queue'] as const,
  list: () => [...qaQueueKeys.all, 'list'] as const,
};

/* ------------------------------------------------------------------ */
/*  Fetch                                                              */
/* ------------------------------------------------------------------ */

async function fetchQAQueue(): Promise<QAQueueItem[]> {
  const response = await fetch('/api/qa-queue');
  if (!response.ok) {
    throw new Error('Failed to fetch QA queue');
  }
  const data = await response.json();
  return data.items ?? [];
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useQAQueue() {
  const { user } = useUser();

  return useQuery({
    queryKey: qaQueueKeys.list(),
    queryFn: fetchQAQueue,
    enabled: !!user,
    staleTime: 1000 * 30, // 30s — QA queue changes less frequently
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000, // poll every 30s for updates
  });
}

/* ------------------------------------------------------------------ */
/*  QA Review Mutation                                                 */
/* ------------------------------------------------------------------ */

export type QAReviewAction = 'approve' | 'reject_caption' | 'reject_flyer' | 'reject_both';

interface QAReviewInput {
  itemId: string;
  action: QAReviewAction;
  reason?: string;
  qaNotes?: string;
  campaignOrUnlock?: string;
  totalSale?: number;
}

async function performQAReview(input: QAReviewInput) {
  const { itemId, ...body } = input;
  const response = await fetch(`/api/qa-queue/${itemId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to process QA review');
  }
  return response.json();
}

export function useQAReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performQAReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qaQueueKeys.all });
      queryClient.invalidateQueries({ queryKey: boardItemKeys.all });
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Post Comment Mutation                                              */
/* ------------------------------------------------------------------ */

async function postComment(input: { itemId: string; content: string }) {
  const response = await fetch(`/api/qa-queue/${input.itemId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: input.content }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to post comment');
  }
  return response.json();
}

export function useQAComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qaQueueKeys.all });
    },
  });
}
