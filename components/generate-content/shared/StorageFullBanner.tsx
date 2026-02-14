'use client';

import { AlertTriangle, HardDrive, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStorageCheck } from '@/lib/hooks/useStorageCheck';

interface StorageFullBannerProps {
  /**
   * Whether to show a compact version (for inline display)
   */
  compact?: boolean;
  /**
   * Custom class name for styling
   */
  className?: string;
  /**
   * Show a warning banner when storage is near full (>80%)
   */
  showWarning?: boolean;
}

export function StorageFullBanner({ compact = false, className = '', showWarning = true }: StorageFullBannerProps) {
  const params = useParams();
  const tenant = params.tenant as string;
  const { isStorageFull, currentGB, maxGB, percentageUsed, loading } = useStorageCheck();

  // Don't show anything while loading
  if (loading) return null;

  // Storage is full - show error banner
  if (isStorageFull) {
    if (compact) {
      return (
        <div className={`flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm ${className}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Storage full</span>
          <Link
            href={`/${tenant}/billing`}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Add storage
          </Link>
        </div>
      );
    }

    return (
      <div className={`rounded-xl border border-red-500/30 bg-red-500/10 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <HardDrive className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-red-500 mb-1">Storage Full</h3>
            <p className="text-sm text-red-400/80 mb-3">
              You've used {currentGB.toFixed(2)} GB of your {maxGB} GB storage limit. 
              Please free up space or add more storage to continue generating content.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/${tenant}/billing`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Storage
              </Link>
              <Link
                href={`/${tenant}/workspace/vault`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
              >
                Manage Files
              </Link>
            </div>
          </div>
        </div>
        {/* Storage bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-red-400 mb-1">
            <span>{currentGB.toFixed(2)} GB used</span>
            <span>{maxGB} GB total</span>
          </div>
          <div className="w-full h-2 bg-red-500/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(percentageUsed, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Storage is near full (>80%) - show warning banner
  if (showWarning && percentageUsed >= 80) {
    if (compact) {
      return (
        <div className={`flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-500 text-sm ${className}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">{percentageUsed.toFixed(0)}% storage used</span>
          <Link
            href={`/${tenant}/billing`}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Add storage
          </Link>
        </div>
      );
    }

    return (
      <div className={`rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-amber-500 mb-1">Storage Almost Full</h3>
            <p className="text-sm text-amber-400/80 mb-3">
              You've used {percentageUsed.toFixed(0)}% of your storage ({currentGB.toFixed(2)} GB of {maxGB} GB). 
              Consider adding more storage to avoid interruptions.
            </p>
            <Link
              href={`/${tenant}/billing`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Storage
            </Link>
          </div>
        </div>
        {/* Storage bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-amber-400 mb-1">
            <span>{currentGB.toFixed(2)} GB used</span>
            <span>{maxGB} GB total</span>
          </div>
          <div className="w-full h-2 bg-amber-500/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${percentageUsed}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Hook-based storage check result for use in generation functions
 */
export function useCanGenerate() {
  const { isStorageFull, availableGB, hasSpaceFor, loading, refresh } = useStorageCheck();

  return {
    /**
     * Whether generation is allowed (storage is not full)
     */
    canGenerate: !isStorageFull,
    /**
     * Whether still loading storage status
     */
    loading,
    /**
     * Available storage in GB
     */
    availableGB,
    /**
     * Check if there's space for estimated file size
     */
    hasSpaceFor,
    /**
     * Refresh storage status
     */
    refresh,
    /**
     * Error message to show if generation is blocked
     */
    storageError: isStorageFull ? 'Storage is full. Please add more storage or free up space before generating.' : null,
  };
}
