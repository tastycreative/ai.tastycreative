'use client';

import { useState, memo, useCallback } from 'react';
import { TrendingUp, DollarSign, Copy, Check } from 'lucide-react';
import { TopCaption } from './types';

interface ReferencePanelProps {
  topCaptions: TopCaption[];
}

function ReferencePanelComponent({ topCaptions }: ReferencePanelProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = useCallback(async (caption: string, id: number) => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <div className="p-4 overflow-auto bg-white dark:bg-gray-900/80 custom-scrollbar">
      {/* Header */}
      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <TrendingUp size={12} />
        Top Performing Captions
      </div>

      {/* Info banner */}
      <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-[10px] text-emerald-600 dark:text-emerald-400 mb-4">
        Sorted by revenue • Click to copy
      </div>

      {/* Caption list */}
      {topCaptions.map((item, index) => {
        const isCopied = copiedId === item.id;
        
        return (
          <div
            key={item.id}
            onClick={() => handleCopy(item.caption, item.id)}
            className={`p-3 rounded-xl mb-3 cursor-pointer transition-all border ${
              isCopied 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700' 
                : 'bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/5 border-brand-mid-pink/10 hover:border-brand-mid-pink/30'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span 
                  className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                    index < 3 
                      ? 'bg-linear-to-br from-yellow-400 to-yellow-500 text-black shadow-sm' 
                      : 'bg-brand-mid-pink/20 text-brand-mid-pink'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="px-2 py-0.5 bg-white dark:bg-gray-900 border border-brand-mid-pink/20 rounded text-[10px] text-gray-700 dark:text-gray-300">
                  {Array.isArray(item.contentType) ? item.contentType.join(', ') : item.contentType}
                </span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <DollarSign size={12} />
                {item.revenue.toLocaleString()}
              </div>
            </div>

            {/* Caption text */}
            <div className="text-xs leading-relaxed text-gray-700 dark:text-gray-300 mb-2">
              {item.caption}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500 dark:text-gray-400">{item.sales} sales</span>
              <div className={`flex items-center gap-1 transition-colors ${
                isCopied ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {isCopied ? (
                  <>
                    <Check size={10} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    Click to copy
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(ReferencePanelComponent);
