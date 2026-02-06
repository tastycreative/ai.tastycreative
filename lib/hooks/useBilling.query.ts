'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface BillingInfo {
  organization: {
    id: string;
    name: string;
    subscriptionStatus: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: string | null;
  };
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
    billingInterval: string;
    monthlyCredits: number;
  } | null;
  usage: {
    members: { current: number; max: number; percentage: number };
    profiles: { current: number; max: number; percentage: number };
    storage: { current: number; max: number; percentage: number };
    credits: { used: number; max: number; remaining: number; available: number; percentage: number };
  };
}

export interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  creditsAdded: number | null;
  planName: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

export interface UsageLog {
  id: string;
  action: string;
  resource: string;
  creditsUsed: number;
  createdAt: string;
  metadata?: any;
  user?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
}

interface UsageLogsResponse {
  usageLogs: UsageLog[];
}

async function fetchBillingInfo(): Promise<BillingInfo> {
  const response = await fetch('/api/billing/current');
  if (!response.ok) {
    throw new Error('Failed to fetch billing information');
  }
  return response.json();
}

async function fetchTransactions(): Promise<TransactionsResponse> {
  const response = await fetch('/api/billing/transactions');
  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }
  return response.json();
}

async function fetchUsageLogs(): Promise<UsageLogsResponse> {
  const response = await fetch('/api/billing/usage-logs');
  if (!response.ok) {
    throw new Error('Failed to fetch usage logs');
  }
  return response.json();
}

async function cancelSubscription(): Promise<{ success: boolean }> {
  const response = await fetch('/api/billing/cancel', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to cancel subscription');
  }
  return response.json();
}

export function useBillingInfo() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['billing', 'info', user?.id],
    queryFn: fetchBillingInfo,
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useTransactions(enabled: boolean = true) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['billing', 'transactions', user?.id],
    queryFn: fetchTransactions,
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useUsageLogs(enabled: boolean = true) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['billing', 'usage-logs', user?.id],
    queryFn: fetchUsageLogs,
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      // Invalidate billing info to refetch latest data
      queryClient.invalidateQueries({ queryKey: ['billing', 'info'] });
    },
  });
}
