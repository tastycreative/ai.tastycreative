'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

export interface Profile {
  id: string;
  name: string;
  instagramUsername?: string;
  profileImageUrl?: string;
  isDefault: boolean;
}

const STORAGE_KEY = 'selectedInstagramProfileId';

export function useInstagramProfile() {
  const { user, isLoaded } = useUser();
  const [profileId, setProfileIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
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
        
        // Auto-select profile if none selected
        const currentProfileId = localStorage.getItem(STORAGE_KEY);
        if (!currentProfileId && data.profiles.length > 0) {
          const defaultProfile = data.profiles.find((p: Profile) => p.isDefault);
          const selectedProfile = defaultProfile || data.profiles[0];
          setProfileIdState(selectedProfile.id);
          localStorage.setItem(STORAGE_KEY, selectedProfile.id);
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

  const selectedProfile = profiles.find(p => p.id === profileId);

  return {
    profileId,
    setProfileId,
    profiles,
    selectedProfile,
    loadingProfiles,
    fetchProfiles,
  };
}
