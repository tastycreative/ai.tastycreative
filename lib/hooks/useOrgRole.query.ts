'use client';

import { useOrganization } from '@/lib/hooks/useOrganization.query';
import { canCreateQueue, canManageQueue, canViewQueue, isCreatorRole, type OrgRole } from '@/lib/rbac';

/**
 * Returns the current user's TeamRole in their active organization,
 * plus convenience permission helpers derived from RBAC rules.
 */
export function useOrgRole() {
  const { currentOrganization, loading } = useOrganization();

  const role = (currentOrganization?.role ?? null) as OrgRole | null;

  return {
    role,
    loading,
    canCreateQueue: canCreateQueue(role),
    canManageQueue: canManageQueue(role),
    canViewQueue: canViewQueue(role),
    isCreator: isCreatorRole(role),
  };
}
