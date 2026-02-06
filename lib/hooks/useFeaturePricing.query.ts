'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

export interface FeaturePricing {
  id: string;
  featureKey: string;
  featureName: string;
  category: string;
  credits: number;
  description: string | null;
  isActive: boolean;
}

async function fetchFeaturePricing(urlPath: string): Promise<FeaturePricing | null> {
  const response = await fetch(`/api/features/pricing?path=${encodeURIComponent(urlPath)}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null; // Feature pricing not found
    }
    throw new Error('Failed to fetch feature pricing');
  }
  return response.json();
}

/**
 * Extracts the last segment from URL path
 * Example: /tenant/workspace/generate-content/seedream-image-to-image -> seedream-image-to-image
 */
function getUrlSegmentFromPath(pathname: string | null): string | null {
  if (!pathname) return null;

  // Extract the last segment of the path (keep kebab-case as-is)
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  return lastSegment;
}

export function useFeaturePricing(customPath?: string) {
  const { user } = useUser();
  const pathname = usePathname();

  // Use custom path if provided, otherwise extract from current URL
  const urlSegment = customPath || getUrlSegmentFromPath(pathname);

  const query = useQuery({
    queryKey: ['feature-pricing', urlSegment],
    queryFn: () => fetchFeaturePricing(urlSegment!),
    enabled: !!user && !!urlSegment,
    staleTime: 1000 * 60 * 5, // 5 minutes - pricing doesn't change often
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    featurePricing: query.data,
    credits: query.data?.credits ?? 0,
    featureName: query.data?.featureName ?? '',
    featureKey: query.data?.featureKey ?? '',
  };
}
