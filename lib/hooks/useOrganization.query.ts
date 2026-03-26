'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

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
  const params = useParams();
  const tenant = params?.tenant as string | undefined;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: fetchOrganizations,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Resolve current organization: prefer the one matching the URL tenant
  const currentOrganization = useMemo(() => {
    if (!data) return null;

    if (tenant && data.organizations.length > 0) {
      const matchingOrg = data.organizations.find((org) => org.slug === tenant);
      if (matchingOrg) return matchingOrg;
    }

    return data.currentOrganization ?? null;
  }, [data, tenant]);

  const switchOrganization = async (organizationId: string, slug: string) => {
    try {
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      if (response.ok) {
        // Navigate to the organization's dashboard using tenant
        window.location.href = `/${slug}/dashboard`;
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  return {
    currentOrganization,
    organizations: data?.organizations ?? [],
    loading: isLoading,
    error,
    switchOrganization,
    refetch,
  };
}
