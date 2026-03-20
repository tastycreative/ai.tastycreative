'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { GalleryFilters, type GalleryFilterValues } from './GalleryFilters';
import { GalleryGrid } from './GalleryGrid';
import { StatsOverview } from './StatsOverview';
import { PerformanceModal } from './PerformanceModal';
import { ContentTypeEditor } from './ContentTypeEditor';
import { DetailModal } from './DetailModal';
import {
  useGalleryItems,
  useGalleryStats,
  useDeleteGalleryItem,
  ITEMS_PER_PAGE,
} from '@/lib/hooks/useGallery.query';
import type { GalleryItemWithModel } from '@/types/gallery';

interface ProfileGalleryTabProps {
  profileId: string;
  profileName: string;
}

export function ProfileGalleryTab({ profileId, profileName }: ProfileGalleryTabProps) {
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
    modelId: profileId,
    isArchived: false,
    sortField: 'postedAt',
    sortOrder: 'desc',
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const queryFilters: GalleryFilterValues = { ...filters, search: debouncedSearch, modelId: profileId };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filters.contentType, filters.platform, filters.isArchived]);

  const {
    data: galleryData,
    isLoading: loading,
  } = useGalleryItems(queryFilters, currentPage);

  const { data: stats, isLoading: statsLoading } = useGalleryStats(profileId);
  const deleteMutation = useDeleteGalleryItem();

  const items = galleryData?.items ?? [];
  const totalPages = galleryData?.pagination.totalPages ?? 1;
  const totalItems = galleryData?.pagination.total ?? 0;

  const handleFiltersChange = useCallback((newFilters: Partial<GalleryFilterValues>) => {
    // Prevent overriding modelId
    const { modelId: _, ...rest } = newFilters;
    setFilters((prev) => ({ ...prev, ...rest }));
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
      params.set('profileId', profileId);
      if (filters.contentType !== 'all') params.set('contentType', filters.contentType);
      if (filters.platform !== 'all') params.set('platform', filters.platform);
      params.set('isArchived', String(filters.isArchived));

      const response = await fetch(`/api/gallery/export?${params.toString()}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gallery-${profileName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.${format}`;
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
  };

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Gallery for {profileName}
          </h3>
          <p className="text-[13px] text-[#71717a] mt-0.5">
            Content tagged by type with performance metrics
          </p>
        </div>
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting || totalItems === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <StatsOverview stats={stats ?? null} loading={statsLoading} />

      {/* Filters (no model selector since we're already scoped) */}
      <GalleryFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        models={[]}
        showAdvanced={showAdvancedFilters}
        onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
      />

      {/* Results Count */}
      {!loading && totalItems > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[#71717a] text-[13px]">
            Showing{' '}
            <span className="text-[#a1a1aa] font-medium">
              {startIndex}-{endIndex}
            </span>{' '}
            of <span className="text-[#a1a1aa] font-medium">{totalItems}</span> items
          </p>
          <button
            onClick={() => setGifsPlaying(p => !p)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
              gifsPlaying
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30'
                : 'bg-[#18181b] border-[#27272a] text-[#71717a] hover:text-white hover:border-[#3f3f46]'
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

      {/* Empty State */}
      {!loading && totalItems === 0 && (
        <div className="py-16 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#18181b] border border-[#27272a] mb-4">
            <ImageIcon className="w-7 h-7 text-[#52525b]" />
          </div>
          <p className="text-[#71717a] text-sm">No content found for {profileName}</p>
          <p className="text-[#52525b] text-xs mt-1">
            Gallery items will appear here once content is posted and tagged to this model
          </p>
        </div>
      )}

      {/* Grid */}
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
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-[#71717a] hover:text-white hover:border-[#3f3f46] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
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
                  className={`w-9 h-9 rounded-lg text-[13px] font-medium transition-colors ${
                    page === currentPage
                      ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30'
                      : 'bg-[#18181b] border border-[#27272a] text-[#71717a] hover:text-white hover:border-[#3f3f46]'
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-[#71717a] hover:text-white hover:border-[#3f3f46] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
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
            if (selectedItem) handleDelete(selectedItem);
            setSelectedItem(null);
          }}
          onNavigate={handleNavigateDetail}
          hasPrev={items.findIndex(i => i.id === selectedItem.id) > 0}
          hasNext={items.findIndex(i => i.id === selectedItem.id) < items.length - 1}
        />
      )}
    </div>
  );
}
