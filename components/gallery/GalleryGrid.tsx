'use client';

import React from 'react';
import { GalleryItem } from './GalleryItem';
import type { GalleryItemWithModel } from '@/types/gallery';
import { ImageOff } from 'lucide-react';

interface GalleryGridProps {
  items: GalleryItemWithModel[];
  loading?: boolean;
  onItemClick?: (item: GalleryItemWithModel) => void;
  onItemEdit?: (item: GalleryItemWithModel) => void;
  onItemEditType?: (item: GalleryItemWithModel) => void;
  onItemPerformance?: (item: GalleryItemWithModel) => void;
  onItemArchive?: (item: GalleryItemWithModel) => void;
}

export function GalleryGrid({
  items,
  loading = false,
  onItemClick,
  onItemEdit,
  onItemEditType,
  onItemPerformance,
  onItemArchive,
}: GalleryGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden animate-pulse"
          >
            <div className="aspect-[4/3] bg-zinc-800/50" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-zinc-800" />
                <div className="h-4 w-24 bg-zinc-800 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-14 bg-zinc-800/50 rounded-lg" />
                <div className="h-14 bg-zinc-800/50 rounded-lg" />
                <div className="h-14 bg-zinc-800/50 rounded-lg" />
              </div>
              <div className="h-4 w-32 bg-zinc-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 mb-6">
          <ImageOff className="w-12 h-12 text-zinc-700" />
        </div>
        <h3 className="text-xl font-medium text-white mb-2">No content found</h3>
        <p className="text-zinc-500 max-w-md">
          Try adjusting your filters or search query to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {items.map((item) => (
        <GalleryItem
          key={item.id}
          item={item}
          onClick={onItemClick}
          onEdit={onItemEdit}
          onEditType={onItemEditType}
          onPerformance={onItemPerformance}
          onArchive={onItemArchive}
        />
      ))}
    </div>
  );
}
