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
 * Invalidates board items, and also comments/history for the currently open item.
 */
export function useBoardRealtime(boardId: string | undefined, openItemId?: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const openItemIdRef = useRef(openItemId);
  openItemIdRef.current = openItemId;

  useEffect(() => {
    if (!boardId) return;

    const client = getAblyClient();
    const channel = client.channels.get(`board:${boardId}`);
    channelRef.current = channel;

    const listener = (message: Ably.Message) => {
      const data = message.data as { tabId?: string; entityId?: string };
      if (data.tabId === tabId) return; // skip events from this tab

      const eventName = message.name ?? '';
      console.log('[ably] received event:', eventName, '— invalidating cache');

      // Always invalidate the board list
      queryClient.invalidateQueries({
        queryKey: boardItemKeys.list(boardId),
      });

      const entityId = data.entityId;
      const currentItemId = openItemIdRef.current;

      // If a comment was added to the currently open item, refresh comments
      if (eventName === 'comment.created' && entityId && entityId === currentItemId) {
        queryClient.invalidateQueries({
          queryKey: boardItemKeys.comments(entityId),
        });
      }

      // If the currently open item was updated, refresh its history
      if (eventName === 'item.updated' && entityId && entityId === currentItemId) {
        queryClient.invalidateQueries({
          queryKey: boardItemKeys.history(entityId),
        });
      }
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
