'use client';

import { memo } from 'react';
import { Send, AlertTriangle, Check, Info } from 'lucide-react';
import { ModelContext } from './types';

interface CaptionEditorProps {
  caption: string;
  onCaptionChange: (caption: string) => void;
  modelContext: ModelContext;
  restrictedWordsFound: string[];
  isDraft?: boolean;
}

const MAX_CAPTION_LENGTH = 2200;
const OPTIMAL_MIN = 50;
const OPTIMAL_MAX = 300;

function CaptionEditorComponent({ 
  caption, 
  onCaptionChange, 
  modelContext, 
  restrictedWordsFound,
  isDraft = false
}: CaptionEditorProps) {
  const hasRestrictions = restrictedWordsFound.length > 0;
  const isValid = !hasRestrictions && caption.length >= 10;
  
  // Character count status
  const isOptimal = caption.length >= OPTIMAL_MIN && caption.length <= OPTIMAL_MAX;
  const isTooShort = caption.length > 0 && caption.length < OPTIMAL_MIN;
  const isTooLong = caption.length > OPTIMAL_MAX;
  const isOverLimit = caption.length > MAX_CAPTION_LENGTH;

  const getCharCountColor = () => {
    if (isOverLimit) return 'text-red-500';
    if (isOptimal) return 'text-emerald-500';
    if (isTooShort) return 'text-yellow-500';
    if (isTooLong) return 'text-orange-500';
    return 'text-gray-400 dark:text-gray-500';
  };

  const getProgressWidth = () => {
    const percent = Math.min((caption.length / OPTIMAL_MAX) * 100, 100);
    return `${percent}%`;
  };

  const getProgressColor = () => {
    if (isOverLimit) return 'bg-red-500';
    if (isOptimal) return 'bg-emerald-500';
    if (isTooShort) return 'bg-yellow-500';
    if (isTooLong) return 'bg-orange-500';
    return 'bg-gray-300 dark:bg-gray-600';
  };

  return (
    <div className="h-full p-5 flex flex-col overflow-y-auto bg-white dark:bg-gray-900/80 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Write Caption</span>
          {isDraft && (
            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-[10px] font-medium">
              Draft saved
            </span>
          )}
        </div>
        
        {/* Character count indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getProgressColor()} transition-all duration-300`}
                style={{ width: getProgressWidth() }}
              />
            </div>
            <span className={`text-xs font-medium ${getCharCountColor()}`}>
              {caption.length}
              <span className="text-gray-400 dark:text-gray-500">/{MAX_CAPTION_LENGTH}</span>
            </span>
          </div>
          {isOptimal && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-medium">
              <Check size={10} />
              Optimal
            </span>
          )}
          {isTooShort && caption.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded text-[10px] font-medium">
              <Info size={10} />
              Too short
            </span>
          )}
        </div>
      </div>

      {/* Text area */}
      <textarea
        value={caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Write your caption here... Use the model context on the right for personality, lingo, and restrictions."
        className="flex-1 min-h-30 mb-3 px-3 py-3 bg-brand-off-white dark:bg-gray-800 border border-brand-mid-pink/20 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 text-gray-900 dark:text-gray-100 text-sm rounded-xl resize-none leading-relaxed placeholder:text-gray-400"
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
              Found: {restrictedWordsFound.map(w => `"${w}"`).join(', ')} — This model doesn't use these words.
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
              onClick={() => onCaptionChange(caption + emoji)}
              className="px-2 py-1 bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/10 border border-brand-mid-pink/20 hover:border-brand-mid-pink/40 rounded-lg text-base transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button className="flex-1 px-5 py-3 bg-white dark:bg-gray-800 hover:bg-brand-off-white dark:hover:bg-gray-700 border border-brand-mid-pink/20 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-medium transition-colors">
          Save Draft
        </button>
        <button
          disabled={!isValid || isOverLimit}
          className={`flex-2 px-5 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            isValid && !isOverLimit
              ? 'bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white shadow-lg shadow-brand-mid-pink/30'
              : 'bg-brand-off-white dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-brand-mid-pink/10'
          }`}
        >
          <Send size={14} />
          Submit for QA
        </button>
      </div>
    </div>
  );
}

export default memo(CaptionEditorComponent);
