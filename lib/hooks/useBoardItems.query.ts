'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/* ------------------------------------------------------------------ */
/*  Types (matching actual schema fields)                              */
/* ------------------------------------------------------------------ */

export interface BoardItemComment {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface BoardItemMedia {
  id: string;
  url: string;
  type: string;
  name?: string | null;
  size?: number | null;
}

export interface BoardItemHistoryEntry {
  id: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string;
  createdAt: string;
}

export interface BoardItem {
  id: string;
  organizationId: string;
  itemNo: number;
  columnId: string;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  position: number;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number; media: number };
}

interface BoardItemsResponse {
  items: BoardItem[];
  columns: { id: string; name: string; color?: string | null; position: number }[];
}

export interface CreateBoardItemInput {
  title: string;
  columnId: string;
  description?: string;
  type?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
  assigneeId?: string;
  dueDate?: string;
}

export interface UpdateBoardItemInput {
  title?: string;
  columnId?: string;
  description?: string;
  priority?: string;
  position?: number;
  metadata?: Record<string, unknown>;
  assigneeId?: string | null;
  dueDate?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Query keys                                                         */
/* ------------------------------------------------------------------ */

export const boardItemKeys = {
  all: ['board-items'] as const,
  lists: () => [...boardItemKeys.all, 'list'] as const,
  list: (boardId: string) => [...boardItemKeys.lists(), boardId] as const,
  details: () => [...boardItemKeys.all, 'detail'] as const,
  detail: (itemId: string) => [...boardItemKeys.details(), itemId] as const,
  comments: (itemId: string) => [...boardItemKeys.all, 'comments', itemId] as const,
  history: (itemId: string) => [...boardItemKeys.all, 'history', itemId] as const,
};

/* ------------------------------------------------------------------ */
/*  Fetch functions                                                    */
/* ------------------------------------------------------------------ */

function itemsUrl(spaceId: string, boardId: string) {
  return `/api/spaces/${spaceId}/boards/${boardId}/items`;
}

async function fetchBoardItems(
  spaceId: string,
  boardId: string,
): Promise<BoardItemsResponse> {
  const res = await fetch(itemsUrl(spaceId, boardId));
  if (!res.ok) throw new Error('Failed to fetch board items');
  return res.json();
}

async function createBoardItem(
  spaceId: string,
  boardId: string,
  input: CreateBoardItemInput,
): Promise<BoardItem> {
  const res = await fetch(itemsUrl(spaceId, boardId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to create item');
  }
  return res.json();
}

async function updateBoardItem(
  spaceId: string,
  boardId: string,
  itemId: string,
  input: UpdateBoardItemInput,
): Promise<BoardItem> {
  const res = await fetch(`${itemsUrl(spaceId, boardId)}/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to update item');
  }
  return res.json();
}

async function deleteBoardItem(
  spaceId: string,
  boardId: string,
  itemId: string,
): Promise<void> {
  const res = await fetch(`${itemsUrl(spaceId, boardId)}/${itemId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete item');
}

async function fetchComments(
  spaceId: string,
  boardId: string,
  itemId: string,
): Promise<{ comments: BoardItemComment[] }> {
  const res = await fetch(
    `${itemsUrl(spaceId, boardId)}/${itemId}/comments`,
  );
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

async function addComment(
  spaceId: string,
  boardId: string,
  itemId: string,
  content: string,
): Promise<BoardItemComment> {
  const res = await fetch(
    `${itemsUrl(spaceId, boardId)}/${itemId}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) throw new Error('Failed to add comment');
  return res.json();
}

async function fetchHistory(
  spaceId: string,
  boardId: string,
  itemId: string,
): Promise<{ history: BoardItemHistoryEntry[] }> {
  const res = await fetch(
    `${itemsUrl(spaceId, boardId)}/${itemId}/history`,
  );
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useBoardItems(
  spaceId: string | undefined,
  boardId: string | undefined,
) {
  return useQuery({
    queryKey: boardItemKeys.list(boardId!),
    queryFn: () => fetchBoardItems(spaceId!, boardId!),
    enabled: !!spaceId && !!boardId,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
}

export function useCreateBoardItem(spaceId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBoardItemInput) =>
      createBoardItem(spaceId, boardId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.list(boardId),
      });
    },
  });
}

export function useUpdateBoardItem(spaceId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      ...input
    }: UpdateBoardItemInput & { itemId: string }) =>
      updateBoardItem(spaceId, boardId, itemId, input),
    onMutate: async ({ itemId, ...input }) => {
      await queryClient.cancelQueries({
        queryKey: boardItemKeys.list(boardId),
      });

      const previous = queryClient.getQueryData<BoardItemsResponse>(
        boardItemKeys.list(boardId),
      );

      if (previous) {
        queryClient.setQueryData<BoardItemsResponse>(
          boardItemKeys.list(boardId),
          {
            ...previous,
            items: previous.items.map((item) =>
              item.id === itemId ? { ...item, ...input } : item,
            ),
          },
        );
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          boardItemKeys.list(boardId),
          context.previous,
        );
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.list(boardId),
      });
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.history(vars.itemId),
      });
    },
  });
}

export function useDeleteBoardItem(spaceId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      deleteBoardItem(spaceId, boardId, itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({
        queryKey: boardItemKeys.list(boardId),
      });

      const previous = queryClient.getQueryData<BoardItemsResponse>(
        boardItemKeys.list(boardId),
      );

      if (previous) {
        queryClient.setQueryData<BoardItemsResponse>(
          boardItemKeys.list(boardId),
          {
            ...previous,
            items: previous.items.filter((i) => i.id !== itemId),
          },
        );
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          boardItemKeys.list(boardId),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.list(boardId),
      });
    },
  });
}

export function useBoardItemComments(
  spaceId: string | undefined,
  boardId: string | undefined,
  itemId: string | undefined,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: boardItemKeys.comments(itemId!),
    queryFn: () => fetchComments(spaceId!, boardId!, itemId!),
    enabled: enabled && !!spaceId && !!boardId && !!itemId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}

export function useAddComment(
  spaceId: string,
  boardId: string,
  itemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      addComment(spaceId, boardId, itemId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.comments(itemId),
      });
    },
  });
}

export function useBoardItemHistory(
  spaceId: string | undefined,
  boardId: string | undefined,
  itemId: string | undefined,
) {
  return useQuery({
    queryKey: boardItemKeys.history(itemId!),
    queryFn: () => fetchHistory(spaceId!, boardId!, itemId!),
    enabled: !!spaceId && !!boardId && !!itemId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}

/* ------------------------------------------------------------------ */
/*  Column Creation                                                    */
/* ------------------------------------------------------------------ */

interface CreateColumnInput {
  name: string;
  color?: string;
}

async function createColumn(
  spaceId: string,
  boardId: string,
  input: CreateColumnInput,
) {
  const response = await fetch(
    `/api/spaces/${spaceId}/boards/${boardId}/columns`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error('Failed to create column');
  return response.json();
}

export function useCreateColumn(spaceId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateColumnInput) =>
      createColumn(spaceId, boardId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.list(boardId),
      });
    },
  });
}
