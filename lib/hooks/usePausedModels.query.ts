'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

interface PausedModel {
  modelName: string;
  pausedContentStyles: string[];
}

interface PausedModelsResponse {
  pausedModels: PausedModel[];
}

async function fetchPausedModels(): Promise<PausedModelsResponse> {
  const response = await fetch('/api/page-tracker/paused-models');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch paused models');
  }
  return response.json();
}

export function usePausedModels() {
  const { user } = useUser();

  const query = useQuery({
    queryKey: ['paused-models', user?.id],
    queryFn: fetchPausedModels,
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Build a Map<modelName, pausedStyles[]> for easy lookup
  const pausedModelsMap = new Map<string, string[]>();
  if (query.data?.pausedModels) {
    for (const m of query.data.pausedModels) {
      pausedModelsMap.set(m.modelName, m.pausedContentStyles);
    }
  }

  return {
    ...query,
    pausedModelsMap,
  };
}
