'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface SpaceMemberUser {
  id: string;
  clerkId: string;
  name: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface SpaceMember {
  id: string;
  userId: string;
  role: MemberRole;
  user: SpaceMemberUser;
}

/* ------------------------------------------------------------------ */
/*  Query keys                                                         */
/* ------------------------------------------------------------------ */

export const spaceMemberKeys = {
  all: ['space-members'] as const,
  list: (spaceId: string) => [...spaceMemberKeys.all, spaceId] as const,
};

/* ------------------------------------------------------------------ */
/*  Fetch functions                                                    */
/* ------------------------------------------------------------------ */

async function fetchMembers(spaceId: string): Promise<SpaceMember[]> {
  const res = await fetch(`/api/spaces/${spaceId}/members`);
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json();
}

async function updateMemberRole(
  spaceId: string,
  memberId: string,
  role: MemberRole,
): Promise<SpaceMember> {
  const res = await fetch(`/api/spaces/${spaceId}/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to update role');
  }
  return res.json();
}

async function removeMember(spaceId: string, memberId: string): Promise<void> {
  const res = await fetch(`/api/spaces/${spaceId}/members/${memberId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to remove member');
  }
}

async function addMembersBulk(
  spaceId: string,
  userIds: string[],
  role: MemberRole,
): Promise<{ added: number }> {
  const res = await fetch(`/api/spaces/${spaceId}/members/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to add members');
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useSpaceMembers(spaceId: string | undefined) {
  return useQuery({
    queryKey: spaceMemberKeys.list(spaceId!),
    queryFn: () => fetchMembers(spaceId!),
    enabled: !!spaceId,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateMemberRole(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      updateMemberRole(spaceId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceMemberKeys.list(spaceId) });
    },
  });
}

export function useRemoveMember(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(spaceId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceMemberKeys.list(spaceId) });
    },
  });
}

export function useAddSpaceMembers(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, role }: { userIds: string[]; role: MemberRole }) =>
      addMembersBulk(spaceId, userIds, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: spaceMemberKeys.list(spaceId) });
    },
  });
}
