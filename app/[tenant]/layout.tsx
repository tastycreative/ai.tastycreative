"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

const ACTIVITY_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const AFK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes of no interaction = AFK

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const { user, isLoaded } = useUser();
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const tenant = params.tenant as string;

  useEffect(() => {
    async function verifyAccess() {
      if (!isLoaded || !user) {
        return;
      }

      try {
        // Check if this is the user's personal workspace
        const isPersonalWorkspace = tenant === user.username || tenant === user.id || tenant === "personal";

        if (isPersonalWorkspace) {
          // Grant access to personal workspace
          setHasAccess(true);
          setIsVerifying(false);
          return;
        }

        // Otherwise, verify organization access
        const response = await fetch(`/api/organizations/verify-slug?slug=${tenant}`);

        if (!response.ok) {
          // User doesn't have access to this org
          router.push('/dashboard');
          return;
        }

        const data = await response.json();

        if (data.hasAccess) {
          setHasAccess(true);
        } else {
          // Redirect to their current organization or dashboard
          if (data.redirectSlug) {
            router.push(`/${data.redirectSlug}/dashboard`);
          } else {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error verifying access:', error);
        router.push('/dashboard');
      } finally {
        setIsVerifying(false);
      }
    }

    verifyAccess();
  }, [isLoaded, user, tenant, router]);

  // Track activity only when user is not AFK (has recent interactions)
  const lastTrackedRef = useRef(0);
  const lastInteractionRef = useRef(Date.now());

  const isUserActive = useCallback(() => {
    return Date.now() - lastInteractionRef.current < AFK_THRESHOLD_MS;
  }, []);

  const trackActivity = useCallback(() => {
    if (!isUserActive()) return;
    const now = Date.now();
    if (now - lastTrackedRef.current < ACTIVITY_COOLDOWN_MS) return;
    lastTrackedRef.current = now;
    fetch('/api/track-activity', { method: 'POST' }).catch(() => {});
  }, [isUserActive]);

  // Listen for user interactions to detect AFK
  useEffect(() => {
    if (!hasAccess) return;

    const resetInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, resetInteraction, { passive: true }));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetInteraction));
    };
  }, [hasAccess]);

  // Track on mount, on visibility change, and periodically (only if active)
  useEffect(() => {
    if (!hasAccess) return;

    // Track on mount
    trackActivity();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastInteractionRef.current = Date.now();
        trackActivity();
      }
    };

    // Periodic check every 2 min — only fires API if user is active
    const interval = setInterval(trackActivity, ACTIVITY_COOLDOWN_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [hasAccess, trackActivity]);

  // Show loading state while verifying
  if (!isLoaded || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-400">Verifying organization access...</p>
        </div>
      </div>
    );
  }

  // Only render children if user has access
  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
