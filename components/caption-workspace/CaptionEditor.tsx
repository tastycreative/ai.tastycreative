'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, AlertTriangle, Save, Loader2, AlertCircle, Lock, CheckCircle2, Cloud, CloudOff } from 'lucide-react';
import { toast } from 'sonner';
import { ModelContext } from './types';

interface CaptionEditorProps {
  caption: string;
  onCaptionChange: (caption: string) => void;
  modelContext: ModelContext;
  restrictedWordsFound: string[];
  isDraft?: boolean;
  ticketId?: string;
  onSaveDraft?: (caption: string) => Promise<void>;
  onSubmit?: (caption: string) => Promise<void>;
  /** When set, shows "Caption X of N" indicator */
  currentItemIndex?: number;
  totalItems?: number;
  /** Number of actionable items (excludes approved/not_required) */
  actionableCount?: number;
  /**
   * When provided (multi-item tickets), the Submit button submits the whole
   * ticket at once instead of advancing item-by-item.
   */
  onSubmitAll?: () => Promise<void>;
  /** QA rejection reason — shown as a banner so the writer knows what to fix; per-item takes priority over ticket-level */
  qaRejectionReason?: string | null;
  /** Per-item caption status (pending, in_progress, submitted, approved, rejected, not_required) */
  itemCaptionStatus?: string;
  /** Whether this item is locked (approved / not_required) — makes editor read-only */
  isLocked?: boolean;
  /** When true, the ticket hasn't been claimed yet — shown instead of generic read-only */
  isUnclaimedTicket?: boolean;
  /** Auto-save state from parent — shown as a status indicator */
  autoSaveState?: 'idle' | 'saving' | 'saved' | 'error';
}

const MAX_CAPTION_LENGTH = 2200;

// Highlight restricted words in text
function HighlightedTextarea({ 
  value, 
  restrictedWords, 
  onChange, 
  placeholder,
  maxLength 
}: { 
  value: string;
  restrictedWords: string[];
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  maxLength: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea and highlight div
  const handleScroll = useCallback(() => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Create highlighted HTML
  const highlightedHtml = useMemo(() => {
    if (restrictedWords.length === 0 || !value) return value;

    let result = value;
    // Create a regex that matches any restricted word (case-insensitive)
    const pattern = restrictedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    
    result = result.replace(regex, '<mark class="bg-red-300 dark:bg-red-500/50 rounded px-0.5">$1</mark>');
    
    // Replace newlines with <br> for proper display
    result = result.replace(/\n/g, '<br>');
    
    return result;
  }, [value, restrictedWords]);

  return (
    <div className="relative flex-1 min-h-30 mb-3">
      {/* Highlight layer (behind textarea) */}
      <div
        ref={highlightRef}
        className="absolute inset-0 px-3 py-3 bg-brand-off-white dark:bg-gray-800 border border-transparent rounded-xl text-sm leading-relaxed text-transparent overflow-auto whitespace-pre-wrap wrap-break-word pointer-events-none"
        style={{ wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: highlightedHtml || '&nbsp;' }}
      />
      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        placeholder={placeholder}
        className="relative w-full h-full px-3 py-3 bg-transparent border border-brand-mid-pink/20 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 text-gray-900 dark:text-gray-100 text-sm rounded-xl resize-none leading-relaxed placeholder:text-gray-400 caret-brand-mid-pink"
        style={{ 
          background: 'transparent',
          WebkitTextFillColor: restrictedWords.length > 0 ? 'transparent' : undefined,
        }}
        maxLength={maxLength}
      />
    </div>
  );
}

function CaptionEditorComponent({ 
  caption, 
  onCaptionChange, 
  modelContext, 
  restrictedWordsFound,
  isDraft = false,
  ticketId,
  onSaveDraft,
  onSubmit,
  onSubmitAll,
  currentItemIndex,
  totalItems,
  actionableCount,
  qaRejectionReason,
  itemCaptionStatus,
  isLocked = false,
  isUnclaimedTicket = false,
  autoSaveState = 'idle',
}: CaptionEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Validation state
  const hasRestrictions = restrictedWordsFound.length > 0;
  const isValid = !hasRestrictions;
  const isOverLimit = caption.length > MAX_CAPTION_LENGTH;
  
  // Handle caption change
  const handleCaptionChange = useCallback((newCaption: string) => {
    onCaptionChange(newCaption);
  }, [onCaptionChange]);

  // Manual save draft
  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft || caption.length === 0) return;
    
    setIsSavingDraft(true);
    try {
      await onSaveDraft(caption);
      toast.success('Draft saved');
    } catch (err) {
      toast.error('Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  }, [onSaveDraft, caption]);

  // Submit caption
  const handleSubmit = useCallback(async () => {
    if (onSubmitAll) {
      if (isOverLimit) return;
      setIsSubmitting(true);
      try {
        await onSubmitAll();
      } catch (err) {
        toast.error('Failed to submit captions');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!onSubmit || !isValid || isOverLimit) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(caption);
    } catch (err) {
      toast.error('Failed to submit caption');
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, onSubmitAll, caption, isValid, isOverLimit]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900/80">
      {/* Scrollable area: header + textarea + warnings + emojis */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-5 pb-3 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Write Caption</span>

        {/* Multi-item indicator */}
        {totalItems !== undefined && currentItemIndex !== undefined && (
          <span className="px-2 py-0.5 bg-brand-mid-pink/10 border border-brand-mid-pink/20 text-brand-mid-pink rounded text-[10px] font-semibold">
            {currentItemIndex + 1} / {totalItems}
          </span>
        )}

        {/* Per-item status badge */}
        {itemCaptionStatus === 'approved' && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[10px] font-semibold">
            <CheckCircle2 size={10} />
            Approved
          </span>
        )}
        {itemCaptionStatus === 'rejected' && (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-[10px] font-semibold">
            Revision Required
          </span>
        )}
        {itemCaptionStatus === 'not_required' && (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px] font-semibold">
            No Caption Needed
          </span>
        )}

        {/* Lock indicator */}
        {isLocked && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px] font-medium">
            <Lock size={10} />
            {isUnclaimedTicket ? 'Unclaimed' : 'Read-only'}
          </span>
        )}

        {/* Auto-save indicator */}
        {!isLocked && autoSaveState !== 'idle' && (
          <span className={`ml-auto flex items-center gap-1 text-[10px] font-medium transition-opacity ${
            autoSaveState === 'saving' ? 'text-gray-400 dark:text-gray-500' :
            autoSaveState === 'saved' ? 'text-emerald-500 dark:text-emerald-400' :
            'text-red-400 dark:text-red-400'
          }`}>
            {autoSaveState === 'saving' && <><Loader2 size={10} className="animate-spin" />Saving…</>}
            {autoSaveState === 'saved' && <><Cloud size={10} />Saved</>}
            {autoSaveState === 'error' && <><CloudOff size={10} />Save failed</>}
          </span>
        )}
      </div>

      {/* QA rejection banner — shown when this ticket was rejected and returned for revision */}
      {qaRejectionReason && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
              QA Revision Required
            </div>
            <div className="text-xs text-red-500 dark:text-red-300 leading-relaxed whitespace-pre-wrap">
              {qaRejectionReason}
            </div>
          </div>
        </div>
      )}

      {/* Text area with restricted word highlighting */}
      {isLocked ? (
        isUnclaimedTicket ? (
          <div className="flex-1 min-h-30 mb-3 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-6 text-center">
            <Lock size={20} className="text-gray-400 dark:text-gray-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Claim this ticket to start writing</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Click <span className="font-semibold">Claim</span> in the queue to take ownership of this ticket.</p>
          </div>
        ) : (
        <div className="flex-1 min-h-30 mb-3 relative">
          <div className="absolute inset-0 px-3 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 overflow-auto whitespace-pre-wrap">
            {caption || <span className="text-gray-400 italic">No caption</span>}
          </div>
        </div>
        )
      ) : (
        <HighlightedTextarea
          value={caption}
          restrictedWords={restrictedWordsFound}
          onChange={(e) => handleCaptionChange(e.target.value)}
          placeholder="Write your caption here... Use the model context on the right for personality, lingo, and restrictions."
          maxLength={MAX_CAPTION_LENGTH}
        />
      )}

      {/* Restriction warning */}
      {hasRestrictions && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
              Restricted words detected
            </div>
            <div className="text-xs text-red-500 dark:text-red-300">
              Found: {restrictedWordsFound.map(w => `"${w}"`).join(', ')} — This model doesn&apos;t use these words.
            </div>
          </div>
        </div>
      )}

      {/* Quick emoji bar */}
      {modelContext.emojis.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Quick add:</span>
          {modelContext.emojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleCaptionChange(caption + emoji)}
              className="px-2 py-1 bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/10 border border-brand-mid-pink/20 hover:border-brand-mid-pink/40 rounded-lg text-base transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      </div>{/* end scrollable area */}

      {/* Action buttons — always pinned at bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-brand-mid-pink/10 bg-white dark:bg-gray-900/80">
      {isLocked ? (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-400 dark:text-gray-500">
          <Lock size={14} />
          This item is {itemCaptionStatus === 'approved' ? 'approved' : 'locked'} and cannot be edited
        </div>
      ) : (
      <div className="flex gap-3">
        <button 
          onClick={handleSaveDraft}
          disabled={isSavingDraft || caption.length === 0}
          className="flex-1 px-5 py-3 bg-white dark:bg-gray-800 hover:bg-brand-off-white dark:hover:bg-gray-700 border border-brand-mid-pink/20 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSavingDraft ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Draft
        </button>
        <button
          onClick={handleSubmit}
          disabled={isOverLimit || isSubmitting || (!onSubmitAll && !isValid)}
          className={`flex-2 px-5 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            !isOverLimit && !isSubmitting && (onSubmitAll || isValid)
              ? 'bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white shadow-lg shadow-brand-mid-pink/30'
              : 'bg-brand-off-white dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-brand-mid-pink/10'
          }`}
        >
          {isSubmitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {isSubmitting
            ? 'Submitting...'
            : onSubmitAll
            ? (itemCaptionStatus === 'rejected' ? 'Resubmit All for QA' : 'Submit All for QA')
            : totalItems !== undefined && currentItemIndex !== undefined
            ? (() => {
                const remaining = actionableCount ?? totalItems;
                if (remaining <= 1) {
                  return itemCaptionStatus === 'rejected' ? 'Resubmit for QA' : 'Submit All';
                }
                return itemCaptionStatus === 'rejected'
                  ? `Resubmit & Next`
                  : `Next (${currentItemIndex + 1}/${totalItems})`;
              })()
            : itemCaptionStatus === 'rejected'
            ? 'Resubmit for QA'
            : 'Submit for QA'}
        </button>
      </div>
      )}
      </div>{/* end action buttons container */}
    </div>
  );
}

export default memo(CaptionEditorComponent);
