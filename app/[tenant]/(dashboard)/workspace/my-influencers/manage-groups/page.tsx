'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Palette,
  Check,
  Sparkles,
  Search,
  MoreVertical,
  UserPlus,
  LayoutGrid,
  TrendingUp,
  Star,
} from 'lucide-react';
import {
  useProfileGroups,
  useCreateProfileGroup,
  useUpdateProfileGroup,
  useDeleteProfileGroup,
  useAddProfilesToGroup,
  useRemoveProfileFromGroup,
} from '@/lib/hooks/useProfileGroups.query';
import { useInstagramProfiles, InstagramProfile } from '@/lib/hooks/useInstagramProfiles.query';
import { toast } from 'sonner';

const GROUP_COLORS = [
  { name: 'Pink', value: '#F774B9', class: 'bg-brand-light-pink' },
  { name: 'Blue', value: '#5DC3F8', class: 'bg-brand-blue' },
  { name: 'Dark Pink', value: '#E1518E', class: 'bg-brand-dark-pink' },
  { name: 'Purple', value: '#A855F7', class: 'bg-purple-500' },
  { name: 'Green', value: '#10B981', class: 'bg-emerald-500' },
  { name: 'Orange', value: '#F97316', class: 'bg-orange-500' },
  { name: 'Red', value: '#EF4444', class: 'bg-red-500' },
  { name: 'Yellow', value: '#F59E0B', class: 'bg-amber-500' },
  { name: 'Cyan', value: '#06B6D4', class: 'bg-cyan-500' },
  { name: 'Indigo', value: '#6366F1', class: 'bg-indigo-500' },
];

const GROUP_ICONS = [
  { name: 'Folder', icon: '📁' },
  { name: 'Star', icon: '⭐' },
  { name: 'Heart', icon: '❤️' },
  { name: 'Fire', icon: '🔥' },
  { name: 'Crown', icon: '👑' },
  { name: 'Diamond', icon: '💎' },
  { name: 'Sparkles', icon: '✨' },
  { name: 'Rocket', icon: '🚀' },
  { name: 'Target', icon: '🎯' },
  { name: 'Briefcase', icon: '💼' },
];

export default function ManageGroupsPage() {
  const router = useRouter();
  const { data: groups, isLoading: loadingGroups } = useProfileGroups();
  const { data: profiles, isLoading: loadingProfiles } = useInstagramProfiles();
  
  // Mutations
  const createGroup = useCreateProfileGroup();
  const updateGroup = useUpdateProfileGroup();
  const deleteGroup = useDeleteProfileGroup();
  const addProfilesToGroup = useAddProfilesToGroup();
  const removeProfileFromGroup = useRemoveProfileFromGroup();

  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddProfilesModal, setShowAddProfilesModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);

  // Update selected group when groups data changes (after mutations)
  useEffect(() => {
    if (selectedGroup && groups) {
      const updatedGroup = groups.find(g => g.id === selectedGroup.id);
      if (updatedGroup) {
        setSelectedGroup(updatedGroup);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const handleCreateGroup = () => {
    setSelectedGroup(null);
    setShowCreateModal(true);
  };

  const handleEditGroup = (group: any) => {
    setSelectedGroup(group);
    setShowEditModal(true);
  };

  const handleDeleteGroup = (group: any) => {
    setSelectedGroup(group);
    setShowDeleteModal(true);
  };

  const handleSelectGroup = (group: any) => {
    setSelectedGroup(group);
  };

  const handleAddProfiles = (group: any) => {
    setSelectedGroup(group);
    setShowAddProfilesModal(true);
  };

  const handleAddProfilesToGroup = async (groupId: string) => {
    if (selectedProfiles.length === 0) {
      toast.error('Please select at least one profile');
      return;
    }

    try {
      await addProfilesToGroup.mutateAsync({
        groupId,
        profileIds: selectedProfiles,
      });
      
      toast.success(`Added ${selectedProfiles.length} profile(s) to group`);
      
      // Update selected group to reflect the additions
      if (selectedGroup?.id === groupId && profiles) {
        const addedProfiles = profiles.filter((p: InstagramProfile) => 
          selectedProfiles.includes(p.id)
        );
        const newMembers = addedProfiles.map(profile => ({
          profile,
          groupId,
          profileId: profile.id,
          createdAt: new Date().toISOString(),
        }));
        setSelectedGroup({
          ...selectedGroup,
          members: [...selectedGroup.members, ...newMembers]
        });
      }
      
      setSelectedProfiles([]);
      setShowAddProfilesModal(false);
    } catch (error) {
      toast.error('Failed to add profiles to group');
    }
  };

  const handleRemoveProfile = async (groupId: string, profileId: string) => {
    try {
      await removeProfileFromGroup.mutateAsync({ groupId, profileId });
      toast.success('Profile removed from group');
      
      // Update selected group to reflect the removal
      if (selectedGroup?.id === groupId) {
        setSelectedGroup({
          ...selectedGroup,
          members: selectedGroup.members.filter((m: any) => m.profile.id !== profileId)
        });
      }
    } catch (error) {
      toast.error('Failed to remove profile from group');
    }
  };

  const getProfilesInGroup = (groupId: string) => {
    const group = groups?.find(g => g.id === groupId);
    if (!group) return [];
    return group.members.map(m => m.profile);
  };

  const getAvailableProfiles = (groupId: string) => {
    if (!profiles) return [];
    const profilesInGroup = getProfilesInGroup(groupId);
    const profileIdsInGroup = new Set(profilesInGroup.map(p => p.id));
    return profiles.filter((p: InstagramProfile) => !profileIdsInGroup.has(p.id));
  };

  // Filter groups by search
  const filteredGroups = groups?.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Calculate stats
  const totalProfiles = profiles?.length || 0;
  const totalGroups = groups?.length || 0;
  const totalMemberships = groups?.reduce((sum, g) => sum + g.members.length, 0) || 0;

  if (loadingGroups || loadingProfiles) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-brand-mid-pink mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[85vh] flex flex-col bg-brand-off-white dark:bg-[#0a0a0f] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white/90 dark:bg-[#1a1625]/90 backdrop-blur-xl border-b border-brand-mid-pink/20">
        <div className="px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-brand-light-pink/10 dark:hover:bg-brand-light-pink/20 rounded-xl transition-all"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-mid-pink via-brand-light-pink to-brand-blue bg-clip-text text-transparent">
                  Profile Groups
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Organize and manage your influencer collections
                </p>
              </div>
            </div>
            
            <button
              onClick={handleCreateGroup}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-xl hover:shadow-xl hover:shadow-brand-mid-pink/30 hover:-translate-y-0.5 transition-all duration-300 font-medium"
            >
              <Plus className="h-5 w-5" />
              New Group
            </button>
          </div>

          {/* Stats Bar */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-brand-light-pink/10 to-brand-light-pink/5 dark:from-brand-light-pink/20 dark:to-brand-light-pink/10 rounded-xl p-4 border border-brand-light-pink/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Groups</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalGroups}</p>
                </div>
                <div className="w-12 h-12 bg-brand-light-pink/20 rounded-xl flex items-center justify-center">
                  <LayoutGrid className="h-6 w-6 text-brand-dark-pink" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-brand-blue/10 to-brand-blue/5 dark:from-brand-blue/20 dark:to-brand-blue/10 rounded-xl p-4 border border-brand-blue/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Profiles</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalProfiles}</p>
                </div>
                <div className="w-12 h-12 bg-brand-blue/20 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-brand-blue" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-brand-mid-pink/10 to-brand-mid-pink/5 dark:from-brand-mid-pink/20 dark:to-brand-mid-pink/10 rounded-xl p-4 border border-brand-mid-pink/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Memberships</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalMemberships}</p>
                </div>
                <div className="w-12 h-12 bg-brand-mid-pink/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-brand-dark-pink" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Split Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Groups List */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-[#1a1625] border-r border-brand-mid-pink/10 dark:border-brand-mid-pink/20 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-brand-mid-pink/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groups..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-[#0a0a0f] border border-brand-mid-pink/10 dark:border-brand-mid-pink/20 rounded-xl focus:ring-2 focus:ring-brand-mid-pink focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Groups List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-12">
                <Folder className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {searchQuery ? 'No groups found' : 'No groups yet'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleCreateGroup}
                    className="mt-4 text-sm text-brand-mid-pink hover:text-brand-dark-pink font-medium"
                  >
                    Create your first group
                  </button>
                )}
              </div>
            ) : (
              filteredGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    selectedGroup?.id === group.id
                      ? 'bg-gradient-to-r from-brand-light-pink/20 to-brand-blue/20 border-brand-mid-pink/30 border-2'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/50 border border-transparent'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: group.color || GROUP_COLORS[0].value }}
                  >
                    {group.icon || '📁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                      {group.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {group.members.length} {group.members.length === 1 ? 'profile' : 'profiles'}
                    </p>
                  </div>
                  {selectedGroup?.id === group.id && (
                    <ChevronRight className="h-4 w-4 text-brand-mid-pink flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Group Details */}
        <div className="flex-1 bg-white dark:bg-[#1a1625] flex flex-col overflow-hidden">
          {!selectedGroup ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md px-6">
                <div className="w-20 h-20 bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-10 w-10 text-brand-mid-pink" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Select a Group
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose a group from the sidebar to view and manage its profiles
                </p>
                {totalGroups === 0 && (
                  <button
                    onClick={handleCreateGroup}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-xl hover:shadow-xl hover:shadow-brand-mid-pink/30 transition-all font-medium"
                  >
                    <Plus className="h-5 w-5" />
                    Create First Group
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Group Header */}
              <div className="flex-shrink-0 p-6 border-b border-brand-mid-pink/10">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg flex-shrink-0"
                      style={{ backgroundColor: selectedGroup.color || GROUP_COLORS[0].value }}
                    >
                      {selectedGroup.icon || '📁'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                        {selectedGroup.name}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedGroup.members.length} {selectedGroup.members.length === 1 ? 'profile' : 'profiles'} in this group
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddProfiles(selectedGroup)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-lg hover:shadow-lg hover:shadow-brand-mid-pink/30 transition-all text-sm font-medium"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Profiles
                    </button>
                    <button
                      onClick={() => handleEditGroup(selectedGroup)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                      title="Edit group"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(selectedGroup)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title="Delete group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Profiles List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {selectedGroup.members.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-sm">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No profiles yet
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Start adding profiles to this group to get organized
                      </p>
                      <button
                        onClick={() => handleAddProfiles(selectedGroup)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
                      >
                        <Plus className="h-4 w-4" />
                        Add Profiles
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedGroup.members.map((member: any) => (
                      <div
                        key={member.profile.id}
                        className="group relative bg-white dark:bg-[#0a0a0f] rounded-xl p-4 border border-brand-mid-pink/10 dark:border-brand-mid-pink/20 hover:border-brand-mid-pink/30 hover:shadow-lg hover:shadow-brand-mid-pink/10 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {member.profile.profileImageUrl ? (
                            <img
                              src={member.profile.profileImageUrl}
                              alt={member.profile.name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-brand-light-pink/30"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 flex items-center justify-center">
                              <Users className="h-6 w-6 text-brand-mid-pink" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">
                              {member.profile.name}
                            </p>
                            {member.profile.instagramUsername && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                                @{member.profile.instagramUsername}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveProfile(selectedGroup.id, member.profile.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Remove from group"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateEditGroupModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            // The new group will appear in the sidebar after refetch
          }}
        />
      )}
      {showEditModal && selectedGroup && (
        <CreateEditGroupModal
          mode="edit"
          group={selectedGroup}
          onClose={() => {
            setShowEditModal(false);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            // Refresh the selected group from the updated groups list
            if (selectedGroup && groups) {
              const updatedGroup = groups.find(g => g.id === selectedGroup.id);
              if (updatedGroup) {
                setSelectedGroup(updatedGroup);
              }
            }
          }}
        />
      )}
      {showDeleteModal && selectedGroup && (
        <DeleteGroupModal
          group={selectedGroup}
          onClose={() => {
            setShowDeleteModal(false);
          }}
          onSuccess={() => {
            setShowDeleteModal(false);
            setSelectedGroup(null);
          }}
        />
      )}
      {showAddProfilesModal && selectedGroup && (
        <AddProfilesModal
          group={selectedGroup}
          availableProfiles={getAvailableProfiles(selectedGroup.id)}
          selectedProfiles={selectedProfiles}
          setSelectedProfiles={setSelectedProfiles}
          onClose={() => {
            setShowAddProfilesModal(false);
            setSelectedProfiles([]);
          }}
          onAdd={handleAddProfilesToGroup}
          isAdding={addProfilesToGroup.isPending}
        />
      )}
    </div>
  );
}

// CreateEditGroupModal Component
function CreateEditGroupModal({
  mode,
  group,
  onClose,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  group?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const createGroup = useCreateProfileGroup();
  const updateGroup = useUpdateProfileGroup();

  const [formData, setFormData] = useState({
    name: group?.name || '',
    color: group?.color || GROUP_COLORS[0].value,
    icon: group?.icon || GROUP_ICONS[0].icon,
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        await createGroup.mutateAsync({
          name: formData.name.trim(),
          color: formData.color,
          icon: formData.icon,
        });
        toast.success('Group created successfully!');
      } else {
        await updateGroup.mutateAsync({
          groupId: group.id,
          data: {
            name: formData.name.trim(),
            color: formData.color,
            icon: formData.icon,
          },
        });
        toast.success('Group updated successfully!');
      }
      onSuccess();
    } catch (error) {
      toast.error(`Failed to ${mode} group`);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl w-full max-w-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#1a1625] border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-brand-light-pink to-brand-blue rounded-xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {mode === 'create' ? 'Create New Group' : 'Edit Group'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {mode === 'create' ? 'Organize your profiles with a custom group' : 'Update group details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Top Performers, New Models, VIP..."
              className="w-full px-4 py-3 bg-white dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:ring-2 focus:ring-brand-mid-pink focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500"
              autoFocus
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Group Color
            </label>
            <div className="flex flex-wrap gap-3">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`relative w-14 h-14 rounded-xl ${color.class} transition-all hover:scale-110 ${
                    formData.color === color.value ? 'ring-4 ring-brand-mid-pink ring-offset-2 dark:ring-offset-[#1a1625] scale-110' : ''
                  }`}
                  title={color.name}
                >
                  {formData.color === color.value && (
                    <Check className="h-6 w-6 text-white absolute inset-0 m-auto drop-shadow-lg" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Group Icon
            </label>
            <div className="flex flex-wrap gap-3">
              {GROUP_ICONS.map((iconOption) => (
                <button
                  key={iconOption.icon}
                  onClick={() => setFormData({ ...formData, icon: iconOption.icon })}
                  className={`w-16 h-16 text-3xl rounded-xl border-2 transition-all hover:scale-110 ${
                    formData.icon === iconOption.icon
                      ? 'border-brand-mid-pink bg-brand-mid-pink/10 scale-110'
                      : 'border-[#EC67A1]/20 dark:border-[#EC67A1]/30 hover:border-brand-mid-pink/50'
                  }`}
                  title={iconOption.name}
                >
                  {iconOption.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-6 bg-gradient-to-br from-brand-light-pink/5 to-brand-blue/5 dark:from-brand-light-pink/10 dark:to-brand-blue/10 rounded-xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Preview</p>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg"
                style={{ backgroundColor: formData.color }}
              >
                {formData.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {formData.name || 'Group Name'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">0 profiles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-[#1a1625] border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.name.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-xl hover:shadow-xl hover:shadow-brand-mid-pink/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Creating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {mode === 'create' ? 'Create Group' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// DeleteGroupModal Component
function DeleteGroupModal({
  group,
  onClose,
  onSuccess,
}: {
  group: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteGroup = useDeleteProfileGroup();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteGroup.mutateAsync(group.id);
      toast.success('Group deleted successfully!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to delete group');
      setDeleting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl w-full max-w-md border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center mb-4">
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Delete Group?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">"{group.name}"</span>? 
            This action cannot be undone. Profiles will not be deleted, only removed from this group.
          </p>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50 font-medium"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Group
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// AddProfilesModal Component
function AddProfilesModal({
  group,
  availableProfiles,
  selectedProfiles,
  setSelectedProfiles,
  onClose,
  onAdd,
  isAdding,
}: {
  group: any;
  availableProfiles: InstagramProfile[];
  selectedProfiles: string[];
  setSelectedProfiles: (profiles: string[]) => void;
  onClose: () => void;
  onAdd: (groupId: string) => void;
  isAdding: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const filteredProfiles = availableProfiles.filter(profile =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleProfile = (profileId: string) => {
    if (selectedProfiles.includes(profileId)) {
      setSelectedProfiles(selectedProfiles.filter(id => id !== profileId));
    } else {
      setSelectedProfiles([...selectedProfiles, profileId]);
    }
  };

  const selectAll = () => {
    setSelectedProfiles(filteredProfiles.map(p => p.id));
  };

  const deselectAll = () => {
    setSelectedProfiles([]);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl w-full max-w-3xl border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1a1625] border-b border-brand-mid-pink/10 dark:border-brand-mid-pink/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: group.color }}
              >
                {group.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Add Profiles to {group.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select profiles to add to this group
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Search and Actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search profiles..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-[#0a0a0f] border border-brand-mid-pink/10 dark:border-brand-mid-pink/20 rounded-xl focus:ring-2 focus:ring-brand-mid-pink focus:border-transparent text-sm"
              />
            </div>
            <button
              onClick={selectAll}
              className="px-3 py-2.5 text-sm text-brand-mid-pink hover:bg-brand-light-pink/10 rounded-xl transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Clear
            </button>
          </div>

          {selectedProfiles.length > 0 && (
            <div className="mt-3 px-4 py-2 bg-brand-light-pink/10 dark:bg-brand-light-pink/20 rounded-lg border border-brand-light-pink/30">
              <p className="text-sm text-brand-dark-pink dark:text-brand-light-pink font-medium">
                {selectedProfiles.length} {selectedProfiles.length === 1 ? 'profile' : 'profiles'} selected
              </p>
            </div>
          )}
        </div>

        {/* Profiles List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {availableProfiles.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  All profiles are already in this group
                </p>
              </div>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Search className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  No profiles found
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProfiles.map((profile) => (
                <label
                  key={profile.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedProfiles.includes(profile.id)
                      ? 'bg-brand-light-pink/10 border-brand-mid-pink'
                      : 'border-brand-mid-pink/10 dark:border-brand-mid-pink/20 hover:border-brand-mid-pink/30 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProfiles.includes(profile.id)}
                    onChange={() => toggleProfile(profile.id)}
                    className="rounded border-gray-300 text-brand-mid-pink focus:ring-brand-mid-pink"
                  />
                  {profile.profileImageUrl ? (
                    <img
                      src={profile.profileImageUrl}
                      alt={profile.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-brand-light-pink/30"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 flex items-center justify-center">
                      <Users className="h-6 w-6 text-brand-mid-pink" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {profile.name}
                    </p>
                    {profile.username && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                        @{profile.username}
                      </p>
                    )}
                  </div>
                  {selectedProfiles.includes(profile.id) && (
                    <div className="w-6 h-6 bg-brand-mid-pink rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1a1625] border-t border-brand-mid-pink/10 dark:border-brand-mid-pink/20 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isAdding}
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onAdd(group.id)}
            disabled={isAdding || selectedProfiles.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-xl hover:shadow-xl hover:shadow-brand-mid-pink/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Add {selectedProfiles.length} {selectedProfiles.length === 1 ? 'Profile' : 'Profiles'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
