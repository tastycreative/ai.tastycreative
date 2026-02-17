'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface InstagramProfile {
  id: string;
  name: string;
  username: string | null;
  profileImageUrl: string | null;
  selectedContentTypes: string[];
  customContentTypes: string[];
  isDefault: boolean;
  isShared: boolean;
  clerkId: string;
  organizationId: string | null;
  linkedLoRAs: Array<{
    id: string;
    displayName: string;
    thumbnailUrl: string | null;
    fileName: string;
  }>;
  _count: {
    posts: number;
    feedPosts: number;
  };
}

async function fetchInstagramProfiles(): Promise<InstagramProfile[]> {
  const response = await fetch('/api/instagram-profiles');
  
  if (!response.ok) {
    throw new Error('Failed to fetch profiles');
  }
  
  const data = await response.json();
  
  // API returns array directly, not wrapped in profiles property
  return Array.isArray(data) ? data : [];
}

export function useInstagramProfiles() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['instagram-profiles', user?.id],
    queryFn: fetchInstagramProfiles,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
