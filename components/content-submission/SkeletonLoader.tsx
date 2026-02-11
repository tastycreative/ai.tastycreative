'use client';

import { memo } from 'react';

export const SkeletonLoader = memo(function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Header Skeleton */}
      <div className="space-y-3">
        <div className="h-8 bg-zinc-800/50 rounded-lg w-1/3" />
        <div className="h-4 bg-zinc-800/30 rounded w-1/2" />
      </div>

      {/* Progress Bar Skeleton */}
      <div className="space-y-2">
        <div className="h-2 bg-zinc-800/50 rounded-full w-full" />
        <div className="flex justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2 flex flex-col items-center">
              <div className="w-12 h-12 bg-zinc-800/50 rounded-full" />
              <div className="h-3 bg-zinc-800/30 rounded w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-8 space-y-6">
        <div className="space-y-4">
          <div className="h-6 bg-zinc-800/50 rounded w-1/4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-zinc-800/30 rounded-xl" />
            <div className="h-32 bg-zinc-800/30 rounded-xl" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-6 bg-zinc-800/50 rounded w-1/3" />
          <div className="h-24 bg-zinc-800/30 rounded-xl" />
        </div>
      </div>

      {/* Button Skeleton */}
      <div className="flex justify-between">
        <div className="h-12 bg-zinc-800/30 rounded-xl w-24" />
        <div className="h-12 bg-zinc-800/50 rounded-xl w-32" />
      </div>
    </div>
  );
});

export const FormFieldSkeleton = memo(function FormFieldSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-zinc-800/50 rounded w-32" />
      <div className="h-12 bg-zinc-800/30 rounded-xl w-full" />
    </div>
  );
});
