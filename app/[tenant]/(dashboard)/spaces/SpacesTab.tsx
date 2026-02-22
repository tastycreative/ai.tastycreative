'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useSpaces } from '@/lib/hooks/useSpaces.query';
import { SpacesList } from './SpacesList';
import { CreateSpaceModal } from './CreateSpaceModal';

export function SpacesTab() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data, isLoading } = useSpaces();
  const spaces = data?.spaces ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-brand-off-white">
            Spaces
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage all your workspaces. Click a space to open its board.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-brand-light-pink to-brand-mid-pink text-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Space
        </button>
      </div>

      {/* Space cards grid */}
      <SpacesList spaces={spaces} isLoading={isLoading} />

      <CreateSpaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
