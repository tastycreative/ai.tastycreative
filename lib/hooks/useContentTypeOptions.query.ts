'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ContentTypeOption {
  id: string;
  value: string;
  label: string;
  priceType: string | null;
  priceFixed: number | null;
  priceMin: number | null;
  priceMax: number | null;
  description: string | null;
  isActive: boolean;
  order: number;
  category: string;
  isFree: boolean;
  modelId: string | null;
  pageType: string | null;
  model?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
}

interface ContentTypeOptionsResponse {
  success: boolean;
  contentTypeOptions: ContentTypeOption[];
  category: string | null;
  modelId: string | null;
  pageType: string | null;
}

async function fetchContentTypeOptions(params: {
  category?: string;
  modelId?: string;
  modelName?: string;
  pageType?: string;
  fetchAll?: boolean;
  includeInactive?: boolean;
}): Promise<ContentTypeOption[]> {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.append('category', params.category);
  if (params.modelId) searchParams.append('modelId', params.modelId);
  if (params.modelName) searchParams.append('modelName', params.modelName);
  if (params.pageType) searchParams.append('pageType', params.pageType);
  if (params.fetchAll) searchParams.append('fetchAll', 'true');
  if (params.includeInactive) searchParams.append('includeInactive', 'true');

  const response = await fetch(`/api/content-type-options?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch content type options');
  }

  const data: ContentTypeOptionsResponse = await response.json();
  if (!data.success) {
    throw new Error('Failed to fetch content type options');
  }

  return data.contentTypeOptions;
}

export function useContentTypeOptions(params: {
  category?: string;
  modelId?: string;
  modelName?: string;
  pageType?: string;
  fetchAll?: boolean;
  enabled?: boolean;
} = {}) {
  const { enabled = true, ...queryParams } = params;

  return useQuery({
    queryKey: ['contentTypeOptions', queryParams],
    queryFn: () => fetchContentTypeOptions(queryParams),
    enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// Admin: fetch ALL content type options (including inactive)
export function useContentTypeAdmin(params?: {
  category?: string;
  modelId?: string;
  pageType?: string;
}) {
  return useQuery({
    queryKey: ['content-type-options-admin', params],
    queryFn: () =>
      fetchContentTypeOptions({
        ...params,
        fetchAll: true,
        includeInactive: true,
      }),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export interface CreateContentTypePayload {
  value: string;
  label: string;
  category: string;
  pageType?: string;
  priceType?: string;
  priceFixed?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  description?: string;
  order?: number;
  isFree?: boolean;
  modelId?: string | null;
}

export function useCreateContentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateContentTypePayload) => {
      const response = await fetch('/api/content-type-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create content type');
      }
      return data.contentTypeOption as ContentTypeOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-type-options-admin'] });
      queryClient.invalidateQueries({ queryKey: ['contentTypeOptions'] });
    },
  });
}

export interface UpdateContentTypePayload {
  id: string;
  value?: string;
  label?: string;
  pageType?: string;
  priceType?: string;
  priceFixed?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  description?: string;
  reason?: string;
  isFree?: boolean;
  modelId?: string | null;
}

export function useUpdateContentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateContentTypePayload) => {
      const response = await fetch(`/api/content-type-options/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update content type');
      }
      return data.contentTypeOption as ContentTypeOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-type-options-admin'] });
      queryClient.invalidateQueries({ queryKey: ['contentTypeOptions'] });
    },
  });
}

export function useDeleteContentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/content-type-options/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete content type');
      }
      return data.contentTypeOption as ContentTypeOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-type-options-admin'] });
      queryClient.invalidateQueries({ queryKey: ['contentTypeOptions'] });
    },
  });
}

export function formatContentTypePrice(option: ContentTypeOption): string {
  if (option.isFree) return 'Free';
  if (!option.priceType) return '$--.--';

  switch (option.priceType) {
    case 'FIXED':
      return option.priceFixed != null ? `$${option.priceFixed.toFixed(2)}` : '$--.--';
    case 'RANGE':
      return option.priceMin != null && option.priceMax != null
        ? `$${option.priceMin.toFixed(2)}-${option.priceMax.toFixed(2)}`
        : '$--.--';
    case 'MINIMUM':
      return option.priceMin != null ? `$${option.priceMin.toFixed(2)}+` : '$--.--';
    default:
      return '$--.--';
  }
}

export function formatPageType(pageType: string | null): string {
  switch (pageType) {
    case 'ALL_PAGES':
      return '(All Pages)';
    case 'FREE':
      return '(Free)';
    case 'PAID':
      return '(Paid)';
    case 'VIP':
      return '(VIP)';
    default:
      return '(All Pages)';
  }
}
