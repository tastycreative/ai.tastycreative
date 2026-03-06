'use client';

import { useEffect, useCallback } from 'react';
import * as Ably from 'ably';
import { useAuth } from '@clerk/nextjs';

let sharedClient: Ably.Realtime | null = null;

function getAblyClient(): Ably.Realtime {
  if (!sharedClient || sharedClient.connection.state === 'failed' || sharedClient.connection.state === 'closed') {
    if (sharedClient) sharedClient.close();
    sharedClient = new Ably.Realtime({
      authUrl: '/api/ably/auth',
      autoConnect: true,
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 10000,
    });
  }
  return sharedClient;
}

interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  createdAt: string;
}

/**
 * Subscribe to real-time notification events for the current user.
 * Calls `onNewNotification` whenever a new notification arrives via Ably.
 */
export function useNotificationRealtime(
  onNewNotification: (notification: RealtimeNotification) => void,
) {
  const { userId } = useAuth();

  const stableCallback = useCallback(onNewNotification, [onNewNotification]);

  useEffect(() => {
    if (!userId) return;

    const client = getAblyClient();
    const channel = client.channels.get(`notifications:user:${userId}`);

    const listener = (message: Ably.Message) => {
      const data = message.data as RealtimeNotification;
      if (data?.id) {
        stableCallback(data);
      }
    };

    channel.subscribe('notification:new', listener);

    const onConnected = () => {
      if (channel.state !== 'attached') {
        channel.attach().catch(() => {});
      }
    };
    client.connection.on('connected', onConnected);

    return () => {
      channel.unsubscribe('notification:new', listener);
      client.connection.off('connected', onConnected);
    };
  }, [userId, stableCallback]);
}
