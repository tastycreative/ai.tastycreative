'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const setProfileId = useCallback((newProfileId: string) => {
    setProfileIdState(newProfileId);
    localStorage.setItem(STORAGE_KEY, newProfileId);
    // Trigger storage event for other components to pick up the change
    window.dispatchEvent(new Event('storage'));
  }, []);

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
