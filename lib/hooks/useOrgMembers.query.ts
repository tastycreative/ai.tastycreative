'use client';

import { useQuery } from '@tanstack/react-query';

export interface OrgMember {
  id: string;
  clerkId: string;
  name: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface OrgMemberWithRole {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  user: {
    id: string;
    name: string | null;
    email: string;
    imageUrl?: string | null;
  };
}

async function fetchOrgMembers(): Promise<OrgMember[]> {
  const res = await fetch('/api/organization/members');
  if (!res.ok) throw new Error('Failed to fetch organization members');
  return res.json();
}

async function fetchOrgMembersWithRoles(): Promise<OrgMemberWithRole[]> {
  const res = await fetch('/api/organization/current');
  if (!res.ok) throw new Error('Failed to fetch organization');
  const data = await res.json();
  return data.organization?.members || [];
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ['organization-members'],
    queryFn: fetchOrgMembers,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useOrgMembersWithRoles() {
  return useQuery({
    queryKey: ['organization-members-with-roles'],
    queryFn: fetchOrgMembersWithRoles,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}
