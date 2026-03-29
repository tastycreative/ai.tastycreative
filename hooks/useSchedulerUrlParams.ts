'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export interface SchedulerUrlParams {
  model: string | null;
  platform: string | null;
  week: string | null;
  task: string | null;
}

export function useSchedulerUrlParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params: SchedulerUrlParams = {
    model: searchParams.get('model'),
    platform: searchParams.get('platform'),
    week: searchParams.get('week'),
    task: searchParams.get('task'),
  };

  const buildUrl = useCallback(
    (updates: Partial<Record<keyof SchedulerUrlParams, string | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, pathname],
  );

  /** Replace URL (no new history entry) — use for tab/profile/week changes */
  const setParams = useCallback(
    (updates: Partial<Record<keyof SchedulerUrlParams, string | null>>) => {
      router.replace(buildUrl(updates), { scroll: false });
    },
    [router, buildUrl],
  );

  /** Push URL (new history entry) — use for task modal (supports back button to close) */
  const pushParams = useCallback(
    (updates: Partial<Record<keyof SchedulerUrlParams, string | null>>) => {
      router.push(buildUrl(updates), { scroll: false });
    },
    [router, buildUrl],
  );

  return { params, setParams, pushParams };
}
