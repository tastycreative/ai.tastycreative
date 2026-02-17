'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

interface CaptionQueueItem {
  id: string;
  clerkId: string;
  profileId: string | null;
  modelName: string;
  modelAvatar: string;
  profileImageUrl: string | null;
  description: string;
  contentTypes: string[];
  messageTypes: string[];
  urgency: string;
  releaseDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: string | null;
  completedAt: string | null;
  captionText: string | null;
}

// Urgency priority mapping for proper sorting
const urgencyPriority: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

async function fetchCaptionQueue(): Promise<CaptionQueueItem[]> {
  const response = await fetch('/api/caption-queue');
  if (!response.ok) {
    throw new Error('Failed to fetch caption queue');
  }
  const data = await response.json();
  return data.items || [];
}

export function useCaptionQueue() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['caption-queue', user?.id],
    queryFn: fetchCaptionQueue,
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    select: (data) => {
      // Sort by urgency priority (urgent > high > medium > low), then by releaseDate
      return [...data].sort((a, b) => {
        const urgencyDiff = (urgencyPriority[b.urgency] || 0) - (urgencyPriority[a.urgency] || 0);
        if (urgencyDiff !== 0) return urgencyDiff;
        
        // If same urgency, sort by releaseDate (earliest first)
        return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      });
    },
  });
}
