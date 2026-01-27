'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  Instagram,
  Twitter,
  Globe,
  Eye,
  Sparkles,
  Filter,
  LayoutGrid,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  TrendingUp,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useOfModelStore } from '@/stores/of-model-store';

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

const statusConfig: Record<string, { bg: string; text: string; dot: string; glow: string }> = {
  ACTIVE: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    glow: 'shadow-emerald-500/20'
  },
  INACTIVE: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
    glow: 'shadow-zinc-500/20'
  },
  PENDING: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    glow: 'shadow-amber-500/20'
  },
  ARCHIVED: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    glow: 'shadow-rose-500/20'
  },
};

function getDisplayImageUrl(url: string | null): string | null {
  if (!url) return null;

  if (url.includes('drive.google.com')) {
    try {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      let driveId: string | null = null;

      if (fileMatch && fileMatch[1]) {
        driveId = fileMatch[1];
      } else {
        const urlObj = new URL(url);
        driveId = urlObj.searchParams.get('id');
      }

      if (driveId) {
        return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
      }
    } catch {
      // Fall through
    }
  }

  return url;
}

function getSocialUrl(value: string | null, platform: 'instagram' | 'twitter' | 'tiktok'): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    default:
      return trimmed;
  }
}

const ITEMS_PER_PAGE = 12;

export default function OfModelsPage() {
  const [models, setModels] = useState<OfModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<OfModel | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const setStoreSelectedModel = useOfModelStore((state) => state.setSelectedModel);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadModels();
  }, [debouncedSearch, statusFilter]);

  const loadModels = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      const response = await fetch(`/api/of-models?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setModels(result.data || []);
      } else {
        toast.error('Failed to load models');
      }
    } catch (error) {
      console.error('Error loading models:', error);
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => setShowCreateModal(true);
  const handleEdit = (model: OfModel) => {
    setSelectedModel(model);
    setShowEditModal(true);
  };
  const handleDelete = (model: OfModel) => {
    setSelectedModel(model);
    setShowDeleteModal(true);
  };

  const totalModels = models.length;
  const totalPages = Math.ceil(totalModels / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedModels = models.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const statusCounts = models.reduce((acc, model) => {
    acc[model.status] = (acc[model.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <header className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/10">
                  <Crown className="w-6 h-6 text-violet-400" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-white">
                  Models
                </h1>
              </div>
              <p className="text-zinc-500 text-lg font-light max-w-xl">
                Curate and manage your creator portfolio with precision
              </p>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-3">
              {['ACTIVE', 'PENDING', 'INACTIVE'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}
                  className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                    statusFilter === status
                      ? `${statusConfig[status].bg} border-current ${statusConfig[status].text}`
                      : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig[status].dot} ${statusFilter === status ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-medium">{statusCounts[status] || 0}</span>
                  <span className="text-xs opacity-70 hidden sm:inline">{status.toLowerCase()}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Actions Bar */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-lg group">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Search by name, handle, or bio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-zinc-900/80 border border-zinc-800/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:bg-zinc-900 transition-all duration-300"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 p-1 rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 rounded-lg transition-all duration-200 ${
                    viewMode === 'grid'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 rounded-lg transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 ${
                  showFilters || statusFilter !== 'ALL'
                    ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                    : 'bg-zinc-900/80 border-zinc-800/50 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">Filters</span>
                {statusFilter !== 'ALL' && (
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                )}
              </button>

              {/* Add Model Button */}
              <button
                onClick={handleCreate}
                className="group relative flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-white overflow-hidden transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <Plus className="relative w-5 h-5" />
                <span className="relative hidden sm:inline">Add Model</span>
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-fadeIn">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-zinc-500 mr-2">Status:</span>
                {['ALL', 'ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      statusFilter === status
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                        : 'bg-zinc-800/50 text-zinc-500 border border-transparent hover:text-zinc-400'
                    }`}
                  >
                    {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && totalModels > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-zinc-500 text-sm">
              Showing <span className="text-zinc-300 font-medium">{startIndex + 1}-{Math.min(endIndex, totalModels)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{totalModels}</span> models
            </p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-zinc-800" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
            </div>
            <p className="text-zinc-500 text-sm">Loading models...</p>
          </div>
        ) : models.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 mb-6">
              <Users className="w-12 h-12 text-zinc-700" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              {searchQuery || statusFilter !== 'ALL' ? 'No models found' : 'Start building your roster'}
            </h3>
            <p className="text-zinc-500 mb-8 max-w-md">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search or filters'
                : 'Add your first model to begin managing profiles, pricing, and assets'}
            </p>
            {!searchQuery && statusFilter === 'ALL' && (
              <button
                onClick={handleCreate}
                className="group relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Sparkles className="relative w-5 h-5" />
                <span className="relative">Create First Model</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginatedModels.map((model, index) => (
              <ModelCard
                key={model.id}
                model={model}
                index={index}
                onEdit={handleEdit}
                onDelete={handleDelete}
                setStoreSelectedModel={setStoreSelectedModel}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedModels.map((model, index) => (
              <ModelListItem
                key={model.id}
                model={model}
                index={index}
                onEdit={handleEdit}
                onDelete={handleDelete}
                setStoreSelectedModel={setStoreSelectedModel}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Previous</span>
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
                      page === currentPage
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                        : 'bg-zinc-900/80 border border-zinc-800/50 text-zinc-500 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span className="hidden sm:inline text-sm">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateModelModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadModels();
          }}
        />
      )}

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

// Model Card Component
function ModelCard({
  model,
  index,
  onEdit,
  onDelete,
  setStoreSelectedModel,
}: {
  model: OfModel;
  index: number;
  onEdit: (model: OfModel) => void;
  onDelete: (model: OfModel) => void;
  setStoreSelectedModel: (model: any) => void;
}) {
  const imageUrl = getDisplayImageUrl(model.profileImageUrl);
  const config = statusConfig[model.status] || statusConfig.INACTIVE;

  return (
    <div
      className="group relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-700/50 transition-all duration-500"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-800/50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={model.displayName}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${imageUrl ? 'hidden' : ''}`}>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center border border-violet-500/20">
            <span className="text-4xl font-light text-white/80">
              {model.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />

        {/* Status Badge */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} backdrop-blur-sm`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.text}`}>
            {model.status}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => onEdit(model)}
            className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(model)}
            className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Social Links */}
        <div className="absolute bottom-16 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {model.instagramUrl && (
            <a
              href={getSocialUrl(model.instagramUrl, 'instagram')!}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-pink-400 hover:bg-pink-500/20 hover:border-pink-500/30 transition-all"
            >
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {model.twitterUrl && (
            <a
              href={getSocialUrl(model.twitterUrl, 'twitter')!}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/30 transition-all"
            >
              <Twitter className="w-4 h-4" />
            </a>
          )}
          {model.websiteUrl && (
            <a
              href={model.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:bg-zinc-500/20 hover:border-zinc-500/30 transition-all"
            >
              <Globe className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-4 space-y-3">
        <div>
          <Link
            href={`/of-models/${model.slug}`}
            onClick={() => setStoreSelectedModel(model as any)}
            className="block"
          >
            <h3 className="text-lg font-medium text-white group-hover:text-violet-300 transition-colors truncate">
              {model.displayName}
            </h3>
          </Link>
          <p className="text-sm text-zinc-500 truncate">@{model.slug}</p>
        </div>

        <p className="text-sm text-zinc-400 line-clamp-2 min-h-[40px]">
          {model.bio || 'No bio provided'}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(model.createdAt).toLocaleDateString()}</span>
          </div>

          <Link
            href={`/of-models/${model.slug}`}
            onClick={() => setStoreSelectedModel(model as any)}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
}

// Model List Item Component
function ModelListItem({
  model,
  index,
  onEdit,
  onDelete,
  setStoreSelectedModel,
}: {
  model: OfModel;
  index: number;
  onEdit: (model: OfModel) => void;
  onDelete: (model: OfModel) => void;
  setStoreSelectedModel: (model: any) => void;
}) {
  const imageUrl = getDisplayImageUrl(model.profileImageUrl);
  const config = statusConfig[model.status] || statusConfig.INACTIVE;

  return (
    <div
      className="group flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-zinc-700/50 transition-all duration-300"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Avatar */}
      <div className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-zinc-800/50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={model.displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${imageUrl ? 'hidden' : ''}`}>
          <span className="text-xl font-light text-white/80">
            {model.displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/of-models/${model.slug}`}
            onClick={() => setStoreSelectedModel(model as any)}
          >
            <h3 className="font-medium text-white hover:text-violet-300 transition-colors truncate">
              {model.displayName}
            </h3>
          </Link>
          <span className="text-sm text-zinc-500">@{model.slug}</span>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${config.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.text}`}>
              {model.status}
            </span>
          </div>
        </div>
        <p className="text-sm text-zinc-500 truncate mt-1">
          {model.bio || 'No bio provided'}
        </p>
      </div>

      {/* Social */}
      <div className="hidden md:flex items-center gap-2">
        {model.instagramUrl && (
          <a
            href={getSocialUrl(model.instagramUrl, 'instagram')!}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-pink-400/60 hover:text-pink-400 hover:bg-pink-500/10 transition-all"
          >
            <Instagram className="w-4 h-4" />
          </a>
        )}
        {model.twitterUrl && (
          <a
            href={getSocialUrl(model.twitterUrl, 'twitter')!}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-sky-400/60 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
          >
            <Twitter className="w-4 h-4" />
          </a>
        )}
        {model.websiteUrl && (
          <a
            href={model.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-400 hover:bg-zinc-500/10 transition-all"
          >
            <Globe className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Date */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-500">
        <Calendar className="w-3.5 h-3.5" />
        <span>{new Date(model.createdAt).toLocaleDateString()}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Link
          href={`/of-models/${model.slug}`}
          onClick={() => setStoreSelectedModel(model as any)}
          className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <Eye className="w-4 h-4" />
        </Link>
        <button
          onClick={() => onEdit(model)}
          className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(model)}
          className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
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
        toast.success('Model created successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create model');
      }
    } catch (error) {
      console.error('Error creating model:', error);
      toast.error('Failed to create model');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fadeIn overflow-hidden">
        {/* Header Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Create New Model</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Internal Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. julia_model"
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Display Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Julia Rose"
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              URL Slug <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center">
              <span className="px-4 py-3 bg-zinc-800 border border-r-0 border-zinc-700/50 rounded-l-xl text-zinc-500 text-sm">
                /of-models/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="julia-rose"
                className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-r-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short description..."
              rows={3}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    status === s
                      ? `${statusConfig[s].bg} ${statusConfig[s].text} border border-current`
                      : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig[s].dot}`} />
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
              <span className="relative">{saving ? 'Creating...' : 'Create Model'}</span>
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
        toast.success('Model updated successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update model');
      }
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fadeIn overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Pencil className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Edit Model</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Internal Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Display Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              URL Slug <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center">
              <span className="px-4 py-3 bg-zinc-800 border border-r-0 border-zinc-700/50 rounded-l-xl text-zinc-500 text-sm">
                /of-models/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-r-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s as OfModel['status'])}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    status === s
                      ? `${statusConfig[s].bg} ${statusConfig[s].text} border border-current`
                      : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig[s].dot}`} />
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
              <span className="relative">{saving ? 'Saving...' : 'Save Changes'}</span>
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
        toast.success('Model deleted successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete model');
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error('Failed to delete model');
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fadeIn overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-rose-500 to-transparent" />

        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Delete Model</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center">
              <span className="text-xl font-light text-white">
                {model.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-white">{model.displayName}</p>
              <p className="text-sm text-zinc-500">@{model.slug}</p>
            </div>
          </div>

          <p className="text-zinc-400 mb-6">
            Are you sure you want to delete this model? This action cannot be undone and will permanently remove all associated details, assets, and pricing data.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-red-600" />
              <span className="relative">{deleting ? 'Deleting...' : 'Delete Model'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
