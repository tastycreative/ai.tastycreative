'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spaceKeys } from '@/lib/hooks/useSpaces.query';
import type { ChecklistItem } from '@/lib/spaces/template-metadata';

export interface ChecklistConfig {
  items: ChecklistItem[];
}

export function useUpdateSpaceChecklist(
  spaceId: string | undefined,
  currentConfig: Record<string, unknown> | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checklist: ChecklistConfig) => {
      if (!spaceId) throw new Error('Space ID is required');

      const mergedConfig = {
        ...(currentConfig ?? {}),
        checklist,
      };

      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: mergedConfig }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to update checklist settings');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceKeys.all });
    },
  });
}
