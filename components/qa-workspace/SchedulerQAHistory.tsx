'use client';

import { memo, useState } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Loader2,
  Pencil,
  ArrowRight,
} from 'lucide-react';
import { useTaskHistory, type TaskHistoryItem } from '@/lib/hooks/useScheduler.query';

/* ── Helpers ──────────────────────────────────────────────────── */

const QA_ACTIONS = new Set([
  'caption_sent_to_qa',
  'caption_qa_approved',
  'caption_qa_rejected',
]);

function isQAHistoryItem(item: TaskHistoryItem) {
  return QA_ACTIONS.has(item.action);
}

/** Skip internal/meta fields from full history display */
const HIDDEN_FIELDS = new Set([
  'fields.flagged',
  'fields._previousCaption',
  'fields._unlockPaywallContent',
  'fields.captionId',
  'fields.flyerAssetId',
  'flagged',
  '_previousCaption',
  '_unlockPaywallContent',
  'captionId',
  'flyerAssetId',
]);

function qaActionIcon(action: string) {
  switch (action) {
    case 'caption_sent_to_qa':
      return <Send className="w-3.5 h-3.5 text-brand-blue" />;
    case 'caption_qa_approved':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    case 'caption_qa_rejected':
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function qaActionLabel(action: string) {
  switch (action) {
    case 'caption_sent_to_qa':
      return 'Sent to QA';
    case 'caption_qa_approved':
      return 'Approved';
    case 'caption_qa_rejected':
      return 'Rejected';
    default:
      return action;
  }
}

function qaActionColor(action: string) {
  switch (action) {
    case 'caption_sent_to_qa':
      return 'text-brand-blue';
    case 'caption_qa_approved':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'caption_qa_rejected':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-500';
  }
}

/** Pretty field name from raw field key */
function prettyFieldName(field: string) {
  // Strip "fields." prefix
  const key = field.replace(/^fields\./, '');
  // Known labels
  const labels: Record<string, string> = {
    status: 'Status',
    taskType: 'Task Type',
    taskName: 'Task Name',
    type: 'Type',
    subType: 'Style',
    time: 'Time',
    contentPreview: 'Content/Preview',
    contentFlyer: 'Content/Flyer',
    paywallContent: 'Paywall Content',
    folderName: 'Folder Name',
    tag: 'Tag',
    caption: 'Caption',
    captionBankText: 'Caption',
    captionGuide: 'Caption Guide',
    captionQAStatus: 'QA Status',
    price: 'Price',
    priceInfo: 'Price/Info',
    finalAmount: 'Final Amount',
    postSchedule: 'Post Schedule',
    notes: 'Notes',
    sortOrder: 'Sort Order',
    flyerAssetUrl: 'GIF/Flyer',
    qaRejectionReason: 'QA Rejection Reason',
    _qaRejectionReason: 'QA Rejection Reason',
    storyPostSchedule: 'Story Schedule',
  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Truncate long values for display */
function truncateValue(val: string, max = 60) {
  if (!val || val.length <= max) return val;
  return val.slice(0, max) + '...';
}

/* ── Timeline Item (shared) ──────────────────────────────────── */

function TimelineItem({
  icon,
  label,
  labelColor,
  time,
  userName,
  userImage,
  children,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor: string;
  time: string;
  userName?: string | null;
  userImage?: string | null;
  children?: React.ReactNode;
  isLast: boolean;
}) {
  return (
    <div className="relative flex gap-3 px-4 py-2.5">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[27px] top-[30px] bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
      )}

      {/* Icon */}
      <div className="relative z-10 w-6 h-6 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-bold ${labelColor}`}>
            {label}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-600">
            {formatTime(time)}
          </span>
        </div>

        {/* Who */}
        {userName && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="w-3.5 h-3.5 rounded-full" />
            ) : (
              <User className="w-3 h-3 text-gray-400" />
            )}
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {userName}
            </span>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

/* ── QA History View ─────────────────────────────────────────── */

function QAHistoryView({
  allItems,
  qaItems,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}: {
  allItems: TaskHistoryItem[];
  qaItems: TaskHistoryItem[];
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}) {
  if (qaItems.length === 0) {
    return (
      <div className="px-4 py-3 text-[11px] text-gray-400 dark:text-gray-600">
        No QA history yet
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {qaItems.map((item, idx) => {
        // Skip rejection reason rows (shown inline with reject action)
        const isRejectReason =
          item.field === 'qaRejectionReason' || item.field === '_qaRejectionReason' ||
          item.field === 'fields.qaRejectionReason' || item.field === 'fields._qaRejectionReason';
        if (isRejectReason) return null;

        // Find paired rejection reason
        const rejectReason =
          item.action === 'caption_qa_rejected'
            ? allItems.find(
                (h) =>
                  (h.field === 'qaRejectionReason' || h.field === '_qaRejectionReason' ||
                   h.field === 'fields.qaRejectionReason' || h.field === 'fields._qaRejectionReason') &&
                  h.newValue &&
                  Math.abs(new Date(h.createdAt).getTime() - new Date(item.createdAt).getTime()) < 5000,
              )
            : null;

        const isLast = idx === qaItems.length - 1;

        return (
          <TimelineItem
            key={item.id}
            icon={qaActionIcon(item.action)}
            label={qaActionLabel(item.action)}
            labelColor={qaActionColor(item.action)}
            time={item.createdAt}
            userName={item.user?.name}
            userImage={item.user?.imageUrl}
            isLast={isLast}
          >
            {rejectReason?.newValue && (
              <div className="mt-1.5 px-2.5 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 rounded-lg">
                <p className="text-[10px] text-red-600 dark:text-red-400">
                  {rejectReason.newValue}
                </p>
              </div>
            )}
          </TimelineItem>
        );
      })}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full px-4 py-2 text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more history'}
        </button>
      )}
    </div>
  );
}

/* ── Full Task History View ───────────────────────────────────── */

function FullHistoryView({
  allItems,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}: {
  allItems: TaskHistoryItem[];
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}) {
  // Filter out hidden internal fields and rejection reason duplicates
  const visibleItems = allItems.filter((item) => {
    if (HIDDEN_FIELDS.has(item.field)) return false;
    // Skip rejection reason rows — shown inline with reject action
    if (
      item.field === 'qaRejectionReason' || item.field === '_qaRejectionReason' ||
      item.field === 'fields.qaRejectionReason' || item.field === 'fields._qaRejectionReason'
    ) return false;
    return true;
  });

  if (visibleItems.length === 0) {
    return (
      <div className="px-4 py-3 text-[11px] text-gray-400 dark:text-gray-600">
        No task history yet
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {visibleItems.map((item, idx) => {
        const isQA = QA_ACTIONS.has(item.action);
        const isLast = idx === visibleItems.length - 1;

        // For QA actions, use dedicated labels
        if (isQA) {
          const rejectReason =
            item.action === 'caption_qa_rejected'
              ? allItems.find(
                  (h) =>
                    (h.field === 'qaRejectionReason' || h.field === '_qaRejectionReason' ||
                     h.field === 'fields.qaRejectionReason' || h.field === 'fields._qaRejectionReason') &&
                    h.newValue &&
                    Math.abs(new Date(h.createdAt).getTime() - new Date(item.createdAt).getTime()) < 5000,
                )
              : null;

          return (
            <TimelineItem
              key={item.id}
              icon={qaActionIcon(item.action)}
              label={qaActionLabel(item.action)}
              labelColor={qaActionColor(item.action)}
              time={item.createdAt}
              userName={item.user?.name}
              userImage={item.user?.imageUrl}
              isLast={isLast}
            >
              {rejectReason?.newValue && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 rounded-lg">
                  <p className="text-[10px] text-red-600 dark:text-red-400">
                    {rejectReason.newValue}
                  </p>
                </div>
              )}
            </TimelineItem>
          );
        }

        // For regular field changes
        const fieldName = prettyFieldName(item.field);

        return (
          <TimelineItem
            key={item.id}
            icon={<Pencil className="w-3 h-3 text-gray-400" />}
            label={fieldName}
            labelColor="text-gray-600 dark:text-gray-300"
            time={item.createdAt}
            userName={item.user?.name}
            userImage={item.user?.imageUrl}
            isLast={isLast}
          >
            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono">
              {item.oldValue ? (
                <>
                  <span className="text-gray-400 dark:text-gray-600 line-through truncate max-w-[120px]">
                    {truncateValue(item.oldValue)}
                  </span>
                  <ArrowRight className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                </>
              ) : null}
              <span className="text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                {truncateValue(item.newValue || '(empty)')}
              </span>
            </div>
          </TimelineItem>
        );
      })}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full px-4 py-2 text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more history'}
        </button>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

interface SchedulerQAHistoryProps {
  taskId: string | null;
}

function SchedulerQAHistoryComponent({ taskId }: SchedulerQAHistoryProps) {
  const [tab, setTab] = useState<'qa' | 'all'>('qa');
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useTaskHistory(taskId);

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const qaItems = allItems.filter(isQAHistoryItem);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading history...
      </div>
    );
  }

  return (
    <div>
      {/* Tab toggle */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 dark:border-white/[0.04]">
        <button
          onClick={() => setTab('qa')}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full font-sans transition-all ${
            tab === 'qa'
              ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/25'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border border-transparent'
          }`}
        >
          QA History
          {qaItems.length > 0 && (
            <span className="ml-1 text-[9px] opacity-70">({qaItems.length})</span>
          )}
        </button>
        <button
          onClick={() => setTab('all')}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full font-sans transition-all ${
            tab === 'all'
              ? 'bg-gray-200/60 dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-300/50 dark:border-white/10'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border border-transparent'
          }`}
        >
          All History
          {allItems.length > 0 && (
            <span className="ml-1 text-[9px] opacity-70">({allItems.length})</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'qa' ? (
        <QAHistoryView
          allItems={allItems}
          qaItems={qaItems}
          hasNextPage={hasNextPage ?? false}
          fetchNextPage={fetchNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      ) : (
        <FullHistoryView
          allItems={allItems}
          hasNextPage={hasNextPage ?? false}
          fetchNextPage={fetchNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      )}
    </div>
  );
}

export const SchedulerQAHistory = memo(SchedulerQAHistoryComponent);
export default SchedulerQAHistory;
