// app\(dashboard)\workspace\instagram-staging\page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Instagram, Calendar, GitBranch, Clock, Sparkles, Activity, Hash, ListChecks, ImageIcon, User, ChevronDown, Settings, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import InstagramStagingTool from '@/components/social-media/InstagramStagingTool';
import CalendarView from '@/components/social-media/CalendarView';
import ContentPipelineView from '@/components/social-media/ContentPipelineView';
import StoriesPlannerView from '@/components/social-media/StoriesPlannerView';
import ReelsPlannerView from '@/components/social-media/ReelsPlannerView';
import FeedPostPlannerView from '@/components/social-media/FeedPostPlannerView';
import ReelsFormulaView from '@/components/social-media/ReelsFormulaView';
import PerformanceTrackerView from '@/components/social-media/PerformanceTrackerView';
import HashtagBankView from '@/components/social-media/HashtagBankView';
import WorkflowChecklistView from '@/components/social-media/WorkflowChecklistView';

interface Profile {
  id: string;
  name: string;
  instagramUsername?: string;
  isDefault: boolean;
}

const tabs = [
  { id: 'instagram-staging', label: 'Instagram Staging', icon: Instagram },
  { id: 'calendar', label: 'Calendar View', icon: Calendar },
  { id: 'pipeline', label: 'Content Pipeline', icon: GitBranch },
  { id: 'stories', label: 'Stories Planner', icon: Clock },
  { id: 'reels', label: 'Reels Planner', icon: Sparkles },
  { id: 'feed-posts', label: 'Feed Posts', icon: ImageIcon },
  { id: 'performance', label: 'Performance', icon: Activity },
  { id: 'formulas', label: 'Reels Formulas', icon: Sparkles },
  { id: 'hashtags', label: 'Hashtag Bank', icon: Hash },
  { id: 'workflow', label: 'Workflow', icon: ListChecks },
];

function SocialMediaContent() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const postIdFromUrl = searchParams.get('post');
  const tabFromUrl = searchParams.get('tab');
  const dateFromUrl = searchParams.get('date');
  const [activeTab, setActiveTab] = useState('instagram-staging');
  const [profileId, setProfileId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedInstagramProfileId');
    }
    return null;
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
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

  // Auto-switch tabs based on URL parameters
  useEffect(() => {
    if (postIdFromUrl) {
      setActiveTab('instagram-staging');
    } else if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    } else if (dateFromUrl) {
      setActiveTab('stories');
    }
  }, [postIdFromUrl, tabFromUrl, dateFromUrl]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetchProfiles();
  }, [isLoaded, user]);

  const fetchProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const response = await fetch("/api/instagram/profiles");
      const data = await response.json();
      
      if (data.profiles) {
        setProfiles(data.profiles);
        
        // Auto-select profile if none selected
        if (!profileId && data.profiles.length > 0) {
          const defaultProfile = data.profiles.find((p: Profile) => p.isDefault);
          const selectedProfile = defaultProfile || data.profiles[0];
          setProfileId(selectedProfile.id);
          localStorage.setItem('selectedInstagramProfileId', selectedProfile.id);
        }
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleProfileSelect = (newProfileId: string) => {
    setProfileId(newProfileId);
    localStorage.setItem('selectedInstagramProfileId', newProfileId);
    setShowProfileDropdown(false);
    // Trigger storage event for other components to pick up the change
    window.dispatchEvent(new Event('storage'));
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
        // Update existing profile
        const response = await fetch(`/api/instagram/profiles/${editingProfile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileForm),
        });

        if (!response.ok) throw new Error('Failed to update profile');
      } else {
        // Create new profile
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

  const deleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile? All associated posts will be deleted.')) {
      return;
    }

    try {
      setDeletingProfileId(profileId);
      const response = await fetch(`/api/instagram/profiles/${profileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete profile');

      await fetchProfiles();
      
      // If deleted profile was selected, clear selection
      if (profileId === profileId) {
        setProfileId(null);
        localStorage.removeItem('selectedInstagramProfileId');
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
      alert('Failed to delete profile. Please try again.');
    } finally {
      setDeletingProfileId(null);
    }
  };

  const selectedProfile = profiles.find(p => p.id === profileId);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'instagram-staging':
        return <InstagramStagingTool highlightPostId={postIdFromUrl} />;
      case 'calendar':
        return <CalendarView profileId={profileId} />;
      case 'pipeline':
        return <ContentPipelineView profileId={profileId} />;
      case 'formulas':
        return <ReelsFormulaView />;
      case 'stories':
        return <StoriesPlannerView profileId={profileId} />;
      case 'reels':
        return <ReelsPlannerView profileId={profileId} />;
      case 'feed-posts':
        return <FeedPostPlannerView profileId={profileId} />;
      case 'performance':
        return <PerformanceTrackerView profileId={profileId} />;
      case 'hashtags':
        return <HashtagBankView />;
      case 'workflow':
        return <WorkflowChecklistView profileId={profileId} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Instagram Staging</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Manage your instagram content and posting schedule</p>
          </div>

          {/* Profile Selector */}
          {!loadingProfiles && profiles.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg shadow-lg transition-all duration-200 text-sm font-medium"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{selectedProfile?.name || 'Select Profile'}</span>
                <ChevronDown className="w-4 h-4" />
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
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                      <button
                        onClick={openManageModal}
                        className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="font-medium">Manage Profiles</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="border-b border-gray-200/50 dark:border-gray-700/30">
          <nav className="flex gap-4 sm:gap-6 md:gap-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  } whitespace-nowrap border-b-2 py-3 sm:py-4 px-1 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 active:scale-95`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{tab.label}</span>
                  <span className="xs:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {renderTabContent()}
        </div>
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
    </div>
  );
}

export default function SocialMediaPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SocialMediaContent />
    </Suspense>
  );
}