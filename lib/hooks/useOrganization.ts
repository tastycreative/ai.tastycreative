'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  subscriptionPlanId?: string;
  subscriptionStatus: string;
  role: string; // User's role in this organization
}

export interface OrganizationContext {
  currentOrganization: Organization | null;
  organizations: Organization[];
  loading: boolean;
  switchOrganization: (organizationId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useOrganization(): OrganizationContext {
  const { user } = useUser();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    console.log('🔄 Fetching organizations...', { userId: user?.id });

    if (!user) {
      console.log('⚠️ No user, clearing organizations');
      setCurrentOrganization(null);
      setOrganizations([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/organizations/list');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Organizations API response:', data);
        setOrganizations(data.organizations || []);
        setCurrentOrganization(data.currentOrganization || null);
      } else {
        console.error('❌ Organizations API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
    } finally {
      setLoading(false);
      console.log('✅ Organizations loading complete');
    }
  };

  const switchOrganization = async (organizationId: string) => {
    try {
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentOrganization(data.organization);
        // Reload the page to refresh all organization-scoped data
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  useEffect(() => {
    fetchOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only re-fetch when user ID changes, not the whole user object

  return {
    currentOrganization,
    organizations,
    loading,
    switchOrganization,
    refetch: fetchOrganizations,
  };
}
