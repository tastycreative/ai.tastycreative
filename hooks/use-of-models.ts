'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import type {
  OfModel,
  OfModelDetails,
  OfModelAsset,
  OfModelStats,
  OfModelFilters,
  OfModelPricingCategory,
  CreateOfModelInput,
  CreateOfModelDetailsInput,
  CreateOfModelAssetInput,
  CreateOfModelPricingCategoryInput,
  CreateOfModelPricingItemInput,
} from '@/types/of-model';

// ============================================
// Fetcher Functions
// ============================================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'An error occurred');
  }
  const json = await res.json();
  return json.data;
};

const mutationFetcher = async <T>(
  url: string,
  { arg }: { arg: { method: string; body?: unknown } }
): Promise<T> => {
  const res = await fetch(url, {
    method: arg.method,
    headers: { 'Content-Type': 'application/json' },
    body: arg.body ? JSON.stringify(arg.body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'An error occurred');
  }
  const json = await res.json();
  return json.data;
};

// ============================================
// Query Hooks - List & Stats
// ============================================

/**
 * Fetch all OF Models with optional filters
 */
export function useOfModels(filters?: OfModelFilters) {
  const queryParams = new URLSearchParams();

  if (filters?.search) {
    queryParams.set('search', filters.search);
  }
  if (filters?.status && filters.status !== 'all') {
    queryParams.set('status', filters.status);
  }
  if (filters?.sort) {
    queryParams.set('sort', filters.sort);
  }
  if (filters?.sortDirection) {
    queryParams.set('sortDirection', filters.sortDirection);
  }

  const queryString = queryParams.toString();
  const url = `/api/of-models${queryString ? `?${queryString}` : ''}`;

  return useSWR<OfModel[]>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
}

/**
 * Fetch OF Models stats (counts by status)
 */
export function useOfModelStats() {
  return useSWR<OfModelStats>('/api/of-models/stats', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });
}

// ============================================
// Query Hooks - Single Model
// ============================================

/**
 * Fetch a single OF Model by ID or slug
 */
export function useOfModel(idOrSlug: string | null) {
  return useSWR<OfModel>(
    idOrSlug ? `/api/of-models/${idOrSlug}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch OF Model details
 */
export function useOfModelDetails(modelId: string | null) {
  return useSWR<OfModelDetails>(
    modelId ? `/api/of-models/${modelId}/details` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch OF Model assets
 */
export function useOfModelAssets(modelId: string | null) {
  return useSWR<OfModelAsset[]>(
    modelId ? `/api/of-models/${modelId}/assets` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch OF Model pricing categories (with items)
 */
export function useOfModelPricing(modelId: string | null) {
  return useSWR<OfModelPricingCategory[]>(
    modelId ? `/api/of-models/${modelId}/pricing` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
}

// ============================================
// Mutation Hooks - Model CRUD
// ============================================

/**
 * Create a new OF Model
 */
export function useCreateOfModel() {
  return useSWRMutation<OfModel, Error, string, CreateOfModelInput>(
    '/api/of-models',
    async (url, { arg }) => {
      return mutationFetcher<OfModel>(url, {
        arg: { method: 'POST', body: arg },
      });
    }
  );
}

/**
 * Update an OF Model
 */
export function useUpdateOfModel(modelId: string) {
  const key = `/api/of-models/${modelId}`;
  return useSWRMutation<OfModel, Error, string, Partial<CreateOfModelInput>>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<OfModel>(url, {
        arg: { method: 'PATCH', body: arg },
      });
    }
  );
}

/**
 * Delete an OF Model
 */
export function useDeleteOfModel(modelId: string) {
  const key = `/api/of-models/${modelId}`;
  return useSWRMutation<void, Error, string>(
    key,
    async (url) => {
      return mutationFetcher<void>(url, {
        arg: { method: 'DELETE' },
      });
    }
  );
}

// ============================================
// Mutation Hooks - Details
// ============================================

/**
 * Update OF Model details
 */
export function useUpdateOfModelDetails(modelId: string) {
  const key = `/api/of-models/${modelId}/details`;
  return useSWRMutation<OfModelDetails, Error, string, CreateOfModelDetailsInput>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<OfModelDetails>(url, {
        arg: { method: 'PATCH', body: arg },
      });
    }
  );
}

// ============================================
// Mutation Hooks - Assets
// ============================================

/**
 * Add an asset to an OF Model
 */
export function useAddOfModelAsset(modelId: string) {
  const key = `/api/of-models/${modelId}/assets`;
  return useSWRMutation<OfModelAsset, Error, string, CreateOfModelAssetInput>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<OfModelAsset>(url, {
        arg: { method: 'POST', body: arg },
      });
    }
  );
}

/**
 * Delete an asset from an OF Model
 */
export function useDeleteOfModelAsset(modelId: string) {
  const key = `/api/of-models/${modelId}/assets`;
  return useSWRMutation<void, Error, string, { assetId: string }>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<void>(`${url}?assetId=${arg.assetId}`, {
        arg: { method: 'DELETE' },
      });
    }
  );
}

// ============================================
// Mutation Hooks - Pricing Categories
// ============================================

/**
 * Create a pricing category
 */
export function useCreatePricingCategory(modelId: string) {
  const key = `/api/of-models/${modelId}/pricing`;
  return useSWRMutation<OfModelPricingCategory, Error, string, CreateOfModelPricingCategoryInput>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<OfModelPricingCategory>(url, {
        arg: { method: 'POST', body: arg },
      });
    }
  );
}

/**
 * Update a pricing category
 */
export function useUpdatePricingCategory(modelId: string, categoryId: string) {
  const key = `/api/of-models/${modelId}/pricing/${categoryId}`;
  return useSWRMutation<OfModelPricingCategory, Error, string, Partial<CreateOfModelPricingCategoryInput>>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<OfModelPricingCategory>(url, {
        arg: { method: 'PATCH', body: arg },
      });
    }
  );
}

/**
 * Delete a pricing category
 */
export function useDeletePricingCategory(modelId: string, categoryId: string) {
  const key = `/api/of-models/${modelId}/pricing/${categoryId}`;
  return useSWRMutation<void, Error, string>(
    key,
    async (url) => {
      return mutationFetcher<void>(url, {
        arg: { method: 'DELETE' },
      });
    }
  );
}

// ============================================
// Mutation Hooks - Pricing Items
// ============================================

/**
 * Create a pricing item
 */
export function useCreatePricingItem(modelId: string, categoryId: string) {
  const key = `/api/of-models/${modelId}/pricing/${categoryId}/items`;
  return useSWRMutation<unknown, Error, string, CreateOfModelPricingItemInput>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<unknown>(url, {
        arg: { method: 'POST', body: arg },
      });
    }
  );
}

/**
 * Update a pricing item
 */
export function useUpdatePricingItem(modelId: string, categoryId: string) {
  const key = `/api/of-models/${modelId}/pricing/${categoryId}/items`;
  return useSWRMutation<unknown, Error, string, { itemId: string } & Partial<CreateOfModelPricingItemInput>>(
    key,
    async (url, { arg }) => {
      const { itemId, ...body } = arg;
      return mutationFetcher<unknown>(url, {
        arg: { method: 'PATCH', body: { itemId, ...body } },
      });
    }
  );
}

/**
 * Delete a pricing item
 */
export function useDeletePricingItem(modelId: string, categoryId: string) {
  const key = `/api/of-models/${modelId}/pricing/${categoryId}/items`;
  return useSWRMutation<void, Error, string, { itemId: string }>(
    key,
    async (url, { arg }) => {
      return mutationFetcher<void>(`${url}?itemId=${arg.itemId}`, {
        arg: { method: 'DELETE' },
      });
    }
  );
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Invalidate and refetch OF Models list
 */
export function useInvalidateOfModels() {
  const { mutate } = useSWR('/api/of-models', null, { revalidateOnMount: false });
  return () => mutate();
}
