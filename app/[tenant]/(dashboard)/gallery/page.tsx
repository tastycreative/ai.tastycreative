'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageIcon, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GalleryFilters, type GalleryFilterValues } from '@/components/gallery/GalleryFilters';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { StatsOverview } from '@/components/gallery/StatsOverview';
import { PerformanceModal } from '@/components/gallery/PerformanceModal';
// import { TopPerformers } from '@/components/gallery/TopPerformers';
import { ContentTypeEditor } from '@/components/gallery/ContentTypeEditor';
import { DetailModal } from '@/components/gallery/DetailModal';
import {
  useGalleryItems,
  useGalleryStats,
  useGalleryModels,
  useDeleteGalleryItem,
  ITEMS_PER_PAGE,
} from '@/lib/hooks/useGallery.query';
import type { GalleryItemWithModel } from '@/types/gallery';

export default function GalleryPage() {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GalleryItemWithModel | null>(null);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showContentTypeEditor, setShowContentTypeEditor] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [gifsPlaying, setGifsPlaying] = useState(false);

  const [filters, setFilters] = useState<GalleryFilterValues>({
    search: '',
    contentType: 'all',
    platform: 'all',
    modelId: '',
    isArchived: false,
    sortField: 'postedAt',
    sortOrder: 'desc',
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // The filters object we pass to the query (uses debounced search)
  const queryFilters: GalleryFilterValues = { ...filters, search: debouncedSearch };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filters.contentType, filters.platform, filters.modelId, filters.isArchived]);

  // ── TanStack Query hooks ──
  const {
    data: galleryData,
    isLoading: loading,
    isFetching,
  } = useGalleryItems(queryFilters, currentPage);

  const { data: stats, isLoading: statsLoading } = useGalleryStats();
  const { data: models = [] } = useGalleryModels();
  const deleteMutation = useDeleteGalleryItem();

  const items = galleryData?.items ?? [];
  const totalPages = galleryData?.pagination.totalPages ?? 1;
  const totalItems = galleryData?.pagination.total ?? 0;

  const handleFiltersChange = useCallback((newFilters: Partial<GalleryFilterValues>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handlePerformance = (item: GalleryItemWithModel) => {
    setSelectedItem(item);
    setShowPerformanceModal(true);
  };

  const handleDelete = async (item: GalleryItemWithModel) => {
    if (!confirm('Delete this item permanently? This cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleViewDetail = (item: GalleryItemWithModel) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleEditContentType = (item: GalleryItemWithModel) => {
    setSelectedItem(item);
    setShowContentTypeEditor(true);
  };

  const invalidateGallery = () => {
    queryClient.invalidateQueries({ queryKey: ['gallery', 'items'] });
    queryClient.invalidateQueries({ queryKey: ['gallery', 'stats'] });
  };

  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('format', format);
      if (filters.contentType !== 'all') params.set('contentType', filters.contentType);
      if (filters.platform !== 'all') params.set('platform', filters.platform);
      if (filters.modelId) params.set('profileId', filters.modelId);
      params.set('isArchived', String(filters.isArchived));

      const response = await fetch(`/api/gallery/export?${params.toString()}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gallery-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Exported ${totalItems} items as ${format.toUpperCase()}`);
      } else {
        toast.error('Failed to export');
      }
    } catch {
      toast.error('Failed to export gallery');
    } finally {
      setExporting(false);
    }
  };

  const handleNavigateDetail = (direction: 'prev' | 'next') => {
    if (!selectedItem) return;
    const currentIndex = items.findIndex(i => i.id === selectedItem.id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < items.length) {
      setSelectedItem(items[newIndex]);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/10">
                  <ImageIcon className="w-6 h-6 text-violet-400" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-white">
                  Content Gallery
                </h1>
              </div>
              <p className="text-zinc-500 text-lg font-light max-w-xl">
                Track performance and manage your posted content
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting || totalItems === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="text-sm">Export CSV</span>
              </button>
            </div>
          </div>
        </header>

        {/* Stats Overview */}
        <StatsOverview stats={stats ?? null} loading={statsLoading} />

        {/* Filters */}
        <div className="mb-8">
          <GalleryFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            models={models}
            showAdvanced={showAdvancedFilters}
            onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
          />
        </div>

        {/* Results Count */}
        {!loading && totalItems > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-zinc-500 text-sm">
              Showing{' '}
              <span className="text-zinc-300 font-medium">
                {startIndex}-{endIndex}
              </span>{' '}
              of <span className="text-zinc-300 font-medium">{totalItems}</span> items
            </p>
            <button
              onClick={() => setGifsPlaying(p => !p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                gifsPlaying
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30'
                  : 'bg-zinc-900/80 border-zinc-800/50 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              {gifsPlaying ? (
                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                  <rect x="0" y="0" width="3" height="12" />
                  <rect x="7" y="0" width="3" height="12" />
                </svg>
              ) : (
                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                  <polygon points="1,0 10,6 1,12" />
                </svg>
              )}
              {gifsPlaying ? 'Pause GIFs' : 'Play GIFs'}
            </button>
          </div>
        )}

        {/* Gallery Grid */}
        <GalleryGrid
          items={items}
          loading={loading}
          gifsPlaying={gifsPlaying}
          onItemClick={handleViewDetail}
          onItemEditType={handleEditContentType}
          onItemPerformance={handlePerformance}
          onItemArchive={handleDelete}
        />

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

      {/* Performance Modal */}
      {showPerformanceModal && selectedItem && (
        <PerformanceModal
          item={selectedItem}
          onClose={() => {
            setShowPerformanceModal(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setShowPerformanceModal(false);
            setSelectedItem(null);
            invalidateGallery();
          }}
        />
      )}

      {/* Content Type Editor Modal */}
      {showContentTypeEditor && selectedItem && (
        <ContentTypeEditor
          item={selectedItem}
          onClose={() => {
            setShowContentTypeEditor(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setShowContentTypeEditor(false);
            setSelectedItem(null);
            invalidateGallery();
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedItem(null);
          }}
          onEditContentType={() => {
            setShowDetailModal(false);
            setShowContentTypeEditor(true);
          }}
          onEditPerformance={() => {
            setShowDetailModal(false);
            setShowPerformanceModal(true);
          }}
          onArchive={() => {
            setShowDetailModal(false);
            setSelectedItem(null);
            handleDelete(selectedItem);
          }}
          onNavigate={handleNavigateDetail}
          hasPrev={items.findIndex(i => i.id === selectedItem.id) > 0}
          hasNext={items.findIndex(i => i.id === selectedItem.id) < items.length - 1}
        />
      )}
    </div>
  );
}
