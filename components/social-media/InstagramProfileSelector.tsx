'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, ChevronDown, Settings, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useInstagramProfile, Profile } from '@/hooks/useInstagramProfile';

interface InstagramProfileSelectorProps {
  compact?: boolean;
  showManageButton?: boolean;
  className?: string;
}

export default function InstagramProfileSelector({ 
  compact = false, 
  showManageButton = true,
  className = ''
}: InstagramProfileSelectorProps) {
  const { 
    profileId, 
    setProfileId, 
    profiles, 
    selectedProfile, 
    loadingProfiles,
    fetchProfiles 
  } = useInstagramProfile();
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    instagramUsername: '',
    isDefault: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleProfileSelect = (newProfileId: string) => {
    setProfileId(newProfileId);
    setShowProfileDropdown(false);
  };

  const openManageModal = () => {
    setShowProfileDropdown(false);
    setShowManageModal(true);
  };

  const openProfileForm = (profile?: Profile) => {
    if (profile) {
      setEditingProfile(profile);
      setProfileForm({
        name: profile.name,
        instagramUsername: profile.instagramUsername || '',
        isDefault: profile.isDefault,
      });
    } else {
      setEditingProfile(null);
      setProfileForm({
        name: '',
        instagramUsername: '',
        isDefault: false,
      });
    }
    setShowProfileForm(true);
  };

  const closeProfileForm = () => {
    setShowProfileForm(false);
    setEditingProfile(null);
    setProfileForm({
      name: '',
      instagramUsername: '',
      isDefault: false,
    });
  };

  const saveProfile = async () => {
    if (!profileForm.name.trim()) {
      alert('Profile name is required');
      return;
    }

    try {
      if (editingProfile) {
        const response = await fetch(`/api/instagram/profiles/${editingProfile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileForm),
        });

        if (!response.ok) throw new Error('Failed to update profile');
      } else {
        const response = await fetch('/api/instagram/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileForm),
        });

        if (!response.ok) throw new Error('Failed to create profile');
      }

      await fetchProfiles();
      closeProfileForm();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const deleteProfile = async (profileIdToDelete: string) => {
    if (!confirm('Are you sure you want to delete this profile? All associated posts will be deleted.')) {
      return;
    }

    try {
      setDeletingProfileId(profileIdToDelete);
      const response = await fetch(`/api/instagram/profiles/${profileIdToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete profile');

      await fetchProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
      alert('Failed to delete profile. Please try again.');
    } finally {
      setDeletingProfileId(null);
    }
  };

  if (loadingProfiles) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse ${className}`}>
        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <div className="w-20 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <button
        onClick={() => {
          setShowManageModal(true);
          openProfileForm();
        }}
        className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg shadow-lg transition-all duration-200 text-sm font-medium ${className}`}
      >
        <Plus className="w-4 h-4" />
        <span>Create Profile</span>
      </button>
    );
  }

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          className={`flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg shadow-lg transition-all duration-200 font-medium ${
            compact ? 'px-2 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          }`}
        >
          <User className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          <span className={compact ? 'max-w-[100px] truncate' : 'hidden sm:inline'}>
            {selectedProfile?.name || 'Select Profile'}
          </span>
          <ChevronDown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        </button>

        {showProfileDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-2">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileSelect(profile.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    profile.id === profileId
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="font-medium">{profile.name}</div>
                  {profile.instagramUsername && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      @{profile.instagramUsername}
                    </div>
                  )}
                  {profile.isDefault && (
                    <div className="text-xs text-purple-600 dark:text-purple-400">Default</div>
                  )}
                </button>
              ))}
              {showManageButton && (
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                  <button
                    onClick={openManageModal}
                    className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="font-medium">Manage Profiles</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manage Profiles Modal */}
      {showManageModal && mounted && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-6 h-6 text-purple-500" />
                Manage Profiles
              </h2>
              <button
                onClick={() => setShowManageModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              <button
                onClick={() => openProfileForm()}
                className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add New Profile
              </button>

              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {profile.name}
                          </h3>
                          {profile.isDefault && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        {profile.instagramUsername && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            @{profile.instagramUsername}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openProfileForm(profile)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit profile"
                        >
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => deleteProfile(profile.id)}
                          disabled={deletingProfileId === profile.id}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete profile"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Profile Form Modal */}
      {showProfileForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingProfile ? 'Edit Profile' : 'Add New Profile'}
              </h2>
              <button
                onClick={closeProfileForm}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Profile Name *
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="e.g., Main Account"
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instagram Username
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg text-gray-600 dark:text-gray-400">
                    @
                  </span>
                  <input
                    type="text"
                    value={profileForm.instagramUsername}
                    onChange={(e) => setProfileForm({ ...profileForm, instagramUsername: e.target.value })}
                    placeholder="username"
                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-r-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={profileForm.isDefault}
                  onChange={(e) => setProfileForm({ ...profileForm, isDefault: e.target.checked })}
                  className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Set as default profile
                </label>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeProfileForm}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={!profileForm.name.trim()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {editingProfile ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
