'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  subscriptionPlanId?: string;
  subscriptionStatus: string;
  role: string;
  availableCredits?: number;
}

interface OrganizationsResponse {
  organizations: Organization[];
  currentOrganization: Organization | null;
}

async function fetchOrganizations(): Promise<OrganizationsResponse> {
  const response = await fetch('/api/organizations/list');
  if (!response.ok) {
    throw new Error('Failed to fetch organizations');
  }
  return response.json();
}

export function useOrganization() {
  const { user } = useUser();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: fetchOrganizations,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const switchOrganization = async (organizationId: string, tenant: string) => {
    try {
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      if (response.ok) {
        // Navigate to the organization's dashboard using tenant
        window.location.href = `/${tenant}/dashboard`;
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  return {
    currentOrganization: data?.currentOrganization ?? null,
    organizations: data?.organizations ?? [],
    loading: isLoading,
    error,
    switchOrganization,
    refetch,
  };
}
