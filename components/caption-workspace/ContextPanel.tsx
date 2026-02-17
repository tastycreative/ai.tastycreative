'use client';

import { memo } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ModelContext } from './types';

interface ContextPanelProps {
  modelContext: ModelContext;
  onAddToCaption: (text: string) => void;
}

function ContextPanelComponent({ modelContext, onAddToCaption }: ContextPanelProps) {
  const hasMinimalData = !modelContext.personality || modelContext.personality.includes('No personality data');

  return (
    <div className="p-4 overflow-auto bg-white dark:bg-gray-900/80 custom-scrollbar">
      {/* Model Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-brand-mid-pink/20">
        {modelContext.imageUrl ? (
          <img 
            src={modelContext.imageUrl} 
            alt={modelContext.name}
            className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-brand-mid-pink/30"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-base font-semibold text-white shadow-lg shadow-brand-mid-pink/30">
            {modelContext.avatar}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{modelContext.name}</div>
          <div className="mt-1 inline-block px-2 py-1 bg-brand-mid-pink/15 text-brand-mid-pink dark:text-brand-light-pink rounded text-[10px] font-semibold">
            {modelContext.pageStrategy}
          </div>
        </div>
      </div>

      {/* Warning if no model bible data */}
      {hasMinimalData && (
        <div className="mb-5 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                This model's context is not fully configured yet.
              </p>
              <a 
                href="../my-influencers" 
                className="text-xs text-yellow-600 dark:text-yellow-400 underline hover:text-yellow-800 dark:hover:text-yellow-200"
              >
                Configure Model Bible in My Influencers →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Personality */}
      <div className="mb-5">
        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Personality
        </div>
        <div className="p-3 bg-brand-off-white dark:bg-gray-800 rounded-xl text-sm leading-relaxed text-gray-700 dark:text-gray-300 border border-brand-mid-pink/10">
          {modelContext.personality}
        </div>
      </div>

      {/* Background */}
      <div className="mb-5">
        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Background
        </div>
        <div className="p-3 bg-brand-off-white dark:bg-gray-800 rounded-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400 border border-brand-mid-pink/10">
          {modelContext.background}
        </div>
      </div>

      {/* Lingo */}
      {modelContext.lingo.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Lingo & Keywords
          </div>
          <div className="flex flex-wrap gap-2">
            {modelContext.lingo.map(word => (
              <button
                key={word}
                onClick={() => onAddToCaption(' ' + word)}
                className="px-2.5 py-1.5 bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/10 border border-brand-mid-pink/20 hover:border-brand-mid-pink/50 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-all cursor-pointer"
              >
                "{word}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preferred Emojis */}
      {modelContext.emojis.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Preferred Emojis
          </div>
          <div className="flex flex-wrap gap-2">
            {modelContext.emojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => onAddToCaption(emoji)}
                className="px-2.5 py-1.5 bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/10 border border-brand-mid-pink/20 hover:border-brand-mid-pink/50 rounded-lg text-lg transition-all cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Restrictions */}
      {(modelContext.restrictions.length > 0 || modelContext.wordingToAvoid.length > 0) && (
        <div>
          <div className="text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <AlertCircle size={12} />
            Restrictions
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
            {modelContext.restrictions.map((r, i) => (
              <div
                key={i}
                className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2"
              >
                <X size={10} />
                {r}
              </div>
            ))}
            {modelContext.wordingToAvoid.length > 0 && (
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-900/50">
                <div className="text-[10px] font-semibold text-red-500 dark:text-red-400 mb-1">Words to Avoid:</div>
                <div className="flex flex-wrap gap-1">
                  {modelContext.wordingToAvoid.map((word, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-[10px]">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ContextPanelComponent);
