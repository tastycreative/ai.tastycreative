'use client';

import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  Flame,
  TrendingUp,
  Database,
  FileSpreadsheet,
  Calendar,
  Tag,
  Folder,
} from 'lucide-react';
import type { Caption } from '@/lib/hooks/useCaptions.query';
import { getCategoryStyle } from './utils';

interface CaptionDetailModalProps {
  open: boolean;
  caption: Caption | null;
  onClose: () => void;
  isTopPerformer: boolean;
  categoryRank: number | null;
  totalInCategory: number;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/[0.06] last:border-0">
      <span className="font-mono text-[11px] text-gray-500 tracking-wide">{label}</span>
      <div className="text-sm text-gray-900 dark:text-brand-off-white font-medium">{children}</div>
    </div>
  );
}

export function CaptionDetailModal({
  open,
  caption,
  onClose,
  isTopPerformer,
  categoryRank,
  totalInCategory,
  onCopy,
  copiedId,
}: CaptionDetailModalProps) {
  if (!open || !caption) return null;
  if (typeof window === 'undefined') return null;

  const catStyle = getCategoryStyle(caption.captionCategory);
  const isCopied = copiedId === caption.id;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono tracking-[0.05em] rounded-full ${
              caption.source === 'gallery'
                ? 'bg-brand-blue/10 text-brand-blue'
                : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
            }`}>
              {caption.source === 'gallery' ? <Database className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
              {caption.source === 'gallery' ? 'Gallery' : 'Imported'}
            </span>
            {isTopPerformer && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono tracking-[0.05em] rounded-full">
                <Flame className="w-3 h-3" />
                Top 10%
              </span>
            )}
            {caption.profileName && (
              <span className="font-mono text-[11px] text-gray-500 tracking-wide">{caption.profileName}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row">
            {/* Left: Caption text */}
            <div className="flex-[2] p-6 md:border-r border-gray-100 dark:border-white/[0.06]">
              <p className="font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase mb-3">Caption</p>
              <div className="font-mono text-[14px] leading-[1.85] text-gray-700 dark:text-gray-200 font-light italic whitespace-pre-wrap break-words">
                {caption.caption}
              </div>
              {caption.tags && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
                  <p className="font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase mb-2">Tags</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {caption.tags.split(',').map((tag) => (
                      <span key={tag.trim()} className="px-2 py-0.5 bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 text-[10px] font-mono rounded-full">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {caption.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
                  <p className="font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase mb-2">Notes</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{caption.notes}</p>
                </div>
              )}
            </div>

            {/* Right: Metadata + Performance */}
            <div className="flex-1 p-6 space-y-6 min-w-[280px]">
              {/* GIF Preview */}
              {caption.gifUrl && /^https?:\/\/.+/i.test(caption.gifUrl) && (
                <div>
                  <p className="font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase mb-3">Preview</p>
                  <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-white/[0.06] bg-black/5 dark:bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={caption.gifUrl}
                      alt="Content preview"
                      className="w-full h-auto max-h-48 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div>
                <p className="font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase mb-3">Metadata</p>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06] px-4">
                  <MetadataRow label="Content Type">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono tracking-[0.1em] uppercase rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                      <Tag className="w-3 h-3" />
                      {caption.captionCategory}
                    </span>
                  </MetadataRow>
                  {caption.captionTypes !== 'Unknown' && (
                    <MetadataRow label="Post Origin">
                      {caption.captionTypes}
                    </MetadataRow>
                  )}
                  {caption.captionBanks !== 'Unknown' && (
                    <MetadataRow label="Platform">
                      <span className="flex items-center gap-1">
                        <Folder className="w-3 h-3 text-gray-400" />
                        {caption.captionBanks}
                      </span>
                    </MetadataRow>
                  )}
                  {caption.lastUsedAt && (
                    <MetadataRow label="Posted">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {new Date(caption.lastUsedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </MetadataRow>
                  )}
                </div>
              </div>

              {/* Performance */}
              <div>
                <p className="font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase mb-3">Performance</p>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06] px-4">
                  <MetadataRow label="Sales">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-brand-light-pink" />
                      <span className="font-semibold text-brand-light-pink">{caption.usageCount}</span>
                      {isTopPerformer && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-mono rounded-full">
                          <Flame className="w-2.5 h-2.5" />
                          Top 10%
                        </span>
                      )}
                    </span>
                  </MetadataRow>
                  {categoryRank !== null && (
                    <MetadataRow label="Category Rank">
                      <span>
                        #{categoryRank} in {caption.captionCategory}
                        <span className="text-[10px] text-gray-500 ml-1">of {totalInCategory}</span>
                      </span>
                    </MetadataRow>
                  )}
                  {caption.lastUsedAt && (
                    <MetadataRow label="Last Used">
                      {new Date(caption.lastUsedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </MetadataRow>
                  )}
                  {caption.cooldownDays > 0 && (
                    <MetadataRow label="Cooldown">
                      {caption.cooldownDays} days
                    </MetadataRow>
                  )}
                </div>
              </div>

              {/* Usage Summary */}
              <div>
                <p className="font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase mb-3">Usage History</p>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
                  {caption.usageCount > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-gray-500">Total uses</span>
                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-brand-off-white">{caption.usageCount}x</span>
                      </div>
                      {caption.lastUsedAt && (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-gray-500">Last used</span>
                          <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                            {new Date(caption.lastUsedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="font-mono text-[11px] text-gray-400 dark:text-gray-600 text-center">
                      Not used yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => onCopy(caption.caption, caption.id)}
            className={`w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              isCopied
                ? 'bg-emerald-600 text-white'
                : 'bg-brand-light-pink hover:bg-brand-mid-pink text-white'
            }`}
          >
            {isCopied ? (
              <><Check className="w-4 h-4" /> Copied to Clipboard</>
            ) : (
              <><Copy className="w-4 h-4" /> Copy Caption</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
