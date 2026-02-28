'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ModelContext } from './types';
import { useAutoSave } from '@/lib/hooks/useAutoSave';

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
  currentItemIndex,
  totalItems,
}: CaptionEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Validation state - defined early for use in hooks
  const hasRestrictions = restrictedWordsFound.length > 0;
  const isValid = !hasRestrictions;
  const isOverLimit = caption.length > MAX_CAPTION_LENGTH;
  
  // Handle caption change
  const handleCaptionChange = useCallback((newCaption: string) => {
    onCaptionChange(newCaption);
  }, [onCaptionChange]);

  // Auto-save functionality
  const handleAutoSave = useCallback(async (data: string) => {
    if (onSaveDraft && data.length > 0) {
      await onSaveDraft(data);
    }
  }, [onSaveDraft]);

  const { isSaving: isAutoSaving, lastSaved, error: autoSaveError, reset: resetAutoSave } = useAutoSave({
    data: caption,
    onSave: handleAutoSave,
    delay: 3000,
    enabled: !!onSaveDraft && !!ticketId && caption.length > 0,
  });

  // Reset auto-save when ticket changes
  useEffect(() => {
    resetAutoSave();
  }, [ticketId, resetAutoSave]);

  // Show auto-save error
  useEffect(() => {
    if (autoSaveError) {
      toast.error('Failed to auto-save draft');
    }
  }, [autoSaveError]);

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
    if (!onSubmit || !isValid || isOverLimit) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(caption);
      toast.success('Caption submitted for QA');
    } catch (err) {
      toast.error('Failed to submit caption');
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, caption, isValid, isOverLimit]);

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
        
        {/* Auto-save indicator */}
        {isAutoSaving && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-medium">
            <Loader2 size={10} className="animate-spin" />
            Saving...
          </span>
        )}
        {isDraft && !isAutoSaving && lastSaved && (
          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-[10px] font-medium">
            Draft saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
        {isDraft && !isAutoSaving && !lastSaved && (
          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-[10px] font-medium">
            Unsaved draft
          </span>
        )}
      </div>

      {/* Text area with restricted word highlighting */}
      <HighlightedTextarea
        value={caption}
        restrictedWords={restrictedWordsFound}
        onChange={(e) => handleCaptionChange(e.target.value)}
        placeholder="Write your caption here... Use the model context on the right for personality, lingo, and restrictions."
        maxLength={MAX_CAPTION_LENGTH}
      />

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
          disabled={!isValid || isOverLimit || isSubmitting}
          className={`flex-2 px-5 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            isValid && !isOverLimit && !isSubmitting
              ? 'bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white shadow-lg shadow-brand-mid-pink/30'
              : 'bg-brand-off-white dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-brand-mid-pink/10'
          }`}
        >
          {isSubmitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {totalItems !== undefined && currentItemIndex !== undefined
            ? currentItemIndex < totalItems - 1
              ? `Next (${currentItemIndex + 1}/${totalItems})`
              : `Submit All`
            : 'Submit for QA'}
        </button>
      </div>
      </div>{/* end action buttons container */}
    </div>
  );
}

export default memo(CaptionEditorComponent);
