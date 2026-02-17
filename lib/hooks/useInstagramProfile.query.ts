'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface ModelBible {
  age?: string;
  backstory?: string;
  interests?: string[];
  personalityDescription?: string;
  favoriteColors?: string[];
  lingoKeywords?: string[];
  preferredEmojis?: string[];
  restrictions?: {
    contentLimitations?: string;
    wallRestrictions?: string;
    mmExclusions?: string;
    wordingToAvoid?: string[];
    customsToAvoid?: string;
  };
  coreTraits?: string[];
  morningVibe?: string;
  afternoonVibe?: string;
  nightVibe?: string;
  primaryNiche?: string;
  commonThemes?: string;
  hair?: string;
  eyes?: string;
  bodyType?: string;
  tattoosPiercings?: string;
}

export interface InstagramProfileDetail {
  id: string;
  name: string;
  description?: string;
  instagramUsername?: string;
  profileImageUrl?: string;
  pageStrategy?: string;
  modelBible?: ModelBible;
  selectedContentTypes?: string[];
  customContentTypes?: string[];
}

async function fetchInstagramProfile(profileId: string): Promise<InstagramProfileDetail> {
  const response = await fetch(`/api/instagram-profiles/${profileId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  
  return response.json();
}

export function useInstagramProfile(profileId: string | null | undefined) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['instagram-profile', profileId, user?.id],
    queryFn: () => fetchInstagramProfile(profileId!),
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
