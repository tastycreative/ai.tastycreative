'use client';

import { memo } from 'react';
import { AlertCircle, AlertTriangle, X, Info, User2 } from 'lucide-react';
import type { QAQueueItem, SchedulerQAItem } from '@/lib/hooks/useQAQueue.query';

/* ── helpers ────────────────────────────────────────────────────── */

function parseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      // split by comma / newline
      return val
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/* ── Main Component ─────────────────────────────────────────────── */

interface QAContextPanelProps {
  item: QAQueueItem | undefined;
  schedulerItem?: SchedulerQAItem | undefined;
}

function QAContextPanelComponent({ item, schedulerItem }: QAContextPanelProps) {
  // Resolve profile from either content or scheduler item
  const profile = item?.modelProfile ?? schedulerItem?.modelProfile ?? null;
  const modelName = item
    ? ((item.metadata.model as string) ?? profile?.name ?? 'Unknown')
    : (schedulerItem?.profileName ?? profile?.name ?? 'Unknown');

  if (!item && !schedulerItem) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-600">
        Select a ticket to see model context
      </div>
    );
  }

  const bible = profile?.modelBible ?? {};

  // Model Bible fields — field names match the ModelBible type in useInstagramProfile.query.ts
  const personality = (bible.personalityDescription as string) ?? '';
  const background = (bible.backstory as string) ?? '';
  const lingo = parseArray(bible.lingoKeywords);
  const emojis = parseArray(bible.preferredEmojis);
  const bibleRestrictions = bible.restrictions as {
    contentLimitations?: string;
    wallRestrictions?: string;
    mmExclusions?: string;
    customsToAvoid?: string;
    wordingToAvoid?: string[];
  } | undefined;
  const restrictions = [
    bibleRestrictions?.contentLimitations,
    bibleRestrictions?.wallRestrictions,
    bibleRestrictions?.mmExclusions,
    bibleRestrictions?.customsToAvoid,
  ].filter(Boolean) as string[];
  const wordingToAvoid = parseArray(bibleRestrictions?.wordingToAvoid);
  const operatorNotes = (bible.captionOperatorNotes as string) ?? '';
  const pageStrategy = profile?.pageStrategy ?? '';

  const hasMinimalData = !personality;

  return (
    <div className="flex flex-col h-full overflow-auto custom-scrollbar">
      {/* Model header */}
      <div className="px-4 py-4 border-b border-gray-200/50 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          {(profile?.profileImageUrl || schedulerItem?.profileImage) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(profile?.profileImageUrl || schedulerItem?.profileImage)!}
              alt={modelName}
              className="w-11 h-11 rounded-xl object-cover shadow-lg shadow-emerald-500/20"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-base font-bold text-emerald-500 shadow-lg shadow-emerald-500/20">
              {modelName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{modelName}</p>
            {pageStrategy && (
              <span className="mt-0.5 inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-semibold">
                {pageStrategy}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-5">
        {/* Warning */}
        {hasMinimalData && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                This model&apos;s context is not fully configured yet.
              </p>
            </div>
          </div>
        )}

        {/* Restrictions — shown FIRST as a prominent callout */}
        {(restrictions.length > 0 || wordingToAvoid.length > 0) && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-500/30 rounded-xl ring-1 ring-red-200 dark:ring-red-800/30 shadow-sm shadow-red-500/5">
            <div className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <AlertTriangle size={13} className="shrink-0" />
              Restrictions &amp; Things to Avoid
            </div>
            {restrictions.map((r, i) => (
              <div key={i} className="text-xs text-red-700 dark:text-red-300 py-1 flex items-start gap-2">
                <X size={11} className="shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
            ))}
            {wordingToAvoid.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-red-200 dark:border-red-700/50">
                <div className="text-[10px] font-bold text-red-600 dark:text-red-400 mb-1.5 uppercase tracking-wide">
                  Words / Phrases to Avoid:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wordingToAvoid.map((word, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/40 rounded-md text-[10px] font-medium"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personality */}
        {personality && (
          <div>
            <SectionLabel>Personality</SectionLabel>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-xl text-xs leading-relaxed text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-white/[0.06] whitespace-pre-wrap">
              {personality}
            </div>
          </div>
        )}

        {/* Background */}
        {background && (
          <div>
            <SectionLabel>Background</SectionLabel>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-xl text-xs leading-relaxed text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/[0.06] whitespace-pre-wrap">
              {background}
            </div>
          </div>
        )}

        {/* Lingo */}
        {lingo.length > 0 && (
          <div>
            <SectionLabel>Lingo & Keywords</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {lingo.map((word) => (
                <span
                  key={word}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] text-gray-700 dark:text-gray-300"
                >
                  &ldquo;{word}&rdquo;
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Emojis */}
        {emojis.length > 0 && (
          <div>
            <SectionLabel>Preferred Emojis</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {emojis.map((emoji) => (
                <span
                  key={emoji}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm"
                >
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Operator Notes */}
        {operatorNotes && (
          <div>
            <div className="text-[10px] font-semibold text-brand-blue uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Info size={11} />
              Operator Notes
            </div>
            <div className="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/15 rounded-xl text-xs leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {operatorNotes}
            </div>
          </div>
        )}

        {/* Ticket meta summary (quick-ref) */}
        <div>
          <SectionLabel>Quick Ref</SectionLabel>
          <div className="space-y-1.5 text-[11px]">
            {item && (
              <>
                <MetaRow label="Space" value={item.spaceName} />
                <MetaRow label="Board Column" value={item.columnName} />
                <MetaRow label="Priority" value={item.priority} />
                <MetaRow label="Post Origin" value={(item.metadata.postOrigin as string) ?? ''} />
                <MetaRow label="Platforms" value={((item.metadata.platforms as string[]) ?? []).join(', ')} />
                <MetaRow label="Price" value={item.metadata.price != null ? `$${item.metadata.price}` : ''} />
              </>
            )}
            {schedulerItem && (
              <>
                <MetaRow label="Source" value="Scheduler" />
                <MetaRow label="Task Type" value={schedulerItem.taskType} />
                <MetaRow label="Platform" value={schedulerItem.platform} />
                <MetaRow label="Slot" value={schedulerItem.slotLabel} />
                <MetaRow label="Scheduled" value={schedulerItem.taskDate} />
                <MetaRow label="Price" value={(schedulerItem.fields.price as string) ?? (schedulerItem.fields.priceInfo as string) ?? ''} />
                {(schedulerItem.fields.paywallContent as string) && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-500">Paywall Content</span>
                    <div className="mt-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {schedulerItem.fields.paywallContent as string}
                    </div>
                  </div>
                )}
                {(schedulerItem.fields._unlockPaywallContent as string) && (
                  <div>
                    <span className="text-purple-500 dark:text-purple-400">Unlock Paywall Content</span>
                    <div className="mt-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {schedulerItem.fields._unlockPaywallContent as string}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small UI bits ──────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 dark:text-gray-500">{label}</span>
      <span className="font-medium text-gray-700 dark:text-gray-300 text-right truncate">{value}</span>
    </div>
  );
}

const QAContextPanel = memo(QAContextPanelComponent);
export default QAContextPanel;
