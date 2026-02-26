'use client';

import { memo } from 'react';

// Base skeleton component
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
  );
}

// Queue Panel Skeleton
export const QueuePanelSkeleton = memo(function QueuePanelSkeleton() {
  return (
    <div className="flex flex-col h-full border-r border-brand-mid-pink/20 bg-white dark:bg-gray-900/80">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-brand-mid-pink/20">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>

      {/* Queue items */}
      <div className="flex-1 overflow-hidden p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-brand-mid-pink/10">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-6 h-6 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3 mb-2" />
            <div className="flex gap-1.5 mb-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
});

// Content Viewer Skeleton
export const ContentViewerSkeleton = memo(function ContentViewerSkeleton() {
  return (
    <div className="h-full relative flex items-center justify-center bg-brand-off-white dark:bg-gray-800 border-b border-brand-mid-pink/20">
      <div className="w-4/5 h-4/5 bg-linear-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-xl animate-pulse flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-600" />
      </div>
    </div>
  );
});

// Caption Editor Skeleton
export const CaptionEditorSkeleton = memo(function CaptionEditorSkeleton() {
  return (
    <div className="h-full p-5 flex flex-col bg-white dark:bg-gray-900/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="w-24 h-1.5 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Textarea */}
      <Skeleton className="flex-1 min-h-30 mb-3 rounded-xl" />

      {/* Quick emoji bar */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-3 w-16" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="w-8 h-8 rounded-lg" />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Skeleton className="flex-1 h-12 rounded-xl" />
        <Skeleton className="flex-2 h-12 rounded-xl" />
      </div>
    </div>
  );
});

// Context Panel Skeleton
export const ContextPanelSkeleton = memo(function ContextPanelSkeleton() {
  return (
    <div className="p-4 bg-white dark:bg-gray-900/80">
      {/* Model Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-brand-mid-pink/20">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
      </div>

      {/* Personality Section */}
      <div className="mb-5">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>

      {/* Background Section */}
      <div className="mb-5">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      {/* Lingo Section */}
      <div className="mb-5">
        <Skeleton className="h-3 w-28 mb-2" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>

      {/* Emojis Section */}
      <div className="mb-5">
        <Skeleton className="h-3 w-32 mb-2" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
});

// Reference Panel Skeleton
export const ReferencePanelSkeleton = memo(function ReferencePanelSkeleton() {
  return (
    <div className="p-4 bg-white dark:bg-gray-900/80">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-8 w-full rounded-xl mb-4" />
      
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl mb-3 border border-brand-mid-pink/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-4 w-12 rounded" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4 mb-2" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
});

// Full Workspace Skeleton
export const CaptionWorkspaceSkeleton = memo(function CaptionWorkspaceSkeleton() {
  return (
    <div className="h-full flex">
      {/* Queue Panel */}
      <div className="w-80 shrink-0">
        <QueuePanelSkeleton />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <ContentViewerSkeleton />
        <div className="flex-1">
          <CaptionEditorSkeleton />
        </div>
      </div>
      
      {/* Context Panel */}
      <div className="w-80 shrink-0 border-l border-brand-mid-pink/20">
        <ContextPanelSkeleton />
      </div>
    </div>
  );
});
