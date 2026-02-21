'use client';

import type { Space } from '@/lib/hooks/useSpaces.query';

interface SpaceCardProps {
  space: Space;
  onClick?: () => void;
}

export function SpaceCard({ space, onClick }: SpaceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/70 px-4 py-3 sm:px-5 sm:py-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 mb-1.5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-brand-off-white">
              {space.name}
            </h3>
            <span className="inline-flex items-center rounded-full bg-brand-light-pink/10 text-[10px] sm:text-xs font-medium text-brand-light-pink px-2 py-0.5">
              {space.templateType === 'KANBAN' ? 'Kanban board' : space.templateType}
            </span>
          </div>
          {space.description && (
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {space.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-light-pink/10 text-brand-light-pink text-xs font-semibold">
            {space.name.charAt(0).toUpperCase()}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Created {new Date(space.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </button>
  );
}

