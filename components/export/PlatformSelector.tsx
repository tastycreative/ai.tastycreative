'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { PlatformId, PLATFORM_SPECS } from '@/lib/export/platform-specs';

interface PlatformSelectorProps {
  selectedPlatforms: PlatformId[];
  onTogglePlatform: (platformId: PlatformId) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  disabled?: boolean;
}

const PLATFORM_ORDER: PlatformId[] = [
  'onlyfans',
  'fansly',
  'fanvue',
  'instagram-posts',
  'instagram-stories',
  'instagram-reels',
  'twitter',
  'tiktok',
];

export default function PlatformSelector({
  selectedPlatforms,
  onTogglePlatform,
  onSelectAll,
  onClearAll,
  disabled = false,
}: PlatformSelectorProps) {
  const allSelected = selectedPlatforms.length === PLATFORM_ORDER.length;
  const noneSelected = selectedPlatforms.length === 0;

  return (
    <div className="space-y-3">
      {/* Header with Select/Clear All */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Select Platforms
        </label>
        <div className="flex gap-2">
          {onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              disabled={disabled || allSelected}
              className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select All
            </button>
          )}
          {onClearAll && onSelectAll && (
            <span className="text-gray-300 dark:text-gray-600">|</span>
          )}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              disabled={disabled || noneSelected}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Platform Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PLATFORM_ORDER.map((platformId) => {
          const spec = PLATFORM_SPECS[platformId];
          if (!spec) return null;

          const isSelected = selectedPlatforms.includes(platformId);
          const recommendedDim = spec.dimensions.find((d) => d.recommended) || spec.dimensions[0];

          return (
            <button
              key={platformId}
              type="button"
              onClick={() => onTogglePlatform(platformId)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              {/* Checkmark indicator */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Platform icon/emoji */}
              <span className="text-xl">{spec.icon}</span>

              {/* Platform name */}
              <span
                className={`text-xs font-medium text-center ${
                  isSelected
                    ? 'text-purple-900 dark:text-purple-100'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {spec.shortName}
              </span>

              {/* Dimensions hint */}
              <span
                className={`text-[10px] ${
                  isSelected
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {recommendedDim.width}x{recommendedDim.height}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selection count */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
        {selectedPlatforms.length} of {PLATFORM_ORDER.length} platforms selected
      </p>
    </div>
  );
}

/**
 * Hook for managing platform selection state
 */
export function usePlatformSelection(initialPlatforms: PlatformId[] = []) {
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<PlatformId[]>(initialPlatforms);

  const togglePlatform = React.useCallback((platformId: PlatformId) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  }, []);

  const selectAll = React.useCallback(() => {
    setSelectedPlatforms([...PLATFORM_ORDER]);
  }, []);

  const clearAll = React.useCallback(() => {
    setSelectedPlatforms([]);
  }, []);

  const reset = React.useCallback((platforms: PlatformId[] = []) => {
    setSelectedPlatforms(platforms);
  }, []);

  return {
    selectedPlatforms,
    togglePlatform,
    selectAll,
    clearAll,
    reset,
  };
}
