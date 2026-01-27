"use client";

import { useState, useEffect, useCallback } from "react";

export interface ReferenceItem {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  fileType: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  awsS3Key: string;
  awsS3Url: string;
  thumbnailUrl: string | null;
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
  isFavorite: boolean;
  folderId: string | null;
  folder?: {
    id: string;
    name: string;
    color: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceFolder {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

interface UseReferenceBankOptions {
  filterType?: "all" | "image" | "video";
  folderId?: string | null;
  favoritesOnly?: boolean;
  autoFetch?: boolean;
}

export function useReferenceBank(options: UseReferenceBankOptions = {}) {
  const { 
    filterType = "all", 
    folderId,
    favoritesOnly = false,
    autoFetch = true 
  } = options;
  
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [folders, setFolders] = useState<ReferenceFolder[]>([]);
  const [stats, setStats] = useState({ total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      
      if (folderId === "root") {
        params.set("folderId", "root");
      } else if (folderId) {
        params.set("folderId", folderId);
      }
      
      if (favoritesOnly) {
        params.set("favorites", "true");
      }
      
      if (filterType !== "all") {
        params.set("fileType", filterType);
      }
      
      const response = await fetch(`/api/reference-bank?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch reference items");
      }
      
      const data = await response.json();
      setItems(data.items || []);
      setFolders(data.folders || []);
      setStats(data.stats || { total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 });
    } catch (err) {
      console.error("Error fetching reference items:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [folderId, favoritesOnly, filterType]);

  useEffect(() => {
    if (autoFetch) {
      fetchItems();
    }
  }, [fetchItems, autoFetch]);

  // Track usage when a reference is used
  const trackUsage = useCallback(async (itemId: string) => {
    try {
      await fetch(`/api/reference-bank/${itemId}/use`, {
        method: "POST",
      });
      
      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                usageCount: item.usageCount + 1,
                lastUsedAt: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (err) {
      console.error("Error tracking usage:", err);
    }
  }, []);

  // Get most recently used items
  const getRecentItems = useCallback(
    (limit: number = 5) => {
      return [...items]
        .filter((item) => item.lastUsedAt)
        .sort(
          (a, b) =>
            new Date(b.lastUsedAt!).getTime() -
            new Date(a.lastUsedAt!).getTime()
        )
        .slice(0, limit);
    },
    [items]
  );

  // Get most used items
  const getMostUsedItems = useCallback(
    (limit: number = 5) => {
      return [...items]
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
    },
    [items]
  );

  return {
    items,
    folders,
    stats,
    isLoading,
    error,
    fetchItems,
    trackUsage,
    getRecentItems,
    getMostUsedItems,
    hasItems: items.length > 0,
    imageCount: items.filter((i) => i.fileType === "image").length,
    videoCount: items.filter((i) => i.fileType === "video").length,
  };
}
