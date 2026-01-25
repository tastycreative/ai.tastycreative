'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  ExternalLink,
  Instagram,
  Twitter,
  Globe,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface OfModel {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED';
  profileImageUrl: string | null;
  bio: string | null;
  personalityType: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  launchDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assets: number;
    pricingCategories: number;
  };
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ARCHIVED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function OfModelsPage() {
  const [models, setModels] = useState<OfModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<OfModel | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/of-models');
      if (response.ok) {
        const result = await response.json();
        setModels(result.data || []);
      } else {
        toast.error('Failed to load OF models');
      }
    } catch (error) {
      console.error('Error loading OF models:', error);
      toast.error('Failed to load OF models');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleEdit = (model: OfModel) => {
    setSelectedModel(model);
    setShowEditModal(true);
  };

  const handleDelete = (model: OfModel) => {
    setSelectedModel(model);
    setShowDeleteModal(true);
  };

  const filteredModels = models.filter(model => {
    const matchesSearch =
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.slug.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || model.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            OF Models
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage OF model profiles, pricing, and assets
          </p>
        </div>

        {/* Actions Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="PENDING">Pending</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            {/* Add Button */}
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Model
            </button>
          </div>
        </div>

        {/* Models Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery || statusFilter !== 'ALL' ? 'No models found' : 'No OF models yet'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Try adjusting your search or filter'
                  : 'Get started by creating your first OF model profile'}
              </p>
              {!searchQuery && statusFilter === 'ALL' && (
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Model
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Social Links
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Launch Date
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
                  {filteredModels.map((model) => (
                    <tr
                      key={model.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {model.profileImageUrl ? (
                            <img
                              src={model.profileImageUrl}
                              alt={model.displayName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {model.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <Link
                              href={`/workspace/of-models/${model.slug}`}
                              className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {model.displayName}
                            </Link>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              @{model.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {model.instagramUrl && (
                            <a
                              href={model.instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              title="Instagram"
                            >
                              <Instagram className="w-4 h-4 text-pink-500" />
                            </a>
                          )}
                          {model.twitterUrl && (
                            <a
                              href={model.twitterUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              title="Twitter"
                            >
                              <Twitter className="w-4 h-4 text-blue-400" />
                            </a>
                          )}
                          {model.websiteUrl && (
                            <a
                              href={model.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              title="Website"
                            >
                              <Globe className="w-4 h-4 text-gray-500" />
                            </a>
                          )}
                          {!model.instagramUrl && !model.twitterUrl && !model.websiteUrl && (
                            <span className="text-sm text-gray-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[model.status]}`}>
                          {model.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {model.launchDate
                          ? new Date(model.launchDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(model.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/workspace/of-models/${model.slug}`}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </Link>
                          <button
                            onClick={() => handleEdit(model)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(model)}
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

      {/* Create Modal */}
      {showCreateModal && (
        <CreateModelModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadModels();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedModel && (
        <EditModelModal
          model={selectedModel}
          onClose={() => {
            setShowEditModal(false);
            setSelectedModel(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedModel(null);
            loadModels();
          }}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedModel && (
        <DeleteModelModal
          model={selectedModel}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedModel(null);
          }}
          onSuccess={() => {
            setShowDeleteModal(false);
            setSelectedModel(null);
            loadModels();
          }}
        />
      )}
    </div>
  );
}

// Create Model Modal
function CreateModelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState<string>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [name]);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !displayName.trim() || !slug.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch('/api/of-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          displayName: displayName.trim(),
          slug: slug.trim(),
          bio: bio.trim() || null,
          status,
        }),
      });

      if (response.ok) {
        toast.success('OF model created successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create OF model');
      }
    } catch (error) {
      console.error('Error creating OF model:', error);
      toast.error('Failed to create OF model');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create New OF Model
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Internal name"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Public display name"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Slug *
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="url-friendly-name"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used in URLs: /workspace/of-models/{slug || 'slug'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short biography"
              rows={3}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PENDING">Pending</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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

// Edit Model Modal
function EditModelModal({
  model,
  onClose,
  onSuccess,
}: {
  model: OfModel;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(model.name);
  const [displayName, setDisplayName] = useState(model.displayName);
  const [slug, setSlug] = useState(model.slug);
  const [bio, setBio] = useState(model.bio || '');
  const [status, setStatus] = useState(model.status);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !displayName.trim() || !slug.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/of-models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          displayName: displayName.trim(),
          slug: slug.trim(),
          bio: bio.trim() || null,
          status,
        }),
      });

      if (response.ok) {
        toast.success('OF model updated successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update OF model');
      }
    } catch (error) {
      console.error('Error updating OF model:', error);
      toast.error('Failed to update OF model');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit OF Model
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name *
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
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Slug *
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OfModel['status'])}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PENDING">Pending</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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

// Delete Model Modal
function DeleteModelModal({
  model,
  onClose,
  onSuccess,
}: {
  model: OfModel;
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
      const response = await fetch(`/api/of-models/${model.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('OF model deleted successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete OF model');
      }
    } catch (error) {
      console.error('Error deleting OF model:', error);
      toast.error('Failed to delete OF model');
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Delete OF Model
          </h2>
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to delete <strong>{model.displayName}</strong>? This action cannot be undone and will remove all associated details, assets, and pricing.
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
