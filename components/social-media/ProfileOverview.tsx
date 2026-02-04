'use client';

import { useState, useEffect } from 'react';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';
import { useAuth } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { 
  User, 
  Edit3, 
  TrendingUp, 
  Heart, 
  Bookmark, 
  Image as ImageIcon,
  Users,
  Calendar,
  ExternalLink,
  Loader2,
  Sparkles,
  FolderOpen,
  Building2
} from 'lucide-react';

interface ProfileStats {
  totalPosts: number;
  totalLikes: number;
  totalBookmarks: number;
  lastPostDate?: string;
}

export default function ProfileOverview() {
  const { selectedProfile, isAllProfiles } = useInstagramProfile();
  const { userId } = useAuth();
  const params = useParams();
  const router = useRouter();
  const tenant = params.tenant as string;
  
  const [stats, setStats] = useState<ProfileStats>({
    totalPosts: 0,
    totalLikes: 0,
    totalBookmarks: 0,
  });
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userOrgRole, setUserOrgRole] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadCurrentUser();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedProfile?.organizationId && userId) {
      loadUserOrgRole();
    }
  }, [selectedProfile?.organizationId, userId]);

  useEffect(() => {
    if (selectedProfile && !isAllProfiles) {
      loadProfileStats();
    }
  }, [selectedProfile, isAllProfiles]);

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadUserOrgRole = async () => {
    if (!selectedProfile?.organizationId) return;
    
    try {
      const response = await fetch(`/api/organizations/${selectedProfile.organizationId}/role`);
      if (response.ok) {
        const data = await response.json();
        setUserOrgRole(data.role);
      }
    } catch (error) {
      console.error('Error loading user org role:', error);
    }
  };

  const loadProfileStats = async () => {
    if (!selectedProfile) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/feed/profile-stats?profileId=${selectedProfile.id}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading profile stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const isOwnProfile = selectedProfile?.clerkId === userId || selectedProfile?.user?.clerkId === userId;
  
  // Check if user can edit this profile (owner or org admin/manager)
  const canEditProfile = isOwnProfile || 
    (selectedProfile?.organizationId && ['OWNER', 'ADMIN', 'MANAGER'].includes(userOrgRole || ''));

  const handleViewProfile = () => {
    router.push(`/${tenant}/workspace/my-profile`);
  };

  const handleEditProfile = () => {
    router.push(`/${tenant}/workspace/my-influencers`);
  };

  const handleCreatePost = () => {
    // Trigger the create post modal
    window.dispatchEvent(new CustomEvent('openCreatePost'));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No posts yet';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Show "All Profiles" view
  if (isAllProfiles) {
    return (
      <div className="sticky top-6">
        <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/30 dark:via-gray-900 dark:to-teal-950/30 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-emerald-200/50 dark:border-emerald-800/50 p-6 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <FolderOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                All Profiles
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Viewing all your content
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Combined View</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Posts from all profiles
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
              <button
                onClick={() => router.push(`/${tenant}/workspace/my-influencers`)}
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 font-medium text-sm flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Manage Profiles
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No profile selected
  if (!selectedProfile) {
    return (
      <div className="sticky top-6">
        <div className="bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/30 dark:via-gray-900 dark:to-pink-950/30 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-purple-200/50 dark:border-purple-800/50 p-6 backdrop-blur-sm overflow-hidden text-center">
          <div className="mb-4 inline-block">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-500/30 dark:to-pink-500/30 flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            No Profile Selected
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select a profile from the sidebar to view details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-6">
      <div className="bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/30 dark:via-gray-900 dark:to-pink-950/30 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-purple-200/50 dark:border-purple-800/50 p-6 backdrop-blur-sm overflow-hidden">
        {/* Profile Header */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-purple-200/50 dark:border-purple-800/50">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-purple-200 dark:ring-purple-800 shadow-lg">
              {selectedProfile.profileImageUrl ? (
                <img
                  src={selectedProfile.profileImageUrl}
                  alt={selectedProfile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            )}
            {!isOwnProfile && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                <Users className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {selectedProfile.name}
              </h2>
              {selectedProfile.organization && (
                <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              )}
            </div>
            {selectedProfile.instagramUsername && (
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">
                @{selectedProfile.instagramUsername}
              </p>
            )}
            {!isOwnProfile && selectedProfile.user && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Shared by {selectedProfile.user.firstName || selectedProfile.user.email?.split('@')[0]}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-purple-200/30 dark:border-purple-800/30">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Posts</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalPosts}
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-purple-200/30 dark:border-purple-800/30">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Likes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalLikes}
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-purple-200/30 dark:border-purple-800/30">
              <div className="flex items-center gap-2 mb-1">
                <Bookmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Saved</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalBookmarks}
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-purple-200/30 dark:border-purple-800/30">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Last Post</span>
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">
                {formatDate(stats.lastPostDate)}
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={handleCreatePost}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 font-medium text-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Create Post
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleViewProfile}
              className="px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-300 border border-purple-200 dark:border-purple-800 font-medium text-sm flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View
            </button>

            {canEditProfile && (
              <button
                onClick={handleEditProfile}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-300 border border-purple-200 dark:border-purple-800 font-medium text-sm flex items-center justify-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Engagement Rate (if posts exist) */}
        {stats.totalPosts > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-200/50 dark:border-purple-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Avg. Engagement</span>
              </div>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {(stats.totalLikes / stats.totalPosts).toFixed(1)} likes/post
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
