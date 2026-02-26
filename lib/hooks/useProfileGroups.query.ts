'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface ProfileGroup {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  isCollapsed: boolean;
  memberCount: number;
  members: {
    id: string;
    profileId: string;
    order: number;
    profile: {
      id: string;
      name: string;
      profileImageUrl?: string;
      instagramUsername?: string;
    };
  }[];
}

// Fetch all groups with members
async function fetchProfileGroups(): Promise<ProfileGroup[]> {
  const response = await fetch('/api/profile-groups');
  if (!response.ok) throw new Error('Failed to fetch groups');
  return response.json();
}

export function useProfileGroups() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: ['profile-groups', user?.id],
    queryFn: fetchProfileGroups,
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

// Create group
export function useCreateProfileGroup() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (data: { name: string; color?: string; icon?: string }) => {
      const response = await fetch('/api/profile-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-groups', user?.id] });
    },
  });
}

// Update group
export function useUpdateProfileGroup() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async ({ groupId, data }: { groupId: string; data: { name?: string; color?: string; icon?: string; order?: number; isCollapsed?: boolean } }) => {
      const response = await fetch(`/api/profile-groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-groups', user?.id] });
    },
  });
}

// Add profiles to group
export function useAddProfilesToGroup() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async ({ groupId, profileIds }: { groupId: string; profileIds: string[] }) => {
      const response = await fetch(`/api/profile-groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds }),
      });
      if (!response.ok) throw new Error('Failed to add profiles');
      return response.json();
    },
    onMutate: async ({ groupId, profileIds }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['profile-groups', user?.id] });
      
      // Snapshot previous value
      const previousGroups = queryClient.getQueryData<ProfileGroup[]>(['profile-groups', user?.id]);
      
      // Optimistically add profiles to group
      queryClient.setQueryData<ProfileGroup[]>(['profile-groups', user?.id], (old = []) => {
        return old.map(group => {
          if (group.id === groupId) {
            const newMembers = profileIds.map((profileId, index) => ({
              id: 'temp-' + Date.now() + '-' + index,
              groupId,
              profileId,
              order: group.members.length + index,
              profile: {
                id: profileId,
                name: 'Loading...',
              },
            }));
            return { 
              ...group, 
              members: [...group.members, ...newMembers],
              memberCount: group.memberCount + profileIds.length,
            };
          }
          return group;
        });
      });
      
      return { previousGroups };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousGroups) {
        queryClient.setQueryData(['profile-groups', user?.id], context.previousGroups);
      }
    },
    onSettled: () => {
      // Refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['profile-groups', user?.id] });
    },
  });
}

// Remove profile from group
export function useRemoveProfileFromGroup() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async ({ groupId, profileId }: { groupId: string; profileId: string }) => {
      const response = await fetch(`/api/profile-groups/${groupId}/members?profileId=${profileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove profile');
      return response.json();
    },
    onMutate: async ({ groupId, profileId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['profile-groups', user?.id] });
      
      // Snapshot previous value
      const previousGroups = queryClient.getQueryData<ProfileGroup[]>(['profile-groups', user?.id]);
      
      // Optimistically remove profile from group
      queryClient.setQueryData<ProfileGroup[]>(['profile-groups', user?.id], (old = []) => {
        return old.map(group => {
          if (group.id === groupId) {
            return {
              ...group,
              members: group.members.filter(member => member.profileId !== profileId),
              memberCount: Math.max(0, group.memberCount - 1),
            };
          }
          return group;
        });
      });
      
      return { previousGroups };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousGroups) {
        queryClient.setQueryData(['profile-groups', user?.id], context.previousGroups);
      }
    },
    onSettled: () => {
      // Refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['profile-groups', user?.id] });
    },
  });
}

// Delete group
export function useDeleteProfileGroup() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/api/profile-groups/${groupId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-groups', user?.id] });
    },
  });
}
