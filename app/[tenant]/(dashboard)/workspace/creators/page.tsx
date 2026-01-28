'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Instagram, 
  Search, 
  Link2, 
  X, 
  ExternalLink, 
  Share2, 
  Building2,
  MoreHorizontal,
  User,
  Sparkles,
  Image as ImageIcon,
  Check,
  Users,
  Star,
  Grid3X3,
  List
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';

interface LinkedLoRA {
  id: string;
  displayName: string;
  thumbnailUrl: string | null;
  fileName: string;
}

interface CreatorOwner {
  id: string;
  clerkId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  email: string | null;
}

interface Creator {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  instagramUsername: string | null;
  instagramAccountId: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
  linkedLoRAs?: LinkedLoRA[];
  _count?: {
    posts: number;
    feedPosts: number;
  };
  organization?: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  user?: CreatorOwner;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'mine' | 'shared';

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLinkLoRAModal, setShowLinkLoRAModal] = useState(false);
  const [showAllLoRAsPopup, setShowAllLoRAsPopup] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { userId } = useAuth();

  useEffect(() => {
    loadCreators();
  }, []);

  const loadCreators = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/instagram/profiles');
      if (response.ok) {
        const data = await response.json();
        const profilesList = data.profiles || data;
        setCreators(Array.isArray(profilesList) ? profilesList : []);
      } else {
        toast.error('Failed to load creators');
      }
    } catch (error) {
      console.error('Error loading creators:', error);
      toast.error('Failed to load creators');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleEdit = (creator: Creator) => {
    setSelectedCreator(creator);
    setShowEditModal(true);
  };

  const handleDelete = (creator: Creator) => {
    setSelectedCreator(creator);
    setShowDeleteModal(true);
  };

  const handleLinkLoRA = (creator: Creator) => {
    setSelectedCreator(creator);
    setShowLinkLoRAModal(true);
  };

  const handleSetDefault = async (creatorId: string) => {
    try {
      const response = await fetch(`/api/instagram/profiles/${creatorId}/default`, {
        method: 'PATCH',
      });

      if (response.ok) {
        toast.success('Default creator updated');
        loadCreators();
      } else {
        toast.error('Failed to update default creator');
      }
    } catch (error) {
      console.error('Error updating default:', error);
      toast.error('Failed to update default creator');
    }
  };

  const handleToggleShare = async (creator: Creator) => {
    const isCurrentlyShared = !!creator.organizationId;

    try {
      const response = await fetch(`/api/instagram/profiles/${creator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareWithOrganization: !isCurrentlyShared,
        }),
      });

      if (response.ok) {
        toast.success(isCurrentlyShared ? 'Profile unshared from organization' : 'Profile shared with organization');
        loadCreators();
      } else {
        toast.error('Failed to update sharing');
      }
    } catch (error) {
      console.error('Error toggling share:', error);
      toast.error('Failed to update sharing');
    }
  };

  const getOwnerDisplayName = (creator: Creator) => {
    if (!creator.user) return 'Unknown';
    if (creator.user.name) return creator.user.name;
    if (creator.user.firstName || creator.user.lastName) {
      return `${creator.user.firstName || ''} ${creator.user.lastName || ''}`.trim();
    }
    return creator.user.email?.split('@')[0] || 'Unknown';
  };

  const isOwnProfile = (creator: Creator) => creator.clerkId === userId;

  const filteredCreators = creators.filter(creator => {
    const matchesSearch = creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.instagramUsername?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getOwnerDisplayName(creator).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterMode === 'all' 
      ? true 
      : filterMode === 'mine' 
        ? isOwnProfile(creator)
        : !isOwnProfile(creator);
    
    return matchesSearch && matchesFilter;
  });

  const myCreatorsCount = creators.filter(c => isOwnProfile(c)).length;
  const sharedCreatorsCount = creators.filter(c => !isOwnProfile(c)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-blue-950/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Header */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 md:p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtMnYtMmgydi0yaDJ2MmgydjJoLTJ2MmgydjRoLTJ2Mmgtdi0yem0wLThoMnYyaC0ydi0yem0tNCAyaDJ2MmgtMnYtMnptMCA0aDJ2MmgtMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Users className="w-6 h-6" />
                  </div>
                  Creator Profiles
                </h1>
                <p className="text-purple-100 text-sm md:text-base max-w-xl">
                  Manage your creator identities, link LoRA models, and organize your content generation workflow.
                </p>
              </div>
              <button
                onClick={handleCreate}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-purple-700 font-semibold rounded-xl hover:bg-purple-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                New Creator
              </button>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <p className="text-purple-200 text-xs font-medium">Total Creators</p>
                <p className="text-white text-xl font-bold">{creators.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <p className="text-purple-200 text-xs font-medium">My Profiles</p>
                <p className="text-white text-xl font-bold">{myCreatorsCount}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <p className="text-purple-200 text-xs font-medium">Shared</p>
                <p className="text-white text-xl font-bold">{sharedCreatorsCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-800 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            {/* Search */}
            <div className="relative flex-1 w-full lg:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, username, or owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              {/* Filter Tabs */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 flex-1 lg:flex-initial">
                {[
                  { key: 'all', label: 'All', count: creators.length },
                  { key: 'mine', label: 'Mine', count: myCreatorsCount },
                  { key: 'shared', label: 'Shared', count: sharedCreatorsCount },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setFilterMode(filter.key as FilterMode)}
                    className={`flex-1 lg:flex-initial px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterMode === filter.key
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {filter.label}
                    <span className={`ml-1.5 text-xs ${
                      filterMode === filter.key ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                    }`}>
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-purple-200 dark:border-purple-900"></div>
              <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-transparent border-t-purple-600 animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading creators...</p>
          </div>
        ) : filteredCreators.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center">
              <Users className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery || filterMode !== 'all' ? 'No creators found' : 'No creators yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {searchQuery
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first creator profile to start generating content with custom LoRA models'}
            </p>
            {!searchQuery && filterMode === 'all' && (
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-purple-500/25"
              >
                <Plus className="w-5 h-5" />
                Create Your First Creator
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCreators.map((creator) => (
              <CreatorCard
                key={creator.id}
                creator={creator}
                isOwn={isOwnProfile(creator)}
                ownerName={getOwnerDisplayName(creator)}
                onEdit={() => handleEdit(creator)}
                onDelete={() => handleDelete(creator)}
                onLinkLoRA={() => handleLinkLoRA(creator)}
                onToggleShare={() => handleToggleShare(creator)}
                onSetDefault={() => handleSetDefault(creator.id)}
                onViewLoRAs={() => {
                  setSelectedCreator(creator);
                  setShowAllLoRAsPopup(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Creator</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Owner</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instagram</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">LoRAs</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredCreators.map((creator) => (
                    <CreatorListRow
                      key={creator.id}
                      creator={creator}
                      isOwn={isOwnProfile(creator)}
                      ownerName={getOwnerDisplayName(creator)}
                      onEdit={() => handleEdit(creator)}
                      onDelete={() => handleDelete(creator)}
                      onLinkLoRA={() => handleLinkLoRA(creator)}
                      onToggleShare={() => handleToggleShare(creator)}
                      onSetDefault={() => handleSetDefault(creator.id)}
                      onViewLoRAs={() => {
                        setSelectedCreator(creator);
                        setShowAllLoRAsPopup(true);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateCreatorModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadCreators();
          }}
        />
      )}

      {showEditModal && selectedCreator && (
        <EditCreatorModal
          creator={selectedCreator}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCreator(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedCreator(null);
            loadCreators();
          }}
        />
      )}

      {showDeleteModal && selectedCreator && (
        <DeleteCreatorModal
          creator={selectedCreator}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCreator(null);
          }}
          onSuccess={() => {
            setShowDeleteModal(false);
            setSelectedCreator(null);
            loadCreators();
          }}
        />
      )}

      {showLinkLoRAModal && selectedCreator && (
        <LinkLoRAModal
          creator={selectedCreator}
          onClose={() => {
            setShowLinkLoRAModal(false);
            setSelectedCreator(null);
          }}
          onSuccess={() => {
            setShowLinkLoRAModal(false);
            setSelectedCreator(null);
            loadCreators();
          }}
        />
      )}

      {showAllLoRAsPopup && selectedCreator && (
        <ViewAllLoRAsPopup
          creator={selectedCreator}
          onClose={() => {
            setShowAllLoRAsPopup(false);
            setSelectedCreator(null);
          }}
        />
      )}
    </div>
  );
}

// Creator Card Component
function CreatorCard({
  creator,
  isOwn,
  ownerName,
  onEdit,
  onDelete,
  onLinkLoRA,
  onToggleShare,
  onSetDefault,
  onViewLoRAs,
}: {
  creator: Creator;
  isOwn: boolean;
  ownerName: string;
  onEdit: () => void;
  onDelete: () => void;
  onLinkLoRA: () => void;
  onToggleShare: () => void;
  onSetDefault: () => void;
  onViewLoRAs: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalPosts = (creator._count?.posts || 0) + (creator._count?.feedPosts || 0);
  const loraCount = creator.linkedLoRAs?.length || 0;

  return (
    <div className={`group relative bg-white dark:bg-gray-900 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1 ${
      isOwn 
        ? 'border-purple-200 dark:border-purple-900/50' 
        : 'border-gray-200 dark:border-gray-800'
    }`}>
      {/* Top Section with gradient background */}
      <div className={`relative h-24 rounded-t-2xl overflow-hidden ${
        isOwn
          ? 'bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500'
          : 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 dark:from-gray-700 dark:via-gray-600 dark:to-gray-500'
      }`}>
        <div className="absolute inset-0 bg-black/10"></div>
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {creator.isDefault && (
            <span className="flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-lg">
              <Star className="w-3 h-3 fill-current" />
              Default
            </span>
          )}
          {creator.organizationId && (
            <span className="flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-lg">
              <Building2 className="w-3 h-3" />
              Shared
            </span>
          )}
        </div>

        {/* Menu */}
        {isOwn && (
          <div className="absolute top-3 right-3" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-4 h-4 text-white" />
            </button>
            
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={() => { onEdit(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Profile
                </button>
                <button
                  onClick={() => { onLinkLoRA(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Link2 className="w-4 h-4" />
                  Link LoRAs
                </button>
                <button
                  onClick={() => { onToggleShare(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {creator.organizationId ? (
                    <>
                      <X className="w-4 h-4" />
                      Unshare
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Share with Team
                    </>
                  )}
                </button>
                {!creator.isDefault && (
                  <button
                    onClick={() => { onSetDefault(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Star className="w-4 h-4" />
                    Set as Default
                  </button>
                )}
                <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>
                <button
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="relative px-4 -mt-10">
        <div className="relative inline-block">
          {creator.profileImageUrl ? (
            <img
              src={creator.profileImageUrl}
              alt={creator.name}
              className="w-20 h-20 rounded-xl object-cover border-4 border-white dark:border-gray-900 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 border-4 border-white dark:border-gray-900 shadow-lg flex items-center justify-center text-white text-2xl font-bold">
              {creator.name.charAt(0).toUpperCase()}
            </div>
          )}
          {isOwn && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center border-2 border-white dark:border-gray-900">
              <User className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg truncate">
              {creator.name}
            </h3>
            {creator.instagramUsername && (
              <a
                href={`https://instagram.com/${creator.instagramUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors mt-0.5"
              >
                <Instagram className="w-3.5 h-3.5" />
                @{creator.instagramUsername}
              </a>
            )}
          </div>
        </div>

        {/* Owner Info */}
        {!isOwn && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            {creator.user?.imageUrl ? (
              <img
                src={creator.user.imageUrl}
                alt={ownerName}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              </div>
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Shared by <span className="font-medium text-gray-700 dark:text-gray-300">{ownerName}</span>
            </span>
          </div>
        )}

        {creator.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
            {creator.description}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">LoRAs</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{loraCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
              <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Posts</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{totalPosts}</p>
            </div>
          </div>
        </div>

        {/* LoRAs Section */}
        {loraCount > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Linked Models
              </p>
              {loraCount > 2 && (
                <button
                  onClick={onViewLoRAs}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                >
                  View all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {creator.linkedLoRAs?.slice(0, 2).map((lora) => (
                <div
                  key={lora.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 rounded-lg"
                >
                  {lora.thumbnailUrl ? (
                    <img
                      src={lora.thumbnailUrl}
                      alt={lora.displayName}
                      className="w-4 h-4 rounded object-cover"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-[8px] font-bold text-purple-600 dark:text-purple-300">
                      {lora.displayName.charAt(0)}
                    </div>
                  )}
                  <span className="text-xs text-purple-700 dark:text-purple-300 truncate max-w-[80px]">
                    {lora.displayName}
                  </span>
                </div>
              ))}
              {loraCount > 2 && (
                <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  +{loraCount - 2} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions for own profiles */}
        {isOwn && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={onLinkLoRA}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
            >
              <Link2 className="w-4 h-4" />
              {loraCount > 0 ? 'Manage' : 'Link'} LoRAs
            </button>
            <button
              onClick={onEdit}
              className="flex items-center justify-center p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Creator List Row Component
function CreatorListRow({
  creator,
  isOwn,
  ownerName,
  onEdit,
  onDelete,
  onLinkLoRA,
  onToggleShare,
  onSetDefault,
  onViewLoRAs,
}: {
  creator: Creator;
  isOwn: boolean;
  ownerName: string;
  onEdit: () => void;
  onDelete: () => void;
  onLinkLoRA: () => void;
  onToggleShare: () => void;
  onSetDefault: () => void;
  onViewLoRAs: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loraCount = creator.linkedLoRAs?.length || 0;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {creator.profileImageUrl ? (
              <img
                src={creator.profileImageUrl}
                alt={creator.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-lg">
                {creator.name.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwn && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-500 rounded-md flex items-center justify-center border-2 border-white dark:border-gray-900">
                <User className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 dark:text-white">
                {creator.name}
              </p>
              {creator.isDefault && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-md">
                  <Star className="w-3 h-3 fill-current" />
                  Default
                </span>
              )}
              {creator.organizationId && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md">
                  <Building2 className="w-3 h-3" />
                  Shared
                </span>
              )}
            </div>
            {creator.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {creator.description}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {creator.user?.imageUrl ? (
            <img
              src={creator.user.imageUrl}
              alt={ownerName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <User className="w-3 h-3 text-gray-500" />
            </div>
          )}
          <span className={`text-sm ${isOwn ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
            {isOwn ? 'You' : ownerName}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        {creator.instagramUsername ? (
          <a
            href={`https://instagram.com/${creator.instagramUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            <Instagram className="w-4 h-4" />
            @{creator.instagramUsername}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-sm text-gray-400">Not connected</span>
        )}
      </td>
      <td className="px-6 py-4">
        {loraCount > 0 ? (
          <button
            onClick={onViewLoRAs}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loraCount} LoRA{loraCount !== 1 ? 's' : ''}
          </button>
        ) : (
          <span className="text-sm text-gray-400">None</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOwn ? 'bg-green-500' : 'bg-blue-500'}`}></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isOwn ? 'Owned' : 'Shared'}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        {isOwn ? (
          <div className="relative inline-block" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-500" />
            </button>
            
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={() => { onEdit(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => { onLinkLoRA(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Link2 className="w-4 h-4" />
                  Link LoRAs
                </button>
                <button
                  onClick={() => { onToggleShare(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {creator.organizationId ? <X className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  {creator.organizationId ? 'Unshare' : 'Share'}
                </button>
                {!creator.isDefault && (
                  <button
                    onClick={() => { onSetDefault(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Star className="w-4 h-4" />
                    Set Default
                  </button>
                )}
                <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>
                <button
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">View only</span>
        )}
      </td>
    </tr>
  );
}

// Create Creator Modal
function CreateCreatorModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [shareWithOrganization, setShareWithOrganization] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => { setProfileImagePreview(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Please enter a creator name'); return; }
    try {
      setSaving(true);
      let profileImageUrl = null;
      if (profileImage) {
        const formData = new FormData();
        formData.append('image', profileImage);
        const uploadResponse = await fetch('/api/upload/image', { method: 'POST', body: formData });
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          profileImageUrl = uploadData.dataUrl;
        } else { toast.error('Failed to upload profile image'); return; }
      }
      const response = await fetch('/api/instagram/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, instagramUsername: instagramUsername.trim() || null, profileImageUrl, isDefault, shareWithOrganization }),
      });
      if (response.ok) { toast.success('Creator created successfully'); onSuccess(); }
      else { const error = await response.json(); toast.error(error.error || 'Failed to create creator'); }
    } catch (error) { console.error('Error creating creator:', error); toast.error('Failed to create creator'); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl"><Plus className="w-6 h-6 text-white" /></div>
            <div><h2 className="text-xl font-bold text-white">Create New Creator</h2><p className="text-purple-100 text-sm">Set up a new creator profile</p></div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {profileImagePreview ? <img src={profileImagePreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover" /> : <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">{name ? name.charAt(0).toUpperCase() : '?'}</div>}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-xl cursor-pointer transition-opacity"><ImageIcon className="w-6 h-6 text-white" /><input type="file" accept="image/*" onChange={handleImageChange} className="hidden" /></label>
            </div>
            <div className="flex-1"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Photo</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">JPG, PNG or GIF. Max 5MB</p></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Creator Name <span className="text-red-500">*</span></label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Personal Brand" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" rows={3} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white resize-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Instagram Username</label><div className="relative"><Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" value={instagramUsername} onChange={(e) => setInstagramUsername(e.target.value)} placeholder="username" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white" /></div></div>
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-5 h-5 text-purple-600 bg-white dark:bg-gray-700 border-gray-300 rounded focus:ring-purple-500" /><div className="flex-1"><p className="text-sm font-medium text-gray-900 dark:text-white">Set as default</p><p className="text-xs text-gray-500 dark:text-gray-400">Use this profile by default</p></div><Star className={`w-5 h-5 ${isDefault ? 'text-yellow-500 fill-current' : 'text-gray-300 dark:text-gray-600'}`} /></label>
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><input type="checkbox" checked={shareWithOrganization} onChange={(e) => setShareWithOrganization(e.target.checked)} className="w-5 h-5 text-purple-600 bg-white dark:bg-gray-700 border-gray-300 rounded focus:ring-purple-500" /><div className="flex-1"><p className="text-sm font-medium text-gray-900 dark:text-white">Share with team</p><p className="text-xs text-gray-500 dark:text-gray-400">Let team members use this profile</p></div><Users className={`w-5 h-5 ${shareWithOrganization ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`} /></label>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-purple-500/25">{saving ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Creating...</span> : 'Create Creator'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Edit Creator Modal
function EditCreatorModal({ creator, onClose, onSuccess }: { creator: Creator; onClose: () => void; onSuccess: () => void; }) {
  const [name, setName] = useState(creator.name);
  const [description, setDescription] = useState(creator.description || '');
  const [instagramUsername, setInstagramUsername] = useState(creator.instagramUsername || '');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(creator.profileImageUrl);
  const [isDefault, setIsDefault] = useState(creator.isDefault);
  const [shareWithOrganization, setShareWithOrganization] = useState(!!creator.organizationId);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => { setProfileImagePreview(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Please enter a creator name'); return; }
    try {
      setSaving(true);
      let profileImageUrl = creator.profileImageUrl;
      if (profileImage) {
        const formData = new FormData();
        formData.append('image', profileImage);
        const uploadResponse = await fetch('/api/upload/image', { method: 'POST', body: formData });
        if (uploadResponse.ok) { const uploadData = await uploadResponse.json(); profileImageUrl = uploadData.dataUrl; }
        else { toast.error('Failed to upload profile image'); return; }
      }
      const response = await fetch(`/api/instagram/profiles/${creator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, instagramUsername: instagramUsername.trim() || null, profileImageUrl, isDefault, shareWithOrganization }),
      });
      if (response.ok) { toast.success('Creator updated successfully'); onSuccess(); }
      else { const error = await response.json(); toast.error(error.error || 'Failed to update creator'); }
    } catch (error) { console.error('Error updating creator:', error); toast.error('Failed to update creator'); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"><X className="w-5 h-5 text-white" /></button>
          <div className="flex items-center gap-3"><div className="p-3 bg-white/20 rounded-xl"><Pencil className="w-6 h-6 text-white" /></div><div><h2 className="text-xl font-bold text-white">Edit Creator</h2><p className="text-purple-100 text-sm">Update {creator.name}</p></div></div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {profileImagePreview ? <img src={profileImagePreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover" /> : <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">{name ? name.charAt(0).toUpperCase() : '?'}</div>}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-xl cursor-pointer transition-opacity"><ImageIcon className="w-6 h-6 text-white" /><input type="file" accept="image/*" onChange={handleImageChange} className="hidden" /></label>
            </div>
            <div className="flex-1"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Photo</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Click to change</p></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Creator Name <span className="text-red-500">*</span></label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white resize-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Instagram Username</label><div className="relative"><Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" value={instagramUsername} onChange={(e) => setInstagramUsername(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white" /></div></div>
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-5 h-5 text-purple-600 bg-white dark:bg-gray-700 border-gray-300 rounded focus:ring-purple-500" /><div className="flex-1"><p className="text-sm font-medium text-gray-900 dark:text-white">Set as default</p><p className="text-xs text-gray-500 dark:text-gray-400">Use this profile by default</p></div><Star className={`w-5 h-5 ${isDefault ? 'text-yellow-500 fill-current' : 'text-gray-300 dark:text-gray-600'}`} /></label>
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><input type="checkbox" checked={shareWithOrganization} onChange={(e) => setShareWithOrganization(e.target.checked)} className="w-5 h-5 text-purple-600 bg-white dark:bg-gray-700 border-gray-300 rounded focus:ring-purple-500" /><div className="flex-1"><p className="text-sm font-medium text-gray-900 dark:text-white">Share with team</p><p className="text-xs text-gray-500 dark:text-gray-400">Let team members use this profile</p></div><Users className={`w-5 h-5 ${shareWithOrganization ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`} /></label>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-purple-500/25">{saving ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Saving...</span> : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Delete Creator Modal
function DeleteCreatorModal({ creator, onClose, onSuccess }: { creator: Creator; onClose: () => void; onSuccess: () => void; }) {
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/instagram/profiles/${creator.id}`, { method: 'DELETE' });
      if (response.ok) { toast.success('Creator deleted successfully'); onSuccess(); }
      else { const error = await response.json(); toast.error(error.error || 'Failed to delete creator'); }
    } catch (error) { console.error('Error deleting creator:', error); toast.error('Failed to delete creator'); }
    finally { setDeleting(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" /></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Creator?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{creator.name}</strong>? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={deleting} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl disabled:opacity-50">{deleting ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Deleting...</span> : 'Delete'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Link LoRA Modal
interface AvailableLoRA { id: string; displayName: string; thumbnailUrl: string | null; fileName: string; isActive: boolean; profileId: string | null; }

function LinkLoRAModal({ creator, onClose, onSuccess }: { creator: Creator; onClose: () => void; onSuccess: () => void; }) {
  const [availableLoRAs, setAvailableLoRAs] = useState<AvailableLoRA[]>([]);
  const [linkedLoRAIds, setLinkedLoRAIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { setMounted(true); loadLoRAs(); return () => setMounted(false); }, []);

  const loadLoRAs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/influencers');
      if (response.ok) {
        const data = await response.json();
        const loras = Array.isArray(data) ? data : [];
        setAvailableLoRAs(loras);
        const linked = new Set<string>();
        loras.forEach((lora: AvailableLoRA) => { if (lora.profileId === creator.id) linked.add(lora.id); });
        setLinkedLoRAIds(linked);
      }
    } catch (error) { console.error('Error loading LoRAs:', error); toast.error('Failed to load LoRAs'); }
    finally { setLoading(false); }
  };

  const toggleLoRA = (loraId: string) => {
    setLinkedLoRAIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(loraId)) newSet.delete(loraId);
      else newSet.add(loraId);
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const currentLinked = new Set(availableLoRAs.filter(lora => lora.profileId === creator.id).map(lora => lora.id));
      const toLink = [...linkedLoRAIds].filter(id => !currentLinked.has(id));
      const toUnlink = [...currentLinked].filter(id => !linkedLoRAIds.has(id));
      for (const loraId of toLink) {
        const response = await fetch(`/api/instagram/profiles/${creator.id}/loras`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loraId }) });
        if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Failed to link LoRA'); }
      }
      for (const loraId of toUnlink) {
        const response = await fetch(`/api/instagram/profiles/${creator.id}/loras?loraId=${loraId}`, { method: 'DELETE' });
        if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Failed to unlink LoRA'); }
      }
      toast.success('LoRA links updated successfully');
      onSuccess();
    } catch (error) { console.error('Error saving LoRA links:', error); toast.error(error instanceof Error ? error.message : 'Failed to update LoRA links'); }
    finally { setSaving(false); }
  };

  if (!mounted) return null;
  const filteredLoRAs = availableLoRAs.filter(lora => lora.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || lora.fileName.toLowerCase().includes(searchQuery.toLowerCase()));

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
        <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-6 rounded-t-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"><X className="w-5 h-5 text-white" /></button>
          <div className="flex items-center gap-3"><div className="p-2.5 bg-white/20 rounded-xl"><Link2 className="w-5 h-5 text-white" /></div><div><h2 className="text-lg font-bold text-white">Link LoRAs</h2><p className="text-purple-100 text-sm">{creator.name}</p></div></div>
        </div>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search LoRAs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-900 dark:text-white" /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div></div>
          ) : filteredLoRAs.length === 0 ? (
            <div className="text-center py-12"><Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">{searchQuery ? 'No LoRAs match your search' : 'No LoRAs available'}</p></div>
          ) : (
            <div className="space-y-2">
              {filteredLoRAs.map((lora) => {
                const isLinked = linkedLoRAIds.has(lora.id);
                const isLinkedToOther = lora.profileId && lora.profileId !== creator.id;
                return (
                  <div key={lora.id} onClick={() => !isLinkedToOther && toggleLoRA(lora.id)} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isLinkedToOther ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700' : isLinked ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 cursor-pointer' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 cursor-pointer'}`}>
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">{lora.thumbnailUrl ? <img src={lora.thumbnailUrl} alt={lora.displayName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold">{lora.displayName.charAt(0).toUpperCase()}</div>}</div>
                    <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 dark:text-white truncate">{lora.displayName}</p><p className="text-xs text-gray-500 dark:text-gray-400 truncate">{lora.fileName}</p>{isLinkedToOther && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Linked to another creator</p>}</div>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isLinked ? 'bg-purple-500 text-white' : 'border-2 border-gray-300 dark:border-gray-600'}`}>{isLinked && <Check className="w-4 h-4" />}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3"><span className="text-sm text-gray-500 dark:text-gray-400">{linkedLoRAIds.size} LoRA{linkedLoRAIds.size !== 1 ? 's' : ''} selected</span></div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button onClick={handleSave} disabled={saving || loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50">{saving ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Saving...</span> : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// View All LoRAs Popup
function ViewAllLoRAsPopup({ creator, onClose }: { creator: Creator; onClose: () => void; }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;
  const loras = creator.linkedLoRAs || [];

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div><div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Linked LoRAs</h2><p className="text-sm text-gray-500 dark:text-gray-400">{creator.name} • {loras.length} model{loras.length !== 1 ? 's' : ''}</p></div></div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loras.length === 0 ? (
            <div className="text-center py-12"><Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">No LoRAs linked</p></div>
          ) : (
            <div className="space-y-2">
              {loras.map((lora) => (
                <div key={lora.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">{lora.thumbnailUrl ? <img src={lora.thumbnailUrl} alt={lora.displayName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold">{lora.displayName.charAt(0).toUpperCase()}</div>}</div>
                  <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 dark:text-white truncate">{lora.displayName}</p><p className="text-xs text-gray-500 dark:text-gray-400 truncate">{lora.fileName}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800"><button onClick={onClose} className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl">Close</button></div>
      </div>
    </div>,
    document.body
  );
}
