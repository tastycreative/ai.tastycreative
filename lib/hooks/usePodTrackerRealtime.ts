'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Ably from 'ably';
import { podTrackerKeys } from './usePodTracker.query';
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

/**
 * Subscribe to real-time POD Tracker events for an organization.
 * Invalidates TanStack Query caches when remote changes arrive.
 */
export function usePodTrackerRealtime(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const client = getAblyClient();
    const channel = client.channels.get(`pod-tracker:org:${orgId}`);
    channelRef.current = channel;

    const listener = (message: Ably.Message) => {
      const data = message.data as { tabId?: string };
      if (data.tabId === tabId) return; // skip own events

      const eventName = message.name ?? '';

      if (eventName === 'task.updated' || eventName === 'task.deleted' || eventName === 'tasks.seeded') {
        queryClient.invalidateQueries({ queryKey: podTrackerKeys.all });
      }

      if (eventName === 'config.updated') {
        queryClient.invalidateQueries({ queryKey: podTrackerKeys.config() });
      }
    };

    channel.subscribe(listener);

    // Re-attach and refetch on reconnect
    const onConnected = () => {
      if (channel.state !== 'attached') {
        channel.attach().catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: podTrackerKeys.all });
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
