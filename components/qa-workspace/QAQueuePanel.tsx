'use client';

import { memo, useRef, useCallback } from 'react';
import { Search, FileText, Film, ChevronRight, RotateCcw, Clock, Calendar, Send } from 'lucide-react';
import type { QAQueueItem } from '@/lib/hooks/useQAQueue.query';
import type { UnifiedQAItem, QASourceFilter } from './QAWorkspace';

/* ── Helpers ──────────────────────────────────────────────────── */

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlight matching substrings with a styled <mark> */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark key={i} className="bg-yellow-300/40 dark:bg-yellow-400/20 text-inherit rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ageBadgeProps(createdAt: string) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageMin = ageMs / (1000 * 60);
  const ageH = ageMin / 60;
  if (ageMin < 60) return { label: `${Math.max(1, Math.round(ageMin))}m`, color: 'text-emerald-500' };
  if (ageH < 4) return { label: `${Math.round(ageH)}h`, color: 'text-emerald-500' };
  if (ageH < 12) return { label: `${Math.round(ageH)}h`, color: 'text-amber-500' };
  if (ageH < 24) return { label: `${Math.round(ageH)}h`, color: 'text-orange-500' };
  const d = Math.floor(ageH / 24);
  return { label: `${d}d`, color: 'text-red-500' };
}

/** Compute deadline countdown from taskDate (YYYY-MM-DD) + time field (LA time) */
function deadlineBadgeProps(taskDate: string | undefined, timeStr?: string) {
  const fallback = { label: '—', color: 'text-gray-400' };
  if (!taskDate) return fallback;

  try {
    // taskDate is already the full date like "2026-04-02"
    const d = new Date(taskDate + 'T00:00:00Z');
    if (isNaN(d.getTime())) return fallback;

    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();

    let hours = 23;
    let minutes = 59;
    if (timeStr) {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = (match[3] || '').toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }

    // Convert LA time to UTC: guess PDT (UTC-7), verify via Intl, fallback PST (UTC-8)
    const guess = new Date(Date.UTC(year, month, day, hours + 7, minutes));
    let deadlineMs = guess.getTime();
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hour12: false,
      }).formatToParts(guess);
      const laHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0');
      if (laHour !== hours % 24) {
        deadlineMs = Date.UTC(year, month, day, hours + 8, minutes);
      }
    } catch {
      deadlineMs = Date.UTC(year, month, day, hours + 8, minutes);
    }

    const diffMs = deadlineMs - Date.now();

    if (diffMs <= 0) {
      const overH = Math.abs(diffMs) / (1000 * 60 * 60);
      if (overH < 1) return { label: `${Math.max(1, Math.round(Math.abs(diffMs) / (1000 * 60)))}m over`, color: 'text-red-500' };
      if (overH < 24) return { label: `${Math.round(overH)}h over`, color: 'text-red-500' };
      return { label: `${Math.floor(overH / 24)}d over`, color: 'text-red-500' };
    }

    const diffMin = diffMs / (1000 * 60);
    const diffH = diffMin / 60;
    if (diffMin < 60) return { label: `${Math.round(diffMin)}m left`, color: 'text-red-500' };
    if (diffH < 4) return { label: `${Math.round(diffH)}h left`, color: 'text-orange-500' };
    if (diffH < 12) return { label: `${Math.round(diffH)}h left`, color: 'text-amber-500' };
    if (diffH < 24) return { label: `${Math.round(diffH)}h left`, color: 'text-emerald-500' };
    const days = Math.floor(diffH / 24);
    return { label: `${days}d left`, color: 'text-emerald-500' };
  } catch {
    return fallback;
  }
}

/* ── Priority config ──────────────────────────────────────────── */

const PRIORITY_BORDER: Record<string, string> = {
  Urgent: 'border-l-rose-400',
  High: 'border-l-amber-400',
  Normal: 'border-l-sky-400',
  Low: 'border-l-emerald-400',
};

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  OTP: { bg: 'bg-blue-500/15 border-blue-500/25', text: 'text-blue-400' },
  PTR: { bg: 'bg-brand-light-pink/15 border-brand-light-pink/25', text: 'text-brand-light-pink' },
  OTM: { bg: 'bg-violet-500/15 border-violet-500/25', text: 'text-violet-400' },
  PPV: { bg: 'bg-emerald-500/15 border-emerald-500/25', text: 'text-emerald-400' },
  GAME: { bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400' },
  LIVE: { bg: 'bg-red-500/15 border-red-500/25', text: 'text-red-400' },
  TIP_ME: { bg: 'bg-cyan-500/15 border-cyan-500/25', text: 'text-cyan-400' },
  VIP: { bg: 'bg-yellow-500/15 border-yellow-500/25', text: 'text-yellow-400' },
  DM_FUNNEL: { bg: 'bg-indigo-500/15 border-indigo-500/25', text: 'text-indigo-400' },
  RENEW_ON: { bg: 'bg-teal-500/15 border-teal-500/25', text: 'text-teal-400' },
  CUSTOM: { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' },
  SEXTING_SET: { bg: 'bg-fuchsia-500/15 border-fuchsia-500/25', text: 'text-fuchsia-400' },
};

/* ── Scheduler task type badge colors ─────────────────────────── */

const SCHEDULER_TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  MM: { bg: 'bg-pink-500/15 border-pink-500/25', text: 'text-pink-400' },
  WP: { bg: 'bg-sky-500/15 border-sky-500/25', text: 'text-sky-400' },
  ST: { bg: 'bg-violet-500/15 border-violet-500/25', text: 'text-violet-400' },
  SP: { bg: 'bg-orange-500/15 border-orange-500/25', text: 'text-orange-400' },
};

/* ── Status indicators ────────────────────────────────────────── */

const SEXTING_SET_STATUS_COLORS: Record<string, string> = {
  PENDING_CAPTION: 'bg-gray-400',
  IN_CAPTION: 'bg-amber-400',
  FOR_QA: 'bg-brand-blue',
  REVISION_REQUIRED: 'bg-red-400',
  PARTIALLY_APPROVED: 'bg-orange-400',
  IN_REVISION: 'bg-orange-400',
  QA_APPROVED: 'bg-cyan-400',
  COMPLETED: 'bg-emerald-400',
};

function CaptionStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    APPROVED: 'bg-emerald-400',
    AWAITING_APPROVAL: 'bg-violet-400',
    IN_CAPTION: 'bg-brand-blue',
    NEEDS_REVISION: 'bg-red-400',
    PENDING_CAPTION: 'bg-amber-400',
  };
  return (
    <div className="flex items-center gap-1" title={`Caption: ${status}`}>
      <FileText className="w-3 h-3 text-gray-500" />
      <span className={`w-1.5 h-1.5 rounded-full ${colors[status] ?? 'bg-gray-400'}`} />
    </div>
  );
}

function FlyerStatusDot({ hasGif }: { hasGif: boolean }) {
  return (
    <div className="flex items-center gap-1" title={hasGif ? 'GIF attached' : 'No GIF'}>
      <Film className="w-3 h-3 text-gray-500" />
      <span className={`w-1.5 h-1.5 rounded-full ${hasGif ? 'bg-emerald-400' : 'bg-amber-400'}`} />
    </div>
  );
}

/* ── Content Queue Item Card ──────────────────────────────────── */

const ContentQueueItemCard = memo(function ContentQueueItemCard({
  item,
  isSelected,
  onClick,
  getMemberName,
  searchQuery,
}: {
  item: QAQueueItem & { source: 'content' };
  isSelected: boolean;
  onClick: () => void;
  getMemberName: (id?: string | null) => string | null;
  searchQuery: string;
}) {
  const meta = item.metadata;
  const isSextingSets = item.workflowType === 'SEXTING_SETS';
  const postOrigin = (meta.postOrigin as string) ?? (meta.requestType as string) ?? '';
  const category = (meta.category as string) ?? '';
  const model = (meta.model as string) ?? '';
  const price = meta.price as number | undefined;
  const captionStatus = (meta.otpPtrCaptionStatus as string) ?? '';
  const sextingSetStatus = (meta.sextingSetStatus as string) ?? '';
  const gifUrl = (meta.gifUrl as string) ?? '';
  const hasGif = !!gifUrl.trim();
  const badgeKey = isSextingSets ? 'SEXTING_SET' : postOrigin;
  const badgeLabel = isSextingSets ? (category || 'Sexting Set') : (postOrigin || 'N/A');
  const typeBadge = TYPE_BADGE[badgeKey] ?? TYPE_BADGE[postOrigin] ?? { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' };
  const priorityBorder = PRIORITY_BORDER[item.priority ?? ''] ?? 'border-l-transparent';
  const assigneeName = getMemberName(item.assigneeId);
  const revisionCount = (item.history ?? []).filter(h => h.action?.toLowerCase().includes('reject')).length;
  const age = ageBadgeProps(item.createdAt);

  return (
    <button
      onClick={onClick}
      className={[
        'group w-full text-left rounded-xl overflow-hidden select-none border-l-[3px] transition-all duration-200',
        priorityBorder,
        isSelected
          ? 'bg-emerald-500/10 dark:bg-emerald-500/8 border border-emerald-500/30 shadow-md shadow-emerald-500/10'
          : 'bg-white/90 dark:bg-gray-900/70 border border-gray-200/80 dark:border-white/[0.08] hover:border-emerald-500/20 hover:shadow-sm',
      ].join(' ')}
    >
      <div className="px-3 py-2.5">
        {/* Row 1: Type badge + ticket no + statuses */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${typeBadge.bg} ${typeBadge.text}`}>
            {badgeLabel}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-500 font-mono">
            #{item.itemNo}
          </span>
          <span className="flex-1" />
          {revisionCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-orange-400" title={`${revisionCount} revision(s)`}>
              <RotateCcw className="w-2.5 h-2.5" />{revisionCount}
            </span>
          )}
          <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${age.color}`} title="Time in queue">
            <Clock className="w-2.5 h-2.5" />{age.label}
          </span>
          <CaptionStatusDot status={isSextingSets ? '' : captionStatus} />
          {isSextingSets ? (
            sextingSetStatus ? (
              <div className="flex items-center gap-1" title={`Status: ${sextingSetStatus}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${SEXTING_SET_STATUS_COLORS[sextingSetStatus] ?? 'bg-gray-400'}`} />
              </div>
            ) : null
          ) : (
            <FlyerStatusDot hasGif={hasGif} />
          )}
        </div>

        {/* Row 2: Title */}
        <p className="text-[12px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-1 mb-1">
          <Highlight text={item.title} query={searchQuery} />
        </p>

        {/* Row 3: Model + price */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
          {item.modelProfile?.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.modelProfile.profileImageUrl}
              alt=""
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-[8px] font-bold">
              {model.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate max-w-[100px]"><Highlight text={model || 'Unknown'} query={searchQuery} /></span>
          {!isSextingSets && price != null && price > 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span className="font-medium text-emerald-400">${price}</span>
            </>
          )}
          <span className="flex-1" />
          {assigneeName && (
            <span className="truncate max-w-[60px] text-gray-400" title={assigneeName}>
              {assigneeName}
            </span>
          )}
          {isSelected && <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />}
        </div>
      </div>
    </button>
  );
});

/* ── Scheduler Queue Item Card ────────────────────────────────── */

const SchedulerQueueItemCard = memo(function SchedulerQueueItemCard({
  item,
  isSelected,
  onClick,
  searchQuery,
}: {
  item: UnifiedQAItem & { source: 'scheduler' };
  isSelected: boolean;
  onClick: () => void;
  searchQuery: string;
}) {
  const typeBadge = SCHEDULER_TYPE_BADGE[item.taskType] ?? { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' };
  const timeField = (item.fields?.time as string) || (item.fields?.storyPostSchedule as string) || '';
  const deadline = deadlineBadgeProps(item.taskDate, timeField);
  const captionSnippet = item.caption.length > 80 ? item.caption.slice(0, 80) + '...' : item.caption;

  return (
    <button
      onClick={onClick}
      className={[
        'group w-full text-left rounded-xl overflow-hidden select-none border-l-[3px] border-l-brand-blue transition-all duration-200',
        isSelected
          ? 'bg-emerald-500/10 dark:bg-emerald-500/8 border border-emerald-500/30 shadow-md shadow-emerald-500/10'
          : 'bg-white/90 dark:bg-gray-900/70 border border-gray-200/80 dark:border-white/[0.08] hover:border-emerald-500/20 hover:shadow-sm',
      ].join(' ')}
    >
      <div className="px-3 py-2.5">
        {/* Row 1: Scheduler badge + type + date */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wide bg-brand-blue/15 border-brand-blue/25 text-brand-blue">
            SCH
          </span>
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${typeBadge.bg} ${typeBadge.text}`}>
            {item.taskType}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-500 font-mono">
            {item.platform}
          </span>
          <span className="flex-1" />
          <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${deadline.color}`} title="Deadline countdown">
            <Clock className="w-2.5 h-2.5" />{deadline.label}
          </span>
        </div>

        {/* Row 2: Caption snippet */}
        <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-snug line-clamp-2 mb-1 font-mono">
          {captionSnippet || <span className="text-gray-400 italic">No caption</span>}
        </p>

        {/* Row 3: Model + date */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
          {item.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.profileImage}
              alt=""
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <span className="w-4 h-4 rounded-full bg-brand-blue/15 text-brand-blue flex items-center justify-center text-[8px] font-bold">
              {item.profileName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate max-w-[100px]"><Highlight text={item.profileName} query={searchQuery} /></span>
          <span className="text-gray-400">·</span>
          <span className="inline-flex items-center gap-0.5">
            <Calendar className="w-2.5 h-2.5" />
            {item.taskDate}
          </span>
          <span className="flex-1" />
          {isSelected && <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />}
        </div>

        {/* Row 4: Submitted by */}
        {item.submittedBy?.name && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-gray-400 dark:text-gray-500">
            <Send className="w-2.5 h-2.5 text-brand-blue/60 shrink-0" />
            <span>by</span>
            {item.submittedBy.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.submittedBy.imageUrl} alt="" className="w-3.5 h-3.5 rounded-full" />
            )}
            <span className="font-medium text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
              {item.submittedBy.name}
            </span>
          </div>
        )}
      </div>
    </button>
  );
});

/* ── Main QAQueuePanel ────────────────────────────────────────── */

interface QAQueuePanelProps {
  queue: UnifiedQAItem[];
  selectedIndex: number;
  onSelectTicket: (index: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  getMemberName: (id?: string | null) => string | null;
  sourceFilter: QASourceFilter;
  onSourceFilterChange: (filter: QASourceFilter) => void;
  contentCount: number;
  schedulerCount: number;
}

function QAQueuePanelComponent({
  queue,
  selectedIndex,
  onSelectTicket,
  searchQuery,
  onSearchChange,
  getMemberName,
  sourceFilter,
  onSourceFilterChange,
  contentCount,
  schedulerCount,
}: QAQueuePanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange],
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900/80 border-r border-emerald-500/20">
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-gray-200/50 dark:border-white/[0.06] shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search tickets..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/[0.08] text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30"
          />
        </div>

        {/* Source filter */}
        <div className="flex gap-1">
          {([
            { key: 'all' as const, label: 'All', count: contentCount + schedulerCount },
            { key: 'content' as const, label: 'Content', count: contentCount },
            { key: 'scheduler' as const, label: 'Scheduler', count: schedulerCount },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => onSourceFilterChange(key)}
              className={`flex-1 text-[10px] font-semibold px-2 py-1.5 rounded-md transition-all ${
                sourceFilter === key
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1 px-1 py-px rounded text-[8px] ${
                  sourceFilter === key
                    ? 'bg-emerald-500/20'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div ref={listRef} className="flex-1 overflow-auto px-2 py-2 space-y-1.5">
        {queue.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {searchQuery ? 'No matching tickets' : 'No tickets in QA'}
            </p>
          </div>
        ) : (
          queue.map((item, idx) =>
            item.source === 'scheduler' ? (
              <SchedulerQueueItemCard
                key={`sch-${item.id}`}
                item={item}
                isSelected={idx === selectedIndex}
                onClick={() => onSelectTicket(idx)}
                searchQuery={searchQuery}
              />
            ) : (
              <ContentQueueItemCard
                key={`cnt-${item.id}`}
                item={item}
                isSelected={idx === selectedIndex}
                onClick={() => onSelectTicket(idx)}
                getMemberName={getMemberName}
                searchQuery={searchQuery}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

const QAQueuePanel = memo(QAQueuePanelComponent);
export default QAQueuePanel;
