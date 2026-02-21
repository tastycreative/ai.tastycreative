'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface ProfilePin {
  id: string;
  userId: string;
  profileId: string;
  order: number;
  profile: {
    id: string;
    name: string;
    profileImageUrl?: string;
    instagramUsername?: string;
  };
}

// Fetch pinned profiles
async function fetchProfilePins(userId: string): Promise<ProfilePin[]> {
  const response = await fetch(`/api/profiles/pins?userId=${userId}`);
  if (!response.ok) throw new Error('Failed to fetch pins');
  return response.json();
}

export function useProfilePins() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: ['profile-pins', user?.id],
    queryFn: () => fetchProfilePins(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

// Toggle pin (pin or unpin)
export function useToggleProfilePin() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (profileId: string) => {
      // First check if already pinned
      const pinsResponse = await fetch(`/api/profiles/pins?userId=${user!.id}`);
      const pins: ProfilePin[] = await pinsResponse.json();
      const isPinned = pins.some(pin => pin.profileId === profileId);
      
      if (isPinned) {
        // Unpin
        const response = await fetch(`/api/profiles/pins/${profileId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to unpin');
        return response.json();
      } else {
        // Pin
        const response = await fetch('/api/profiles/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId }),
        });
        if (!response.ok) throw new Error('Failed to pin');
        return response.json();
      }
    },
    onMutate: async (profileId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['profile-pins', user?.id] });
      
      // Snapshot previous value
      const previousPins = queryClient.getQueryData<ProfilePin[]>(['profile-pins', user?.id]);
      
      // Optimistically update
      queryClient.setQueryData<ProfilePin[]>(['profile-pins', user?.id], (old = []) => {
        const isPinned = old.some(pin => pin.profileId === profileId);
        if (isPinned) {
          // Remove pin
          return old.filter(pin => pin.profileId !== profileId);
        } else {
          // Add pin with temporary data (will be replaced by server response)
          return [...old, { 
            id: 'temp-' + Date.now(), 
            profileId, 
            userId: user!.id,
            order: old.length,
            profile: {
              id: profileId,
              name: 'Loading...',
            }
          }];
        }
      });
      
      return { previousPins };
    },
    onError: (err, profileId, context) => {
      // Rollback on error
      if (context?.previousPins) {
        queryClient.setQueryData(['profile-pins', user?.id], context.previousPins);
      }
    },
    onSettled: () => {
      // Refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['profile-pins', user?.id] });
    },
  });
}

// Reorder pinned profiles
export function useReorderProfilePins() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (pinnedProfileIds: string[]) => {
      const response = await fetch('/api/profiles/pins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedProfileIds }),
      });
      if (!response.ok) throw new Error('Failed to reorder pins');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-pins', user?.id] });
    },
  });
}
