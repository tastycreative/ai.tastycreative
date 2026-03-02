'use client';

import { useQuery } from '@tanstack/react-query';

export interface OrgMember {
  id: string;
  clerkId: string;
  name: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

async function fetchOrgMembers(): Promise<OrgMember[]> {
  const res = await fetch('/api/organization/members');
  if (!res.ok) throw new Error('Failed to fetch organization members');
  return res.json();
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ['organization-members'],
    queryFn: fetchOrgMembers,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}
