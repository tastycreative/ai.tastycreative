'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

interface VaultFavoriteItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Url: string;
  createdAt: string;
  folderId: string;
  profileId: string;
  metadata?: Record<string, any> | null;
  folder?: {
    id: string;
    name: string;
  };
  profile?: {
    id: string;
    name: string;
    instagramUsername?: string | null;
  };
}

const STORAGE_KEY = 'vault-favorites';

function getFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

async function fetchFavoriteItems(itemIds: string[]): Promise<VaultFavoriteItem[]> {
  if (itemIds.length === 0) return [];

  const response = await fetch('/api/vault/items/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch favorite items');
  }

  return response.json();
}

export function useVaultFavorites(enabled: boolean = true) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Load favorite IDs from localStorage on mount
  useEffect(() => {
    setFavoriteIds(getFavoriteIds());
  }, []);

  // Listen for storage changes (from other tabs or vault component updates)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setFavoriteIds(getFavoriteIds());
      }
    };

    // Also poll periodically to catch same-tab localStorage changes
    const interval = setInterval(() => {
      const current = getFavoriteIds();
      setFavoriteIds((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(current)) {
          return current;
        }
        return prev;
      });
    }, 2000);

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const refresh = useCallback(() => {
    setFavoriteIds(getFavoriteIds());
  }, []);

  const query = useQuery({
    queryKey: ['vault-favorites', favoriteIds],
    queryFn: () => fetchFavoriteItems(favoriteIds),
    enabled: enabled && favoriteIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data ?? [],
    favoriteIds,
    refresh,
    hasFavorites: favoriteIds.length > 0,
  };
}
