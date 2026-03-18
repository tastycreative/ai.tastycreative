'use client';

import { useMemo } from 'react';
import { useCaptionQueue, type CaptionQueueItem } from './useCaptionQueue.query';
import { safeUrgency } from '@/components/gif-maker-workspace/queue-constants';

export interface GifQueueTicket {
  id: string;
  profileId: string | null;
  boardItemId: string | null;
  modelName: string;
  modelAvatar: string;
  profileImageUrl: string | null;
  description: string;
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  releaseDate: string;
  contentTypes: string[];
  messageTypes: string[];
  workflowType: string | null;
  status: string;
  captionText: string | null;
  contentUrl: string | null;
  contentSourceType: string | null;
  contentItems: CaptionQueueItem['contentItems'];
  hasGif: boolean;
}

export function useGifQueue() {
  const { data: rawQueue, isLoading, error, refetch } = useCaptionQueue();

  const queue: GifQueueTicket[] = useMemo(() => {
    if (!rawQueue) return [];
    return rawQueue
      .filter(item => !['completed'].includes(item.status))
      .map(item => ({
        id: item.id,
        profileId: item.profileId,
        boardItemId: item.boardItemId ?? null,
        modelName: item.modelName,
        modelAvatar: item.modelAvatar,
        profileImageUrl: item.profileImageUrl,
        description: item.description,
        urgency: safeUrgency(item.urgency),
        releaseDate: item.releaseDate,
        contentTypes: item.contentTypes,
        messageTypes: item.messageTypes,
        workflowType: item.workflowType ?? null,
        status: item.status,
        captionText: item.captionText,
        contentUrl: item.contentUrl ?? null,
        contentSourceType: item.contentSourceType ?? null,
        contentItems: item.contentItems || [],
        hasGif: false,
      }));
  }, [rawQueue]);

  return { queue, isLoading, error, refetch };
}
