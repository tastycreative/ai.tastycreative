'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── Types ──────────────────────────────────────────────────────────

export interface Caption {
  id: string;
  caption: string;
  captionCategory: string;
  captionTypes: string;
  captionBanks: string;
  profileId: string;
  usageCount: number;
  isFavorite: boolean;
  lastUsedAt: string | null;
  cooldownDays: number;
  notes: string | null;
  tags: string | null;
  createdAt: string;
  profileName?: string;
  isSharedProfile?: boolean;
  source: 'gallery' | 'imported';
  gifUrl?: string | null;
}

export interface CaptionFilters {
  contentTypes: string[];
  postOrigins: string[];
  platforms: string[];
}

export interface CaptionsData {
  captions: Caption[];
  filters: CaptionFilters;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  duplicatesSkipped: number;
  totalProcessed: number;
  sheetStats: Record<string, number>;
  message?: string;
}

export interface DuplicateGroup {
  original: Caption;
  duplicates: Caption[];
  similarity: number;
}

export interface CaptionStats {
  totalCaptions: number;
  favoriteCaptions: number;
  totalUsage: number;
  mostUsed: Array<{ id: string; caption: string; usageCount: number; captionCategory: string }>;
  recentlyUsed: Array<{ id: string; caption: string; lastUsedAt: string; usageCount: number; captionCategory: string }>;
  captionsInCooldown: Array<{ id: string; caption: string; lastUsedAt: string; cooldownDays: number; cooldownEndsAt: string; captionCategory: string }>;
  categoryStats: Array<{ category: string; count: number; totalUsage: number }>;
}

interface UseCaptionsParams {
  profileId: string;
  sortBy: 'createdAt' | 'postedAt' | 'caption' | 'revenue';
  sortOrder: 'asc' | 'desc';
}

// ── Fetch functions ────────────────────────────────────────────────

async function fetchCaptions(params: UseCaptionsParams): Promise<CaptionsData> {
  const { profileId, sortBy, sortOrder } = params;

  const galleryParams = new URLSearchParams({
    profileId,
    sortBy,
    sortOrder,
    pageSize: '500',
  });

  const importedParams = new URLSearchParams({
    sourceType: 'spreadsheet_import',
    sortBy: sortBy === 'postedAt' ? 'createdAt' : sortBy,
    sortOrder,
  });

  const [galleryRes, importedRes] = await Promise.all([
    fetch(`/api/gallery/captions?${galleryParams}`),
    fetch(`/api/captions?${importedParams}`),
  ]);

  let galleryCaptions: Caption[] = [];
  let importedCaptions: Caption[] = [];
  let filters: CaptionFilters = { contentTypes: [], postOrigins: [], platforms: [] };

  if (galleryRes.ok) {
    const data = await galleryRes.json();
    galleryCaptions = (data.captions || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      caption: (item.captionUsed as string) || '',
      captionCategory: (item.contentType as string) || 'Uncategorized',
      captionTypes: (item.postOrigin as string) || 'Unknown',
      captionBanks: (item.platform as string) || 'Unknown',
      profileId: (item.profileId as string) || '',
      usageCount: (item.salesCount as number) || 0,
      isFavorite: false,
      lastUsedAt: (item.postedAt as string) || null,
      cooldownDays: 0,
      notes: (item.title as string) || null,
      tags: Array.isArray(item.tags) ? (item.tags as string[]).join(', ') : (item.tags as string) || null,
      createdAt: item.createdAt as string,
      profileName: (item.profile as { name?: string })?.name || undefined,
      isSharedProfile: false,
      source: 'gallery' as const,
      gifUrl: ((item.boardMetadata as Record<string, unknown>)?.gifUrl as string) || (/\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test((item.previewUrl as string) || '') ? (item.previewUrl as string) : null),
    }));
    if (data.filters) {
      filters = {
        contentTypes: data.filters.contentTypes || [],
        postOrigins: data.filters.postOrigins || [],
        platforms: data.filters.platforms || [],
      };
    }
  }

  if (importedRes.ok) {
    const rawData = await importedRes.json();
    const items = Array.isArray(rawData) ? rawData : (rawData.captions || []);
    importedCaptions = items.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      caption: (item.caption as string) || '',
      captionCategory: (item.captionCategory as string) || 'Uncategorized',
      captionTypes: (item.captionTypes as string) || 'Unknown',
      captionBanks: (item.captionBanks as string) || 'Unknown',
      profileId: (item.profileId as string) || '',
      usageCount: (item.usageCount as number) || 0,
      isFavorite: (item.isFavorite as boolean) || false,
      lastUsedAt: (item.lastUsedAt as string) || null,
      cooldownDays: (item.cooldownDays as number) || 0,
      notes: (item.notes as string) || null,
      tags: (item.tags as string) || null,
      createdAt: item.createdAt as string,
      profileName: (item.profileName as string) || undefined,
      isSharedProfile: (item.isSharedProfile as boolean) || false,
      source: 'imported' as const,
      gifUrl: (item.gifUrl as string) || null,
    }));
  }

  return {
    captions: [...galleryCaptions, ...importedCaptions],
    filters,
  };
}

// ── Hooks ──────────────────────────────────────────────────────────

export function useCaptions({ profileId, sortBy, sortOrder }: UseCaptionsParams) {
  return useQuery({
    queryKey: ['captions-bank', profileId, sortBy, sortOrder],
    queryFn: () => fetchCaptions({ profileId, sortBy, sortOrder }),
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/captions?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete caption');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['captions-bank'] });
    },
  });
}

export function useImportCaptions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (progress: number) => void;
    }): Promise<ImportResult> => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/captions/import-xlsx');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress?.(Math.round((e.loaded / e.total) * 50));
          }
        };

        let progressTick: ReturnType<typeof setInterval> | null = null;

        xhr.upload.onload = () => {
          onProgress?.(60);
          let current = 60;
          progressTick = setInterval(() => {
            if (current >= 90) {
              if (progressTick) clearInterval(progressTick);
              return;
            }
            current += 5;
            onProgress?.(current);
          }, 500);
        };

        xhr.onload = () => {
          if (progressTick) clearInterval(progressTick);
          onProgress?.(100);
          try {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(result);
            } else {
              reject(new Error(result.error || 'Import failed'));
            }
          } catch {
            reject(new Error('Failed to parse response'));
          }
        };

        xhr.onerror = () => {
          if (progressTick) clearInterval(progressTick);
          reject(new Error('Failed to import file'));
        };

        xhr.send(formData);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['captions-bank'] });
    },
  });
}
