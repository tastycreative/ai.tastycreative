'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, Instagram, Search, MoreVertical, Link2, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';

interface LinkedLoRA {
  id: string;
  displayName: string;
  thumbnailUrl: string | null;
  fileName: string;
}

interface Creator {
  id: string;
  name: string;
  description: string | null;
  instagramUsername: string | null;
  instagramAccountId: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  linkedLoRAs?: LinkedLoRA[];
  _count?: {
    posts: number;
    feedPosts: number;
  };
}

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
    setOpenMenuId(null);
  };

  const handleDelete = (creator: Creator) => {
    setSelectedCreator(creator);
    setShowDeleteModal(true);
    setOpenMenuId(null);
  };

  const handleLinkLoRA = (creator: Creator) => {
    setSelectedCreator(creator);
    setShowLinkLoRAModal(true);
    setOpenMenuId(null);
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
    setOpenMenuId(null);
  };

  const filteredCreators = creators.filter(creator =>
    creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    creator.instagramUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Creators
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your creator profiles and accounts
          </p>
        </div>

        {/* Actions Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            {/* Add Button */}
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Creator
            </button>
          </div>
        </div>

        {/* Creators Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="text-center py-12">
              <Instagram className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No creators found' : 'No creators yet'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Get started by creating your first creator profile'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Creator
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Creator
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Instagram
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      LoRAs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Posts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredCreators.map((creator) => (
                    <tr
                      key={creator.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {creator.profileImageUrl ? (
                            <img
                              src={creator.profileImageUrl}
                              alt={creator.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {creator.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {creator.name}
                            </div>
                            {creator.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {creator.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {creator.instagramUsername ? (
                          <a
                            href={`https://instagram.com/${creator.instagramUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
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
                        <div className="flex items-center gap-2">
                          {creator.linkedLoRAs && creator.linkedLoRAs.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-1">
                                {creator.linkedLoRAs.slice(0, 2).map((lora) => (
                                  <div
                                    key={lora.id}
                                    className="flex items-center gap-2"
                                  >
                                    <div
                                      className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0"
                                    >
                                      {lora.thumbnailUrl ? (
                                        <img
                                          src={lora.thumbnailUrl}
                                          alt={lora.displayName}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-medium">
                                          {lora.displayName.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-sm text-gray-900 dark:text-white truncate max-w-[120px]">
                                      {lora.displayName}
                                    </span>
                                  </div>
                                ))}
                                {creator.linkedLoRAs.length > 2 && (
                                  <button
                                    onClick={() => {
                                      setSelectedCreator(creator);
                                      setShowAllLoRAsPopup(true);
                                    }}
                                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 pl-8 hover:underline transition-colors"
                                  >
                                    +{creator.linkedLoRAs.length - 2} more
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() => handleLinkLoRA(creator)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                title="Manage LoRAs"
                              >
                                <Link2 className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleLinkLoRA(creator)}
                              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                              <Link2 className="w-4 h-4" />
                              Link LoRA
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {(creator._count?.posts || 0) + (creator._count?.feedPosts || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {creator.isDefault ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Default
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(creator.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(creator)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(creator)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit/Delete Modals */}
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

// Create Creator Modal
function CreateCreatorModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a creator name');
      return;
    }

    try {
      setSaving(true);
      
      let profileImageUrl = null;
      if (profileImage) {
        const formData = new FormData();
        formData.append('image', profileImage);
        
        const uploadResponse = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          profileImageUrl = uploadData.dataUrl;
        } else {
          toast.error('Failed to upload profile image');
          return;
        }
      }
      
      const response = await fetch('/api/instagram/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          instagramUsername: instagramUsername.trim() || null,
          profileImageUrl,
          isDefault,
        }),
      });

      if (response.ok) {
        toast.success('Creator created successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create creator');
      }
    } catch (error) {
      console.error('Error creating creator:', error);
      toast.error('Failed to create creator');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create New Creator
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Profile Image
            </label>
            <div className="flex items-center gap-4">
              {profileImagePreview ? (
                <img
                  src={profileImagePreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    dark:file:bg-blue-900 dark:file:text-blue-200
                    dark:hover:file:bg-blue-800"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Max 5MB. Supports JPG, PNG, GIF
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Creator Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Personal Brand, Business Account"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Instagram Username
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">@</span>
              <input
                type="text"
                value={instagramUsername}
                onChange={(e) => setInstagramUsername(e.target.value)}
                placeholder="username"
                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">
              Set as default creator
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Edit Creator Modal
function EditCreatorModal({
  creator,
  onClose,
  onSuccess,
}: {
  creator: Creator;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(creator.name);
  const [description, setDescription] = useState(creator.description || '');
  const [instagramUsername, setInstagramUsername] = useState(creator.instagramUsername || '');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(creator.profileImageUrl);
  const [isDefault, setIsDefault] = useState(creator.isDefault);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a creator name');
      return;
    }

    try {
      setSaving(true);
      
      let profileImageUrl = creator.profileImageUrl;
      if (profileImage) {
        const formData = new FormData();
        formData.append('image', profileImage);
        
        const uploadResponse = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          profileImageUrl = uploadData.dataUrl;
        } else {
          toast.error('Failed to upload profile image');
          return;
        }
      }
      
      const response = await fetch(`/api/instagram/profiles/${creator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          instagramUsername: instagramUsername.trim() || null,
          profileImageUrl,
          isDefault,
        }),
      });

      if (response.ok) {
        toast.success('Creator updated successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update creator');
      }
    } catch (error) {
      console.error('Error updating creator:', error);
      toast.error('Failed to update creator');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Creator
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Profile Image
            </label>
            <div className="flex items-center gap-4">
              {profileImagePreview ? (
                <img
                  src={profileImagePreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    dark:file:bg-blue-900 dark:file:text-blue-200
                    dark:hover:file:bg-blue-800"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Max 5MB. Supports JPG, PNG, GIF
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Creator Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Instagram Username
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">@</span>
              <input
                type="text"
                value={instagramUsername}
                onChange={(e) => setInstagramUsername(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="editIsDefault" className="text-sm text-gray-700 dark:text-gray-300">
              Set as default creator
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Delete Creator Modal
function DeleteCreatorModal({
  creator,
  onClose,
  onSuccess,
}: {
  creator: Creator;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/instagram/profiles/${creator.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Creator deleted successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete creator');
      }
    } catch (error) {
      console.error('Error deleting creator:', error);
      toast.error('Failed to delete creator');
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Delete Creator
          </h2>
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to delete <strong>{creator.name}</strong>? This action cannot be undone and will remove all associated posts.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Link LoRA Modal
interface AvailableLoRA {
  id: string;
  displayName: string;
  thumbnailUrl: string | null;
  fileName: string;
  isActive: boolean;
  profileId: string | null;
}

function LinkLoRAModal({
  creator,
  onClose,
  onSuccess,
}: {
  creator: Creator;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [availableLoRAs, setAvailableLoRAs] = useState<AvailableLoRA[]>([]);
  const [linkedLoRAIds, setLinkedLoRAIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadLoRAs();
    return () => setMounted(false);
  }, []);

  const loadLoRAs = async () => {
    try {
      setLoading(true);
      // Fetch all user's LoRAs
      const response = await fetch('/api/user/influencers');
      if (response.ok) {
        const data = await response.json();
        const loras = Array.isArray(data) ? data : [];
        setAvailableLoRAs(loras);
        
        // Set initially linked LoRAs for this creator
        const linked = new Set<string>();
        loras.forEach((lora: AvailableLoRA) => {
          if (lora.profileId === creator.id) {
            linked.add(lora.id);
          }
        });
        setLinkedLoRAIds(linked);
      }
    } catch (error) {
      console.error('Error loading LoRAs:', error);
      toast.error('Failed to load LoRAs');
    } finally {
      setLoading(false);
    }
  };

  const toggleLoRA = (loraId: string) => {
    setLinkedLoRAIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(loraId)) {
        newSet.delete(loraId);
      } else {
        newSet.add(loraId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Get current linked LoRAs
      const currentLinked = new Set(
        availableLoRAs
          .filter(lora => lora.profileId === creator.id)
          .map(lora => lora.id)
      );
      
      // Find LoRAs to link (newly selected)
      const toLink = [...linkedLoRAIds].filter(id => !currentLinked.has(id));
      
      // Find LoRAs to unlink (previously selected but now unselected)
      const toUnlink = [...currentLinked].filter(id => !linkedLoRAIds.has(id));
      
      // Link new LoRAs
      for (const loraId of toLink) {
        const response = await fetch(`/api/instagram/profiles/${creator.id}/loras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loraId }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to link LoRA');
        }
      }
      
      // Unlink removed LoRAs
      for (const loraId of toUnlink) {
        const response = await fetch(`/api/instagram/profiles/${creator.id}/loras?loraId=${loraId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to unlink LoRA');
        }
      }
      
      toast.success('LoRA links updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Error saving LoRA links:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update LoRA links');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Link LoRAs to {creator.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select LoRA models to associate with this creator
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : availableLoRAs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No LoRAs available. Upload LoRAs in the Influencers tab first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableLoRAs.map((lora) => {
                const isLinked = linkedLoRAIds.has(lora.id);
                const isLinkedToOther = lora.profileId && lora.profileId !== creator.id;
                
                return (
                  <div
                    key={lora.id}
                    onClick={() => !isLinkedToOther && toggleLoRA(lora.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isLinkedToOther
                        ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
                        : isLinked
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
                      {lora.thumbnailUrl ? (
                        <img
                          src={lora.thumbnailUrl}
                          alt={lora.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-medium">
                          {lora.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {lora.displayName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {lora.fileName}
                      </p>
                      {isLinkedToOther && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Linked to another creator
                        </p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isLinked
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isLinked && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// View All LoRAs Popup
function ViewAllLoRAsPopup({
  creator,
  onClose,
}: {
  creator: Creator;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const loras = creator.linkedLoRAs || [];

  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Linked LoRAs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {creator.name} • {loras.length} LoRA{loras.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loras.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No LoRAs linked to this creator.
            </p>
          ) : (
            <div className="space-y-3">
              {loras.map((lora) => (
                <div
                  key={lora.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
                    {lora.thumbnailUrl ? (
                      <img
                        src={lora.thumbnailUrl}
                        alt={lora.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-medium">
                        {lora.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {lora.displayName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {lora.fileName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}