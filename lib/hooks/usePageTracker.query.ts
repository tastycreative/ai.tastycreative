'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrackerTeam {
  id: string;
  name: string;
  color: string | null;
  order: number;
  organizationId: string;
  _count?: { entries: number };
}

export interface TrackerEntryProfile {
  id: string;
  name: string;
  profileImageUrl: string | null;
  instagramUsername: string | null;
  status: string;
  type: string;
}

export interface TrackerEntry {
  id: string;
  profileId: string;
  teamId: string | null;
  platformType: string | null;
  managingSystem: string | null;
  trackerStatus: string;
  notes: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  profile: TrackerEntryProfile;
  team: { id: string; name: string; color: string | null } | null;
}

export interface TrackerConfig {
  customStatuses: string[];
  customPlatforms: string[];
  customSystems: string[];
}

export interface UnassignedProfile {
  id: string;
  name: string;
  profileImageUrl: string | null;
  instagramUsername: string | null;
  type: string;
}

interface PageTrackerResponse {
  teams: TrackerTeam[];
  entries: TrackerEntry[];
  config: TrackerConfig | null;
  unassignedProfiles: UnassignedProfile[];
}

// ─── Default Options ────────────────────────────────────────────────────────

export const DEFAULT_STATUSES = ['ACTIVE', 'ON PAUSE', 'LAUNCHING'];
export const DEFAULT_PLATFORMS = ['Free', 'Paid', 'VIP', 'OFTV'];
export const DEFAULT_SYSTEMS = ['HIVE', 'POD', 'US Scheduler'];

// ─── Fetch Functions ────────────────────────────────────────────────────────

async function fetchPageTracker(): Promise<PageTrackerResponse> {
  const response = await fetch('/api/page-tracker');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch page tracker data');
  }
  return response.json();
}

async function fetchTrackerTeams(): Promise<TrackerTeam[]> {
  const response = await fetch('/api/page-tracker/teams');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch tracker teams');
  }
  return response.json();
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function usePageTracker() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['page-tracker', user?.id],
    queryFn: fetchPageTracker,
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useTrackerTeams() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['tracker-teams', user?.id],
    queryFn: fetchTrackerTeams,
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateTrackerEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      profileId: string;
      teamId?: string;
      platformType?: string;
      managingSystem?: string;
      trackerStatus?: string;
      notes?: string;
    }) => {
      const response = await fetch('/api/page-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create entry');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-tracker'] });
    },
  });
}

export function useUpdateTrackerEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      teamId?: string | null;
      platformType?: string;
      managingSystem?: string;
      trackerStatus?: string;
      notes?: string;
    }) => {
      const response = await fetch(`/api/page-tracker/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update entry');
      }
      return response.json();
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['page-tracker'] });
      const previous = queryClient.getQueriesData<PageTrackerResponse>({ queryKey: ['page-tracker'] });

      queryClient.setQueriesData<PageTrackerResponse>(
        { queryKey: ['page-tracker'] },
        (old) => {
          if (!old) return old;
          const { id, ...updates } = variables;
          return {
            ...old,
            entries: old.entries.map((entry) => {
              if (entry.id !== id) return entry;
              const updated = { ...entry, ...updates };
              // Update the nested team reference if teamId changed
              if (updates.teamId !== undefined) {
                updated.team = updates.teamId
                  ? old.teams.find((t) => t.id === updates.teamId)
                    ? { id: updates.teamId, name: old.teams.find((t) => t.id === updates.teamId)!.name, color: old.teams.find((t) => t.id === updates.teamId)!.color }
                    : entry.team
                  : null;
              }
              return updated;
            }),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['page-tracker'] });
    },
  });
}

export function useDeleteTrackerEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/page-tracker/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete entry');
      }
      return response.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['page-tracker'] });
      const previous = queryClient.getQueriesData<PageTrackerResponse>({ queryKey: ['page-tracker'] });

      queryClient.setQueriesData<PageTrackerResponse>(
        { queryKey: ['page-tracker'] },
        (old) => {
          if (!old) return old;
          const removedEntry = old.entries.find((e) => e.id === id);
          return {
            ...old,
            entries: old.entries.filter((e) => e.id !== id),
            // Move profile back to unassigned
            unassignedProfiles: removedEntry
              ? [...old.unassignedProfiles, {
                  id: removedEntry.profile.id,
                  name: removedEntry.profile.name,
                  profileImageUrl: removedEntry.profile.profileImageUrl,
                  instagramUsername: removedEntry.profile.instagramUsername,
                  type: removedEntry.profile.type,
                }]
              : old.unassignedProfiles,
          };
        }
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['page-tracker'] });
    },
  });
}

export function useCreateTrackerTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const response = await fetch('/api/page-tracker/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create team');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-teams'] });
    },
  });
}

export function useUpdateTrackerTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      color?: string;
      order?: number;
    }) => {
      const response = await fetch(`/api/page-tracker/teams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team');
      }
      return response.json();
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['page-tracker'] });
      const previous = queryClient.getQueriesData<PageTrackerResponse>({ queryKey: ['page-tracker'] });

      queryClient.setQueriesData<PageTrackerResponse>(
        { queryKey: ['page-tracker'] },
        (old) => {
          if (!old) return old;
          const { id, ...updates } = variables;
          return {
            ...old,
            teams: old.teams.map((t) => (t.id === id ? { ...t, ...updates } : t)),
            entries: old.entries.map((e) =>
              e.teamId === id && e.team
                ? { ...e, team: { ...e.team, ...updates } }
                : e
            ),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['page-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-teams'] });
    },
  });
}

export function useDeleteTrackerTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/page-tracker/teams/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete team');
      }
      return response.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['page-tracker'] });
      const previous = queryClient.getQueriesData<PageTrackerResponse>({ queryKey: ['page-tracker'] });

      queryClient.setQueriesData<PageTrackerResponse>(
        { queryKey: ['page-tracker'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            teams: old.teams.filter((t) => t.id !== id),
            entries: old.entries.map((e) =>
              e.teamId === id ? { ...e, teamId: null, team: null } : e
            ),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['page-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-teams'] });
    },
  });
}

export function useUpdateTrackerConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<TrackerConfig>) => {
      const response = await fetch('/api/page-tracker/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update config');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-tracker'] });
    },
  });
}

// ─── Activity Log ───────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  details: string | null;
  createdAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    email: string;
  };
}

interface ActivityLogPage {
  items: ActivityLogEntry[];
  nextCursor: string | null;
}

export function useTrackerActivityLog() {
  const { user } = useUser();

  return useInfiniteQuery<ActivityLogPage>({
    queryKey: ['tracker-activity-log', user?.id],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('cursor', pageParam as string);
      const response = await fetch(`/api/page-tracker/activity?${params}`);
      if (!response.ok) throw new Error('Failed to fetch activity log');
      return response.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: false,
  });
}

// ─── CSV Export ─────────────────────────────────────────────────────────────

export async function exportTrackerCSV() {
  const response = await fetch('/api/page-tracker/export');
  if (!response.ok) throw new Error('Failed to export CSV');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'tracker-export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
