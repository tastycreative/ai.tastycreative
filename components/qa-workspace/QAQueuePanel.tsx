'use client';

import { memo, useRef, useCallback, useMemo } from 'react';
import { Search, FileText, Film, ChevronRight, RotateCcw, Clock } from 'lucide-react';
import type { QAQueueItem } from '@/lib/hooks/useQAQueue.query';

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
  const ageH = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (ageH < 4) return { label: `${Math.max(1, Math.round(ageH))}h`, color: 'text-emerald-500' };
  if (ageH < 12) return { label: `${Math.round(ageH)}h`, color: 'text-amber-500' };
  if (ageH < 24) return { label: `${Math.round(ageH)}h`, color: 'text-orange-500' };
  const d = Math.floor(ageH / 24);
  return { label: `${d}d`, color: 'text-red-500' };
}

/* ── Priority config ──────────────────────────────────────────── */

const PRIORITY_BORDER: Record<string, string> = {
  Urgent: 'border-l-rose-400',
  High: 'border-l-amber-400',
  Normal: 'border-l-sky-400',
  Low: 'border-l-emerald-400',
};

const PRIORITY_DOT: Record<string, string> = {
  Urgent: 'bg-rose-400',
  High: 'bg-amber-400',
  Normal: 'bg-sky-400',
  Low: 'bg-emerald-400',
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
  // Sexting set category badges
  SEXTING_SET: { bg: 'bg-fuchsia-500/15 border-fuchsia-500/25', text: 'text-fuchsia-400' },
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

/* ── Queue Item Card ──────────────────────────────────────────── */

const QueueItemCard = memo(function QueueItemCard({
  item,
  isSelected,
  onClick,
  getMemberName,
  searchQuery,
}: {
  item: QAQueueItem;
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

/* ── Main QAQueuePanel ────────────────────────────────────────── */

interface QAQueuePanelProps {
  queue: QAQueueItem[];
  selectedIndex: number;
  onSelectTicket: (index: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  getMemberName: (id?: string | null) => string | null;
}

function QAQueuePanelComponent({
  queue,
  selectedIndex,
  onSelectTicket,
  searchQuery,
  onSearchChange,
  getMemberName,
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
      <div className="px-3 py-2.5 border-b border-gray-200/50 dark:border-white/[0.06] shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search tickets..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/[0.08] text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30"
          />
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
          queue.map((item, idx) => (
            <QueueItemCard
              key={item.id}
              item={item}
              isSelected={idx === selectedIndex}
              onClick={() => onSelectTicket(idx)}
              getMemberName={getMemberName}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  );
}

const QAQueuePanel = memo(QAQueuePanelComponent);
export default QAQueuePanel;
