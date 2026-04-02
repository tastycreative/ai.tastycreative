'use client';

import { useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Shared fields for caption bank + flyer asset linking */
interface PickerFields {
  captionId?: string;         // Reference to Caption bank item
  captionBankText?: string;   // Snapshot of selected caption text
  flyerAssetId?: string;      // Reference to FlyerAsset
  flyerAssetUrl?: string;     // URL snapshot for display
  flagged?: boolean;          // Caption needs replacement
  captionQAStatus?: 'sent_to_qa' | 'approved' | 'rejected';  // Caption QA workflow status
}

export interface MMFields extends PickerFields {
  type?: string; time?: string; contentPreview?: string; paywallContent?: string;
  tag?: string; caption?: string; captionGuide?: string; price?: string;
  subType?: string; // Follow-up sub-type: OG Flyer ⬆, No Flyer ⬆, Universal Flyer ⬆
}
export interface WPFields extends PickerFields {
  type?: string; time?: string; contentFlyer?: string;
  paywallContent?: string; caption?: string; priceInfo?: string;
}
export interface STFields {
  contentFlyer?: string; storyPostSchedule?: string;
}
export interface SPFields extends PickerFields {
  type?: string; contentFlyer?: string;
  time?: string; caption?: string;
}
export type TaskFields = MMFields | WPFields | STFields | SPFields;

export interface FieldDef {
  key: string; label: string; placeholder?: string;
}

// ─── MM Sub-Types ─────────────────────────────────────────────────────────

export const MM_SUB_TYPES = ['Unlock', 'Follow Up', 'Photo Bump'] as const;
export type MMSubType = (typeof MM_SUB_TYPES)[number];

export const MM_SUB_TYPE_ICONS: Record<string, string> = {
  'Unlock': '🔓',
  'Follow Up': '↩',
  'Photo Bump': '📸',
};

// ─── WP Sub-Types ─────────────────────────────────────────────────────────

export const WP_SUB_TYPES = ['Photo Bump', 'Photo Bump (Permanent)', 'Campaign', 'Unlock'] as const;
export type WPSubType = (typeof WP_SUB_TYPES)[number];

export const WP_SUB_TYPE_ICONS: Record<string, string> = {
  'Photo Bump': '📸',
  'Photo Bump (Permanent)': '📌',
  'Campaign': '📢',
  'Unlock': '🔓',
};

/** Known follow-up sub-types for MM tasks */
export const FOLLOW_UP_SUB_TYPES = [
  'OG Flyer ⬆',
  'No Flyer ⬆',
  'Universal Flyer ⬆',
] as const;

export const TASK_FIELD_DEFS: Record<string, FieldDef[]> = {
  MM: [
    { key: 'type', label: 'Type', placeholder: 'Photo bump, Unlock...' },
    { key: 'subType', label: 'Style', placeholder: 'OG Flyer ⬆, No Flyer ⬆...' },
    { key: 'time', label: 'Time (PST)', placeholder: '2:30 PM' },
    { key: 'contentPreview', label: 'Content/Preview', placeholder: 'Content description...' },
    { key: 'paywallContent', label: 'Paywall Content', placeholder: 'Paywall content...' },
    { key: 'folderName', label: 'Folder Name', placeholder: 'Folder name...' },
    { key: 'tag', label: 'Tag', placeholder: 'Tag name' },
    { key: 'caption', label: 'Caption', placeholder: 'Caption text...' },
    { key: 'captionGuide', label: 'Caption Guide', placeholder: 'Guide...' },
    { key: 'price', label: 'Price', placeholder: '$0.00' },
    { key: 'finalAmount', label: 'Final Amount', placeholder: '$0.00' },
  ],
  WP: [
    { key: 'type', label: 'Type', placeholder: 'Post type...' },
    { key: 'time', label: 'Time (PST)', placeholder: '2:30 PM' },
    { key: 'contentFlyer', label: 'Content/Flyer', placeholder: 'Content URL...' },
    { key: 'paywallContent', label: 'Paywall Content', placeholder: 'Paywall content...' },
    { key: 'folderName', label: 'Folder Name', placeholder: 'Folder name...' },
    { key: 'caption', label: 'Caption', placeholder: 'Caption text...' },
    { key: 'priceInfo', label: 'Price/Info', placeholder: '$0.00 / info' },
    { key: 'finalAmount', label: 'Final Amount', placeholder: '$0.00' },
  ],
  ST: [
    { key: 'storyPostSchedule', label: 'Story Post Schedule', placeholder: '' },
    { key: 'contentFlyer', label: 'Content/Flyer', placeholder: 'Content URL...' },
    { key: 'folderName', label: 'Folder Name', placeholder: 'Folder name...' },
  ],
  SP: [
    { key: 'type', label: 'Type', placeholder: 'Promo type...' },
    { key: 'contentFlyer', label: 'Content/Flyer', placeholder: 'Content URL...' },
    { key: 'folderName', label: 'Folder Name', placeholder: 'Folder name...' },
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
  lineageId: string | null;
  sourceTaskId: string | null;
}

export interface TaskLimits {
  defaults: Record<string, number>;
  overrides: Record<string, Record<string, number>>;
  /** Per-platform default limits: platform -> taskType -> max */
  platformDefaults?: Record<string, Record<string, number>>;
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

interface ActivityLogChange {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  action: string;
}

interface ActivityLogItem {
  id: string;
  action: string;
  taskId: string | null;
  summary: string | null;
  createdAt: string;
  user: { name: string | null; imageUrl: string | null };
  task: { id: string; taskType: string; slotLabel: string; dayOfWeek: number; taskName: string } | null;
  changes: ActivityLogChange[];
}

interface ActivityLogPage {
  items: ActivityLogItem[];
  nextCursor: string | null;
}

// ─── Query Keys ────────────────────────────────────────────────────────────

export const schedulerKeys = {
  all: ['scheduler'] as const,
  week: (weekStart: string) => [...schedulerKeys.all, 'week', weekStart] as const,
  month: (month: string, profileId: string) =>
    [...schedulerKeys.all, 'month', month, profileId] as const,
  config: () => [...schedulerKeys.all, 'config'] as const,
  activity: () => [...schedulerKeys.all, 'activity'] as const,
  taskHistory: (taskId: string) => [...schedulerKeys.all, 'taskHistory', taskId] as const,
  lineage: (lineageId: string) => [...schedulerKeys.all, 'lineage', lineageId] as const,
  lineageEarnings: (lineageId: string) =>
    [...schedulerKeys.all, 'lineageEarnings', lineageId] as const,
  lineageHistory: (lineageId: string) => [...schedulerKeys.all, 'lineageHistory', lineageId] as const,
  historyCounts: (month: string, profileId: string, platform: string) =>
    [...schedulerKeys.all, 'historyCounts', month, profileId, platform] as const,
  calendarHistory: (date: string, profileId: string, platform: string) =>
    [...schedulerKeys.all, 'calendarHistory', date, profileId, platform] as const,
  workspace: (filter: string, profileId: string) =>
    [...schedulerKeys.all, 'workspace', filter, profileId] as const,
  sibling: (taskId: string) => [...schedulerKeys.all, 'sibling', taskId] as const,
  streaks: (lineageIds: string[]) => [...schedulerKeys.all, 'streaks', ...lineageIds.sort()] as const,
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
  enabled: boolean = true,
) {
  const { user } = useUser();
  return useQuery({
    queryKey: [...schedulerKeys.week(weekStart), profileId ?? '', platform ?? ''],
    queryFn: () => fetchWeekTasks(weekStart, profileId, platform),
    enabled: !!user && !!weekStart && enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// ─── Month Fetch ────────────────────────────────────────────────────────

async function fetchMonthTasks(
  month: string,
  profileId?: string | null,
): Promise<WeekResponse> {
  const params = new URLSearchParams({ month });
  if (profileId) params.set('profileId', profileId);
  const res = await fetch(`/api/scheduler/month?${params}`);
  if (!res.ok) throw new Error('Failed to fetch month tasks');
  return res.json();
}

export function useSchedulerMonth(
  month: string,
  profileId?: string | null,
  enabled: boolean = true,
) {
  const { user } = useUser();
  return useQuery({
    queryKey: schedulerKeys.month(month, profileId ?? ''),
    queryFn: () => fetchMonthTasks(month, profileId),
    enabled: !!user && !!month && enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch tasks for a calendar grid's visible date range (month + leading/trailing days).
 * Uses the same /api/scheduler/month endpoint with startDate/endDate params.
 */
async function fetchCalendarRange(
  month: string,
  startDate: string,
  endDate: string,
  profileId?: string | null,
): Promise<WeekResponse> {
  const params = new URLSearchParams({ month, startDate, endDate });
  if (profileId) params.set('profileId', profileId);
  const res = await fetch(`/api/scheduler/month?${params}`);
  if (!res.ok) throw new Error('Failed to fetch calendar tasks');
  return res.json();
}

export function useSchedulerCalendarRange(
  month: string,
  startDate: string,
  endDate: string,
  profileId?: string | null,
  enabled: boolean = true,
) {
  const { user } = useUser();
  return useQuery({
    queryKey: [...schedulerKeys.all, 'calendarRange', month, startDate, endDate, profileId ?? ''],
    queryFn: () => fetchCalendarRange(month, startDate, endDate, profileId),
    enabled: !!user && !!month && !!startDate && !!endDate && enabled,
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
      return (await res.json()) as SchedulerTask;
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
          if (!old?.tasks) return old;
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
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
      // Invalidate gallery cache on any status change (gallery item created/removed server-side)
      if (variables.status !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['gallery'] });
      }
    },
  });
}

/**
 * Lightweight mutation for toggling individual fields (e.g. flag).
 * Uses `mergeFields: true` so the server merges instead of replacing,
 * and does NOT cancel in-flight queries — safe for rapid concurrent calls.
 */
export function useMergeTaskFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      fields,
      tabId,
    }: {
      id: string;
      fields: Record<string, string>;
      tabId?: string;
    }) => {
      const res = await fetch(`/api/scheduler/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, mergeFields: true, tabId }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return (await res.json()) as SchedulerTask;
    },
    onMutate: async (variables) => {
      // Optimistic update without cancelling other mutations
      queryClient.setQueriesData<WeekResponse>(
        { queryKey: schedulerKeys.all },
        (old) => {
          if (!old?.tasks) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) => {
              if (t.id !== variables.id) return t;
              const existing = (t.fields || {}) as Record<string, string>;
              return { ...t, fields: { ...existing, ...variables.fields } as TaskFields };
            }),
          };
        },
      );
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
          if (!old?.tasks) return old;
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

// ─── Export ───────────────────────────────────────────────────────────────

export function useExportScheduler() {
  return useMutation({
    mutationFn: async ({
      weekStart,
      platform,
      profileId,
      profileName,
      dayOfWeek,
    }: {
      weekStart: string;
      platform: string;
      profileId: string | null;
      profileName: string;
      dayOfWeek?: number;
    }) => {
      const params = new URLSearchParams({ weekStart, platform, profileName });
      if (profileId) params.set('profileId', profileId);
      if (dayOfWeek != null) params.set('dayOfWeek', String(dayOfWeek));

      const res = await fetch(`/api/scheduler/export?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to export');
      }

      const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
      const baseFilename = `${profileName} ${platformLabel} Schedule`;

      // Both single day (.csv) and weekly (.xlsx) return binary blobs
      const blob = await res.blob();
      const ext = dayOfWeek != null ? 'csv' : 'xlsx';
      downloadBlob(blob, `${baseFilename}.${ext}`);
      return { downloaded: 1 };
    },
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Caption bank for scheduler picker ──────────────────────────────────────

export interface SchedulerCaption {
  id: string;
  caption: string;
  source: 'ticket' | 'bank';
  origin: string;             // 'otp_ptr' | 'wall_post' | 'manual' | 'general'
  profileId: string;
  status: string;
  contentTypes: string[];
  createdAt: string;
  // Board item data (ticket source)
  boardItemId: string | null;
  gifUrl: string;
  gifUrlFansly: string;
  contentCount: string;
  contentLength: string;
  contentType: string;
  price: number;
  driveLink: string;
  boardTitle: string;
  // Bank-specific
  usageCount?: number;
  isFavorite?: boolean;
  totalRevenue?: number;
  // Sexting set — per-image content items (only present for origin='sexting_sets')
  sextingSetItems?: {
    id: string;
    url: string;
    fileName: string;
    captionText: string;
    captionStatus: string;
    isPosted: boolean;
  }[];
}

export type CaptionSourceFilter = 'all' | 'ticket' | 'bank';

export function useSchedulerCaptions(
  profileId: string | null,
  _captionCategory?: string,
  search?: string,
  sourceFilter: CaptionSourceFilter = 'all',
  originFilter?: string,
) {
  const { user } = useUser();

  return useQuery<SchedulerCaption[]>({
    queryKey: ['scheduler-captions', profileId, search, sourceFilter, originFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (profileId) params.set('profileId', profileId);
      if (search) params.set('search', search);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (originFilter) params.set('origin', originFilter);
      const res = await fetch(`/api/scheduler/captions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch captions');
      return res.json();
    },
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// ─── History Types ────────────────────────────────────────────────────────

export interface TaskHistoryItem {
  id: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { name: string | null; imageUrl: string | null };
}

interface TaskHistoryPage {
  items: TaskHistoryItem[];
  nextCursor: string | null;
}

export interface CalendarHistoryItem extends TaskHistoryItem {
  task: {
    id: string;
    taskType: string;
    slotLabel: string;
    dayOfWeek: number;
    taskName: string;
  };
}

interface CalendarHistoryPage {
  items: CalendarHistoryItem[];
  nextCursor: string | null;
}

// ─── History Hooks ────────────────────────────────────────────────────────

export function useTaskHistory(taskId: string | null) {
  const { user } = useUser();

  return useInfiniteQuery<TaskHistoryPage>({
    queryKey: schedulerKeys.taskHistory(taskId ?? ''),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await fetch(`/api/scheduler/${taskId}/history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch task history');
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user && !!taskId,
    staleTime: 1000 * 60 * 1,
  });
}

export function useHistoryCounts(
  month: string | null,
  profileId: string | null,
  platform: string | null,
) {
  const { user } = useUser();

  return useQuery<{ counts: Record<string, number> }>({
    queryKey: schedulerKeys.historyCounts(month ?? '', profileId ?? '', platform ?? ''),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (profileId) params.set('profileId', profileId);
      if (platform) params.set('platform', platform);
      const res = await fetch(`/api/scheduler/history/counts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch history counts');
      return res.json();
    },
    enabled: !!user && !!month,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useCalendarHistory(
  date: string | null,
  profileId: string | null,
  platform: string | null,
) {
  const { user } = useUser();

  return useInfiniteQuery<CalendarHistoryPage>({
    queryKey: schedulerKeys.calendarHistory(date ?? '', profileId ?? '', platform ?? ''),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (date) params.set('date', date);
      if (profileId) params.set('profileId', profileId);
      if (platform) params.set('platform', platform);
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await fetch(`/api/scheduler/history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch calendar history');
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user && !!date,
    staleTime: 1000 * 60 * 1,
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

// ─── Lineage ──────────────────────────────────────────────────────────────

interface LineageResponse {
  tasks: SchedulerTask[];
}

export interface LineageHistoryItem {
  id: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  weekStartDate: string | null;
  user: { name: string | null; imageUrl: string | null };
  task: { id: string; taskType: string; slotLabel: string; dayOfWeek: number; taskName: string } | null;
}

interface LineageHistoryPage {
  items: LineageHistoryItem[];
  nextCursor: string | null;
}

/** Fetch all tasks sharing the same lineageId (for the timeline view) */
export function useTaskLineage(lineageId: string | null) {
  const { user } = useUser();

  return useQuery<LineageResponse>({
    queryKey: schedulerKeys.lineage(lineageId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/scheduler/lineage/${lineageId}`);
      if (!res.ok) throw new Error('Failed to fetch task lineage');
      return res.json();
    },
    enabled: !!user && !!lineageId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/** Fetch the sibling task (Unlock ↔ Follow Up) for an MM task */
export function useSiblingTask(taskId: string | null) {
  const { user } = useUser();

  return useQuery<{ sibling: SchedulerTask | null }>({
    queryKey: schedulerKeys.sibling(taskId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/scheduler/sibling?taskId=${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch sibling task');
      return res.json();
    },
    enabled: !!user && !!taskId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

// ─── Lineage Earnings ──────────────────────────────────────────────────────

export interface LineageEarningsResponse {
  totalEarnings: number;
  taskCount: number;
  filledCount: number;
  items: { date: string; finalAmount: string }[];
}

/** Fetch lifetime earnings for a lineage — disabled by default, enable on click */
export function useLineageEarnings(lineageId: string | null, enabled: boolean = false) {
  const { user } = useUser();

  return useQuery<LineageEarningsResponse>({
    queryKey: schedulerKeys.lineageEarnings(lineageId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/scheduler/lineage/${lineageId}/earnings`);
      if (!res.ok) throw new Error('Failed to fetch lineage earnings');
      return res.json();
    },
    enabled: !!user && !!lineageId && enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/** Fetch aggregated history across all tasks in a lineage */
export function useLineageHistory(lineageId: string | null) {
  const { user } = useUser();

  return useInfiniteQuery<LineageHistoryPage>({
    queryKey: schedulerKeys.lineageHistory(lineageId ?? ''),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await fetch(`/api/scheduler/lineage/${lineageId}/history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch lineage history');
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user && !!lineageId,
    staleTime: 1000 * 60 * 1,
  });
}

/** Mutation to queue a task update for a future week by copying from a source task */
export function useQueueTaskUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      sourceTaskId: string;
      weekStart: string;
      dayOfWeek: number;
      fields?: TaskFields;
      platform?: string;
      profileId?: string | null;
    }) => {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: payload.weekStart,
          dayOfWeek: payload.dayOfWeek,
          sourceTaskId: payload.sourceTaskId,
          fields: payload.fields,
          platform: payload.platform,
          profileId: payload.profileId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to queue task update');
      }
      return res.json() as Promise<SchedulerTask>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
    },
  });
}

// ─── Workspace (Flagged / Missing Amount) ─────────────────────────────────

export interface WorkspacePage {
  items: SchedulerTask[];
  nextCursor: string | null;
  totalCount: number;
}

export function useWorkspaceTasks(
  filter: 'flagged' | 'missing-amount',
  profileId: string | null,
  today: string,
  enabled: boolean = true,
) {
  const { user } = useUser();

  return useInfiniteQuery<WorkspacePage>({
    queryKey: schedulerKeys.workspace(filter, profileId ?? ''),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ filter, limit: '20' });
      if (profileId) params.set('profileId', profileId);
      if (today) params.set('today', today);
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await fetch(`/api/scheduler/workspace?${params}`);
      if (!res.ok) throw new Error('Failed to fetch workspace tasks');
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// ─── Streaks ──────────────────────────────────────────────────────────────

export type StreaksData = Record<string, Record<string, number>>;

async function fetchStreaks(lineageIds: string[]): Promise<{ streaks: StreaksData }> {
  const res = await fetch('/api/scheduler/streaks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineageIds }),
  });
  if (!res.ok) throw new Error('Failed to fetch streaks');
  return res.json();
}

/** Fetch streak counts for all visible tasks that have a lineageId */
export function useTaskStreaks(tasks: SchedulerTask[]) {
  const { user } = useUser();

  const lineageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tasks) {
      if (t.lineageId) ids.add(t.lineageId);
    }
    return Array.from(ids);
  }, [tasks]);

  return useQuery<StreaksData>({
    queryKey: schedulerKeys.streaks(lineageIds),
    queryFn: async () => {
      const { streaks } = await fetchStreaks(lineageIds);
      return streaks;
    },
    enabled: !!user && lineageIds.length > 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

/** Get the streak number for a specific task from the streaks data */
export function getTaskStreak(
  streaks: StreaksData | undefined,
  task: SchedulerTask,
): number | undefined {
  if (!streaks || !task.lineageId) return undefined;
  const lineageStreaks = streaks[task.lineageId];
  if (!lineageStreaks) return undefined;
  return lineageStreaks[task.id];
}

// ─── Utilities ────────────────────────────────────────────────────────────

/**
 * Returns true if the task's date is before schedulerToday (locked for editing).
 * Computes the task's actual date from weekStartDate + dayOfWeek.
 */
export function isTaskLocked(task: SchedulerTask, schedulerToday: string): boolean {
  // weekStartDate may be a full ISO string or YYYY-MM-DD
  const wsStr = typeof task.weekStartDate === 'string'
    ? task.weekStartDate.split('T')[0]
    : String(task.weekStartDate);
  const weekStart = new Date(wsStr + 'T00:00:00Z');
  if (isNaN(weekStart.getTime())) return false;
  const taskDate = new Date(weekStart);
  taskDate.setUTCDate(taskDate.getUTCDate() + task.dayOfWeek);
  const taskDateKey = taskDate.toISOString().split('T')[0];
  return taskDateKey < schedulerToday;
}
