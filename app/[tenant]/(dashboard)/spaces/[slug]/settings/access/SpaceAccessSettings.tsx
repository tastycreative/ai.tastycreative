'use client';

import { useState, useMemo } from 'react';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import {
  useSpaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
  type MemberRole,
  type SpaceMember,
} from '@/lib/hooks/useSpaceMembers.query';
import { Search, UserPlus, Loader2, Trash2, ChevronDown, Shield, Users, Eye, Crown } from 'lucide-react';
import { AddPeopleModal } from '../../../AddPeopleModal';

interface Props {
  slug: string;
}

const ROLE_CONFIG: {
  value: MemberRole;
  label: string;
  icon: typeof Shield;
  iconColor: string;
  desc: string;
}[] = [
  { value: 'OWNER', label: 'Owner', icon: Crown, iconColor: 'text-amber-500', desc: 'Full control over the space' },
  { value: 'ADMIN', label: 'Admin', icon: Shield, iconColor: 'text-brand-light-pink', desc: 'Can manage settings and members' },
  { value: 'MEMBER', label: 'Member', icon: Users, iconColor: 'text-brand-blue', desc: 'Can edit and collaborate' },
  { value: 'VIEWER', label: 'Viewer', icon: Eye, iconColor: 'text-gray-400', desc: 'Can view and comment only' },
];

function getMemberName(member: SpaceMember): string {
  return (
    member.user.name ||
    `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() ||
    member.user.email
  );
}

export function SpaceAccessSettings({ slug }: Props) {
  const { data: space, isLoading: spaceLoading } = useSpaceBySlug(slug);
  const { data: members = [], isLoading: membersLoading } = useSpaceMembers(space?.id);
  const updateRoleMutation = useUpdateMemberRole(space?.id ?? '');
  const removeMemberMutation = useRemoveMember(space?.id ?? '');

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        getMemberName(m).toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q),
    );
  }, [members, searchQuery]);

  const isLoading = spaceLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading members...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Access</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage who has access to this space
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-light-pink text-white text-sm font-medium hover:bg-brand-mid-pink transition-colors shadow-sm shadow-brand-light-pink/20"
        >
          <UserPlus className="h-4 w-4" />
          Add people
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-gray-50/50 dark:bg-gray-900/60 text-sm text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/50 transition-all"
        />
      </div>

      {/* Members table */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl overflow-visible">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_140px_60px] gap-4 px-5 py-3 border-b border-gray-100 dark:border-brand-mid-pink/10">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Member
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Role
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">
            Action
          </span>
        </div>

        {/* Rows */}
        {filteredMembers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {searchQuery.trim() ? 'No members match your search' : 'No members yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-brand-mid-pink/10 overflow-visible">
            {filteredMembers.map((member) => {
              const name = getMemberName(member);
              const roleConf = ROLE_CONFIG.find((r) => r.value === member.role) ?? ROLE_CONFIG[2];
              const isDropdownOpen = openRoleDropdown === member.id;
              const isConfirming = confirmRemove === member.id;

              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[1fr_140px_60px] gap-4 px-5 py-3.5 items-center"
                >
                  {/* Name + email */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-white text-xs font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white truncate leading-tight">
                        {name}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  {/* Role dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenRoleDropdown(isDropdownOpen ? null : member.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:border-brand-light-pink/40 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors w-full"
                    >
                      <roleConf.icon className={`h-3 w-3 ${roleConf.iconColor}`} />
                      <span className="flex-1 text-left">{roleConf.label}</span>
                      <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute z-20 w-56 mt-1 left-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 shadow-xl overflow-hidden">
                        <div className="p-1">
                          {ROLE_CONFIG.map((role) => (
                            <button
                              key={role.value}
                              type="button"
                              onClick={() => {
                                if (role.value !== member.role) {
                                  updateRoleMutation.mutate({ memberId: member.id, role: role.value });
                                }
                                setOpenRoleDropdown(null);
                              }}
                              className={[
                                'w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-colors',
                                member.role === role.value
                                  ? 'bg-brand-light-pink/5 dark:bg-brand-light-pink/10'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
                              ].join(' ')}
                            >
                              <role.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${role.iconColor}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-brand-off-white">
                                  {role.label}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                  {role.desc}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remove action */}
                  <div className="flex justify-end">
                    {isConfirming ? (
                      <button
                        type="button"
                        onClick={() => {
                          removeMemberMutation.mutate(member.id);
                          setConfirmRemove(null);
                        }}
                        className="text-[10px] font-semibold text-red-500 hover:text-red-600 transition-colors"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(member.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-brand-mid-pink/10">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
      </div>

      {/* Add People Modal */}
      {space && (
        <AddPeopleModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          spaceId={space.id}
          spaceName={space.name}
        />
      )}
    </div>
  );
}
