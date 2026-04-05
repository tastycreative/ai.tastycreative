'use client';

import type { Caption } from '@/lib/hooks/useCaptions.query';
import { CaptionCard } from './CaptionCard';

interface CaptionGridProps {
  captions: Caption[];
  isAllProfiles: boolean;
  topPerformerIds: Set<string>;
  copiedId: string | null;
  searchQuery: string;
  onCopy: (text: string, id: string) => void;
  onCardClick: (caption: Caption) => void;
}

export function CaptionGrid({
  captions,
  isAllProfiles,
  topPerformerIds,
  copiedId,
  searchQuery,
  onCopy,
  onCardClick,
}: CaptionGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {captions.map((caption) => (
        <CaptionCard
          key={caption.id}
          caption={caption}
          isAllProfiles={isAllProfiles}
          isTopPerformer={topPerformerIds.has(caption.id)}
          copiedId={copiedId}
          searchQuery={searchQuery}
          onCopy={onCopy}
          onClick={onCardClick}
        />
      ))}
    </div>
  );
}
