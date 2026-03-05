'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spaceKeys } from '@/lib/hooks/useSpaces.query';

export type MemberNotifyMode = 'all' | 'column';

export interface NotificationConfig {
  /** Whether member-based notifications are enabled */
  memberEnabled: boolean;
  /** 'all' = all space members, 'column' = only members assigned to destination column */
  memberMode: MemberNotifyMode;
  /** Whether to also notify the item assignee + creator */
  notifyAssigned: boolean;
  /** Maps columnId → array of clerkIds assigned to that column (used when memberMode = 'column') */
  columnMembers?: Record<string, string[]>;
}

export function useUpdateSpaceNotifications(
  spaceId: string | undefined,
  currentConfig: Record<string, unknown> | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notifications: NotificationConfig) => {
      if (!spaceId) throw new Error('Space ID is required');

      const mergedConfig = {
        ...(currentConfig ?? {}),
        notifications,
      };

      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: mergedConfig }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to update notification settings');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceKeys.all });
    },
  });
}
