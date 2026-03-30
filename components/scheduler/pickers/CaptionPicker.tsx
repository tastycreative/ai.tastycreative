'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Check, Film } from 'lucide-react';
import {
  useSchedulerCaptions,
  type SchedulerCaption,
  type CaptionSourceFilter,
} from '@/lib/hooks/useScheduler.query';

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return /\.(gif|png|jpg|jpeg|webp)(\?|$)/.test(lower) || lower.includes('/uploads/');
}

/** Data from board item returned alongside caption selection */
export interface CaptionSelection {
  captionId: string;
  captionText: string;
  gifUrl: string;
  gifUrlFansly: string;
  contentCount: string;
  contentLength: string;
  contentType: string;
  price: number;
  boardItemId: string | null;
  /** Sexting set folder name (boardTitle); only set for sexting_sets origin */
  sextingSetName?: string;
  /** Per-image content items; only set for sexting_sets origin */
  sextingSetItems?: {
    id: string;
    url: string;
    fileName: string;
    captionText: string;
    captionStatus: string;
    isPosted: boolean;
  }[];
}

interface CaptionPickerProps {
  profileId: string | null;
  captionCategory: string;
  selectedCaptionId: string | null;
  captionOverride: string;
  onSelectCaption: (selection: CaptionSelection) => void;
  onClearCaption: () => void;
  onOverrideChange: (text: string) => void;
  typeColor: string;
}

export function CaptionPicker({
  profileId,
  captionCategory,
  selectedCaptionId,
  captionOverride,
  onSelectCaption,
  onClearCaption,
  onOverrideChange,
  typeColor,
}: CaptionPickerProps) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<CaptionSourceFilter>('all');
  const [originFilter, setOriginFilter] = useState<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: captions, isLoading } = useSchedulerCaptions(
    profileId,
    captionCategory,
    search || undefined,
    sourceFilter,
    originFilter || undefined,
  );

  const sortedCaptions = useMemo(() => {
    if (!captions) return [];
    return [...captions];
  }, [captions]);

  const selectedCaption = useMemo(
    () => captions?.find((c) => c.id === selectedCaptionId),
    [captions, selectedCaptionId],
  );

  if (!profileId) {
    return (
      <div className="py-6 text-center text-[10px] text-gray-500 dark:text-gray-600 font-sans">
        Select a model profile to view captions
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Selected caption preview */}
      {(selectedCaption || captionOverride) && (
        <div
          className="rounded-md p-2.5"
          style={{ background: typeColor + '10', border: `1px solid ${typeColor}25` }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[8px] font-bold font-sans uppercase tracking-wider"
              style={{ color: typeColor }}
            >
              {selectedCaption ? 'Selected from board' : 'Custom override'}
            </span>
            {selectedCaption?.status === 'revision_requested' && (
              <span className="text-[8px] bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-sans font-semibold">
                🚩 Replacement queued
              </span>
            )}
          </div>
          {/* GIF preview + caption text side by side */}
          <div className="flex gap-2.5">
            {/* Sexting set selected preview */}
            {selectedCaption?.origin === 'sexting_sets' && selectedCaption.sextingSetItems ? (
              <>
                <div className="flex -space-x-1.5">
                  {selectedCaption.sextingSetItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="shrink-0 w-10 h-10 rounded overflow-hidden border-2 border-gray-900 bg-black/20">
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-sans font-bold text-gray-300 truncate">
                    {selectedCaption.boardTitle || 'Sexting Set'}
                  </div>
                  <div className="text-[8px] text-gray-500 font-mono mt-0.5">
                    {selectedCaption.sextingSetItems.length} image{selectedCaption.sextingSetItems.length !== 1 ? 's' : ''} with captions · View in preview →
                  </div>
                </div>
              </>
            ) : (
              <>
                {selectedCaption?.gifUrl && isImageUrl(selectedCaption.gifUrl) && (
                  <div className="shrink-0 w-20 h-20 rounded-md overflow-hidden border border-gray-700/30 bg-black/20">
                    <img
                      src={selectedCaption.gifUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-mono line-clamp-3">
                    {selectedCaption?.caption || captionOverride}
                  </div>
                  {selectedCaption && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                      {selectedCaption.contentType && (
                        <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20 font-sans font-bold">
                          {selectedCaption.contentType}
                        </span>
                      )}
                      {selectedCaption.contentCount && (
                        <span className="text-[7px] text-gray-500 dark:text-gray-500 font-mono">
                          {selectedCaption.contentCount}
                        </span>
                      )}
                      {selectedCaption.price > 0 && (
                        <span className="text-[7px] text-green-500 font-mono">
                          ${selectedCaption.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 dark:text-gray-600" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search captions..."
          className="w-full text-[10px] pl-7 pr-2 py-1.5 rounded border outline-none font-mono bg-gray-50 border-gray-200 text-gray-800 focus:border-brand-blue dark:bg-[#07070f] dark:border-[#111124] dark:text-gray-300 dark:focus:border-[#1e1e38]"
        />
      </div>

      {/* Source + Origin filters */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Source filter */}
        {(['all', 'ticket', 'bank'] as const).map((src) => {
          const active = sourceFilter === src;
          const label = src === 'all' ? 'All' : src === 'ticket' ? 'Board' : 'Bank';
          return (
            <button
              key={src}
              onClick={() => {
                setSourceFilter(src);
                // Reset origin filter when switching to Bank (not applicable)
                if (src === 'bank') setOriginFilter('');
              }}
              className="text-[8px] font-bold px-2 py-0.5 rounded-full font-sans transition-all border"
              style={{
                background: active ? typeColor + '20' : 'transparent',
                color: active ? typeColor : '#6b6b8a',
                borderColor: active ? typeColor + '40' : '#1e1e38',
              }}
            >
              {label}
            </button>
          );
        })}
        {/* Origin filter — only show when source is All or Board */}
        {sourceFilter !== 'bank' && (
          <>
            <span className="text-[7px] text-gray-700 mx-0.5">·</span>
            {(['', 'otp_ptr', 'wall_post', 'sexting_sets'] as const).map((org) => {
              const active = originFilter === org;
              const label = org === '' ? 'All' : org === 'otp_ptr' ? 'OTP/PTR' : org === 'wall_post' ? 'Wall Post' : 'Sexting Set';
              return (
                <button
                  key={org}
                  onClick={() => setOriginFilter(org)}
                  className="text-[8px] font-bold px-2 py-0.5 rounded-full font-sans transition-all border"
                  style={{
                    background: active ? '#38bdf820' : 'transparent',
                    color: active ? '#38bdf8' : '#6b6b8a',
                    borderColor: active ? '#38bdf840' : '#1e1e38',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Caption cards */}
      <div className="max-h-[240px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
        {isLoading ? (
          <div className="py-6 text-center text-[10px] text-gray-500 dark:text-gray-600 font-sans">
            Loading captions...
          </div>
        ) : sortedCaptions.length === 0 ? (
          <div className="py-6 text-center text-[10px] text-gray-500 dark:text-gray-600 font-sans">
            No captions found{search ? ` for "${search}"` : ''}
          </div>
        ) : (
          sortedCaptions.map((cap) => {
            const isSel = selectedCaptionId === cap.id;
            const isFlagged = cap.status === 'revision_requested';
            return (
              <CaptionCard
                key={cap.id}
                caption={cap}
                selected={isSel}
                flagged={!!isFlagged}
                typeColor={typeColor}
                onClick={() => {
                  if (isSel) {
                    onClearCaption();
                  } else {
                    onSelectCaption({
                      captionId: cap.id,
                      captionText: cap.caption,
                      gifUrl: cap.gifUrl,
                      gifUrlFansly: cap.gifUrlFansly,
                      contentCount: cap.contentCount,
                      contentLength: cap.contentLength,
                      contentType: cap.contentType,
                      price: cap.price,
                      boardItemId: cap.boardItemId,
                      sextingSetName: cap.origin === 'sexting_sets' ? cap.boardTitle : undefined,
                      sextingSetItems: cap.sextingSetItems,
                    });
                  }
                }}
              />
            );
          })
        )}
      </div>

      {/* Custom override */}
      <CaptionOverrideInput
        value={captionOverride}
        onChange={onOverrideChange}
        typeColor={typeColor}
      />
    </div>
  );
}

// ─── Caption Card ────────────────────────────────────────────────────────────

function CaptionCard({
  caption,
  selected,
  flagged,
  typeColor,
  onClick,
}: {
  caption: SchedulerCaption;
  selected: boolean;
  flagged: boolean;
  typeColor: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-md p-2.5 transition-all ${
        selected ? 'ring-1' : 'hover:bg-white/5'
      }`}
      style={{
        background: selected
          ? typeColor + '12'
          : flagged
            ? 'rgba(245,158,11,.04)'
            : undefined,
        border: `1px solid ${
          selected
            ? typeColor
            : flagged
              ? 'rgba(245,158,11,.22)'
              : '#111124'
        }`,
      }}
    >
      {/* Sexting set card: folder name + thumbnail strip */}
      {caption.origin === 'sexting_sets' && caption.sextingSetItems ? (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex -space-x-2">
              {caption.sextingSetItems.slice(0, 4).map((item) => (
                <div key={item.id} className="shrink-0 w-8 h-8 rounded overflow-hidden border-2 border-gray-900 bg-black/20">
                  <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
              {caption.sextingSetItems.length > 4 && (
                <div className="shrink-0 w-8 h-8 rounded overflow-hidden border-2 border-gray-900 bg-gray-800 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-gray-400">+{caption.sextingSetItems.length - 4}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-sans font-bold text-gray-300 truncate">
                {caption.boardTitle || 'Sexting Set'}
              </div>
              <div className="text-[8px] text-gray-500 font-mono">
                {caption.sextingSetItems.length} image{caption.sextingSetItems.length !== 1 ? 's' : ''} with captions
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {flagged && (
                <span className="text-[8px] text-amber-500 font-sans font-semibold whitespace-nowrap">
                  🚩 queued
                </span>
              )}
              {selected && (
                <Check className="h-3 w-3" style={{ color: typeColor }} />
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* GIF thumbnail + caption text */}
          <div className="flex gap-2 mb-1.5">
            {caption.gifUrl && (
              <div className="shrink-0 w-14 h-14 rounded overflow-hidden border border-gray-800/50 bg-black/20">
                <img
                  src={caption.gifUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-1">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed flex-1 font-mono line-clamp-2">
                  {caption.caption}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {flagged && (
                    <span className="text-[8px] text-amber-500 font-sans font-semibold whitespace-nowrap">
                      🚩 queued
                    </span>
                  )}
                  {selected && (
                    <Check className="h-3 w-3" style={{ color: typeColor }} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Metadata row */}
      <div className="flex gap-1 flex-wrap items-center">
        {/* Source badge */}
        <span
          className="text-[7px] px-1.5 py-0.5 rounded-full font-sans font-bold"
          style={{
            background: caption.source === 'ticket' ? '#c084fc15' : '#fb923c15',
            color: caption.source === 'ticket' ? '#c084fc' : '#fb923c',
            border: `1px solid ${caption.source === 'ticket' ? '#c084fc25' : '#fb923c25'}`,
          }}
        >
          {caption.source === 'ticket' ? 'Board' : 'Bank'}
        </span>
        {/* Origin badge */}
        {caption.origin && caption.origin !== 'general' && caption.origin !== 'manual' && (
          <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20 font-sans font-bold uppercase">
            {caption.origin === 'otp_ptr' ? 'OTP/PTR' : caption.origin === 'sexting_sets' ? 'Sexting Set' : caption.origin.replace('_', ' ')}
          </span>
        )}
        {caption.contentType && (
          <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20 font-sans font-bold">
            {caption.contentType}
          </span>
        )}
        {caption.contentCount && (
          <span className="text-[7px] text-gray-500 dark:text-gray-600 font-mono">
            {caption.contentCount}
          </span>
        )}
        {caption.usageCount != null && caption.usageCount > 0 && (
          <span className="text-[7px] text-gray-500 dark:text-gray-600 font-mono">
            {caption.usageCount} uses
          </span>
        )}
        {caption.price > 0 && (
          <span className="text-[7px] text-green-500 font-mono">
            ${caption.price.toFixed(2)}
          </span>
        )}
        {caption.gifUrl ? (
          <Film className="h-2.5 w-2.5 text-brand-blue/50 ml-auto" />
        ) : (
          <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-sans font-bold ml-auto">
            No GIF
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Custom Override Input (locally controlled) ──────────────────────────────

function CaptionOverrideInput({
  value,
  onChange,
  typeColor,
}: {
  value: string;
  onChange: (text: string) => void;
  typeColor: string;
}) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  return (
    <div>
      <span className="text-[8px] text-gray-400 dark:text-gray-700 font-sans uppercase tracking-wider block mb-1">
        Or type a custom caption
      </span>
      <textarea
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          if (localVal.trim() !== value) onChange(localVal);
        }}
        placeholder="Type a custom caption..."
        rows={2}
        className="w-full text-[10px] px-2.5 py-2 rounded border outline-none font-mono resize-y min-h-[44px] bg-gray-50 border-gray-200 text-gray-800 focus:border-brand-blue dark:bg-[#07070f] dark:border-[#1a1a35] dark:text-gray-300 dark:focus:border-brand-blue/50"
      />
    </div>
  );
}
