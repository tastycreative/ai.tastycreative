'use client';

import { Users, Share2, Upload, BarChart3, Layers } from 'lucide-react';

interface CaptionHeaderProps {
  masterMode: boolean;
  isAllProfiles: boolean;
  isSharedProfile: boolean;
  selectedProfile?: { id: string; name: string } | null;
  sharedProfileOwnerName: string | null;
  isCheckingDuplicates: boolean;
  captionCount: number;
  onImportClick: () => void;
  onStatsClick: () => void;
  onDuplicatesClick: () => void;
}

export function CaptionHeader({
  masterMode,
  isAllProfiles,
  isSharedProfile,
  selectedProfile,
  sharedProfileOwnerName,
  isCheckingDuplicates,
  captionCount,
  onImportClick,
  onStatsClick,
  onDuplicatesClick,
}: CaptionHeaderProps) {
  return (
    <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100 dark:border-white/[0.06]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-brand-light-pink uppercase mb-1">
            {masterMode ? 'caption vault' : 'caption bank'}
          </p>
          <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-gray-900 dark:text-brand-off-white leading-none flex items-center gap-3">
            {masterMode ? 'The Bank' : 'Captions'}
            {isAllProfiles && (
              <span className="px-3 py-1 bg-brand-light-pink/10 dark:bg-brand-light-pink/15 border border-brand-light-pink/25 rounded-full text-sm font-medium text-brand-light-pink flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                All
              </span>
            )}
            {isSharedProfile && !isAllProfiles && (
              <span className="px-3 py-1 bg-brand-blue/10 dark:bg-brand-blue/15 border border-brand-blue/25 rounded-full text-sm font-medium text-brand-blue flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" />
                Shared
              </span>
            )}
          </h1>
          {selectedProfile && !isAllProfiles && (
            <p className="mt-1 text-sm font-mono text-gray-500 dark:text-gray-400 tracking-wide">
              {isSharedProfile ? (
                <>
                  captions for{' '}
                  <span className="text-brand-light-pink">
                    {selectedProfile.name}
                  </span>{' '}
                  {sharedProfileOwnerName && (
                    <span className="text-brand-blue">
                      (shared by {sharedProfileOwnerName})
                    </span>
                  )}
                </>
              ) : (
                <>
                  gallery captions for{' '}
                  <span className="text-brand-light-pink">
                    {selectedProfile.name}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onImportClick}
            className="h-9 px-4 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={onStatsClick}
            disabled={isAllProfiles}
            className="h-9 px-4 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Stats</span>
          </button>
          <button
            onClick={onDuplicatesClick}
            disabled={
              isCheckingDuplicates || captionCount < 2 || isAllProfiles
            }
            className="h-9 px-4 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCheckingDuplicates ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Duplicates</span>
          </button>
        </div>
      </div>
    </div>
  );
}
