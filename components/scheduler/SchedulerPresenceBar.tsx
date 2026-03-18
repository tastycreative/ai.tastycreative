'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Users } from 'lucide-react';
import * as Ably from 'ably';

interface PresenceUser {
  clientId: string;
  name?: string;
}

/** Shared Ably client for presence — reuses one connection across mounts. */
let sharedPresenceClient: Ably.Realtime | null = null;

function getPresenceClient(): Ably.Realtime {
  if (
    !sharedPresenceClient ||
    sharedPresenceClient.connection.state === 'failed' ||
    sharedPresenceClient.connection.state === 'closed'
  ) {
    sharedPresenceClient = new Ably.Realtime({
      authUrl: '/api/ably/auth',
      autoConnect: true,
    });
  }
  return sharedPresenceClient;
}

interface SchedulerPresenceBarProps {
  orgId: string | undefined;
}

export function SchedulerPresenceBar({ orgId }: SchedulerPresenceBarProps) {
  const [members, setMembers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const client = getPresenceClient();
    const channel = client.channels.get(`scheduler:org:${orgId}`);
    channelRef.current = channel;

    const syncPresence = async () => {
      try {
        const presenceMessages = await channel.presence.get();
        setMembers(
          presenceMessages.map((m) => ({
            clientId: m.clientId,
            name: (m.data as { name?: string })?.name,
          })),
        );
      } catch {}
    };

    channel.presence.enter({ name: 'User' }).catch(() => {});
    channel.presence.subscribe('enter', syncPresence);
    channel.presence.subscribe('leave', syncPresence);
    syncPresence();

    return () => {
      channel.presence.leave().catch(() => {});
      channel.presence.unsubscribe();
      channelRef.current = null;
      // Don't close the shared client — it's reused across mounts
    };
  }, [orgId]);

  if (members.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Users className="h-3 w-3 text-gray-400 dark:text-[#3a3a5a]" />
      <div className="flex -space-x-1">
        {members.slice(0, 5).map((m) => (
          <div
            key={m.clientId}
            className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold font-sans bg-brand-dark-pink/10 text-brand-dark-pink border-2 border-white dark:bg-[#ff9a6c20] dark:text-[#ff9a6c] dark:border-[#07070e]"
            title={m.name || m.clientId}
          >
            {(m.name || '?')[0].toUpperCase()}
          </div>
        ))}
        {members.length > 5 && (
          <div className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold font-mono bg-gray-100 text-gray-400 border-2 border-white dark:bg-[#111124] dark:text-[#3a3a5a] dark:border-[#07070e]">
            +{members.length - 5}
          </div>
        )}
      </div>
      <span className="text-[9px] font-mono text-gray-400 dark:text-[#3a3a5a]">
        {members.length}
      </span>
    </div>
  );
}
