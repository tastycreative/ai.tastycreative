'use client';

import type { Caption } from '@/lib/hooks/useCaptions.query';
import { getCategoryStyle, highlightText } from './utils';
import {
  User,
  Database,
  FileSpreadsheet,
  Copy,
  Check,
  Flame,
} from 'lucide-react';

interface CaptionListProps {
  captions: Caption[];
  isAllProfiles: boolean;
  topPerformerIds: Set<string>;
  copiedId: string | null;
  searchQuery: string;
  onCopy: (text: string, id: string) => void;
  onRowClick: (caption: Caption) => void;
}

export function CaptionList({
  captions,
  isAllProfiles,
  topPerformerIds,
  copiedId,
  searchQuery,
  onCopy,
  onRowClick,
}: CaptionListProps) {
  return (
    <div className="bg-gray-50/50 dark:bg-white/[0.02] rounded-[14px] border border-gray-200 dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="bg-gray-100/50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06]">
        <div className="grid grid-cols-12 gap-3 px-5 py-3">
          {isAllProfiles && (
            <div className="col-span-1 font-mono text-[10px] tracking-[0.12em] text-gray-500 dark:text-gray-400 uppercase">
              Profile
            </div>
          )}
          <div
            className={`${isAllProfiles ? 'col-span-4' : 'col-span-5'} font-mono text-[10px] tracking-[0.12em] text-gray-500 dark:text-gray-400 uppercase`}
          >
            Caption
          </div>
          <div className="col-span-1 font-mono text-[10px] tracking-[0.12em] text-gray-500 dark:text-gray-400 uppercase">
            Source
          </div>
          <div className="col-span-2 font-mono text-[10px] tracking-[0.12em] text-gray-500 dark:text-gray-400 uppercase">
            Content Type
          </div>
          <div className="col-span-1 font-mono text-[10px] tracking-[0.12em] text-gray-500 dark:text-gray-400 uppercase">
            Platform
          </div>
          <div className="col-span-2 font-mono text-[10px] tracking-[0.12em] text-gray-500 dark:text-gray-400 uppercase">
            Posted
          </div>
          <div className="col-span-1 font-mono text-[10px] tracking-[0.12em] text-gray-500 dark:text-gray-400 uppercase text-right">
            Actions
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
        {captions.map((caption) => {
          const isTopPerformer = topPerformerIds.has(caption.id);
          const isCopied = copiedId === caption.id;
          const isImported = caption.source === 'imported';
          const categoryStyle = getCategoryStyle(
            caption.captionCategory || 'Unknown'
          );
          const parts = highlightText(caption.caption, searchQuery);

          return (
            <div
              key={caption.id}
              onClick={() => onRowClick(caption)}
              className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              {/* Profile */}
              {isAllProfiles && (
                <div className="col-span-1 flex items-center gap-1.5 min-w-0">
                  <User className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {caption.profileName || 'Unknown'}
                  </span>
                </div>
              )}

              {/* Caption */}
              <div
                className={`${isAllProfiles ? 'col-span-4' : 'col-span-5'} min-w-0`}
              >
                <p className="font-mono text-[12px] leading-[1.6] text-gray-600 dark:text-gray-300 font-light italic truncate">
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
                </p>
              </div>

              {/* Source */}
              <div className="col-span-1 flex items-center gap-1.5">
                {isImported ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <FileSpreadsheet className="w-2.5 h-2.5" />
                    Import
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue border border-brand-blue/20">
                    <Database className="w-2.5 h-2.5" />
                    Gallery
                  </span>
                )}
                {isTopPerformer && (
                  <Flame className="w-3 h-3 text-amber-500" />
                )}
              </div>

              {/* Content Type */}
              <div className="col-span-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
                >
                  {caption.captionCategory || 'Unknown'}
                </span>
              </div>

              {/* Platform */}
              <div className="col-span-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                  {caption.captionBanks || '-'}
                </span>
              </div>

              {/* Posted */}
              <div className="col-span-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {caption.lastUsedAt
                    ? new Date(caption.lastUsedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '-'}
                </span>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex items-center justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(caption.caption, caption.id);
                  }}
                  className={`p-1.5 rounded-lg transition-all duration-150 ${
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
