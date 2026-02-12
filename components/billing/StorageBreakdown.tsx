'use client';

import { useState } from 'react';
import { HardDrive, Image, Video, Database, Cloud, RefreshCw, ChevronDown, ChevronUp, Users, FolderOpen } from 'lucide-react';
import { useStorageData, useRecalculateStorage } from '@/lib/hooks/useStorage.query';
import { toast } from 'sonner';

export default function StorageBreakdown() {
  const { data: storageData, isLoading, refetch } = useStorageData();
  const recalculateMutation = useRecalculateStorage();
  const [showDetails, setShowDetails] = useState(false);
  const [showUserBreakdown, setShowUserBreakdown] = useState(false);

  const handleRecalculate = async () => {
    try {
      await recalculateMutation.mutateAsync();
      toast.success('Storage recalculated successfully!');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to recalculate storage');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <HardDrive className="w-5 h-5 text-brand-mid-pink" />
          <h3 className="text-lg font-semibold text-foreground">Storage Details</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!storageData) {
    return null;
  }

  const { breakdown, limits } = storageData;
  const isNearLimit = limits.percentageUsed > 80;
  const isOverLimit = !limits.isWithinLimit;

  return (
    <div className="bg-card border border-brand-mid-pink/20 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <HardDrive className="w-5 h-5 text-brand-mid-pink" />
          <h3 className="text-lg font-semibold text-foreground">Storage Details</h3>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculateMutation.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 hover:bg-brand-mid-pink/20 dark:hover:bg-brand-mid-pink/30 text-brand-mid-pink dark:text-brand-light-pink rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
          Recalculate
        </button>
      </div>

      {/* Overall Storage */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Total Storage</span>
          <span
            className={`text-sm font-semibold ${
              isOverLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-foreground'
            }`}
          >
            {limits.currentGB.toFixed(2)} GB / {limits.maxGB} GB
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-brand-blue'
            }`}
            style={{ width: `${Math.min(limits.percentageUsed, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {limits.percentageUsed.toFixed(1)}% used
          {isOverLimit && ' - Storage limit exceeded!'}
          {isNearLimit && !isOverLimit && ' - Approaching storage limit'}
        </p>
      </div>

      {/* Storage by Type */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Image className="w-4 h-4 text-brand-mid-pink" />
            <span className="text-sm font-medium text-foreground">Images</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{breakdown.byType.images.count}</p>
          <p className="text-xs text-muted-foreground">{breakdown.byType.images.gb.toFixed(2)} GB</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Video className="w-4 h-4 text-brand-mid-pink" />
            <span className="text-sm font-medium text-foreground">Videos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{breakdown.byType.videos.count}</p>
          <p className="text-xs text-muted-foreground">{breakdown.byType.videos.gb.toFixed(2)} GB</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <FolderOpen className="w-4 h-4 text-brand-mid-pink" />
            <span className="text-sm font-medium text-foreground">Vault</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{breakdown.byType.vault.count}</p>
          <p className="text-xs text-muted-foreground">{breakdown.byType.vault.gb.toFixed(2)} GB</p>
        </div>
      </div>

      {/* Toggle Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors mb-4"
      >
        <span className="text-sm font-medium text-foreground">Storage Backend Details</span>
        {showDetails ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {showDetails && (
        <div className="space-y-3 mb-6 pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cloud className="w-4 h-4 text-brand-blue" />
              <span className="text-sm text-muted-foreground">AWS S3</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{breakdown.byStorage.awsS3.count} files</p>
              <p className="text-xs text-muted-foreground">{breakdown.byStorage.awsS3.gb.toFixed(2)} GB</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-brand-dark-pink" />
              <span className="text-sm text-muted-foreground">Database</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{breakdown.byStorage.database.count} files</p>
              <p className="text-xs text-muted-foreground">{breakdown.byStorage.database.gb.toFixed(2)} GB</p>
            </div>
          </div>
          {breakdown.byStorage.other.count > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-muted-foreground">Other (Legacy)</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{breakdown.byStorage.other.count} files</p>
                <p className="text-xs text-muted-foreground">{breakdown.byStorage.other.gb.toFixed(2)} GB</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Breakdown */}
      {breakdown.byUser.length > 0 && (
        <>
          <button
            onClick={() => setShowUserBreakdown(!showUserBreakdown)}
            className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors mb-4"
          >
            <span className="text-sm font-medium text-foreground">Storage by User</span>
            {showUserBreakdown ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showUserBreakdown && (
            <div className="space-y-2">
              {breakdown.byUser
                .sort((a, b) => b.bytes - a.bytes)
                .map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-brand-mid-pink" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {user.userName || 'Unknown User'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.imageCount} images, {user.videoCount} videos, {user.vaultCount} vault
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{user.gb.toFixed(2)} GB</p>
                      <p className="text-xs text-muted-foreground">
                        {((user.bytes / breakdown.totalBytes) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
