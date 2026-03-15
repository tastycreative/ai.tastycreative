'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface FlyerAsset {
  id: string;
  organizationId: string;
  profileId: string;
  clerkId: string;
  boardItemId: string | null;
  fileName: string;
  fileType: string;
  url: string;
  s3Key: string;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Queries ----------

async function fetchFlyerAssets(profileId: string): Promise<FlyerAsset[]> {
  const response = await fetch(
    `/api/flyer-assets?profileId=${encodeURIComponent(profileId)}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch flyer assets');
  }
  const data = await response.json();
  return data.assets ?? [];
}

export function useFlyerAssets(profileId: string | null) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['flyer-assets', profileId],
    queryFn: () => fetchFlyerAssets(profileId!),
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// ---------- Mutations ----------

export function useUploadFlyerAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      profileId,
      boardItemId,
    }: {
      file: Blob;
      profileId: string;
      boardItemId?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('profileId', profileId);
      if (boardItemId) {
        formData.append('boardItemId', boardItemId);
      }

      const response = await fetch('/api/flyer-assets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload flyer asset');
      }

      const data = await response.json();
      return data.asset as FlyerAsset;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['flyer-assets', variables.profileId],
      });
    },
  });
}

export function useDeleteFlyerAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assetId,
      profileId,
    }: {
      assetId: string;
      profileId: string;
    }) => {
      const response = await fetch(`/api/flyer-assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete flyer asset');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['flyer-assets', variables.profileId],
      });
    },
  });
}
