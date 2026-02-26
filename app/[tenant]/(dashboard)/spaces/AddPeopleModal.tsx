'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, ChevronDown, Shield, Users, Eye, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface AddPeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  spaceName: string;
}

type MemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

interface OrganizationMember {
  id: string;
  clerkId: string;
  name: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface SpaceMember {
  userId: string;
  role: MemberRole;
}

async function searchOrganizationMembers(query: string): Promise<OrganizationMember[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/organization/members/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search members');
  return res.json();
}

async function fetchSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const res = await fetch(`/api/spaces/${spaceId}/members`);
  if (!res.ok) throw new Error('Failed to fetch space members');
  return res.json();
}

async function addSpaceMembers(spaceId: string, userIds: string[], role: MemberRole) {
  const res = await fetch(`/api/spaces/${spaceId}/members/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, role }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to add members');
  }
  return res.json();
}

export function AddPeopleModal({ isOpen, onClose, spaceId, spaceName }: AddPeopleModalProps) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<OrganizationMember[]>([]);
  const [selectedRole, setSelectedRole] = useState<MemberRole>('MEMBER');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false);
      }
    };

    if (showDropdown || showRoleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown, showRoleDropdown]);

  const { data: searchResults = [], isLoading: searching } = useQuery({
    queryKey: ['organization', 'members', 'search', debouncedSearch],
    queryFn: () => searchOrganizationMembers(debouncedSearch),
    enabled: isOpen && debouncedSearch.trim().length > 0,
  });

  const { data: spaceMembers = [] } = useQuery({
    queryKey: ['spaces', spaceId, 'members'],
    queryFn: () => fetchSpaceMembers(spaceId),
    enabled: isOpen && !!spaceId,
  });

  const addMembersMutation = useMutation({
    mutationFn: ({ userIds, role }: { userIds: string[]; role: MemberRole }) =>
      addSpaceMembers(spaceId, userIds, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['space-members', spaceId] });
      setSelectedMembers([]);
      setSearchQuery('');
      onClose();
    },
  });

  useEffect(() => setMounted(true), []);

  // Filter out members already in space or already selected
  const filteredResults = useMemo(() => {
    const spaceMemberIds = new Set(spaceMembers.map(sm => sm.userId));
    const selectedMemberIds = new Set(selectedMembers.map(m => m.id));
    return searchResults.filter(
      member => !spaceMemberIds.has(member.id) && !selectedMemberIds.has(member.id)
    );
  }, [searchResults, spaceMembers, selectedMembers]);

  const handleSelectMember = useCallback((member: OrganizationMember) => {
    setSelectedMembers(prev => [...prev, member]);
    setSearchQuery('');
    setShowDropdown(false);
  }, []);

  const handleRemoveMember = useCallback((memberId: string) => {
    setSelectedMembers(prev => prev.filter(m => m.id !== memberId));
  }, []);

  const handleAddMembers = useCallback(() => {
    if (selectedMembers.length === 0) return;
    addMembersMutation.mutate({
      userIds: selectedMembers.map(m => m.id),
      role: selectedRole,
    });
  }, [selectedMembers, selectedRole, addMembersMutation]);

  const getMemberDisplayName = (member: OrganizationMember) => {
    return member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-visible animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-brand-off-white">
              Add people
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Invite members to <span className="font-medium text-gray-700 dark:text-gray-300">{spaceName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-4 space-y-3">
          {/* Search Box with Selected Members */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Members
            </label>
            <div className="min-h-10 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-gray-50/50 dark:bg-gray-900/60 focus-within:ring-2 focus-within:ring-brand-light-pink/50 focus-within:border-brand-light-pink/40 transition-all">
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedMembers.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md bg-brand-light-pink/10 border border-brand-light-pink/15"
                  >
                    <span className="shrink-0 h-5 w-5 rounded-md bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-white text-[9px] font-bold">
                      {getMemberDisplayName(member).charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 max-w-30 truncate">
                      {getMemberDisplayName(member)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="shrink-0 hover:bg-brand-light-pink/20 rounded p-0.5 transition-colors text-gray-400 hover:text-brand-dark-pink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                <div className="flex-1 min-w-30 relative">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder={selectedMembers.length === 0 ? 'Search by name or email...' : 'Add more...'}
                    className="w-full pl-5 pr-1 py-0.5 bg-transparent text-sm text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Search Results Dropdown */}
            {showDropdown && searchQuery.trim() && (
              <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 shadow-xl max-h-52 overflow-y-auto">
                {searching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-light-pink" />
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      Searching...
                    </span>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No members found
                    </p>
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredResults.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMember(member)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left"
                      >
                        <div className="shrink-0 h-7 w-7 rounded-lg bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-white text-[10px] font-bold">
                          {(member.name || member.email)?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white truncate leading-tight">
                            {getMemberDisplayName(member)}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                            {member.email}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Role Selection */}
          <div className="relative" ref={roleDropdownRef}>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Role
            </label>
            <button
              type="button"
              onClick={() => setShowRoleDropdown((p) => !p)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-gray-50/50 dark:bg-gray-900/60 hover:border-brand-light-pink/40 focus-visible:ring-2 focus-visible:ring-brand-light-pink/50 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                {selectedRole === 'ADMIN' && <Shield className="h-3.5 w-3.5 text-brand-light-pink" />}
                {selectedRole === 'MEMBER' && <Users className="h-3.5 w-3.5 text-brand-blue" />}
                {selectedRole === 'VIEWER' && <Eye className="h-3.5 w-3.5 text-gray-400" />}
                <span className="text-sm font-medium text-gray-800 dark:text-brand-off-white">
                  {selectedRole === 'ADMIN' && 'Admin'}
                  {selectedRole === 'MEMBER' && 'Member'}
                  {selectedRole === 'VIEWER' && 'Viewer'}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showRoleDropdown && (
              <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 shadow-xl overflow-hidden">
                <div className="p-1">
                  {([
                    {
                      value: 'ADMIN' as MemberRole,
                      label: 'Admin',
                      desc: 'Admins can do most things like update settings and add other admins.',
                      icon: Shield,
                      iconColor: 'text-brand-light-pink',
                    },
                    {
                      value: 'MEMBER' as MemberRole,
                      label: 'Member',
                      desc: 'Members are part of the team, and can edit, add and collaborate with the team.',
                      icon: Users,
                      iconColor: 'text-brand-blue',
                    },
                    {
                      value: 'VIEWER' as MemberRole,
                      label: 'Viewer',
                      desc: 'Viewers can search through, view, and comment to your teams work but not much else.',
                      icon: Eye,
                      iconColor: 'text-gray-400',
                    },
                  ]).map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role.value);
                        setShowRoleDropdown(false);
                      }}
                      className={[
                        'w-full flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors',
                        selectedRole === role.value
                          ? 'bg-brand-light-pink/5 dark:bg-brand-light-pink/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      ].join(' ')}
                    >
                      <role.icon className={`h-4 w-4 mt-0.5 shrink-0 ${role.iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-brand-off-white">
                            {role.label}
                          </span>
                          {selectedRole === role.value && (
                            <Check className="h-3.5 w-3.5 text-brand-light-pink shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 mt-0.5">
                          {role.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-brand-mid-pink/10 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {selectedMembers.length > 0
              ? `${selectedMembers.length} selected`
              : 'No members selected'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddMembers}
              disabled={selectedMembers.length === 0 || addMembersMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-light-pink text-white text-xs font-semibold hover:bg-brand-mid-pink disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-brand-light-pink/20"
            >
              {addMembersMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add member${selectedMembers.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
