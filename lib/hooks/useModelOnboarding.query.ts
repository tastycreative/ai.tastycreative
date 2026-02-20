'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export type OnboardingStatus = 'DRAFT' | 'IN_PROGRESS' | 'AWAITING_REVIEW' | 'COMPLETED' | 'CANCELLED';

export interface ModelOnboardingDraft {
  id: string;
  clerkId: string;
  createdByClerkId: string;
  organizationId?: string | null;
  status: OnboardingStatus;
  currentStep: number;
  completionPercentage: number;
  
  // Basic Info
  name?: string;
  description?: string;
  instagramUsername?: string;
  profileImageUrl?: string;
  type?: string;
  
  // Background/Persona
  age?: string;
  birthday?: string;
  location?: string;
  nationality?: string;
  ethnicity?: string;
  occupation?: string;
  relationshipStatus?: string;
  backstory?: string;
  interests?: string[];
  
  // Content
  selectedContentTypes?: string[];
  customContentTypes?: string[];
  primaryNiche?: string;
  feedAesthetic?: string;
  commonThemes?: string;
  uniqueHook?: string;
  
  // Pricing & Platforms
  platformPricing?: any;
  platforms?: any;
  socials?: any;
  
  // Additional
  modelBible?: any;
  restrictions?: any;
  schedule?: any;
  internalNotes?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  completedAt?: string;
  lastAutoSaveAt?: string;
}

async function fetchDrafts(): Promise<ModelOnboardingDraft[]> {
  const response = await fetch('/api/model-onboarding/drafts');
  if (!response.ok) {
    throw new Error('Failed to fetch drafts');
  }
  return response.json();
}

async function fetchDraft(draftId: string): Promise<ModelOnboardingDraft> {
  const response = await fetch(`/api/model-onboarding/drafts/${draftId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch draft');
  }
  return response.json();
}

async function createDraft(data: Partial<ModelOnboardingDraft>): Promise<ModelOnboardingDraft> {
  const response = await fetch('/api/model-onboarding/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create draft');
  }
  return response.json();
}

async function updateDraft(draftId: string, data: Partial<ModelOnboardingDraft>): Promise<ModelOnboardingDraft> {
  const response = await fetch(`/api/model-onboarding/drafts/${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update draft');
  }
  return response.json();
}

async function submitDraft(draftId: string): Promise<{ profileId: string }> {
  const response = await fetch(`/api/model-onboarding/drafts/${draftId}/submit`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to submit draft');
  }
  return response.json();
}

async function deleteDraft(draftId: string): Promise<void> {
  const response = await fetch(`/api/model-onboarding/drafts/${draftId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete draft');
  }
}

export function useOnboardingDrafts() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['onboarding-drafts', user?.id],
    queryFn: fetchDrafts,
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useOnboardingDraft(draftId: string | null | undefined) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['onboarding-draft', draftId, user?.id],
    queryFn: () => fetchDraft(draftId!),
    enabled: !!user && !!draftId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useCreateOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-drafts'] });
    },
  });
}

export function useUpdateOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: Partial<ModelOnboardingDraft> }) =>
      updateDraft(draftId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-draft', variables.draftId] });
    },
  });
}

export function useSubmitOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-profiles'] });
    },
  });
}

export function useDeleteOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-drafts'] });
    },
  });
}

interface DuplicateCheckResult {
  exists: boolean;
  duplicate?: {
    id: string;
    name?: string;
    username: string;
    type: 'profile' | 'draft';
    status?: string;
  } | null;
}

async function checkDuplicate(username: string, excludeDraftId?: string): Promise<DuplicateCheckResult> {
  const params = new URLSearchParams({ username });
  if (excludeDraftId) {
    params.append('excludeDraftId', excludeDraftId);
  }

  const response = await fetch(`/api/model-onboarding/check-duplicate?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to check for duplicates');
  }
  return response.json();
}

export function useCheckDuplicate(username: string, excludeDraftId?: string) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['check-duplicate', username, excludeDraftId],
    queryFn: () => checkDuplicate(username, excludeDraftId),
    enabled: !!user && !!username && username.length > 0,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60, // 1 minute
    retry: 1,
  });
}
