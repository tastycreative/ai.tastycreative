'use client';

import { useState } from 'react';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import { useOrgTeams, type OrgTeam } from '@/lib/hooks/useOrgTeams.query';
import { useQuery } from '@tanstack/react-query';
import TeamList from '@/components/team/TeamList';
import TeamDetailModal from '@/components/team/TeamDetailModal';

interface OrgMember {
  id: string;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  email: string | null;
  role: string;
}

export default function AdminTeamsView() {
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const orgId = currentOrganization?.id;

  const [selectedTeam, setSelectedTeam] = useState<OrgTeam | null>(null);

  const { data: teams = [], isLoading: teamsLoading, error: teamsError } = useOrgTeams(orgId);

  const { data: membersData } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json() as Promise<{ members: OrgMember[] }>;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  const orgMembers: OrgMember[] = membersData?.members ?? [];
  const liveSelectedTeam =
    selectedTeam ? (teams.find((t) => t.id === selectedTeam.id) ?? selectedTeam) : null;

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-brand-light-pink animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-brand-light-pink/10 dark:bg-brand-dark-pink/10">
          <Users className="w-5 h-5 text-brand-light-pink" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-brand-off-white">Teams</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage teams and control which tabs each team can access.
          </p>
        </div>
      </div>

      {/* Content */}
      {teamsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-brand-light-pink animate-spin" />
        </div>
      ) : teamsError ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to load teams. Please refresh the page.
        </div>
      ) : (
        <TeamList
          teams={teams}
          orgId={orgId ?? ''}
          canCreate={true}
          onSelectTeam={(team) => setSelectedTeam(team)}
        />
      )}

      {liveSelectedTeam && orgId && (
        <TeamDetailModal
          team={liveSelectedTeam}
          orgId={orgId}
          canEdit={true}
          orgMembers={orgMembers.map((m) => ({
            id: m.id,
            name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.clerkId,
            email: m.email ?? '',
            imageUrl: m.imageUrl,
            role: m.role,
          }))}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
