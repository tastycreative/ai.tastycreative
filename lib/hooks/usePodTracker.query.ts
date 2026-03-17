'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PodTrackerTask {
  id: string;
  organizationId: string;
  weekStartDate: string;
  dayOfWeek: number;
  slotLabel: string;
  team: string;
  taskName: string;
  taskType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
  startTime: string | null;
  endTime: string | null;
  notes: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PodTrackerConfig {
  id: string;
  organizationId: string;
  teamNames: string[];
  rotationOffset: number;
}

interface WeekResponse {
  tasks: PodTrackerTask[];
}

interface ConfigResponse {
  config: PodTrackerConfig | null;
}

interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  details: string;
  createdAt: string;
  user: { name: string | null; imageUrl: string | null };
}

interface ActivityLogPage {
  items: ActivityLogItem[];
  nextCursor: string | null;
}

// ─── Query Keys ────────────────────────────────────────────────────────────

export const podTrackerKeys = {
  all: ['pod-tracker'] as const,
  week: (weekStart: string) => [...podTrackerKeys.all, 'week', weekStart] as const,
  config: () => [...podTrackerKeys.all, 'config'] as const,
  activity: () => [...podTrackerKeys.all, 'activity'] as const,
};

// ─── Fetch Functions ───────────────────────────────────────────────────────

async function fetchWeekTasks(weekStart: string): Promise<WeekResponse> {
  const res = await fetch(`/api/pod-tracker?weekStart=${encodeURIComponent(weekStart)}`);
  if (!res.ok) throw new Error('Failed to fetch POD tracker tasks');
  return res.json();
}

async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch('/api/pod-tracker/config');
  if (!res.ok) throw new Error('Failed to fetch POD tracker config');
  return res.json();
}

// ─── Query Hooks ───────────────────────────────────────────────────────────

export function usePodTrackerWeek(weekStart: string) {
  const { user } = useUser();
  return useQuery({
    queryKey: podTrackerKeys.week(weekStart),
    queryFn: () => fetchWeekTasks(weekStart),
    enabled: !!user && !!weekStart,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function usePodTrackerConfig() {
  const { user } = useUser();
  return useQuery({
    queryKey: podTrackerKeys.config(),
    queryFn: fetchConfig,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────────────────

export function useUpdatePodTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      tabId,
      ...data
    }: Partial<PodTrackerTask> & { id: string; tabId?: string }) => {
      const res = await fetch(`/api/pod-tracker/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tabId }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json() as Promise<PodTrackerTask>;
    },
    onMutate: async (variables) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: podTrackerKeys.all });
      const snapshots = queryClient.getQueriesData<WeekResponse>({
        queryKey: podTrackerKeys.all,
      });

      queryClient.setQueriesData<WeekResponse>(
        { queryKey: podTrackerKeys.all },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) =>
              t.id === variables.id ? { ...t, ...variables } : t,
            ),
          };
        },
      );

      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: podTrackerKeys.all });
    },
  });
}

export function useSeedPodWeek() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      weekStart,
      tabId,
    }: {
      weekStart: string;
      tabId?: string;
    }) => {
      const res = await fetch('/api/pod-tracker/seed-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, tabId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to seed week');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: podTrackerKeys.all });
    },
  });
}

export function useUpdatePodConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamNames,
      rotationOffset,
      tabId,
    }: {
      teamNames?: string[];
      rotationOffset?: number;
      tabId?: string;
    }) => {
      const res = await fetch('/api/pod-tracker/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamNames, rotationOffset, tabId }),
      });
      if (!res.ok) throw new Error('Failed to update config');
      return res.json() as Promise<ConfigResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: podTrackerKeys.config() });
    },
  });
}

export function usePodTrackerActivity() {
  const { user } = useUser();

  return useInfiniteQuery<ActivityLogPage>({
    queryKey: podTrackerKeys.activity(),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await fetch(`/api/pod-tracker/activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activity log');
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 1000 * 60 * 1,
  });
}
