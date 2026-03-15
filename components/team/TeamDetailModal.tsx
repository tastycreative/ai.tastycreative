'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Trash2, UserPlus, UserMinus, Loader2, Search, Check, Users,
  Shield, Palette, AlertTriangle,
} from 'lucide-react';
import {
  useUpdateOrgTeam,
  useDeleteOrgTeam,
  useAddOrgTeamMember,
  useRemoveOrgTeamMember,
  type OrgTeam,
  type OrgTeamMemberRecord,
} from '@/lib/hooks/useOrgTeams.query';

// All tab sections with their keys and informational subtab labels
const TAB_SECTIONS: { key: string; label: string; subtabs: string[] }[] = [
  { key: 'hasSpacesTab',      label: 'Spaces',              subtabs: [] },
  { key: 'hasSchedulersTab',  label: 'Schedulers Tracker',  subtabs: [] },
  { key: 'hasContentTab',     label: 'Content Ops',         subtabs: ['OF Models', 'Gallery', 'GIF Maker', 'Content Submissions', 'Caption Workspace'] },
  { key: 'hasVaultTab',       label: 'Vault',               subtabs: [] },
  { key: 'hasReferenceBank',  label: 'Reference Bank',      subtabs: [] },
  { key: 'canCaptionBank',    label: 'Caption Banks',       subtabs: ['Captions'] },
  { key: 'hasInstagramTab',   label: 'Content Studio',      subtabs: ['Sexting Set Organizer', 'Staging', 'Calendar', 'Pipeline', 'Stories', 'Reels', 'Feed Posts', 'Performance', 'Formulas', 'Hashtags', 'Workflow'] },
  { key: 'hasGenerateTab',    label: 'Generate Content',    subtabs: ['SeeDream Text/Image/Video', 'Kling AI Video', 'Voice Generator', 'Face Swapping', 'Skin Enhancer', 'FPS Boost'] },
  { key: 'hasFeedTab',        label: 'Social Media',        subtabs: ['User Feed', 'My Profile', 'Friends', 'Bookmarks'] },
  { key: 'hasTrainingTab',    label: 'Train Models',        subtabs: ['Train LoRA', 'Training Jobs'] },
  { key: 'hasAIToolsTab',     label: 'AI Tools',            subtabs: ['My LoRA Models', 'Instagram Extractor', 'Style Transfer Prompts', 'Video Prompts', 'Flux Kontext Prompts'] },
  { key: 'hasMarketplaceTab', label: 'AI Marketplace',      subtabs: [] },
];

const TEAM_COLORS = [
  '#F774B9', '#E1518E', '#5DC3F8', '#60B347',
  '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F97316', '#6366F1',
];

type ActiveTab = 'general' | 'permissions' | 'members';

interface OrgMemberOption {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  role: string;
}

interface TeamDetailModalProps {
  team: OrgTeam;
  orgId: string;
  orgMembers: OrgMemberOption[];
  canEdit: boolean;
  onClose: () => void;
}

// ── Member Avatar ────────────────────────────────────────────────────────────
function MemberAvatar({ src, name, size = 'md' }: { src: string | null; name: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${dim} rounded-full object-cover ring-2 ring-white dark:ring-gray-900`} />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-brand-light-pink/20 flex items-center justify-center text-brand-light-pink font-semibold ring-2 ring-white dark:ring-gray-900`}>
      {(name[0] ?? '?').toUpperCase()}
    </div>
  );
}

// ── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    OWNER:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    ADMIN:   'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    MANAGER: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    CREATOR: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    VIEWER:  'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
    MEMBER:  'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[role] ?? colors.MEMBER}`}>
      {role}
    </span>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
export default function TeamDetailModal({
  team,
  orgId,
  orgMembers,
  canEdit,
  onClose,
}: TeamDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [name, setName]           = useState(team.name);
  const [description, setDesc]    = useState(team.description ?? '');
  const [color, setColor]         = useState(team.color ?? TEAM_COLORS[0]);
  const [tabPerms, setTabPerms]   = useState<Record<string, boolean>>(() => {
    const base = Object.fromEntries(TAB_SECTIONS.map(({ key }) => [key, false]));
    const saved = (team.tabPermissions ?? {}) as Record<string, boolean>;
    return { ...base, ...saved };
  });

  // Multi-select member picker state
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker]     = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateTeam   = useUpdateOrgTeam(orgId);
  const deleteTeam   = useDeleteOrgTeam(orgId);
  const addMember    = useAddOrgTeamMember(orgId, team.id);
  const removeMember = useRemoveOrgTeamMember(orgId, team.id);

  const currentMemberIds = new Set(
    (team.members ?? []).map((m: OrgTeamMemberRecord) => m.teamMemberId)
  );

  const availableToAdd = useMemo(
    () => orgMembers.filter((m) => !currentMemberIds.has(m.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgMembers, team.members]
  );

  const filteredAvailable = useMemo(() => {
    if (!memberSearch.trim()) return availableToAdd;
    const q = memberSearch.toLowerCase();
    return availableToAdd.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    );
  }, [availableToAdd, memberSearch]);

  // Focus search when picker opens
  useEffect(() => {
    if (showPicker) searchRef.current?.focus();
  }, [showPicker]);

  // Close picker on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showPicker) {
          e.stopPropagation();
          setShowPicker(false);
          setMemberSearch('');
          setSelectedIds(new Set());
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showPicker, onClose]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredAvailable.map((m) => m.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleAddSelected() {
    if (selectedIds.size === 0) return;
    setSaveError('');
    try {
      await addMember.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      setMemberSearch('');
      setShowPicker(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to add members');
    }
  }

  async function handleSave() {
    setSaveError('');
    setSaveSuccess(false);
    try {
      await updateTeam.mutateAsync({
        teamId: team.id,
        name,
        description: description || undefined,
        color,
        tabPermissions: tabPerms,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async function handleDelete() {
    try {
      await deleteTeam.mutateAsync(team.id);
      onClose();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function handleRemoveMember(orgTeamMemberId: string) {
    try {
      await removeMember.mutateAsync(orgTeamMemberId);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to remove member');
    }
  }

  const isSaving = updateTeam.isPending || deleteTeam.isPending;
  const enabledCount = Object.values(tabPerms).filter(Boolean).length;
  const memberCount = (team.members ?? []).length;

  const modalTabs: { key: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: 'general',     label: 'General',     icon: <Palette className="w-4 h-4" /> },
    { key: 'permissions', label: 'Permissions',  icon: <Shield className="w-4 h-4" />, badge: `${enabledCount}/${TAB_SECTIONS.length}` },
    { key: 'members',     label: 'Members',      icon: <Users className="w-4 h-4" />, badge: `${memberCount}` },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-brand-mid-pink/20 shadow-2xl overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white dark:ring-gray-900"
              style={{ backgroundColor: color }}
            />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-brand-off-white truncate">
              {canEdit ? 'Edit Team' : team.name}
            </h2>
            {!canEdit && <RoleBadge role="VIEW ONLY" />}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 gap-1">
          {modalTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.key
                  ? 'border-brand-light-pink text-brand-light-pink'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? 'bg-brand-light-pink/15 text-brand-light-pink'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {canEdit ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Team Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-brand-off-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink transition-colors"
                      placeholder="e.g. Content Team"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDesc(e.target.value)}
                      placeholder="What does this team do?"
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-brand-off-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Team Color</label>
                    <div className="flex flex-wrap gap-2.5">
                      {TEAM_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className={`w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 ${
                            color === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 scale-110' : ''
                          }`}
                          style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : undefined, outlineOffset: '3px' }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-brand-off-white">{memberCount}</p>
                    </div>
                    <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tabs Enabled</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-brand-off-white">{enabledCount} <span className="text-sm font-normal text-gray-400">/ {TAB_SECTIONS.length}</span></p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Team Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white">{team.name}</p>
                  </div>
                  {team.description && (
                    <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{team.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Controls which sidebar tabs <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">CREATOR</code>, <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">VIEWER</code>, and <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">MEMBER</code> roles can see.
                </p>
                {canEdit && (
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setTabPerms(Object.fromEntries(TAB_SECTIONS.map(({ key }) => [key, true])))}
                      className="text-xs text-brand-light-pink hover:text-brand-dark-pink font-medium transition-colors"
                    >
                      All
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      onClick={() => setTabPerms(Object.fromEntries(TAB_SECTIONS.map(({ key }) => [key, false])))}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors"
                    >
                      None
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TAB_SECTIONS.map(({ key, label, subtabs }) => (
                  <label
                    key={key}
                    className={`group flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                      canEdit ? 'cursor-pointer hover:shadow-sm' : 'pointer-events-none opacity-80'
                    } ${
                      tabPerms[key]
                        ? 'border-brand-light-pink/40 bg-brand-light-pink/5 dark:bg-brand-dark-pink/10 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
                      tabPerms[key]
                        ? 'bg-brand-light-pink border-brand-light-pink'
                        : 'border-gray-300 dark:border-gray-600 group-hover:border-brand-light-pink/50'
                    }`}>
                      {tabPerms[key] && <Check className="w-3 h-3 text-white" />}
                      <input
                        type="checkbox"
                        checked={!!tabPerms[key]}
                        disabled={!canEdit}
                        onChange={(e) => setTabPerms((prev) => ({ ...prev, [key]: e.target.checked }))}
                        className="sr-only"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className={`text-sm font-medium transition-colors ${
                        tabPerms[key] ? 'text-gray-900 dark:text-brand-off-white' : 'text-gray-600 dark:text-gray-400'
                      }`}>{label}</span>
                      {subtabs.length > 0 && (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
                          {subtabs.join(' · ')}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Zero-tab warning */}
              {enabledCount === 0 && memberCount > 0 && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/40">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    This team has <strong>{memberCount}</strong> {memberCount === 1 ? 'member' : 'members'} but no tabs enabled.
                    Members with CREATOR, VIEWER, or MEMBER roles will see an empty sidebar.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Add Members Section */}
              {canEdit && (
                <div className="space-y-3">
                  {!showPicker ? (
                    <button
                      onClick={() => setShowPicker(true)}
                      disabled={availableToAdd.length === 0}
                      className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-brand-light-pink/30 hover:border-brand-light-pink/60 bg-brand-light-pink/5 hover:bg-brand-light-pink/10 text-brand-light-pink text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-brand-light-pink/30 disabled:hover:bg-brand-light-pink/5"
                    >
                      <UserPlus className="w-4 h-4" />
                      {availableToAdd.length === 0 ? 'All org members are in this team' : `Add Members (${availableToAdd.length} available)`}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-brand-light-pink/30 bg-white dark:bg-gray-800/80 overflow-hidden shadow-lg">
                      {/* Search Bar */}
                      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          ref={searchRef}
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          placeholder="Search by name, email, or role..."
                          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none"
                        />
                        {memberSearch && (
                          <button onClick={() => setMemberSearch('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Select/Deselect Bar */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${filteredAvailable.length} available`}
                        </span>
                        <div className="flex gap-2">
                          {filteredAvailable.length > 0 && (
                            <>
                              <button onClick={selectAll} className="text-xs text-brand-light-pink hover:text-brand-dark-pink font-medium transition-colors">
                                Select all
                              </button>
                              {selectedIds.size > 0 && (
                                <>
                                  <span className="text-gray-300 dark:text-gray-600">|</span>
                                  <button onClick={deselectAll} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors">
                                    Clear
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Member List */}
                      <div className="max-h-52 overflow-y-auto">
                        {filteredAvailable.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                            {memberSearch ? 'No members match your search' : 'No available members to add'}
                          </div>
                        ) : (
                          filteredAvailable.map((m) => {
                            const isSelected = selectedIds.has(m.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => toggleSelected(m.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                  isSelected
                                    ? 'bg-brand-light-pink/10 dark:bg-brand-dark-pink/15'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-brand-light-pink border-brand-light-pink'
                                    : 'border-gray-300 dark:border-gray-600'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <MemberAvatar src={m.imageUrl} name={m.name || m.email} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white truncate">{m.name || m.email}</p>
                                  {m.name && <p className="text-[11px] text-gray-400 truncate">{m.email}</p>}
                                </div>
                                <RoleBadge role={m.role} />
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <button
                          onClick={() => { setShowPicker(false); setMemberSearch(''); setSelectedIds(new Set()); }}
                          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddSelected}
                          disabled={selectedIds.size === 0 || addMember.isPending}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-light-pink hover:bg-brand-mid-pink disabled:opacity-40 text-white text-sm font-medium transition-colors"
                        >
                          {addMember.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5" />
                          )}
                          Add {selectedIds.size > 0 ? `${selectedIds.size} member${selectedIds.size > 1 ? 's' : ''}` : ''}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Current Members List */}
              <div className="space-y-1.5">
                {memberCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No members yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add members to this team to manage their permissions</p>
                  </div>
                ) : (
                  (team.members ?? []).map((m: OrgTeamMemberRecord) => {
                    const displayName = [m.teamMember.user.firstName, m.teamMember.user.lastName].filter(Boolean).join(' ') || m.teamMember.user.email || 'Unknown';
                    return (
                      <div
                        key={m.id}
                        className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MemberAvatar
                            src={m.teamMember.user.imageUrl}
                            name={displayName}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white truncate">{displayName}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{m.teamMember.user.email}</p>
                          </div>
                          <RoleBadge role={m.teamMember.role} />
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            disabled={removeMember.isPending}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all"
                            title="Remove from team"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {canEdit && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4">
            {/* Error / Success */}
            {saveError && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
                <button onClick={() => setSaveError('')} className="ml-auto text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {saveSuccess && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <p className="text-sm text-green-600 dark:text-green-400">Changes saved successfully</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              {confirmDelete ? (
                <div className="flex items-center gap-3 flex-1">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-sm text-red-500">Delete &quot;{team.name}&quot;?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors"
                  >
                    {deleteTeam.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-light-pink hover:bg-brand-mid-pink disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm hover:shadow-md"
              >
                {updateTeam.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {saveSuccess ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
