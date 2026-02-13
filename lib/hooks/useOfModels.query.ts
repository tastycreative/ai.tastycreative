'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface OfModel {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED';
  profileImageUrl: string | null;
  bio: string | null;
  personalityType: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  launchDate: string | null;
  guaranteedAmount?: number | null;
  percentageTaken?: number | null;
  chattingManagers?: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    assets: number;
    pricingCategories: number;
  };
}

interface UseOfModelsParams {
  search?: string;
  status?: string;
  limit?: number;
}

interface OfModelsResponse {
  data: OfModel[];
  total?: number;
}

async function fetchOfModels(params: UseOfModelsParams): Promise<OfModelsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', (params.limit || 500).toString());

  if (params.search) {
    searchParams.set('search', params.search);
  }

  if (params.status && params.status !== 'ALL') {
    searchParams.set('status', params.status);
  }

  const response = await fetch(`/api/of-models?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch OF models');
  }

  return response.json();
}

export function useOfModels(params: UseOfModelsParams = {}) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['of-models', params],
    queryFn: () => fetchOfModels(params),
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

// Mutations
interface CreateOfModelData {
  name: string;
  displayName: string;
  slug: string;
  bio?: string | null;
  status: string;
}

async function createOfModel(data: CreateOfModelData): Promise<OfModel> {
  const response = await fetch('/api/of-models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create model');
  }

  return response.json();
}

export function useCreateOfModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOfModel,
    onSuccess: () => {
      // Invalidate and refetch models list
      queryClient.invalidateQueries({ queryKey: ['of-models'] });
      queryClient.invalidateQueries({ queryKey: ['of-model-stats'] });
    },
  });
}

interface UpdateOfModelData {
  id: string;
  name?: string;
  displayName?: string;
  slug?: string;
  bio?: string | null;
  status?: string;
}

async function updateOfModel({ id, ...data }: UpdateOfModelData): Promise<OfModel> {
  const response = await fetch(`/api/of-models/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update model');
  }

  return response.json();
}

export function useUpdateOfModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOfModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['of-models'] });
      queryClient.invalidateQueries({ queryKey: ['of-model-stats'] });
    },
  });
}

async function deleteOfModel(id: string): Promise<void> {
  const response = await fetch(`/api/of-models/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete model');
  }
}

export function useDeleteOfModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOfModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['of-models'] });
      queryClient.invalidateQueries({ queryKey: ['of-model-stats'] });
    },
  });
}
