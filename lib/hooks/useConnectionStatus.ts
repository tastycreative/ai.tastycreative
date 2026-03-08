'use client';

import { useState, useEffect, useCallback } from 'react';

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

let listeners: Set<(state: ConnectionState) => void> = new Set();
let currentState: ConnectionState = 'connected';

/** Global setter — called from useBoardRealtime / useCaptionQueueSSE */
export function setConnectionState(state: ConnectionState) {
  if (currentState === state) return;
  currentState = state;
  listeners.forEach(fn => fn(state));
}

/** Returns current Ably connection state for UI indicators */
export function useConnectionStatus() {
  const [state, setState] = useState<ConnectionState>(currentState);

  useEffect(() => {
    listeners.add(setState);
    // Sync in case it changed before mount
    setState(currentState);
    return () => { listeners.delete(setState); };
  }, []);

  const isConnected = state === 'connected';
  const isReconnecting = state === 'reconnecting';
  const isDisconnected = state === 'disconnected';

  return { state, isConnected, isReconnecting, isDisconnected };
}

/**
 * Hook that returns a refetchInterval for TanStack Query.
 * When Ably is disconnected, enables polling as a fallback (every 30s).
 * When connected, disables polling (returns false).
 */
export function useRealtimeFallbackInterval(normalInterval: number | false = false) {
  const { isConnected } = useConnectionStatus();
  return isConnected ? normalInterval : 30_000;
}
