'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import * as Ably from 'ably';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PresenceMember {
  clientId: string;
  name: string;
  imageUrl?: string;
  activeTaskId?: string | null;
}

interface SchedulerPresenceContextValue {
  /** All online members viewing this model (including self) */
  members: PresenceMember[];
  /** Map of taskId → members currently viewing that task (excludes self) */
  taskViewers: Map<string, PresenceMember[]>;
  /** Call when opening a task modal */
  setActiveTask: (taskId: string | null) => void;
}

const SchedulerPresenceContext = createContext<SchedulerPresenceContextValue>({
  members: [],
  taskViewers: new Map(),
  setActiveTask: () => {},
});

export function useSchedulerPresenceContext() {
  return useContext(SchedulerPresenceContext);
}

// ─── Shared Ably client ─────────────────────────────────────────────────────

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

// ─── Provider ───────────────────────────────────────────────────────────────

export function SchedulerPresenceProvider({
  profileId,
  children,
}: {
  /** The selected model/profile ID — presence is scoped per model */
  profileId: string | null | undefined;
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const activeTaskRef = useRef<string | null>(null);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'User'
    : 'User';
  const userImageUrl = user?.imageUrl || undefined;
  const selfClientId = user?.id || '';

  // Sync presence from Ably
  const syncPresence = useCallback(async (channel: Ably.RealtimeChannel) => {
    try {
      const presenceMessages = await channel.presence.get();
      const seen = new Set<string>();
      const unique: PresenceMember[] = [];
      for (const m of presenceMessages) {
        if (!seen.has(m.clientId)) {
          seen.add(m.clientId);
          const data = m.data as { name?: string; imageUrl?: string; activeTaskId?: string | null } | undefined;
          unique.push({
            clientId: m.clientId,
            name: data?.name || m.clientId,
            imageUrl: data?.imageUrl,
            activeTaskId: data?.activeTaskId ?? null,
          });
        }
      }
      setMembers(unique);
    } catch {}
  }, []);

  // Connect to Ably presence — scoped to the selected profile/model
  useEffect(() => {
    if (!profileId) {
      setMembers([]);
      return;
    }

    const client = getPresenceClient();
    const channel = client.channels.get(`scheduler:profile:${profileId}`);
    channelRef.current = channel;

    const presenceData = { name: displayName, imageUrl: userImageUrl, activeTaskId: activeTaskRef.current };
    channel.presence.enter(presenceData).catch(() => {});

    const handleSync = () => syncPresence(channel);
    channel.presence.subscribe('enter', handleSync);
    channel.presence.subscribe('leave', handleSync);
    channel.presence.subscribe('update', handleSync);
    handleSync();

    return () => {
      channel.presence.leave().catch(() => {});
      channel.presence.unsubscribe();
      channelRef.current = null;
      setMembers([]);
    };
  }, [profileId, displayName, userImageUrl, syncPresence]);

  // Set active task — updates Ably presence data
  const setActiveTask = useCallback(
    (taskId: string | null) => {
      activeTaskRef.current = taskId;
      const channel = channelRef.current;
      if (channel) {
        channel.presence
          .update({ name: displayName, imageUrl: userImageUrl, activeTaskId: taskId })
          .then(() => syncPresence(channel))
          .catch(() => {});
      }
    },
    [displayName, userImageUrl, syncPresence],
  );

  // Build taskViewers map (excludes self)
  const taskViewers = useMemo(() => {
    const map = new Map<string, PresenceMember[]>();
    for (const m of members) {
      if (m.clientId === selfClientId) continue;
      if (!m.activeTaskId) continue;
      const existing = map.get(m.activeTaskId) || [];
      existing.push(m);
      map.set(m.activeTaskId, existing);
    }
    return map;
  }, [members, selfClientId]);

  const value = useMemo(
    () => ({ members, taskViewers, setActiveTask }),
    [members, taskViewers, setActiveTask],
  );

  return (
    <SchedulerPresenceContext.Provider value={value}>
      {children}
    </SchedulerPresenceContext.Provider>
  );
}
