'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgTeamUser {
  id: string;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  email: string | null;
}

export interface OrgTeamMemberRecord {
  id: string;          // OrgTeamMember.id
  teamId: string;
  teamMemberId: string; // TeamMember.id
  assignedAt: string;
  assignedBy: string | null;
  teamMember: {
    id: string;
    role: string;
    user: OrgTeamUser;
  };
}

export interface OrgTeam {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string | null;
  tabPermissions: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
  members?: OrgTeamMemberRecord[];
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
  color?: string;
  tabPermissions?: Record<string, boolean>;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
  color?: string;
  tabPermissions?: Record<string, boolean>;
}

// ── Query Keys ────────────────────────────────────────────────────────────────

export const orgTeamsKeys = {
  all: (orgId: string) => ['orgTeams', orgId] as const,
  members: (orgId: string, teamId: string) => ['orgTeams', orgId, teamId, 'members'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Fetch all teams for an organization (OWNER/ADMIN/MANAGER). */
export function useOrgTeams(orgId: string | undefined) {
  const { user } = useUser();

  return useQuery({
    queryKey: orgTeamsKeys.all(orgId ?? ''),
    queryFn: async (): Promise<OrgTeam[]> => {
      const res = await fetch(`/api/organizations/${orgId}/teams`);
      if (!res.ok) throw new Error('Failed to fetch teams');
      const data = await res.json();
      return data.teams;
    },
    enabled: !!user && !!orgId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/** Create a new team. */
export function useCreateOrgTeam(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTeamPayload): Promise<OrgTeam> => {
      const res = await fetch(`/api/organizations/${orgId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to create team');
      }
      const data = await res.json();
      return data.team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgTeamsKeys.all(orgId) });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

/** Update a team's name, description, color, or tabPermissions. */
export function useUpdateOrgTeam(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      ...payload
    }: UpdateTeamPayload & { teamId: string }): Promise<OrgTeam> => {
      const res = await fetch(`/api/organizations/${orgId}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to update team');
      }
      const data = await res.json();
      return data.team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgTeamsKeys.all(orgId) });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

/** Delete a team. */
export function useDeleteOrgTeam(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string): Promise<void> => {
      const res = await fetch(`/api/organizations/${orgId}/teams/${teamId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to delete team');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgTeamsKeys.all(orgId) });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

/** Add org members to a team (supports single or batch). */
export function useAddOrgTeamMember(orgId: string, teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamMemberIds: string | string[]): Promise<void> => {
      const ids = Array.isArray(teamMemberIds) ? teamMemberIds : [teamMemberIds];
      const res = await fetch(`/api/organizations/${orgId}/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamMemberIds: ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to add member');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgTeamsKeys.all(orgId) });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

/** Remove a member from a team. */
export function useRemoveOrgTeamMember(orgId: string, teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgTeamMemberId: string): Promise<void> => {
      const res = await fetch(
        `/api/organizations/${orgId}/teams/${teamId}/members/${orgTeamMemberId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to remove member');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgTeamsKeys.all(orgId) });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}
