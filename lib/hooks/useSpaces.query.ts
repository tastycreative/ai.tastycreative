'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SpaceTemplateType = 'KANBAN' | 'WALL_POST' | 'SEXTING_SETS' | 'OTP_PTR';
export type SpaceAccess = 'OPEN' | 'PRIVATE';

export interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  templateType: SpaceTemplateType;
  key?: string | null;
  access: SpaceAccess;
  config?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SpaceWithBoards extends Space {
  boards: {
    id: string;
    name: string;
    isDefault: boolean;
    order: number;
  }[];
}

interface SpacesResponse {
  spaces: Space[];
}

export interface CreateSpaceInput {
  name: string;
  description?: string;
  templateType: SpaceTemplateType;
  key?: string;
  access?: SpaceAccess;
}

/* ------------------------------------------------------------------ */
/*  Query keys (centralized for consistent invalidation)               */
/* ------------------------------------------------------------------ */

export const spaceKeys = {
  all: ['spaces'] as const,
  lists: () => [...spaceKeys.all, 'list'] as const,
  list: (orgId: string | undefined) => [...spaceKeys.lists(), orgId] as const,
  details: () => [...spaceKeys.all, 'detail'] as const,
  detail: (spaceId: string) => [...spaceKeys.details(), spaceId] as const,
};

/* ------------------------------------------------------------------ */
/*  Fetch functions                                                    */
/* ------------------------------------------------------------------ */

async function fetchSpaces(): Promise<SpacesResponse> {
  const res = await fetch('/api/spaces');
  if (!res.ok) throw new Error('Failed to fetch spaces');
  return res.json();
}

async function fetchSpace(spaceId: string): Promise<SpaceWithBoards> {
  const res = await fetch(`/api/spaces/${spaceId}`);
  if (!res.ok) throw new Error('Failed to fetch space');
  return res.json();
}

async function createSpace(input: CreateSpaceInput): Promise<Space> {
  const res = await fetch('/api/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to create space');
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useSpaces(enabled: boolean = true) {
  const { user } = useUser();
  return useQuery({
    queryKey: spaceKeys.list(user?.id),
    queryFn: fetchSpaces,
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useSpace(spaceId: string | undefined) {
  return useQuery({
    queryKey: spaceKeys.detail(spaceId!),
    queryFn: () => fetchSpace(spaceId!),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSpace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceKeys.lists() });
    },
  });
}
