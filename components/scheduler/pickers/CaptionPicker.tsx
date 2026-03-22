'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Flag, Check } from 'lucide-react';
import {
  useSchedulerCaptions,
  type SchedulerCaption,
} from '@/lib/hooks/useScheduler.query';

interface CaptionPickerProps {
  profileId: string | null;
  captionCategory: string;
  selectedCaptionId: string | null;
  captionOverride: string;
  onSelectCaption: (captionId: string, text: string) => void;
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
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: captions, isLoading } = useSchedulerCaptions(
    profileId,
    captionCategory,
    search || undefined,
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
              {selectedCaption ? 'Selected from bank' : 'Custom override'}
            </span>
            {selectedCaption?.status === 'revision_requested' && (
              <span className="text-[8px] bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-sans font-semibold">
                🚩 Replacement queued
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-mono">
            {selectedCaption?.caption || captionOverride}
          </div>
          {selectedCaption && (
            <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
              {(selectedCaption.contentTypes || []).map((t) => (
                <span
                  key={t}
                  className="text-[7px] px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20 font-sans font-bold"
                >
                  {t.trim()}
                </span>
              ))}
              <span className="text-[7px] text-gray-500 dark:text-gray-700 font-mono ml-auto">
                {selectedCaption.usageCount} uses
              </span>
            </div>
          )}
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

      {/* Suggestion label */}
      <div className="text-[8px] text-gray-400 dark:text-gray-700 font-sans">
        Showing workspace captions · {captionCategory}
      </div>

      {/* Caption cards */}
      <div className="max-h-[180px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
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
                  console.log('[CaptionPicker] clicked caption:', { id: cap.id, selected: isSel, captionPreview: cap.caption.slice(0, 50) });
                  if (isSel) {
                    onClearCaption();
                  } else {
                    onSelectCaption(cap.id, cap.caption);
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
        selected
          ? 'ring-1'
          : 'hover:bg-white/5'
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
        ...(selected ? { ringColor: typeColor } : {}),
      }}
    >
      <div className="flex justify-between items-start gap-2 mb-1">
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
      <div className="flex gap-1 flex-wrap items-center">
        {(caption.contentTypes || []).slice(0, 4).map((t) => (
          <span
            key={t}
            className="text-[7px] px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20 font-sans font-bold"
          >
            {t.trim()}
          </span>
        ))}
        <span className="text-[7px] text-gray-500 dark:text-gray-700 font-mono ml-auto">
          {caption.usageCount} uses
        </span>
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
