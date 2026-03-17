'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface WorkspaceEvent {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchEvents(
  spaceId: string,
  start?: string,
  end?: string,
): Promise<WorkspaceEvent[]> {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const qs = params.toString();
  const res = await fetch(`/api/spaces/${spaceId}/events${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

async function fetchEvent(
  spaceId: string,
  eventId: string,
): Promise<WorkspaceEvent> {
  const res = await fetch(`/api/spaces/${spaceId}/events/${eventId}`);
  if (!res.ok) throw new Error('Failed to fetch event');
  return res.json();
}

export function useWorkspaceEvents(
  spaceId?: string,
  start?: string,
  end?: string,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['workspaceEvents', spaceId, start, end],
    queryFn: () => fetchEvents(spaceId!, start, end),
    enabled: !!spaceId && enabled,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useWorkspaceEvent(spaceId?: string, eventId?: string) {
  return useQuery({
    queryKey: ['workspaceEvent', spaceId, eventId],
    queryFn: () => fetchEvent(spaceId!, eventId!),
    enabled: !!spaceId && !!eventId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useCreateEvent(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      startDate: string;
      endDate: string;
      description?: string;
      allDay?: boolean;
      color?: string;
    }) => {
      const res = await fetch(`/api/spaces/${spaceId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceEvents', spaceId] });
    },
  });
}

export function useUpdateEvent(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      ...payload
    }: {
      eventId: string;
      title?: string;
      startDate?: string;
      endDate?: string;
      description?: string;
      allDay?: boolean;
      color?: string;
    }) => {
      const res = await fetch(`/api/spaces/${spaceId}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceEvents', spaceId] });
    },
  });
}

export function useDeleteEvent(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/spaces/${spaceId}/events/${eventId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceEvents', spaceId] });
    },
  });
}
