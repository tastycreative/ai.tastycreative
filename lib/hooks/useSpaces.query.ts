'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export type SpaceTemplateType = 'KANBAN';

export interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  templateType: SpaceTemplateType;
  createdAt: string;
}

interface SpacesResponse {
  spaces: Space[];
}

interface CreateSpaceInput {
  name: string;
  description?: string;
  templateType: SpaceTemplateType;
}

async function fetchSpaces(): Promise<SpacesResponse> {
  const response = await fetch('/api/spaces');

  if (!response.ok) {
    throw new Error('Failed to fetch spaces');
  }

  return response.json();
}

async function createSpace(input: CreateSpaceInput): Promise<Space> {
  const response = await fetch('/api/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error || 'Failed to create space';
    throw new Error(message);
  }

  return response.json();
}

export function useSpaces(enabled: boolean = true) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['spaces', user?.id],
    queryFn: fetchSpaces,
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSpace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
}

