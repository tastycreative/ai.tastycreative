'use client';

import { useState } from 'react';
import { Plus, Loader2, Users, ChevronRight, AlertTriangle } from 'lucide-react';
import { useCreateOrgTeam, type OrgTeam } from '@/lib/hooks/useOrgTeams.query';

const TEAM_COLORS = [
  '#F774B9', '#E1518E', '#5DC3F8', '#60B347',
  '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F97316', '#6366F1',
];

interface TeamListProps {
  teams: OrgTeam[];
  orgId: string;
  canCreate: boolean; // OWNER/ADMIN only
  onSelectTeam: (team: OrgTeam) => void;
}

export default function TeamList({ teams, orgId, canCreate, onSelectTeam }: TeamListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newColor, setNewColor]     = useState(TEAM_COLORS[0]);
  const [createError, setCreateError] = useState('');

  const createTeam = useCreateOrgTeam(orgId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim()) return;
    try {
      await createTeam.mutateAsync({ name: newName.trim(), color: newColor, tabPermissions: {} });
      setNewName('');
      setNewColor(TEAM_COLORS[0]);
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create team');
    }
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      {canCreate && (
        <>
          {showCreate ? (
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-2xl border-2 border-dashed border-brand-light-pink/40 bg-brand-light-pink/5 dark:bg-brand-dark-pink/5 space-y-3"
            >
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Team</p>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Team name (e.g. OTP Team, Paywall Team…)"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
              />
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Color:</span>
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: newColor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createTeam.isPending || !newName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-light-pink hover:bg-brand-mid-pink disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {createTeam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(''); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-light-pink hover:text-brand-light-pink dark:hover:border-brand-light-pink dark:hover:text-brand-light-pink transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create new team
            </button>
          )}
        </>
      )}

      {/* Team cards */}
      {teams.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Users className="mx-auto w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No teams yet.{canCreate ? ' Create one above.' : ''}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => {
            const memberCount = team._count?.members ?? team.members?.length ?? 0;
            const restrictedTabCount = Object.values(team.tabPermissions ?? {}).filter(Boolean).length;

            return (
              <button
                key={team.id}
                onClick={() => onSelectTeam(team)}
                className="group text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-light-pink/50 dark:hover:border-brand-mid-pink/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team.color ?? '#F774B9' }}
                    />
                    <span className="font-semibold text-gray-900 dark:text-brand-off-white text-sm">
                      {team.name}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-brand-light-pink transition-colors flex-shrink-0 mt-0.5" />
                </div>
                {team.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                    {team.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span className={restrictedTabCount === 0 && memberCount > 0 ? 'text-amber-500 dark:text-amber-400 flex items-center gap-1' : ''}>
                    {restrictedTabCount === 0 && memberCount > 0 && <AlertTriangle className="w-3 h-3" />}
                    {restrictedTabCount === 0 ? 'No tab access' : `${restrictedTabCount} tab${restrictedTabCount !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
