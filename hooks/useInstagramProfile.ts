'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

export interface Profile {
  id: string;
  name: string;
  instagramUsername?: string;
  profileImageUrl?: string;
  isDefault: boolean;
  clerkId?: string | null;
  organizationId?: string | null;
  organization?: {
    id: string;
    name: string;
    logoUrl?: string | null;
  } | null;
  user?: {
    id?: string;
    clerkId?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    email?: string | null;
  } | null;
}

const STORAGE_KEY = 'selectedInstagramProfileId';

// Special profile object for "All Profiles" selection
export const ALL_PROFILES_OPTION: Profile = {
  id: 'all',
  name: 'All Profiles',
  isDefault: false,
};

export function useInstagramProfile() {
  const { user, isLoaded } = useUser();
  const [profileId, setProfileIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default to 'all' if nothing stored
      return stored || 'all';
    }
    return 'all';
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const pendingDeletedProfileId = useRef<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoadingProfiles(true);
      const response = await fetch("/api/instagram/profiles");
      const data = await response.json();
      
      if (data.profiles) {
        setProfiles(data.profiles);
        
        // Auto-select 'all' if nothing is stored yet
        const currentProfileId = localStorage.getItem(STORAGE_KEY);
        if (!currentProfileId) {
          setProfileIdState('all');
          localStorage.setItem(STORAGE_KEY, 'all');
        }
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  const setProfileId = useCallback((newProfileId: string) => {
    setProfileIdState(newProfileId);
    localStorage.setItem(STORAGE_KEY, newProfileId);
    // Trigger storage event for other components to pick up the change
    window.dispatchEvent(new Event('storage'));
  }, []);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetchProfiles();
  }, [isLoaded, user, fetchProfiles]);

  // Listen for storage changes from other components/tabs
  useEffect(() => {
    const handleStorageChange = () => {
      const newProfileId = localStorage.getItem(STORAGE_KEY);
      setProfileIdState(newProfileId);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for profile updates from other components (e.g., when creating/editing/deleting a profile)
  useEffect(() => {
    const handleProfilesUpdated = async (event: Event) => {
      const customEvent = event as CustomEvent;
      // If deleting currently selected profile, mark it for auto-selection after fetch
      if (customEvent.detail?.deleted && customEvent.detail?.deletedProfileId === profileId) {
        pendingDeletedProfileId.current = customEvent.detail.deletedProfileId;
      }
      
      await fetchProfiles();
      
      // For create/edit operations, keep or set the specified profile as selected
      if (customEvent.detail?.profileId && !customEvent.detail?.deleted) {
        setProfileId(customEvent.detail.profileId);
      }
    };

    window.addEventListener('profilesUpdated', handleProfilesUpdated);
    return () => window.removeEventListener('profilesUpdated', handleProfilesUpdated);
  }, [fetchProfiles, setProfileId, profileId]);

  // Auto-select another profile when the current one is deleted
  useEffect(() => {
    if (pendingDeletedProfileId.current && !loadingProfiles) {
      if (profiles.length > 0) {
        // Select the first default profile or the first available profile
        const defaultProfile = profiles.find((p: Profile) => p.isDefault);
        const firstProfile = defaultProfile || profiles[0];
        setProfileId(firstProfile.id);
      } else {
        setProfileId('all');
      }
      pendingDeletedProfileId.current = null;
    }
  }, [profiles, loadingProfiles, setProfileId]);

  const selectedProfile = profileId === 'all' ? ALL_PROFILES_OPTION : profiles.find(p => p.id === profileId);
  const isAllProfiles = profileId === 'all';

  return {
    profileId,
    setProfileId,
    profiles,
    selectedProfile,
    loadingProfiles,
    fetchProfiles,
    isAllProfiles,
  };
}
