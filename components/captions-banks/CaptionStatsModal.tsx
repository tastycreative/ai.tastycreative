'use client';

import { createPortal } from 'react-dom';
import { X, BarChart3, TrendingUp, Tag } from 'lucide-react';
import type { CaptionStats } from '@/lib/hooks/useCaptions.query';

interface CaptionStatsModalProps {
  open: boolean;
  onClose: () => void;
  stats: CaptionStats | null;
}

export function CaptionStatsModal({ open, onClose, stats }: CaptionStatsModalProps) {
  if (!open) return null;
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-light-pink/10 dark:bg-brand-light-pink/15 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-brand-light-pink" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-brand-off-white">Statistics</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {stats ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                  <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">{stats.totalCaptions}</p>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">Total</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.favoriteCaptions}</p>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">Favorites</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                  <p className="text-2xl font-bold text-brand-light-pink">{stats.totalUsage}</p>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">Total Usage</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                  <p className="text-2xl font-bold text-brand-blue">{stats.captionsInCooldown?.length || 0}</p>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">In Cooldown</p>
                </div>
              </div>
              {stats.mostUsed && stats.mostUsed.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-light-pink" /> Most Used
                  </h3>
                  <div className="space-y-2">
                    {stats.mostUsed.slice(0, 5).map((item, i) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06]">
                        <span className="w-6 h-6 bg-brand-light-pink/10 text-brand-light-pink text-xs font-bold rounded-full flex items-center justify-center">{i + 1}</span>
                        <p className="flex-1 text-sm text-gray-900 dark:text-brand-off-white truncate font-mono font-light italic">{item.caption}</p>
                        <span className="text-sm font-semibold text-brand-light-pink font-mono">{item.usageCount}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats.categoryStats && stats.categoryStats.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-brand-blue" /> By Category
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stats.categoryStats.map(cat => (
                      <div key={cat.category} className="p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06]">
                        <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white truncate">{cat.category}</p>
                        <p className="text-[10px] font-mono text-gray-500 tracking-[0.05em]">{cat.count} captions · {cat.totalUsage} uses</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-light-pink/30 border-t-brand-light-pink rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
