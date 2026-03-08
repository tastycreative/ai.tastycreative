'use client';

import { useConnectionStatus } from '@/lib/hooks/useConnectionStatus';

/**
 * Small indicator dot that shows real-time connection health.
 * Green = connected, yellow = reconnecting, red = disconnected.
 * Only visible when NOT connected (to avoid visual noise).
 */
export function ConnectionStatusIndicator() {
  const { state, isConnected } = useConnectionStatus();

  if (isConnected) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/80 border border-zinc-700/50 text-[11px] font-medium animate-in fade-in slide-in-from-top-1 duration-300">
      <span
        className={`w-2 h-2 rounded-full ${
          state === 'reconnecting'
            ? 'bg-amber-400 animate-pulse'
            : 'bg-red-400'
        }`}
      />
      <span className={state === 'reconnecting' ? 'text-amber-400' : 'text-red-400'}>
        {state === 'reconnecting' ? 'Reconnecting…' : 'Offline'}
      </span>
    </div>
  );
}
