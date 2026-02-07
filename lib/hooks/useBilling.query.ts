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
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

async function fetchBillingInfo(): Promise<BillingInfo> {
  const response = await fetch('/api/billing/current');
  if (!response.ok) {
    throw new Error('Failed to fetch billing information');
  }
  return response.json();
}

interface TransactionFilters {
  search?: string;
  type?: 'all' | 'subscription' | 'credits';
  startDate?: string;
  endDate?: string;
}

interface UsageFilters {
  search?: string;
  feature?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

async function fetchTransactions(filters?: TransactionFilters): Promise<TransactionsResponse> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const url = `/api/billing/transactions${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }
  return response.json();
}

async function fetchUsageLogs(filters?: UsageFilters): Promise<UsageLogsResponse> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.feature && filters.feature !== 'all') params.append('feature', filters.feature);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const url = `/api/billing/usage-logs${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
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

export function useTransactions(filters?: TransactionFilters, enabled: boolean = true) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['billing', 'transactions', user?.id, filters],
    queryFn: () => fetchTransactions(filters),
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useUsageLogs(filters?: UsageFilters, enabled: boolean = true) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['billing', 'usage-logs', user?.id, filters],
    queryFn: () => fetchUsageLogs(filters),
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
