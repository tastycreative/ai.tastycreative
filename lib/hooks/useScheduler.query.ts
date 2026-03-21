'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MMFields {
  time?: string; contentPreview?: string; paywallContent?: string;
  tag?: string; caption?: string; captionGuide?: string; price?: string;
}
export interface WPFields {
  postSchedule?: string; time?: string; contentFlyer?: string;
  paywallContent?: string; caption?: string; priceInfo?: string;
}
export interface STFields {
  contentFlyer?: string; storyPostSchedule?: string;
}
export interface SPFields {
  subscriberPromoSchedule?: string; contentFlyer?: string;
  time?: string; caption?: string;
}
export type TaskFields = MMFields | WPFields | STFields | SPFields;

export interface FieldDef {
  key: string; label: string; placeholder?: string;
}

export const TASK_FIELD_DEFS: Record<string, FieldDef[]> = {
  MM: [
    { key: 'time', label: 'Time (PST)', placeholder: '2:30 PM' },
    { key: 'contentPreview', label: 'Content/Preview', placeholder: 'Content description...' },
    { key: 'paywallContent', label: 'Paywall Content', placeholder: 'Paywall content...' },
    { key: 'tag', label: 'Tag', placeholder: 'Tag name' },
    { key: 'caption', label: 'Caption', placeholder: 'Caption text...' },
    { key: 'captionGuide', label: 'Caption Guide', placeholder: 'Guide...' },
    { key: 'price', label: 'Price', placeholder: '$0.00' },
  ],
  WP: [
    { key: 'postSchedule', label: 'Post Schedule', placeholder: '10:00 AM' },
    { key: 'time', label: 'Time (PST)', placeholder: '2:30 PM' },
    { key: 'contentFlyer', label: 'Content/Flyer', placeholder: 'Description...' },
    { key: 'paywallContent', label: 'Paywall Content', placeholder: 'Paywall content...' },
    { key: 'caption', label: 'Caption', placeholder: 'Caption text...' },
    { key: 'priceInfo', label: 'Price/Info', placeholder: '$0.00 / info' },
  ],
  ST: [
    { key: 'contentFlyer', label: 'Content/Flyer', placeholder: 'Description...' },
    { key: 'storyPostSchedule', label: 'Story Post Schedule', placeholder: '3:00 PM' },
  ],
  SP: [
    { key: 'subscriberPromoSchedule', label: 'Promo Schedule', placeholder: '12:00 PM' },
    { key: 'contentFlyer', label: 'Content/Flyer', placeholder: 'Description...' },
    { key: 'time', label: 'Time (PST)', placeholder: '2:30 PM' },
    { key: 'caption', label: 'Caption', placeholder: 'Caption text...' },
  ],
};

export interface SchedulerTask {
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
  fields: TaskFields | null;
  platform: string;
  profileId: string | null;
  sortOrder: number;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLimits {
  defaults: Record<string, number>;
  overrides: Record<string, Record<string, number>>;
}

export interface SchedulerConfig {
  id: string;
  organizationId: string;
  teamNames: string[];
  rotationOffset: number;
  taskLimits: TaskLimits | null;
}

interface WeekResponse {
  tasks: SchedulerTask[];
}

interface ConfigResponse {
  config: SchedulerConfig | null;
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

export const schedulerKeys = {
  all: ['scheduler'] as const,
  week: (weekStart: string) => [...schedulerKeys.all, 'week', weekStart] as const,
  config: () => [...schedulerKeys.all, 'config'] as const,
  activity: () => [...schedulerKeys.all, 'activity'] as const,
};

// ─── Fetch Functions ───────────────────────────────────────────────────────

async function fetchWeekTasks(
  weekStart: string,
  profileId?: string | null,
  platform?: string,
): Promise<WeekResponse> {
  const params = new URLSearchParams({ weekStart });
  if (profileId) params.set('profileId', profileId);
  if (platform) params.set('platform', platform);
  const res = await fetch(`/api/scheduler?${params}`);
  if (!res.ok) throw new Error('Failed to fetch Scheduler tasks');
  return res.json();
}

async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch('/api/scheduler/config');
  if (!res.ok) throw new Error('Failed to fetch Scheduler config');
  return res.json();
}

// ─── Query Hooks ───────────────────────────────────────────────────────────

export function useSchedulerWeek(
  weekStart: string,
  profileId?: string | null,
  platform?: string,
) {
  const { user } = useUser();
  return useQuery({
    queryKey: [...schedulerKeys.week(weekStart), profileId ?? '', platform ?? ''],
    queryFn: () => fetchWeekTasks(weekStart, profileId, platform),
    enabled: !!user && !!weekStart,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useSchedulerConfig() {
  const { user } = useUser();
  return useQuery({
    queryKey: schedulerKeys.config(),
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
    }: Partial<SchedulerTask> & { id: string; tabId?: string }) => {
      const res = await fetch(`/api/scheduler/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tabId }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json() as Promise<SchedulerTask>;
    },
    onMutate: async (variables) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: schedulerKeys.all });
      const snapshots = queryClient.getQueriesData<WeekResponse>({
        queryKey: schedulerKeys.all,
      });

      queryClient.setQueriesData<WeekResponse>(
        { queryKey: schedulerKeys.all },
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
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
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
      const res = await fetch('/api/scheduler/seed-week', {
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
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
    },
  });
}

export function useCreateSchedulerTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      weekStart: string;
      dayOfWeek: number;
      taskType?: string;
      taskName?: string;
      fields?: TaskFields;
      platform?: string;
      profileId?: string | null;
      tabId?: string;
    }) => {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create task');
      }
      return res.json() as Promise<SchedulerTask>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
    },
  });
}

export function useDeleteSchedulerTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tabId }: { id: string; tabId?: string }) => {
      const res = await fetch(`/api/scheduler/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId }),
      });
      if (!res.ok) throw new Error('Failed to delete task');
      return res.json();
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: schedulerKeys.all });
      const snapshots = queryClient.getQueriesData<WeekResponse>({
        queryKey: schedulerKeys.all,
      });

      queryClient.setQueriesData<WeekResponse>(
        { queryKey: schedulerKeys.all },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.filter((t) => t.id !== variables.id),
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
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
    },
  });
}

export function useUpdatePodConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamNames,
      rotationOffset,
      taskLimits,
      tabId,
    }: {
      teamNames?: string[];
      rotationOffset?: number;
      taskLimits?: TaskLimits | null;
      tabId?: string;
    }) => {
      const res = await fetch('/api/scheduler/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamNames, rotationOffset, taskLimits, tabId }),
      });
      if (!res.ok) throw new Error('Failed to update config');
      return res.json() as Promise<ConfigResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.config() });
    },
  });
}

export function useUpdateTaskLimits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskLimits,
      tabId,
    }: {
      taskLimits: TaskLimits | null;
      tabId?: string;
    }) => {
      const res = await fetch('/api/scheduler/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskLimits, tabId }),
      });
      if (!res.ok) throw new Error('Failed to update task limits');
      return res.json() as Promise<ConfigResponse>;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: schedulerKeys.config() });
      const prev = queryClient.getQueryData<ConfigResponse>(schedulerKeys.config());

      queryClient.setQueryData<ConfigResponse>(schedulerKeys.config(), (old) => {
        if (!old?.config) return old;
        return { config: { ...old.config, taskLimits: variables.taskLimits } };
      });

      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(schedulerKeys.config(), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.config() });
    },
  });
}

// ─── Import Mutations ─────────────────────────────────────────────────────

export interface ParsedTask {
  taskType: string;
  taskName: string;
  fields: Record<string, string>;
}

export function useParseSchedulerSheet() {
  return useMutation({
    mutationFn: async (sheetUrl: string) => {
      const res = await fetch('/api/scheduler/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to parse sheet');
      }
      return res.json() as Promise<{
        slots: Record<string, ParsedTask[]>;
        errors?: string[];
      }>;
    },
  });
}

export type ImportMode = 'replace' | 'append' | 'replace_by_type';

export function useImportSchedulerTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      weekStart: string;
      platform: string;
      profileId: string | null;
      mode: ImportMode;
      tasks: {
        dayOfWeek: number;
        taskType: string;
        taskName: string;
        fields: Record<string, string>;
        sortOrder: number;
      }[];
    }) => {
      const res = await fetch('/api/scheduler/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to import tasks');
      }
      return res.json() as Promise<{ imported: number; deleted: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
    },
  });
}

// ─── Activity ─────────────────────────────────────────────────────────────

export function useSchedulerActivity() {
  const { user } = useUser();

  return useInfiniteQuery<ActivityLogPage>({
    queryKey: schedulerKeys.activity(),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await fetch(`/api/scheduler/activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activity log');
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 1000 * 60 * 1,
  });
}
