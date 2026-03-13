'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

// User Analytics Types
export interface UserAnalyticsSummary {
  totalUsers: number;
  newUsersToday: number;
  newUsers7d: number;
  newUsers30d: number;
  dau: number;
  wau: number;
  mau: number;
  growthRate7d: number;
  growthRate30d: number;
}

export interface TimeSeriesPoint {
  [key: string]: string | number;
  date: string;
  count: number;
}

export interface ActivityTimeSeriesPoint {
  [key: string]: string | number;
  date: string;
  activeUsers: number;
}

export interface RoleDistribution {
  role: string;
  count: number;
}

export interface RecentSignup {
  id: string;
  name: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: string;
  role: string;
}

export interface UserAnalyticsData {
  summary: UserAnalyticsSummary;
  signupTimeSeries: TimeSeriesPoint[];
  activityTimeSeries: ActivityTimeSeriesPoint[];
  roleDistribution: RoleDistribution[];
  recentSignups: RecentSignup[];
}

// Member Analytics Types (org-specific)
export interface MemberAnalyticsSummary {
  totalMembers: number;
  activeMembersToday: number;
  activeMembers7d: number;
  activeMembers30d: number;
  newMembers7d: number;
  newMembers30d: number;
}

export interface MemberActivityPoint {
  [key: string]: string | number;
  date: string;
  activeMembers: number;
}

export interface RecentMember {
  id: string;
  role: string;
  joinedAt: string;
  lastLoginAt: string | null;
  user: {
    name: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
}

export interface MemberAnalyticsData {
  organizationName: string;
  summary: MemberAnalyticsSummary;
  membersByRole: RoleDistribution[];
  memberGrowthTimeSeries: TimeSeriesPoint[];
  activityTimeSeries: MemberActivityPoint[];
  recentMembers: RecentMember[];
  activeTodayMembers: RecentMember[];
}

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'all';

async function fetchUserAnalytics(range: TimeRange): Promise<UserAnalyticsData> {
  const response = await fetch(`/api/admin/users/analytics?range=${range}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user analytics');
  }
  return response.json();
}

async function fetchMemberAnalytics(
  range: TimeRange,
  slug: string
): Promise<MemberAnalyticsData> {
  const params = new URLSearchParams({ range, slug });
  const response = await fetch(`/api/admin/members/analytics?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch member analytics');
  }
  return response.json();
}

export function useUserAnalytics(range: TimeRange = '30d') {
  const { user } = useUser();

  return useQuery({
    queryKey: ['admin', 'users', 'analytics', range],
    queryFn: () => fetchUserAnalytics(range),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useMemberAnalytics(range: TimeRange = '30d', slug?: string) {
  const { user } = useUser();

  return useQuery({
    queryKey: ['admin', 'members', 'analytics', range, slug],
    queryFn: () => fetchMemberAnalytics(range, slug!),
    enabled: !!user && !!slug,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
