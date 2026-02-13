'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Users,
  Sparkles,
  Filter,
  LayoutGrid,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  X,
  Crown,
} from 'lucide-react';
import Link from 'next/link';
import { useOfModelStore } from '@/stores/of-model-store';
import { OfModelStatsCards } from '@/components/of-models/OfModelStatsCards';
import { OfModelsTable } from '@/components/of-models/OfModelsTable';
import { OfModelQuickFilters, type QuickFilterType, isRecentModel, isHighRevenueModel } from '@/components/of-models/OfModelQuickFilters';
import { ModelCard } from '@/components/of-models/ModelCard';
import { CreateModelModal } from '@/components/of-models/CreateModelModal';
import { EditModelModal } from '@/components/of-models/EditModelModal';
import { DeleteModelModal } from '@/components/of-models/DeleteModelModal';
import { useOfModels, type OfModel } from '@/lib/hooks/useOfModels.query';
import { useOfModelStats } from '@/lib/hooks/useOfModelStats.query';

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  INACTIVE: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
  },
  PENDING: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  ARCHIVED: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
};

const ITEMS_PER_PAGE = 12;

export default function OfModelsPage() {
  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<OfModel | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all');

  const setStoreSelectedModel = useOfModelStore((state) => state.setSelectedModel);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Fetch data with TanStack Query
  const { data: modelsData, isLoading: modelsLoading } = useOfModels({
    search: debouncedSearch,
    status: statusFilter,
    limit: 500,
  });

  const { data: stats, isLoading: statsLoading } = useOfModelStats();

  const models = modelsData?.data || [];

  // Memoize status counts
  const statusCounts = useMemo(() => {
    return models.reduce((acc, model) => {
      acc[model.status] = (acc[model.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [models]);

  // Memoize quick filter counts
  const quickFilterCounts = useMemo<Record<QuickFilterType, number>>(() => {
    return {
      all: models.length,
      active: models.filter((m) => m.status === 'ACTIVE').length,
      dropped: models.filter((m) => m.status === 'INACTIVE' || m.status === 'ARCHIVED').length,
      recent: models.filter((m) => isRecentModel(m.launchDate)).length,
      'high-revenue': models.filter((m) => isHighRevenueModel((m as any).guaranteedAmount)).length,
    };
  }, [models]);

  // Memoize filtered models
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      switch (quickFilter) {
        case 'active':
          return model.status === 'ACTIVE';
        case 'dropped':
          return model.status === 'INACTIVE' || model.status === 'ARCHIVED';
        case 'recent':
          return isRecentModel(model.launchDate);
        case 'high-revenue':
          return isHighRevenueModel((model as any).guaranteedAmount);
        default:
          return true;
      }
    });
  }, [models, quickFilter]);

  // Memoize pagination values
  const { totalModelsFiltered, totalPagesFiltered, paginatedModelsFiltered, startIndex, endIndex } = useMemo(() => {
    const totalModelsFiltered = filteredModels.length;
    const totalPagesFiltered = Math.ceil(totalModelsFiltered / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedModelsFiltered = filteredModels.slice(startIndex, endIndex);

    return {
      totalModelsFiltered,
      totalPagesFiltered,
      paginatedModelsFiltered,
      startIndex,
      endIndex,
    };
  }, [filteredModels, currentPage]);

  const handleCreate = () => setShowCreateModal(true);
  const handleEdit = (model: OfModel) => {
    setSelectedModel(model);
    setShowEditModal(true);
  };
  const handleDelete = (model: OfModel) => {
    setSelectedModel(model);
    setShowDeleteModal(true);
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPagesFiltered)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedModel(null);
  };

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
                  OF Creators
                </h1>
              </div>
              <p className="text-zinc-500 text-lg font-light max-w-xl">
                Profiles, assets, and pricing at a glance
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

        {/* Stats Cards */}
        <OfModelStatsCards stats={stats || null} loading={statsLoading} />

        {/* Quick Filters */}
        <OfModelQuickFilters
          activeFilter={quickFilter}
          onFilterChange={(filter) => {
            setQuickFilter(filter);
            setCurrentPage(1);
          }}
          counts={quickFilterCounts}
        />

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
        {!modelsLoading && totalModelsFiltered > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-zinc-500 text-sm">
              Showing <span className="text-zinc-300 font-medium">{startIndex + 1}-{Math.min(endIndex, totalModelsFiltered)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{totalModelsFiltered}</span> models
              {quickFilter !== 'all' && (
                <span className="text-zinc-600 ml-1">
                  (filtered from {models.length})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Content */}
        {modelsLoading ? (
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
            {paginatedModelsFiltered.map((model, index) => (
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
          <OfModelsTable
            models={paginatedModelsFiltered}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onModelClick={(model) => setStoreSelectedModel(model as any)}
          />
        )}

        {/* Pagination */}
        {!modelsLoading && totalPagesFiltered > 1 && (
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
              {Array.from({ length: Math.min(5, totalPagesFiltered) }, (_, i) => {
                let page: number;
                if (totalPagesFiltered <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPagesFiltered - 2) {
                  page = totalPagesFiltered - 4 + i;
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
              disabled={currentPage === totalPagesFiltered}
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
          onSuccess={handleModalSuccess}
        />
      )}

      {showEditModal && selectedModel && (
        <EditModelModal
          model={selectedModel}
          onClose={() => {
            setShowEditModal(false);
            setSelectedModel(null);
          }}
          onSuccess={handleModalSuccess}
        />
      )}

      {showDeleteModal && selectedModel && (
        <DeleteModelModal
          model={selectedModel}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedModel(null);
          }}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
