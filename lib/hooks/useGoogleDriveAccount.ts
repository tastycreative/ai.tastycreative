'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GoogleDriveProfile {
  email: string;
  name: string;
  picture: string;
}

const STORAGE_KEY = 'gdrive_profile';

export function useGoogleDriveAccount() {
  const [profile, setProfile] = useState<GoogleDriveProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load profile from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setProfile(JSON.parse(stored));
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(() => {
    return new Promise<GoogleDriveProfile>((resolve, reject) => {
      // Always clear old cookies first so fresh tokens (with latest scopes) are issued
      fetch('/api/auth/google/signout', { method: 'POST' }).catch(() => {});
      fetch('/api/auth/google?redirect=/workspace/caption-workspace&mode=popup')
        .then(res => res.json())
        .then(({ authUrl }) => {
          if (!authUrl) { reject(new Error('Failed to get auth URL')); return; }

          const w = 500, h = 600;
          const left = window.screenX + (window.outerWidth - w) / 2;
          const top = window.screenY + (window.outerHeight - h) / 2;
          const popup = window.open(
            authUrl,
            'google-auth',
            `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
          );
          if (!popup) { reject(new Error('Popup was blocked by the browser')); return; }

          let resolved = false;
          let channel: BroadcastChannel | null = null;
          let checkClosedHandle: ReturnType<typeof setInterval> | undefined;

          const cleanup = () => {
            window.removeEventListener('message', messageHandler);
            if (channel) { try { channel.close(); } catch { /* ignore */ } }
            if (checkClosedHandle !== undefined) clearInterval(checkClosedHandle);
          };

          const handleAuthMessage = (data: { type: string; profile?: GoogleDriveProfile; error?: string }) => {
            if (resolved) return;
            if (data?.type === 'google-auth-success' && data.profile) {
              resolved = true;
              cleanup();
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.profile));
              setProfile(data.profile);
              resolve(data.profile);
            } else if (data?.type === 'google-auth-error') {
              resolved = true;
              cleanup();
              reject(new Error(data.error ?? 'Authentication failed'));
            }
          };

          // BroadcastChannel — primary mechanism; survives cross-origin navigation
          // and doesn't depend on window.opener being available.
          try {
            channel = new BroadcastChannel('google-auth');
            channel.addEventListener('message', (e: MessageEvent) => handleAuthMessage(e.data));
          } catch { /* BroadcastChannel not supported */ }

          // window.postMessage — fallback
          const messageHandler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            handleAuthMessage(event.data);
          };
          window.addEventListener('message', messageHandler);

          // Clean up if popup is closed without completing auth
          checkClosedHandle = setInterval(() => {
            if (popup.closed) {
              cleanup();
              // Don't reject — user may have closed the popup intentionally
            }
          }, 500);
        })
        .catch(reject);
    });
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/google/signout', { method: 'POST' });
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
  }, []);

  const switchAccount = useCallback(async () => {
    await signOut();
    return signIn();
  }, [signOut, signIn]);

  return {
    profile,
    isSignedIn: !!profile,
    isLoading,
    signIn,
    signOut,
    switchAccount,
  };
}
