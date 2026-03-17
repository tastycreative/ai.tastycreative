'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface WorkspaceResource {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  description: string | null;
  category: string | null;
  position: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchResources(spaceId: string): Promise<WorkspaceResource[]> {
  const res = await fetch(`/api/spaces/${spaceId}/resources`);
  if (!res.ok) throw new Error('Failed to fetch resources');
  return res.json();
}

export function useWorkspaceResources(spaceId?: string) {
  return useQuery({
    queryKey: ['workspaceResources', spaceId],
    queryFn: () => fetchResources(spaceId!),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useCreateResource(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; url: string; description?: string; category?: string }) => {
      const res = await fetch(`/api/spaces/${spaceId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create resource');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceResources', spaceId] });
    },
  });
}

export function useUpdateResource(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ resourceId, ...payload }: { resourceId: string; name?: string; url?: string; description?: string; category?: string }) => {
      const res = await fetch(`/api/spaces/${spaceId}/resources/${resourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update resource');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceResources', spaceId] });
    },
  });
}

export function useDeleteResource(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch(`/api/spaces/${spaceId}/resources/${resourceId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete resource');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceResources', spaceId] });
    },
  });
}
