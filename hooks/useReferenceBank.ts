"use client";

import { useState, useEffect, useCallback } from "react";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";

export interface ReferenceItem {
  id: string;
  clerkId: string;
  profileId: string;
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
  createdAt: string;
  updatedAt: string;
}

interface UseReferenceBankOptions {
  filterType?: "all" | "image" | "video";
  autoFetch?: boolean;
  profileId?: string;
}

export function useReferenceBank(options: UseReferenceBankOptions = {}) {
  const { filterType = "all", autoFetch = true, profileId: propProfileId } = options;
  const { profileId: selectedProfileId } = useInstagramProfile();
  
  // Use provided profileId or fall back to the global selected profile
  const profileId = propProfileId || selectedProfileId;
  
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!profileId) {
      setItems([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/reference-bank?profileId=${profileId}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch reference items");
      }
      
      const data = await response.json();
      let fetchedItems = data.items || [];
      
      // Apply filter
      if (filterType !== "all") {
        fetchedItems = fetchedItems.filter(
          (item: ReferenceItem) => item.fileType === filterType
        );
      }
      
      setItems(fetchedItems);
    } catch (err) {
      console.error("Error fetching reference items:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [profileId, filterType]);

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
