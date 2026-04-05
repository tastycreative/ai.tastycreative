'use client';

import { createPortal } from 'react-dom';
import { X, Layers, Trash2, CheckCircle2 } from 'lucide-react';
import type { DuplicateGroup } from '@/lib/hooks/useCaptions.query';

interface CaptionDuplicatesModalProps {
  open: boolean;
  onClose: () => void;
  duplicateGroups: DuplicateGroup[];
  onDeleteCaption: (id: string) => void;
  onMergeDuplicates: (group: DuplicateGroup, keepOriginal: boolean) => void;
  onDeleteAllDuplicates: () => void;
  setDuplicateGroups: React.Dispatch<React.SetStateAction<DuplicateGroup[]>>;
}

export function CaptionDuplicatesModal({
  open,
  onClose,
  duplicateGroups,
  onDeleteCaption,
  onMergeDuplicates,
  onDeleteAllDuplicates,
  setDuplicateGroups,
}: CaptionDuplicatesModalProps) {
  if (!open) return null;
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-dark-pink/10 dark:bg-brand-dark-pink/15 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-brand-dark-pink" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-brand-off-white">Duplicates</h2>
              <p className="text-xs font-mono text-gray-500">{duplicateGroups.length} groups found</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {duplicateGroups.length > 0 && (
              <button
                onClick={onDeleteAllDuplicates}
                className="px-3 py-1.5 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
              >
                Remove All
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-100px)]">
          {duplicateGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white">No duplicates found</p>
              <p className="text-xs text-gray-500 mt-1">Your caption bank is clean!</p>
            </div>
          ) : (
            duplicateGroups.map((group, gi) => (
              <div key={gi} className="border border-gray-100 dark:border-white/[0.06] rounded-xl overflow-hidden">
                {/* Original */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-white/[0.03]">
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 rounded uppercase tracking-wider">
                    Keep
                  </span>
                  <p className="flex-1 text-sm text-gray-900 dark:text-brand-off-white font-mono font-light italic leading-relaxed">
                    {group.original.caption}
                  </p>
                  <button
                    onClick={() => onMergeDuplicates(group, true)}
                    className="shrink-0 px-3 py-1 text-xs font-medium bg-brand-dark-pink/10 hover:bg-brand-dark-pink/20 text-brand-dark-pink rounded-lg transition-colors"
                  >
                    Keep First
                  </button>
                </div>
                {/* Duplicates */}
                {group.duplicates.map(dup => (
                  <div key={dup.id} className="flex items-start gap-3 p-4 border-t border-gray-100 dark:border-white/[0.06]">
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-red-500/10 text-red-500 rounded uppercase tracking-wider">
                      Dup
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono font-light italic leading-relaxed truncate">
                        {dup.caption}
                      </p>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">
                        {group.similarity}% similar
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onDeleteCaption(dup.id);
                        setDuplicateGroups(prev =>
                          prev
                            .map(g => {
                              if (g !== group) return g;
                              return { ...g, duplicates: g.duplicates.filter(d => d.id !== dup.id) };
                            })
                            .filter(g => g.duplicates.length > 0)
                        );
                      }}
                      className="shrink-0 p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
