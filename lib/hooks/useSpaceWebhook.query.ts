'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spaceKeys } from '@/lib/hooks/useSpaces.query';

export interface WebhookConfig {
  enabled: boolean;
  secret: string;
}

export function useUpdateSpaceWebhook(
  spaceId: string | undefined,
  currentConfig: Record<string, unknown> | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhook: WebhookConfig) => {
      if (!spaceId) throw new Error('Space ID is required');

      const mergedConfig = {
        ...(currentConfig ?? {}),
        webhook,
      };

      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: mergedConfig }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to update webhook settings');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceKeys.all });
    },
  });
}

export function useRegenerateWebhookSecret(spaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!spaceId) throw new Error('Space ID is required');

      const res = await fetch(`/api/spaces/${spaceId}/webhook/regenerate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to regenerate webhook secret');
      }

      return res.json() as Promise<{ secret: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceKeys.all });
    },
  });
}
