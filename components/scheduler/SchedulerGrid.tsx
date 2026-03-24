'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Settings, History, CalendarClock, Download, Upload, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  useSchedulerWeek,
  useSchedulerConfig,
  useUpdatePodTask,
  useCreateSchedulerTask,
  useDeleteSchedulerTask,
  useUpdateTaskLimits,
  SchedulerTask,
  TaskLimits,
} from '@/lib/hooks/useScheduler.query';
import { useSchedulerRealtime, tabId } from '@/lib/hooks/useSchedulerRealtime';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import {
  getWeekStart,
  getWeekDays,
  getTeamForDay,
  formatDateKey,
  getSchedulerTodayKey,
} from '@/lib/scheduler/rotation';
import { TASK_TYPES, TASK_TYPE_COLORS } from './SchedulerTaskCard';
import { cleanTaskLimits } from '@/lib/scheduler/task-limits';
import { SchedulerDayColumn } from './SchedulerDayColumn';
import { SchedulerWeekNav } from './SchedulerWeekNav';
import { SchedulerPresenceBar } from './SchedulerPresenceBar';
import { SchedulerConfigModal } from './SchedulerConfigModal';
import { SchedulerActivityLog } from './SchedulerActivityLog';
import { SchedulerHistoryCalendar } from './SchedulerHistoryCalendar';
import { SchedulerImportModal } from './SchedulerImportModal';
import { SchedulerExportModal } from './SchedulerExportModal';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

// ─── Page strategy label map ─────────────────────────────────────────────────
const STRATEGY_LABELS: Record<string, string> = {
  gf_experience: 'GF Experience',
  porn_accurate: 'Porn Accurate',
  tease_denial: 'Tease & Denial',
  premium_exclusive: 'Premium Exclusive',
  girl_next_door: 'Girl Next Door',
  domme: 'Domme',
};

// ─── Platform tabs ───────────────────────────────────────────────────────────
const PLATFORM_TABS = [
  { key: 'free', label: 'Free', color: '#4ade80' },
  { key: 'paid', label: 'Paid', color: '#f472b6' },
  { key: 'oftv', label: 'OFTV', color: '#38bdf8' },
  { key: 'fansly', label: 'Fansly', color: '#c084fc' },
] as const;

type PlatformKey = (typeof PLATFORM_TABS)[number]['key'];

// ─── Sample static tasks for demo/preview ────────────────────────────────────
function makeSampleTask(
  overrides: Partial<SchedulerTask> & { dayOfWeek: number; taskType: string },
): SchedulerTask {
  const id = `sample-${overrides.dayOfWeek}-${overrides.taskType}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    organizationId: '',
    weekStartDate: '',
    dayOfWeek: overrides.dayOfWeek,
    slotLabel: `1${String.fromCharCode(65 + overrides.dayOfWeek)}-demo`,
    team: '',
    taskName: overrides.taskName ?? '',
    taskType: overrides.taskType,
    status: overrides.status ?? 'PENDING',
    startTime: overrides.startTime ?? null,
    endTime: overrides.endTime ?? null,
    notes: overrides.notes ?? '',
    fields: overrides.fields ?? null,
    platform: overrides.platform ?? 'free',
    profileId: overrides.profileId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generateSampleTasks(): SchedulerTask[] {
  const samples: SchedulerTask[] = [];
  for (let day = 0; day < 7; day++) {
    // MM tasks — 5 per day
    const mmTasks: { name: string; fields: Record<string, string>; status: SchedulerTask['status'] }[] = [
      {
        name: 'Unlock',
        status: day < 3 ? 'DONE' : day === 3 ? 'IN_PROGRESS' : 'PENDING',
        fields: {
          time: '5:31 PM',
          contentPreview: 'https://www.allthiscash.com/uploads/Universal-GIF/2025-03-22_09:49:44-8.gif',
          paywallContent: '1 pussy vid, 1 solo fingering vid, 1 tit vid, 1 joi vid, 1 gg vid, 10 nsfw vids, 5 feet pics',
          caption: '🔞𝐓𝐡𝐫𝐞𝐞 𝐇𝐮𝐧𝐝𝐫𝐞𝐝 𝐅𝐨𝐫 𝐓𝐞𝐧 🔞\n𝐓𝐡𝐚𝐭\'𝐬 𝐫𝐢𝐠𝐡𝐭!! 𝐎𝐕𝐄𝐑 $𝟑𝟎𝟎 𝐰𝐨𝐫𝐭𝐡 𝐨𝐟 𝐯𝐢𝐝𝐞𝐨𝐬 𝐟𝐨𝐫 $𝟏𝟎!! 𝐘𝐨𝐮 𝐒𝐩𝐨𝐢𝐥𝐭 𝐁𝐨𝐲 😜\n𝐓𝐡𝐞 𝐯𝐢𝐝𝐞𝐨𝐬 𝐢𝐧𝐜𝐥𝐮𝐝𝐞 ⬇️\n- 𝐏𝐔𝐒𝐒𝐘 - 𝐒𝐓𝐎𝐂𝐊𝐈𝐍𝐆𝐒 - 𝐓𝐎𝐄𝐒 - 𝐅𝐈𝐍𝐆𝐄𝐑𝐈𝐍𝐆 - 𝐎𝐑𝐆𝐀𝐒𝐌 - 𝐓𝐈𝐓 𝐖𝐀𝐍𝐊 - 𝐉𝐎𝐈 - 𝐂𝐔𝐌 & 𝐌𝐎𝐑𝐄!\n𝐀𝐥𝐥 𝐟𝐨𝐫 𝐎𝐧𝐥𝐲 $𝟏𝟎 ⬆️',
          captionGuide: '.',
          price: '$10.00',
        },
      },
      {
        name: 'Follow up',
        status: day < 2 ? 'DONE' : day === 2 ? 'IN_PROGRESS' : 'PENDING',
        fields: {
          type: 'Follow up',
          time: '5:56 PM',
          subType: 'Universal Flyer ⬆',
          contentPreview: 'https://www.allthiscash.com/uploads/Universal-GIF/2025-03-22_09:49:44-8.gif',
          caption: 'You wanna cum, right? 💦 Open that videos now and I will give you a ANOTHER FREE VIDEO ⬆️',
          captionGuide: '.',
        },
      },
      {
        name: 'Photo bump',
        status: day < 1 ? 'DONE' : 'PENDING',
        fields: {
          time: '6:37 PM',
          contentPreview: 'SFW NIGHT',
          caption: '**THINKING ABOUT YOU** 💦',
        },
      },
      {
        name: 'Photo bump',
        status: 'PENDING',
        fields: {
          time: '8:05 PM',
          contentPreview: 'SFW NIGHT',
          caption: '### Cum take me as your little slutt tonight 😈',
        },
      },
      {
        name: 'Photo bump',
        status: 'PENDING',
        fields: {
          time: '10:45 PM',
          contentPreview: 'SFW NIGHT',
          caption: '### I want you to spread me open and make me feel how big you are 🥵',
          captionGuide: '.',
        },
      },
    ];
    for (let i = 0; i < mmTasks.length; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'MM',
          taskName: mmTasks[i].name,
          sortOrder: i,
          status: mmTasks[i].status,
          fields: mmTasks[i].fields,
        }),
      );
    }

    // WP tasks — 3 per day
    const wpTasks: { fields: Record<string, string>; status: SchedulerTask['status'] }[] = [
      {
        status: day < 3 ? 'DONE' : 'PENDING',
        fields: {
          postSchedule: 'GIF BUMP',
          time: '5:35 PM',
          contentFlyer: 'https://www.allthiscash.com/uploads/Tita-Paid/2025-02-24_04:55:38-6.gif',
          tag: '.',
          caption: '### FINGERING THIS PUSSY\nYou better be careful whenever you view this because this is the best pussy you will ever see in your life babe I\'m going to have you cumming in your pants 😘 I\'m the baddest bitch on here for real 🥵 DM me "😘" if you want to cum',
          priceInfo: '.',
        },
      },
      {
        status: day < 1 ? 'DONE' : 'PENDING',
        fields: {
          postSchedule: 'Photo bump',
          time: '8:05 PM',
          contentFlyer: 'SFW NIGHT',
          tag: '.',
          caption: '### Cum take me as your little slutt tonight 😈',
          priceInfo: '.',
        },
      },
      {
        status: 'PENDING',
        fields: {
          postSchedule: 'Photo bump',
          time: '10:45 PM',
          contentFlyer: 'SFW NIGHT',
          tag: '.',
          caption: '### I want you to spread me open and make me feel how big you are 🥵',
          priceInfo: '.',
        },
      },
    ];
    for (let i = 0; i < wpTasks.length; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'WP',
          sortOrder: i,
          status: wpTasks[i].status,
          fields: wpTasks[i].fields,
        }),
      );
    }

    // ST tasks — 3 per day
    const stTasks: { fields: Record<string, string>; status: SchedulerTask['status'] }[] = [
      { status: day < 3 ? 'DONE' : 'PENDING', fields: { contentFlyer: '.', storyPostSchedule: '5:00 PM' } },
      { status: day < 1 ? 'DONE' : 'PENDING', fields: { contentFlyer: '.', storyPostSchedule: '7:00 PM' } },
      { status: 'PENDING', fields: { contentFlyer: '.', storyPostSchedule: '9:00 PM' } },
    ];
    for (let i = 0; i < stTasks.length; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'ST',
          sortOrder: i,
          status: stTasks[i].status,
          fields: stTasks[i].fields,
        }),
      );
    }

    // SP tasks — 3 per day
    const spTasks: { fields: Record<string, string>; status: SchedulerTask['status'] }[] = [
      {
        status: day < 2 ? 'DONE' : 'PENDING',
        fields: {
          subscriberPromoSchedule: 'Renew Promo',
          contentFlyer: 'https://www.allthiscash.com/uploads/Tita-Paid/2025-03-22_19:43:52-0.gif',
          time: '5:48 PM',
          caption: 'Wanna see the **𝐔𝐍𝐂𝐄𝐍𝐒𝐎𝐑𝐄𝐃 𝐏𝐈𝐂?** 🔞 If so then turn your renew on right now I send **𝐃𝐀𝐈𝐋𝐘 𝐅𝐑𝐄𝐄 𝐔𝐍𝐑𝐄𝐋𝐄𝐀𝐒𝐄𝐃 𝐁𝐔𝐍𝐃𝐋𝐄𝐒** to all of my renew on subs n I KNOW you won\'t wanna miss out 🥰\n\n**click the link below to turn renew on** ⬇️\nhttps://onlyfans.com/titasaharaofficial?enable_renew=1',
        },
      },
      {
        status: 'PENDING',
        fields: {
          subscriberPromoSchedule: 'Expired Promo',
          contentFlyer: 'https://www.allthiscash.com/uploads/Tita-Paid/2025-03-22_19:43:52-1.gif',
          time: '9:13 PM',
          caption: '𝐅𝐑𝐄𝐄 𝐒𝐔𝐑𝐏𝐑𝐈𝐒𝐄 😱 I made my page 𝗙𝗥𝗘𝗘 𝗙𝗢𝗥 𝟮𝟰 𝗛𝗢𝗨𝗥𝗦 👀 so that you can come back and see my 𝐔𝐍𝐑𝐄𝐋𝐄𝐀𝐒𝐄𝐃 𝐍𝐔𝐃𝐄𝐒 ❗️ DM me a 🔞 when you subscribe and I will spoil you with it for free 🥵',
        },
      },
      {
        status: 'PENDING',
        fields: {
          subscriberPromoSchedule: 'Renew Promo',
          contentFlyer: 'https://www.allthiscash.com/uploads/Tita-Paid/2025-03-22_19:43:52-2.gif',
          time: '6:05 AM',
          caption: '**𝙁𝙍𝙀𝙀 𝙐𝙉𝙍𝙀𝙇𝙀𝘼𝙎𝙀𝘿 𝙓𝙓𝙓𝙑𝙄𝘿𝙀𝙊** 🤫\nI am sending a **𝙁𝙐𝙇𝙇𝙔 𝙁𝙍𝙀𝙀** video bundle 🎥 out to everyone with renew on tonight... I love sending all my renew on subs **𝙁𝙍𝙀𝙀 𝙉𝙀𝙑𝙀𝙍 𝙍𝙀𝙇𝙀𝘼𝙎𝙀𝘿 𝙎𝙐𝙍𝙋𝙍𝙄𝙎𝙀𝙎** everyday\n\n**𝘾𝙡𝙞𝙘𝙠 𝙩𝙝𝙚 𝙡𝙞𝙣𝙠 𝙗𝙚𝙡𝙤𝙬 𝙩𝙤 𝙩𝙪𝙧𝙣 𝙧𝙚𝙣𝙚𝙬 𝙤𝙣** 👇🏻\nhttps://onlyfans.com/titasaharaofficial?enable_renew=1',
        },
      },
    ];
    for (let i = 0; i < spTasks.length; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'SP',
          sortOrder: i,
          status: spTasks[i].status,
          fields: spTasks[i].fields,
        }),
      );
    }
  }
  return samples;
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-[#151528] ${className}`} />;
}

function SkeletonDayColumn({ isToday }: { isToday?: boolean }) {
  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden ${
        isToday
          ? 'border-brand-blue/30 dark:border-[#38bdf8]/20'
          : 'border-gray-200 dark:border-[#111124]'
      } bg-white dark:bg-[#0a0a14]`}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100 dark:border-[#111124]">
        <div className="flex items-center justify-between mb-1.5">
          <SkeletonPulse className="h-3.5 w-10" />
          <SkeletonPulse className="h-3 w-14" />
        </div>
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-3 w-12" />
          <SkeletonPulse className="h-4 w-16 rounded-full" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-3 py-1.5">
        <SkeletonPulse className="h-1 w-full rounded-full" />
      </div>

      {/* Task cards */}
      <div className="flex-1 px-2 pb-2 space-y-1.5">
        {['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4', 'w-1/2'].map((w, i) => (
          <div key={i} className="rounded-lg border border-gray-100 dark:border-[#111124] p-2">
            <div className="flex items-center gap-2">
              <SkeletonPulse className="h-2 w-2 rounded-full shrink-0" />
              <SkeletonPulse className="h-2.5 w-8 rounded-full shrink-0" />
              <SkeletonPulse className={`h-2.5 ${w}`} />
            </div>
            {i % 2 === 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 ml-4">
                <SkeletonPulse className="h-2 w-12" />
                <SkeletonPulse className="h-2 w-8" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add button */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-[#111124]">
        <SkeletonPulse className="h-5 w-full rounded-md" />
      </div>
    </div>
  );
}

function SchedulerGridSkeleton() {
  return (
    <div
      className="grid gap-2 p-2 flex-1 overflow-x-auto"
      style={{ gridTemplateColumns: 'repeat(7, minmax(160px, 1fr))' }}
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <SkeletonDayColumn key={i} isToday={i === 2} />
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SchedulerGrid() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const LA_TZ = 'America/Los_Angeles';
  const { selectedProfile, isAllProfiles, loadingProfiles } = useInstagramProfile();

  // Platform tab state
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('free');

  // Fetch full profile details (page strategy, content types)
  const profileId = selectedProfile && !isAllProfiles ? selectedProfile.id : null;
  const { data: profileDetail } = useQuery<{
    pageStrategy?: string;
    selectedContentTypes?: string[];
    customStrategies?: { id: string; label: string; desc: string }[];
    customContentTypes?: string[];
  }>({
    queryKey: ['instagram-profile-detail', profileId],
    queryFn: async () => {
      const res = await fetch(`/api/instagram-profiles/${profileId}`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const [showContentTypes, setShowContentTypes] = useState(false);
  const contentTypesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contentTypesRef.current && !contentTypesRef.current.contains(e.target as Node)) {
        setShowContentTypes(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [schedulerToday, setSchedulerToday] = useState(() => getSchedulerTodayKey());

  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = getSchedulerTodayKey();
      setSchedulerToday((prev) => (prev !== newToday ? newToday : prev));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date(schedulerToday + 'T00:00:00Z');
    return formatDateKey(getWeekStart(today));
  });
  const [showConfig, setShowConfig] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Expanded column state (null = all normal)
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const toggleExpand = useCallback((dayIndex: number) => {
    setExpandedDay((prev) => (prev === dayIndex ? null : dayIndex));
  }, []);

  // Demo mode toggle
  const [showDemo, setShowDemo] = useState(false);
  const sampleTasks = useMemo(() => generateSampleTasks(), []);

  // Type filter state
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    () => new Set(TASK_TYPES),
  );

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Real-time
  useSchedulerRealtime(orgId);

  // Data — wait for profile selector to resolve before fetching
  const profileReady = isAllProfiles || !loadingProfiles;
  const activeProfileId = selectedProfile && !isAllProfiles ? selectedProfile.id : null;
  const { data: weekData, isLoading: weekLoading } = useSchedulerWeek(weekStart, activeProfileId, activePlatform, profileReady);
  const { data: configData, isLoading: configLoading } = useSchedulerConfig();

  const config = configData?.config ?? null;
  const realTasks = weekData?.tasks ?? [];
  const tasks = showDemo ? sampleTasks : realTasks;
  const teamNames = config?.teamNames ?? [];
  const rotationOffset = config?.rotationOffset ?? 0;
  const taskLimits = config?.taskLimits ?? null;

  // Mutations
  const updateTask = useUpdatePodTask();
  const createTask = useCreateSchedulerTask();
  const deleteTask = useDeleteSchedulerTask();
  const updateTaskLimits = useUpdateTaskLimits();
  // Week days
  const weekDays = useMemo(
    () => getWeekDays(new Date(weekStart + 'T00:00:00Z')),
    [weekStart],
  );

  // Map tasks by day, filtered by active types, sorted by type group then sortOrder
  const tasksByDay = useMemo(() => {
    const map = new Map<number, SchedulerTask[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);

    for (const t of tasks) {
      if (t.taskType && !activeTypes.has(t.taskType)) continue;
      const arr = map.get(t.dayOfWeek);
      if (arr) arr.push(t);
    }

    const typeOrder = Object.fromEntries(TASK_TYPES.map((t, i) => [t, i]));
    for (const [, dayTasks] of map) {
      dayTasks.sort((a, b) => {
        const typeA = typeOrder[a.taskType] ?? 999;
        const typeB = typeOrder[b.taskType] ?? 999;
        if (typeA !== typeB) return typeA - typeB;
        return a.sortOrder - b.sortOrder;
      });
    }

    return map;
  }, [tasks, activeTypes]);

  const handleUpdate = useCallback(
    (id: string, data: Partial<SchedulerTask>) => {
      if (showDemo) return;
      updateTask.mutate({ id, ...data, tabId });

      // ── Bidirectional sync: Unlock ↔ Follow up contentPreview ──
      if (data.fields) {
        const updatedFields = data.fields as Record<string, string>;
        if (updatedFields.contentPreview === undefined) return;

        const task = tasks.find((t) => t.id === id);
        if (!task || task.taskType !== 'MM') return;

        const taskTypeName = (
          (task.fields as Record<string, string> | null)?.type || task.taskName || ''
        ).toLowerCase();
        const isUnlock = taskTypeName.includes('unlock');
        const isFollowUp = taskTypeName.includes('follow up') || taskTypeName.includes('follow-up');

        if (!isUnlock && !isFollowUp) return;

        const dayTasks = tasksByDay.get(task.dayOfWeek) ?? [];
        const mmTasks = dayTasks.filter((t) => t.taskType === 'MM');
        const taskIdx = mmTasks.findIndex((t) => t.id === id);
        if (taskIdx < 0) return;

        if (isUnlock) {
          // Unlock → sync forward to Follow up(s)
          for (let i = taskIdx + 1; i < mmTasks.length; i++) {
            const next = mmTasks[i];
            const nextFields = (next.fields || {}) as Record<string, string>;
            const nextType = (nextFields.type || next.taskName || '').toLowerCase();

            if (nextType.includes('follow up') || nextType.includes('follow-up')) {
              const merged = { ...nextFields, contentPreview: updatedFields.contentPreview };
              updateTask.mutate({ id: next.id, fields: merged as SchedulerTask['fields'], tabId });
            } else if (nextType.includes('unlock')) {
              break;
            }
          }
        } else if (isFollowUp) {
          // Follow up → sync backward to the preceding Unlock
          for (let i = taskIdx - 1; i >= 0; i--) {
            const prev = mmTasks[i];
            const prevFields = (prev.fields || {}) as Record<string, string>;
            const prevType = (prevFields.type || prev.taskName || '').toLowerCase();

            if (prevType.includes('unlock')) {
              const merged = { ...prevFields, contentPreview: updatedFields.contentPreview };
              updateTask.mutate({ id: prev.id, fields: merged as SchedulerTask['fields'], tabId });
              // Also sync to any other Follow ups under that same Unlock
              for (let j = i + 1; j < mmTasks.length; j++) {
                const sibling = mmTasks[j];
                if (sibling.id === id) continue; // skip self
                const sibFields = (sibling.fields || {}) as Record<string, string>;
                const sibType = (sibFields.type || sibling.taskName || '').toLowerCase();
                if (sibType.includes('follow up') || sibType.includes('follow-up')) {
                  const sibMerged = { ...sibFields, contentPreview: updatedFields.contentPreview };
                  updateTask.mutate({ id: sibling.id, fields: sibMerged as SchedulerTask['fields'], tabId });
                } else if (sibType.includes('unlock')) {
                  break;
                }
              }
              break;
            }
          }
        }
      }
    },
    [updateTask, showDemo, tasks, tasksByDay],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (showDemo) return;
      deleteTask.mutate({ id, tabId });
    },
    [deleteTask, showDemo],
  );

  const handleCreateTask = useCallback(
    (dayOfWeek: number, taskType: string) => {
      if (showDemo) return;
      createTask.mutate({
        weekStart,
        dayOfWeek,
        taskType,
        platform: activePlatform,
        profileId: activeProfileId,
        tabId,
      });
    },
    [createTask, weekStart, showDemo, activePlatform, activeProfileId],
  );

  const handleUpdateTaskLimits = useCallback(
    (dayIndex: number, type: string, newMax: number | null) => {
      if (showDemo) return;
      const current: TaskLimits = taskLimits
        ? { defaults: { ...taskLimits.defaults }, overrides: { ...taskLimits.overrides } }
        : { defaults: {}, overrides: {} };

      const dayKey = String(dayIndex);
      if (newMax === null) {
        // Remove override for this day+type
        if (current.overrides[dayKey]) {
          const { [type]: _, ...rest } = current.overrides[dayKey];
          if (Object.keys(rest).length > 0) {
            current.overrides[dayKey] = rest;
          } else {
            const { [dayKey]: __, ...restOverrides } = current.overrides;
            current.overrides = restOverrides;
          }
        }
      } else {
        // Set override for this day+type
        current.overrides[dayKey] = { ...(current.overrides[dayKey] ?? {}), [type]: newMax };
      }

      const cleaned = cleanTaskLimits(current);
      const hasAny = Object.keys(cleaned.defaults).length > 0 || Object.keys(cleaned.overrides).length > 0;
      updateTaskLimits.mutate({ taskLimits: hasAny ? cleaned : null, tabId });
    },
    [taskLimits, showDemo, updateTaskLimits],
  );

  const showSetup = !configLoading && !config;
  const isLoading = weekLoading || configLoading || !profileReady;

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden bg-gray-50 text-gray-900 dark:bg-[#07070e] dark:text-zinc-300">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3 bg-white border-gray-200 dark:bg-[#090912] dark:border-[#111122]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-extrabold tracking-tight font-sans text-brand-dark-pink dark:text-brand-light-pink">
            Scheduler
          </span>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#181828]" />
          <span className="text-[9px] tracking-wide font-mono text-gray-400 dark:text-[#252545]">
            7-day rotation · resets 5 PM LA
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter toggles */}
          <div className="flex items-center gap-1 mr-2">
            {TASK_TYPES.map((type) => {
              const color = TASK_TYPE_COLORS[type];
              const isActive = activeTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans transition-all border"
                  style={{
                    background: isActive ? color + '25' : 'transparent',
                    color: isActive ? color : '#555',
                    borderColor: isActive ? color + '50' : '#333',
                    opacity: isActive ? 1 : 0.5,
                  }}
                  title={`${isActive ? 'Hide' : 'Show'} ${type} tasks`}
                >
                  {type}
                </button>
              );
            })}
          </div>

          {/* Demo toggle */}
          <button
            onClick={() => setShowDemo((p) => !p)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-sans border transition-all ${
              showDemo
                ? 'bg-amber-500/20 text-amber-400 border-amber-400/50'
                : 'text-gray-500 border-gray-600 opacity-50'
            }`}
            title="Toggle sample data preview"
          >
            DEMO
          </button>

          <SchedulerPresenceBar orgId={orgId} />


          {/* Setup teams button */}
          {/* {!isLoading && teamNames.length === 0 && (
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-brand-dark-pink border-brand-dark-pink/25 bg-brand-dark-pink/5 dark:text-[#ff9a6c] dark:border-[#ff9a6c40] dark:bg-[#ff9a6c12]"
            >
              <Settings className="h-3 w-3" />
              SETUP TEAMS
            </button>
          )} */}

          <button
            onClick={() => setShowHistory(true)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Change History"
          >
            <CalendarClock className="h-3.5 w-3.5 text-gray-400 dark:text-[#3a3a5a]" />
          </button>
          <button
            onClick={() => setShowActivity(true)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Activity Log"
          >
            <History className="h-3.5 w-3.5 text-gray-400 dark:text-[#3a3a5a]" />
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5 text-gray-400 dark:text-[#3a3a5a]" />
          </button>
        </div>
      </div>

      {/* Selected profile + platform tabs row */}
      {selectedProfile && !isAllProfiles && (
        <div className="px-4 py-2 border-b flex items-center gap-3 bg-white/50 border-gray-200 dark:bg-[#090912]/50 dark:border-[#111122]">
          {/* Profile name */}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold font-sans text-gray-800 dark:text-zinc-200 truncate">
              {selectedProfile.name}
            </span>
            {selectedProfile.instagramUsername && (
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600 truncate">
                @{selectedProfile.instagramUsername}
              </span>
            )}
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-[#181828]" />

          {/* Platform tabs */}
          <div className="flex items-center gap-1">
            {PLATFORM_TABS.map((tab) => {
              const isActive = activePlatform === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActivePlatform(tab.key)}
                  className="text-[10px] font-bold px-3 py-1 rounded-full font-sans transition-all border"
                  style={{
                    background: isActive ? tab.color + '20' : 'transparent',
                    color: isActive ? tab.color : '#888',
                    borderColor: isActive ? tab.color + '50' : 'transparent',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: strategy + content types + import */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* Page Strategy */}
            {profileDetail?.pageStrategy && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                {(() => {
                  const label = STRATEGY_LABELS[profileDetail.pageStrategy!];
                  if (label) return label;
                  const custom = profileDetail.customStrategies?.find(s => s.id === profileDetail.pageStrategy);
                  return custom?.label ?? profileDetail.pageStrategy;
                })()}
              </span>
            )}

            {/* Content Types */}
            {profileDetail?.selectedContentTypes && profileDetail.selectedContentTypes.length > 0 && (
              <div className="relative" ref={contentTypesRef}>
                <button
                  onClick={() => setShowContentTypes(p => !p)}
                  className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-purple-500/10 text-purple-400 border border-purple-500/20 transition-colors hover:bg-purple-500/20"
                >
                  {profileDetail.selectedContentTypes.length} CONTENT TYPE{profileDetail.selectedContentTypes.length !== 1 ? 'S' : ''}
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showContentTypes ? 'rotate-180' : ''}`} />
                </button>
                {showContentTypes && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#0c0c1a] border border-gray-200 dark:border-[#1a1a2e] rounded-lg shadow-xl p-2 min-w-[180px] max-w-[260px]">
                    <div className="flex flex-wrap gap-1">
                      {profileDetail.selectedContentTypes.map(ct => (
                        <span
                          key={ct}
                          className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        >
                          {ct}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="w-px h-4 bg-gray-200 dark:bg-[#181828]" />

            {/* Import button */}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700 dark:text-gray-500 dark:border-[#252545] dark:hover:border-[#3a3a5a] dark:hover:text-gray-300"
            >
              <Download className="h-3 w-3" />
              IMPORT
            </button>

            {/* Export button */}
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700 dark:text-gray-500 dark:border-[#252545] dark:hover:border-[#3a3a5a] dark:hover:text-gray-300"
            >
              <Upload className="h-3 w-3" />
              EXPORT
            </button>
          </div>
        </div>
      )}

      {/* Week nav */}
      <SchedulerWeekNav weekStart={weekStart} todayKey={schedulerToday} onWeekChange={setWeekStart} />

      {/* Grid */}
      {isLoading && !showDemo ? (
        <SchedulerGridSkeleton />
      ) : expandedDay !== null ? (
        /* ── Expanded layout: horizontal row, strips overlap like fanned cards ── */
        <div className="flex flex-1 overflow-visible p-2 items-stretch">
          {weekDays.map((date, dayIndex) => {
            const dayTasks = tasksByDay.get(dayIndex) ?? [];
            const team = getTeamForDay(date, teamNames, schedulerToday, rotationOffset);
            const dateStr = formatDateKey(date);
            const isExpanded = dayIndex === expandedDay;

            return (
              <SchedulerDayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                date={date}
                tasks={dayTasks}
                team={team}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateTask={handleCreateTask}
                isToday={dateStr === schedulerToday}
                timeZone={LA_TZ}
                weekStart={weekStart}
                expanded={isExpanded}
                collapsed={!isExpanded}
                popupDirection={dayIndex > expandedDay! ? 'left' : 'right'}
                onToggleExpand={() => toggleExpand(dayIndex)}
                taskLimits={taskLimits}
                onUpdateTaskLimits={handleUpdateTaskLimits}
              />
            );
          })}
        </div>
      ) : (
        /* ── Normal grid: all columns equal ── */
        <div
          className="grid gap-2 p-2 flex-1 overflow-x-auto"
          style={{ gridTemplateColumns: 'repeat(7, minmax(160px, 1fr))' }}
        >
          {weekDays.map((date, dayIndex) => {
            const dayTasks = tasksByDay.get(dayIndex) ?? [];
            const team = getTeamForDay(date, teamNames, schedulerToday, rotationOffset);
            const dateStr = formatDateKey(date);

            return (
              <SchedulerDayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                date={date}
                tasks={dayTasks}
                team={team}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateTask={handleCreateTask}
                isToday={dateStr === schedulerToday}
                timeZone={LA_TZ}
                weekStart={weekStart}
                expanded={false}
                collapsed={false}
                onToggleExpand={() => toggleExpand(dayIndex)}
                taskLimits={taskLimits}
                onUpdateTaskLimits={handleUpdateTaskLimits}
              />
            );
          })}
        </div>
      )}

      {/* Modals / Panels */}
      <SchedulerConfigModal
        config={config}
        open={showConfig || showSetup}
        onClose={() => setShowConfig(false)}
      />
      <SchedulerActivityLog open={showActivity} onClose={() => setShowActivity(false)} />
      <SchedulerHistoryCalendar
        open={showHistory}
        onClose={() => setShowHistory(false)}
        profileId={activeProfileId}
        platform={activePlatform}
      />
      <SchedulerImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        weekStart={weekStart}
        platform={activePlatform}
        profileId={activeProfileId}
      />
      <SchedulerExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        weekStart={weekStart}
        platform={activePlatform}
        profileId={activeProfileId}
        profileName={selectedProfile?.name ?? 'Schedule'}
        weekDays={weekDays}
        tasksByDay={tasksByDay}
      />
    </div>
  );
}
