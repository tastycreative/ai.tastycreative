'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

interface Caption {
  id: string;
  caption: string;
  profileId: string;
  usageCount: number;
  totalRevenue: number;
  originalModelName: string | null;
  notes: string | null;
  isFavorite: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  contentTypes?: Array<{ contentType: { id: string; name: string } }>;
  messageTypes?: Array<{ messageType: { id: string; name: string } }>;
  averageRevenuePerUse: number;
}

interface ContentType {
  id: string;
  name: string;
}

interface MessageType {
  id: string;
  name: string;
}

async function fetchModelCaptions(
  profileId: string,
  contentTypeIds?: string[],
  messageTypeIds?: string[],
  search?: string
): Promise<Caption[]> {
  const params = new URLSearchParams({ profileId });
  
  // Add multiple content type IDs
  if (contentTypeIds && contentTypeIds.length > 0) {
    contentTypeIds.forEach(id => params.append('contentTypeId', id));
  }
  
  // Add multiple message type IDs
  if (messageTypeIds && messageTypeIds.length > 0) {
    messageTypeIds.forEach(id => params.append('messageTypeId', id));
  }
  
  if (search) params.append('search', search);

  const response = await fetch(`/api/model-captions?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch model captions');
  }
  return response.json();
}

async function fetchContentTypes(): Promise<ContentType[]> {
  const response = await fetch('/api/model-captions/content-types');
  if (!response.ok) {
    throw new Error('Failed to fetch content types');
  }
  return response.json();
}

async function fetchMessageTypes(): Promise<MessageType[]> {
  const response = await fetch('/api/model-captions/message-types');
  if (!response.ok) {
    throw new Error('Failed to fetch message types');
  }
  return response.json();
}

export function useModelCaptions(
  profileId: string,
  contentTypeIds?: string[],
  messageTypeIds?: string[],
  search?: string
) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['model-captions', profileId, contentTypeIds, messageTypeIds, search],
    queryFn: () => fetchModelCaptions(profileId, contentTypeIds, messageTypeIds, search),
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useContentTypes() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['caption-content-types'],
    queryFn: fetchContentTypes,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useMessageTypes() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['caption-message-types'],
    queryFn: fetchMessageTypes,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useCreateCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      profileId: string;
      caption: string;
      contentTypeIds?: string[];
      messageTypeIds?: string[];
      originalModelName?: string;
      notes?: string;
    }) => {
      const response = await fetch('/api/model-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create caption');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-captions', variables.profileId] });
    },
  });
}

export function useUpdateCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      profileId: string;
      caption?: string;
      contentTypeIds?: string[];
      messageTypeIds?: string[];
      originalModelName?: string;
      notes?: string;
      usageCount?: number;
      totalRevenue?: number;
    }) => {
      const response = await fetch('/api/model-captions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update caption');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-captions', variables.profileId] });
    },
  });
}

export function useDeleteCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; profileId: string }) => {
      const response = await fetch(`/api/model-captions?id=${data.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete caption');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-captions', variables.profileId] });
    },
  });
}

export function useCreateContentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/model-captions/content-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create content type');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-content-types'] });
    },
  });
}

export function useCreateMessageType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/model-captions/message-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create message type');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-message-types'] });
    },
  });
}
