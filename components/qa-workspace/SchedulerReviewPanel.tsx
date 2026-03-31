'use client';

import { memo, useState, useCallback } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchedulerCaptionReview, type SchedulerQAItem } from '@/lib/hooks/useQAQueue.query';
import { TASK_FIELD_DEFS } from '@/lib/hooks/useScheduler.query';

/* ── Helpers ──────────────────────────────────────────────────── */

const TASK_TYPE_COLORS: Record<string, string> = {
  MM: '#f472b6',
  WP: '#38bdf8',
  ST: '#c084fc',
  SP: '#fb923c',
};

/* ── Main Component ──────────────────────────────────────────── */

interface SchedulerReviewPanelProps {
  item: SchedulerQAItem | undefined;
  onReviewComplete: () => void;
}

function SchedulerReviewPanelComponent({ item, onReviewComplete }: SchedulerReviewPanelProps) {
  const reviewMutation = useSchedulerCaptionReview();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = useCallback(() => {
    if (!item) return;
    reviewMutation.mutate(
      { taskId: item.id, action: 'approve' },
      {
        onSuccess: () => {
          toast.success('Caption approved');
          onReviewComplete();
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to approve caption');
        },
      },
    );
  }, [item, reviewMutation, onReviewComplete]);

  const handleReject = useCallback(() => {
    if (!item) return;
    reviewMutation.mutate(
      { taskId: item.id, action: 'reject', reason: rejectReason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Caption rejected — task re-flagged');
          setRejectReason('');
          setShowRejectForm(false);
          onReviewComplete();
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to reject caption');
        },
      },
    );
  }, [item, rejectReason, reviewMutation, onReviewComplete]);

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-600">
        Select a scheduler ticket from the queue to review
      </div>
    );
  }

  const typeColor = TASK_TYPE_COLORS[item.taskType] || '#3a3a5a';
  const fields = item.fields as Record<string, string>;
  const flyerUrl = fields.flyerAssetUrl || fields.contentPreview || fields.contentFlyer;

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50 dark:bg-gray-950/50 custom-scrollbar">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200/50 dark:border-white/[0.06] bg-white dark:bg-gray-900/80 sticky top-0 z-10 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-2">
          {/* Scheduler badge */}
          <span className="inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold tracking-wide bg-brand-blue/15 border-brand-blue/25 text-brand-blue">
            SCHEDULER
          </span>
          {/* Task type badge */}
          <span
            className="inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold"
            style={{
              background: typeColor + '20',
              color: typeColor,
              borderColor: typeColor + '40',
            }}
          >
            #{item.slotLabel}-{item.taskType}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
            {item.platform}
          </span>
        </div>

        {/* Model + date info */}
        <div className="flex items-center gap-4 text-[11px] text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            {item.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.profileImage}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <User className="w-4 h-4" />
            )}
            <span className="font-medium text-gray-900 dark:text-gray-200">
              {item.profileName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{item.taskDate}</span>
          </div>
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 p-4 lg:p-5 space-y-4">
        {/* Content Preview (flyer/image) */}
        {flyerUrl && (
          <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900/80 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200/50 dark:border-white/[0.06] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Content Preview</span>
            </div>
            <div className="p-3 flex justify-center">
              {/\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test(flyerUrl) || flyerUrl.includes('/uploads/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={flyerUrl}
                  alt="Content preview"
                  className="max-h-64 rounded-lg object-contain"
                />
              ) : (
                <a
                  href={flyerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-blue hover:underline break-all"
                >
                  {flyerUrl}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Caption Section */}
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900/80 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200/50 dark:border-white/[0.06] flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Caption to Review</span>
          </div>
          <div className="p-4">
            {item.caption ? (
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono leading-relaxed bg-gray-50 dark:bg-gray-950/50 rounded-lg p-4 border border-gray-200 dark:border-white/[0.06]">
                {item.caption}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No caption text</p>
            )}

            {/* Previous caption (if available) */}
            {item.previousCaption && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 mb-1.5 uppercase tracking-wider">
                  Previous Caption
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-500 whitespace-pre-wrap break-words font-mono leading-relaxed bg-gray-100 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-white/[0.06] line-through opacity-60">
                  {item.previousCaption}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Task Details — all fields from TASK_FIELD_DEFS */}
        {(() => {
          const fieldDefs = TASK_FIELD_DEFS[item.taskType] ?? [];
          // Skip fields already shown in dedicated sections
          const skipKeys = new Set(['caption', 'contentPreview', 'contentFlyer', 'flyerAssetUrl']);
          const visibleFields = fieldDefs.filter(
            (fd) => !skipKeys.has(fd.key) && fields[fd.key],
          );
          if (visibleFields.length === 0) return null;
          return (
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900/80 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-200/50 dark:border-white/[0.06] flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Task Details</span>
              </div>
              <div className="p-4 space-y-2.5">
                {visibleFields.map((fd) => {
                  const val = fields[fd.key];
                  // Render long text (caption guide, paywall content) as a block
                  const isLongText = val && val.length > 60;
                  return (
                    <div key={fd.key} className={isLongText ? '' : 'flex items-center justify-between gap-3'}>
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">
                        {fd.label}
                      </span>
                      {isLongText ? (
                        <div className="mt-1 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-950/50 rounded-lg p-3 border border-gray-200 dark:border-white/[0.06] leading-relaxed">
                          {val}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-right truncate">
                          {val}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* QA Decision */}
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900/80 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200/50 dark:border-white/[0.06]">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">QA Decision</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Reject reason form */}
            {showRejectForm && (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason (optional)..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400/30 resize-none"
                  rows={3}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={reviewMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
              {showRejectForm ? (
                <div className="flex-1 flex gap-1">
                  <button
                    onClick={handleReject}
                    disabled={reviewMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    Confirm Reject
                  </button>
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                    className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-gray-500 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={reviewMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-red-300 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SchedulerReviewPanel = memo(SchedulerReviewPanelComponent);
export default SchedulerReviewPanel;
