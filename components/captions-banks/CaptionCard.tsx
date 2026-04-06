'use client';

import type { Caption } from '@/lib/hooks/useCaptions.query';
import { getCategoryStyle, highlightText, isLongCaption } from './utils';
import { User, Database, FileSpreadsheet, Copy, Check, TrendingUp, Folder, Flame } from 'lucide-react';

interface CaptionCardProps {
  caption: Caption;
  isAllProfiles: boolean;
  isTopPerformer: boolean;
  copiedId: string | null;
  searchQuery: string;
  onCopy: (text: string, id: string) => void;
  onClick: (caption: Caption) => void;
}

export function CaptionCard({
  caption,
  isAllProfiles,
  isTopPerformer,
  copiedId,
  searchQuery,
  onCopy,
  onClick,
}: CaptionCardProps) {
  const categoryStyle = getCategoryStyle(caption.captionCategory || 'Unknown');
  const isCopied = copiedId === caption.id;
  const isImported = caption.source === 'imported';
  const postOrigin = caption.captionTypes;
  const showPostOrigin =
    postOrigin &&
    postOrigin !== 'Unknown' &&
    postOrigin !== caption.captionCategory;

  const parts = highlightText(caption.caption, searchQuery);

  return (
    <div
      onClick={() => onClick(caption)}
      className={`group bg-gray-50/50 dark:bg-white/[0.02] border rounded-[14px] p-5 flex flex-col gap-3.5 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden cursor-pointer ${
        isTopPerformer
          ? 'border-amber-300/40 dark:border-amber-500/20 hover:border-amber-400/60 dark:hover:border-amber-500/30'
          : 'border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12]'
      }`}
    >
      {/* Top gradient line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
          isTopPerformer
            ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500'
            : 'bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue'
        }`}
      />

      {/* Top row: source badge + profile + top performer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Source badge */}
          {isImported ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-3 h-3" />
              Imported
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue border border-brand-blue/20">
              <Database className="w-3 h-3" />
              Gallery
            </span>
          )}

          {/* Profile name */}
          {isAllProfiles && caption.profileName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08] truncate max-w-[120px]">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{caption.profileName}</span>
            </span>
          )}
        </div>

        {/* Top performer signal */}
        {isTopPerformer && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            <Flame className="w-3 h-3" />
            {caption.usageCount}
          </span>
        )}
      </div>

      {/* Caption text with fade + optional GIF thumbnail */}
      <div className="relative flex gap-3">
        {caption.gifUrl && (
          <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/[0.08] bg-black/5 dark:bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={caption.gifUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="relative flex-1 min-w-0">
          <div className="font-mono text-[13px] leading-[1.75] text-gray-600 dark:text-gray-300 font-light italic whitespace-pre-wrap break-words max-h-[7rem] overflow-hidden">
            {parts.map((part, i) =>
              part.highlighted ? (
                <span
                  key={i}
                  className="bg-amber-500/20 dark:bg-amber-500/30 rounded-sm px-0.5"
                >
                  {part.text}
                </span>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </div>
          {isLongCaption(caption.caption) && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent pointer-events-none" />
          )}
        </div>
      </div>

      {/* Bottom tags + copy */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Category pill */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
          >
            {caption.captionCategory || 'Unknown'}
          </span>

          {/* Post origin pill */}
          {showPostOrigin && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08]">
              {postOrigin}
            </span>
          )}
        </div>

        {/* Copy button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy(caption.caption, caption.id);
          }}
          className={`shrink-0 p-1.5 rounded-lg transition-all duration-150 ${
            isCopied
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
          }`}
          title="Copy caption"
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Metadata row */}
      {(caption.usageCount > 0 || caption.captionBanks || caption.lastUsedAt) && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400 dark:text-gray-500 tracking-wide">
          {caption.usageCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {caption.usageCount} sale{caption.usageCount !== 1 ? 's' : ''}
            </span>
          )}
          {caption.captionBanks && (
            <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
              <Folder className="w-3 h-3 shrink-0" />
              <span className="truncate">{caption.captionBanks}</span>
            </span>
          )}
          {caption.lastUsedAt && (
            <span className="ml-auto shrink-0">
              {new Date(caption.lastUsedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
