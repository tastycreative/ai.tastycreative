'use client';

import type { Space } from '@/lib/hooks/useSpaces.query';
import { SpaceCard } from './SpaceCard';

interface SpacesListProps {
  spaces: Space[];
  isLoading?: boolean;
}

export function SpacesList({ spaces, isLoading }: SpacesListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-2xl bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-brand-mid-pink/10 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!spaces.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-brand-mid-pink/30 bg-gray-50/70 dark:bg-gray-900/50 px-4 py-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No spaces yet. Create your first space to start organizing work.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {spaces.map((space) => (
        <SpaceCard key={space.id} space={space} />
      ))}
    </div>
  );
}
