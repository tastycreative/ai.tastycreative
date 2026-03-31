'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface PricingCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  isGlobal: boolean;
  of_model_pricing_items: PricingItem[];
}

export interface PricingItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isActive: boolean;
  isFree: boolean;
  priceType: 'FIXED' | 'RANGE' | 'MINIMUM';
  priceMin: number | null;
  priceMax: number | null;
}

async function fetchModelPricing(modelId: string): Promise<PricingCategory[]> {
  const res = await fetch(`/api/of-models/${modelId}/pricing?includeGlobal=false`);
  if (!res.ok) throw new Error('Failed to fetch pricing');
  return res.json();
}

export function useOfModelPricing(modelId: string | null) {
  const { user } = useUser();
  return useQuery({
    queryKey: ['of-model-pricing', modelId],
    queryFn: () => fetchModelPricing(modelId!),
    enabled: !!user && !!modelId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
