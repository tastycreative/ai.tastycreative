'use client';

import { ChevronDown, ChevronUp, Copy, ShieldAlert, X as XIcon, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { GifQueueTicket } from '@/lib/hooks/useGifQueue.query';
import type { InstagramProfileDetail } from '@/lib/hooks/useInstagramProfile.query';
import { urgencyConfig, safeUrgency } from './queue-constants';

interface TaskContextStripProps {
  ticket: GifQueueTicket | null;
  modelContext: InstagramProfileDetail | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function TaskContextStrip({ ticket, modelContext, isExpanded, onToggleExpand }: TaskContextStripProps) {
  if (!ticket) return null;

  const config = urgencyConfig[safeUrgency(ticket.urgency)];
  const bible = modelContext?.modelBible;
  const restrictions = bible?.restrictions;

  const handleCopyCaption = async () => {
    if (!ticket.captionText) return;
    try {
      await navigator.clipboard.writeText(ticket.captionText);
      toast.success('Caption copied');
    } catch {
      toast.error('Failed to copy caption');
    }
  };

  const releaseFormatted = ticket.releaseDate
    ? new Date(ticket.releaseDate).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  return (
    <div className="border-b border-brand-mid-pink/20 bg-white dark:bg-gray-900/80">
      {/* Header — always visible */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {ticket.profileImageUrl ? (
          <img
            src={ticket.profileImageUrl}
            alt={ticket.modelName}
            className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-sm shadow-brand-mid-pink/20"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center shrink-0 shadow-sm shadow-brand-mid-pink/20">
            <span className="text-[10px] font-bold text-white">{ticket.modelName.slice(0, 2).toUpperCase()}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 block truncate">{ticket.modelName}</span>
          {releaseFormatted && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Calendar size={9} />
              Release: {releaseFormatted}
            </span>
          )}
        </div>

        <span className={`px-2 py-0.5 ${config.bg} ${config.textColor} rounded text-[10px] font-bold shrink-0`}>
          {config.label}
        </span>
      </div>

      {/* Content type tags — always visible */}
      {(ticket.contentTypes.length > 0 || ticket.messageTypes.length > 0) && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {ticket.contentTypes.map((ct) => (
            <span key={ct} className="px-1.5 py-0.5 bg-brand-off-white dark:bg-gray-800 rounded text-[10px] font-medium text-gray-700 dark:text-gray-300 border border-brand-mid-pink/10">
              {ct}
            </span>
          ))}
          {ticket.messageTypes.map((mt) => (
            <span key={mt} className="px-1.5 py-0.5 bg-brand-blue/10 rounded text-[10px] font-medium text-brand-blue border border-brand-blue/20">
              {mt}
            </span>
          ))}
        </div>
      )}

      {/* Caption preview — always visible when caption exists */}
      {ticket.captionText && (
        <div className="px-3 pb-2">
          <div className="p-2.5 bg-brand-off-white dark:bg-gray-800 rounded-lg border border-brand-mid-pink/10">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Caption</span>
              <button onClick={handleCopyCaption} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                <Copy size={10} />
              </button>
            </div>
            <p className={`text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
              {ticket.captionText}
            </p>
          </div>
        </div>
      )}

      {/* Restrictions quick view — always visible when restrictions exist */}
      {restrictions && !isExpanded && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1 flex-wrap">
            {restrictions.contentLimitations && (
              <span className="px-1.5 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded text-[9px] flex items-center gap-1">
                <XIcon size={8} className="shrink-0" /> {restrictions.contentLimitations.slice(0, 40)}
              </span>
            )}
            {restrictions.wallRestrictions && (
              <span className="px-1.5 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded text-[9px] flex items-center gap-1">
                <XIcon size={8} className="shrink-0" /> {restrictions.wallRestrictions.slice(0, 40)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded: full model context */}
      {isExpanded && (
        <div className="px-3 pb-3 max-h-[40vh] overflow-y-auto custom-scrollbar space-y-3">
          {/* Personality */}
          {bible?.personalityDescription && (
            <div className="border-t border-brand-mid-pink/20 pt-2">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">Personality</span>
              <div className="p-3 bg-brand-off-white dark:bg-gray-800 rounded-xl text-sm leading-relaxed border border-brand-mid-pink/10 text-gray-700 dark:text-gray-300">
                {bible.personalityDescription}
              </div>
            </div>
          )}

          {/* Background */}
          {bible?.backstory && (
            <div className="border-t border-brand-mid-pink/20 pt-2">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">Background</span>
              <div className="p-3 bg-brand-off-white dark:bg-gray-800 rounded-xl text-sm leading-relaxed border border-brand-mid-pink/10 text-gray-700 dark:text-gray-300">
                {bible.backstory}
              </div>
            </div>
          )}

          {/* Lingo */}
          {bible?.lingoKeywords && bible.lingoKeywords.length > 0 && (
            <div className="border-t border-brand-mid-pink/20 pt-2">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">Lingo &amp; Keywords</span>
              <div className="flex flex-wrap gap-2">
                {bible.lingoKeywords.map((word) => (
                  <span key={word} className="px-2.5 py-1.5 bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/10 border border-brand-mid-pink/20 hover:border-brand-mid-pink/50 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-all cursor-pointer">
                    &ldquo;{word}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Restrictions — full view */}
          {restrictions && (
            <div className="border-t border-brand-mid-pink/20 pt-2">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert size={11} className="text-red-500 dark:text-red-400" />
                <span className="text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">Restrictions</span>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl space-y-1">
                {restrictions.contentLimitations && (
                  <p className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2">
                    <XIcon size={10} className="shrink-0" /> {restrictions.contentLimitations}
                  </p>
                )}
                {restrictions.wallRestrictions && (
                  <p className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2">
                    <XIcon size={10} className="shrink-0" /> {restrictions.wallRestrictions}
                  </p>
                )}
                {restrictions.mmExclusions && (
                  <p className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2">
                    <XIcon size={10} className="shrink-0" /> {restrictions.mmExclusions}
                  </p>
                )}
                {restrictions.wordingToAvoid && restrictions.wordingToAvoid.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-900/50">
                    <div className="flex flex-wrap gap-1">
                      {restrictions.wordingToAvoid.map((w) => (
                        <span key={w} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-[10px]">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Operator Notes */}
          {bible?.captionOperatorNotes && (
            <div className="border-t border-brand-mid-pink/20 pt-2">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">Operator Notes</span>
              <div className="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/20 rounded-xl text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {bible.captionOperatorNotes}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expand/Collapse toggle */}
      <div className="px-3 pb-2 flex justify-end">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors text-[10px]"
        >
          {isExpanded ? <><ChevronUp size={12} /> Collapse</> : <><ChevronDown size={12} /> Expand</>}
        </button>
      </div>
    </div>
  );
}
