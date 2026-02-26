'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface ModelProfile {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
  status: string;
  type: string;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  user?: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    imageUrl: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  linkedLoRAs?: Array<{
    id: string;
    displayName: string;
    thumbnailUrl: string | null;
    fileName: string;
  }>;
  assignments?: Array<{
    id: string;
    assignedToClerkId: string;
    assignedAt: string;
    assignedBy?: string | null;
  }>;
  _count: {
    posts: number;
    feedPosts: number;
    captions?: number;
  };
}

export interface Creator {
  id: string;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
  organizations: Array<{ id: string; name: string; slug: string }>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  _count: {
    members: number;
    profiles: number;
  };
}

export interface ModelsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ModelsResponse {
  success: boolean;
  data: {
    profiles: ModelProfile[];
    pagination: ModelsPagination;
  };
  error?: string;
}

export interface ModelsFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  assignedTo?: string;
  includeRelations?: boolean;
}

// Query keys factory for better cache management
export const adminModelsKeys = {
  all: ['admin-models'] as const,
  lists: () => [...adminModelsKeys.all, 'list'] as const,
  list: (filters: ModelsFilters) => [...adminModelsKeys.lists(), filters] as const,
  creators: () => [...adminModelsKeys.all, 'creators'] as const,
  organizations: () => [...adminModelsKeys.all, 'organizations'] as const,
};

// Fetch models with filters
async function fetchModels(filters: ModelsFilters): Promise<ModelsResponse> {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.type) params.append('type', filters.type);
  if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
  if (filters.includeRelations !== undefined) {
    params.append('includeRelations', filters.includeRelations.toString());
  }

  const response = await fetch(`/api/admin/models?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch models');
  }

  return response.json();
}

// Main hook for fetching models with caching
export function useAdminModels(filters: ModelsFilters = {}) {
  return useQuery({
    queryKey: adminModelsKeys.list(filters),
    queryFn: () => fetchModels(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes - data is considered fresh
    gcTime: 1000 * 60 * 10, // 10 minutes - keep in cache
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}

// Prefetch next page for smoother pagination
export function usePrefetchNextPage(filters: ModelsFilters, totalPages: number) {
  const queryClient = useQueryClient();

  const prefetchNextPage = () => {
    const currentPage = filters.page || 1;
    if (currentPage < totalPages) {
      const nextPageFilters = { ...filters, page: currentPage + 1 };
      queryClient.prefetchQuery({
        queryKey: adminModelsKeys.list(nextPageFilters),
        queryFn: () => fetchModels(nextPageFilters),
        staleTime: 1000 * 60 * 2,
      });
    }
  };

  return prefetchNextPage;
}

// Bulk delete mutation
export function useBulkDeleteModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileIds: string[]) => {
      const response = await fetch('/api/admin/models/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete models');
      }
      return data;
    },
    onSuccess: () => {
      // Invalidate all model lists to refetch
      queryClient.invalidateQueries({ queryKey: adminModelsKeys.lists() });
    },
  });
}

// Assign creator mutation
export function useAssignCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileIds, creatorClerkId }: { profileIds: string[]; creatorClerkId: string }) => {
      const response = await fetch('/api/admin/models/assign-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds, creatorClerkId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to assign models');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminModelsKeys.lists() });
    },
  });
}

// Unassign creator mutation
export function useUnassignCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileIds, creatorClerkId }: { profileIds: string[]; creatorClerkId: string }) => {
      const response = await fetch('/api/admin/models/unassign-creator', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds, creatorClerkId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to unassign models');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminModelsKeys.lists() });
    },
  });
}

// Bulk share to organization mutation
export function useBulkShareModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileIds, organizationId }: { profileIds: string[]; organizationId: string }) => {
      const response = await fetch('/api/admin/models/bulk-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds, organizationId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to share models');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminModelsKeys.lists() });
    },
  });
}

// Bulk update mutation (status/type)
export function useBulkUpdateModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileIds, updates }: { profileIds: string[]; updates: { status?: string; type?: string } }) => {
      const response = await fetch('/api/admin/models/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds, updates }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update models');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminModelsKeys.lists() });
    },
  });
}

// Fetch creators
export function useAdminCreators() {
  return useQuery<Creator[]>({
    queryKey: adminModelsKeys.creators(),
    queryFn: async (): Promise<Creator[]> => {
      const response = await fetch('/api/admin/models/creators');
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch creators');
      }
      return data.data.creators;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Fetch organizations
export function useAdminOrganizations() {
  return useQuery<Organization[]>({
    queryKey: adminModelsKeys.organizations(),
    queryFn: async (): Promise<Organization[]> => {
      const response = await fetch('/api/admin/models/organizations');
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch organizations');
      }
      return data.data.organizations;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}
