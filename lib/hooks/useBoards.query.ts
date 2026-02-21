'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/* ------------------------------------------------------------------ */
/*  Types (matching actual schema: position, no isDefault)             */
/* ------------------------------------------------------------------ */

export interface BoardColumn {
  id: string;
  name: string;
  color?: string | null;
  position: number;
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  position: number;
  columns: BoardColumn[];
}

interface BoardsResponse {
  boards: Board[];
}

export interface CreateBoardInput {
  name: string;
  description?: string;
  columns?: { name: string; color?: string; position: number }[];
}

/* ------------------------------------------------------------------ */
/*  Query keys                                                         */
/* ------------------------------------------------------------------ */

export const boardKeys = {
  all: ['boards'] as const,
  lists: () => [...boardKeys.all, 'list'] as const,
  list: (spaceId: string) => [...boardKeys.lists(), spaceId] as const,
  details: () => [...boardKeys.all, 'detail'] as const,
  detail: (boardId: string) => [...boardKeys.details(), boardId] as const,
};

/* ------------------------------------------------------------------ */
/*  Fetch functions                                                    */
/* ------------------------------------------------------------------ */

async function fetchBoards(spaceId: string): Promise<BoardsResponse> {
  const res = await fetch(`/api/spaces/${spaceId}/boards`);
  if (!res.ok) throw new Error('Failed to fetch boards');
  return res.json();
}

async function createBoard(
  spaceId: string,
  input: CreateBoardInput,
): Promise<Board> {
  const res = await fetch(`/api/spaces/${spaceId}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to create board');
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useBoards(spaceId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.list(spaceId!),
    queryFn: () => fetchBoards(spaceId!),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useCreateBoard(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBoardInput) => createBoard(spaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.list(spaceId) });
    },
  });
}
