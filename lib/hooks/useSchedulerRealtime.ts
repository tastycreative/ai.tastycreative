'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Ably from 'ably';
import { toast } from 'sonner';
import { schedulerKeys } from './useScheduler.query';
import { setConnectionState } from './useConnectionStatus';

// Unique ID per browser tab — skip events published by this tab
const tabId =
  typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

let sharedClient: Ably.Realtime | null = null;

function getAblyClient(): Ably.Realtime {
  if (
    !sharedClient ||
    sharedClient.connection.state === 'failed' ||
    sharedClient.connection.state === 'closed'
  ) {
    if (sharedClient) sharedClient.close();
    sharedClient = new Ably.Realtime({
      authUrl: '/api/ably/auth',
      autoConnect: true,
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 10000,
    });

    sharedClient.connection.on('connected', () => setConnectionState('connected'));
    sharedClient.connection.on('disconnected', () => setConnectionState('reconnecting'));
    sharedClient.connection.on('suspended', () => setConnectionState('disconnected'));
    sharedClient.connection.on('failed', () => setConnectionState('disconnected'));
  }
  return sharedClient;
}

// Stable toast ID so all clone events update the same toast
const CLONE_TOAST_ID = 'scheduler-clone-progress';

/**
 * Subscribe to real-time Scheduler events for an organization.
 * Invalidates TanStack Query caches when remote changes arrive.
 * Also handles clone progress events with toast notifications.
 */
export function useSchedulerRealtime(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const client = getAblyClient();
    const channel = client.channels.get(`scheduler:org:${orgId}`);
    channelRef.current = channel;

    const listener = (message: Ably.Message) => {
      const data = message.data as Record<string, unknown>;
      if (data.tabId === tabId) return; // skip own events

      const eventName = message.name ?? '';

      // ── Standard task/config events ──
      if (
        eventName === 'task.updated' ||
        eventName === 'task.deleted' ||
        eventName === 'task.created' ||
        eventName === 'tasks.seeded'
      ) {
        queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
      }

      if (eventName === 'config.updated') {
        queryClient.invalidateQueries({ queryKey: schedulerKeys.config() });
      }

      // ── Clone progress events (shown to ALL users) ──
      if (eventName === 'clone.start') {
        const total = Number(data.total) || 0;
        const skipped = Number(data.skipped) || 0;
        const who = String(data.userName || 'Someone');
        toast.loading(`Cloning ${total} tasks to next week...`, {
          id: CLONE_TOAST_ID,
          description: `${who} started cloning${skipped ? ` (${skipped} already existed)` : ''}`,
          duration: Infinity,
        });
      }

      if (eventName === 'clone.progress') {
        const currentDay = Number(data.currentDay) || 0;
        const totalDays = Number(data.totalDays) || 0;
        const totalCloned = Number(data.totalCloned) || 0;
        const totalToClone = Number(data.totalToClone) || 0;
        const totalFailed = Number(data.totalFailed) || 0;
        const tasksInDay = Number(data.tasksInDay) || 0;
        const dayName = String(data.dayName || '');
        const taskTypes = String(data.taskTypes || '');
        const who = String(data.userName || 'Someone');
        const failedNote = totalFailed > 0 ? ` · ${totalFailed} failed` : '';
        toast.loading(`Cloning — day ${currentDay}/${totalDays} (${totalCloned}/${totalToClone} tasks)`, {
          id: CLONE_TOAST_ID,
          description: `${dayName}: ${tasksInDay} ${taskTypes} tasks${failedNote} — by ${who}`,
          duration: Infinity,
        });
      }

      if (eventName === 'clone.complete') {
        const created = Number(data.created) || 0;
        const skipped = Number(data.skipped) || 0;
        const failed = Number(data.failed) || 0;
        const who = String(data.userName || 'Someone');
        const parts: string[] = [];
        if (created > 0) parts.push(`${created} cloned`);
        if (skipped > 0) parts.push(`${skipped} already existed`);
        if (failed > 0) parts.push(`${failed} failed`);

        if (created === 0 && failed === 0) {
          toast.info('All tasks already exist in next week.', {
            id: CLONE_TOAST_ID,
            description: `by ${who}`,
            duration: 4000,
          });
        } else if (failed > 0) {
          toast.warning('Clone completed with errors', {
            id: CLONE_TOAST_ID,
            description: `${parts.join(' · ')} — by ${who}`,
            duration: 6000,
          });
        } else {
          toast.success('Clone complete', {
            id: CLONE_TOAST_ID,
            description: `${parts.join(' · ')} — by ${who}`,
            duration: 4000,
          });
        }

        // Refresh data
        queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
      }
    };

    channel.subscribe(listener);

    // Re-attach and refetch on reconnect
    const onConnected = () => {
      if (channel.state !== 'attached') {
        channel.attach().catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: schedulerKeys.all });
    };
    client.connection.on('connected', onConnected);

    return () => {
      channel.unsubscribe(listener);
      client.connection.off('connected', onConnected);
      channelRef.current = null;
    };
  }, [orgId, queryClient]);
}

/** Expose tabId so mutations can include it */
export { tabId };
