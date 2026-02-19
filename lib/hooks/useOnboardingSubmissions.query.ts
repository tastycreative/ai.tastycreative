'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export interface OnboardingSubmission {
  id: string;
  name: string | null;
  description: string | null;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  type: string | null;
  age: string | null;
  location: string | null;
  nationality: string | null;
  ethnicity: string | null;
  occupation: string | null;
  relationshipStatus: string | null;
  backstory: string | null;
  selectedContentTypes: string[];
  reviewStatus: ReviewStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  invitation: any;
}

export interface SubmissionsResponse {
  submissions: OnboardingSubmission[];
  stats: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

async function fetchSubmissions(status: ReviewStatus): Promise<SubmissionsResponse> {
  const response = await fetch(`/api/onboarding-submissions?status=${status}`);
  if (!response.ok) {
    throw new Error('Failed to fetch submissions');
  }
  return response.json();
}

export function useOnboardingSubmissions(status: ReviewStatus = 'PENDING') {
  const { user } = useUser();

  return useQuery({
    queryKey: ['onboarding-submissions', status],
    queryFn: () => fetchSubmissions(status),
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useApproveSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string) => {
      const response = await fetch(`/api/onboarding-submissions/${submissionId}/approve`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve submission');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-submissions'] });
    },
  });
}

export function useRejectSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissionId, reason }: { submissionId: string; reason: string }) => {
      const response = await fetch(`/api/onboarding-submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject submission');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-submissions'] });
    },
  });
}
