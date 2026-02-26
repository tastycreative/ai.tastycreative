'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Ably from 'ably';
import { boardItemKeys } from './useBoardItems.query';

// Unique ID per browser tab — used to skip events published by this tab
const tabId = typeof crypto !== 'undefined'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

let sharedClient: Ably.Realtime | null = null;

function getAblyClient(): Ably.Realtime {
  if (!sharedClient || sharedClient.connection.state === 'failed' || sharedClient.connection.state === 'closed') {
    if (sharedClient) {
      sharedClient.close();
    }
    sharedClient = new Ably.Realtime({
      authUrl: '/api/ably/auth',
      autoConnect: true,
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 10000,
    });

    sharedClient.connection.on('connected', () => {
      console.log('[ably] connected');
    });
    sharedClient.connection.on('disconnected', () => {
      console.log('[ably] disconnected — will auto-retry');
    });
    sharedClient.connection.on('failed', (err) => {
      console.error('[ably] connection failed:', err);
    });
  }
  return sharedClient;
}

/**
 * Subscribe to real-time board events.
 * When another tab/user mutates the board, invalidate the React Query cache
 * so the UI refetches fresh data.
 */
export function useBoardRealtime(boardId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!boardId) return;

    const client = getAblyClient();
    const channel = client.channels.get(`board:${boardId}`);
    channelRef.current = channel;

    const listener = (message: Ably.Message) => {
      const senderTab = (message.data as { tabId?: string })?.tabId;
      if (senderTab === tabId) return; // skip events from this tab
      console.log('[ably] received event:', message.name, '— invalidating board cache');
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.list(boardId),
      });
    };

    channel.subscribe(listener);

    // Re-attach channel if connection recovers
    const onConnected = () => {
      if (channel.state !== 'attached') {
        channel.attach().catch(() => {});
      }
    };
    client.connection.on('connected', onConnected);

    return () => {
      channel.unsubscribe(listener);
      client.connection.off('connected', onConnected);
      channelRef.current = null;
    };
  }, [boardId, queryClient]);
}

/** Expose tabId so server publish calls can include it */
export { tabId };
