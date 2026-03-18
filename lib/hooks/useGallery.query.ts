'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { GalleryItemWithModel } from '@/types/gallery';
import type { GalleryFilterValues } from '@/components/gallery/GalleryFilters';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

interface GalleryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface GalleryResponse {
  items: GalleryItemWithModel[];
  pagination: GalleryPagination;
}

interface ModelStats {
  model: {
    id: string;
    name: string;
    displayName: string;
    profileImageUrl: string | null;
  } | null;
  count: number;
  revenue: number;
  salesCount: number;
}

interface GalleryStats {
  totals: {
    itemCount: number;
    totalRevenue: number;
    totalSales: number;
    totalViews: number;
    averageRevenue: number;
    averageConversionRate: number;
  };
  byContentType: {
    contentType: string;
    count: number;
    revenue: number;
    salesCount: number;
  }[];
  byPlatform: {
    platform: string;
    count: number;
    revenue: number;
    salesCount: number;
  }[];
  byModel?: ModelStats[];
}

interface GalleryModel {
  id: string;
  name: string;
  displayName: string;
  profileImageUrl: string | null;
}

/* ────────────────────────────────────────────────────────────
   Fetch functions
   ──────────────────────────────────────────────────────────── */

const ITEMS_PER_PAGE = 24;

async function fetchGalleryItems(
  filters: GalleryFilterValues,
  page: number,
): Promise<GalleryResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(ITEMS_PER_PAGE));

  if (filters.search) params.set('search', filters.search);
  if (filters.contentType !== 'all') params.set('contentType', filters.contentType);
  if (filters.platform !== 'all') params.set('platform', filters.platform);
  if (filters.modelId) params.set('profileId', filters.modelId);
  params.set('isArchived', String(filters.isArchived));
  params.set('sortField', filters.sortField);
  params.set('sortOrder', filters.sortOrder);

  const res = await fetch(`/api/gallery?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load gallery');
  const json = await res.json();
  return json.data as GalleryResponse;
}

async function fetchGalleryStats(): Promise<GalleryStats> {
  const res = await fetch('/api/gallery/stats');
  if (!res.ok) throw new Error('Failed to load gallery stats');
  const json = await res.json();
  return json.data as GalleryStats;
}

async function fetchModels(): Promise<GalleryModel[]> {
  const res = await fetch('/api/instagram-profiles');
  if (!res.ok) throw new Error('Failed to load profiles');
  const result = await res.json();
  const profiles = Array.isArray(result) ? result : [];
  return profiles.map((p: { id: string; name: string; profileImageUrl: string | null }) => ({
    id: p.id,
    name: p.name,
    displayName: p.name,
    profileImageUrl: p.profileImageUrl ?? null,
  }));
}

async function deleteGalleryItem(id: string): Promise<void> {
  const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete item');
}

/* ────────────────────────────────────────────────────────────
   Hooks
   ──────────────────────────────────────────────────────────── */

/**
 * Paginated gallery items with filters.
 * Uses `keepPreviousData` so the old page stays visible while the next loads.
 */
export function useGalleryItems(filters: GalleryFilterValues, page: number) {
  return useQuery({
    queryKey: ['gallery', 'items', filters, page],
    queryFn: () => fetchGalleryItems(filters, page),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

/** Gallery-wide stats (independent of filters). */
export function useGalleryStats() {
  return useQuery({
    queryKey: ['gallery', 'stats'],
    queryFn: fetchGalleryStats,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

/** Instagram profiles used as model filter options. */
export function useGalleryModels() {
  return useQuery({
    queryKey: ['gallery', 'models'],
    queryFn: fetchModels,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
}

/** Delete a gallery item and invalidate the list + stats caches. */
export function useDeleteGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGalleryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['gallery', 'stats'] });
    },
  });
}

export { ITEMS_PER_PAGE };
export type { GalleryStats, GalleryModel };
