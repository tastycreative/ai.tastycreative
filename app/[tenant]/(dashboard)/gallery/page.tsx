'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ImageIcon, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GalleryFilters, type GalleryFilterValues } from '@/components/gallery/GalleryFilters';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { StatsOverview } from '@/components/gallery/StatsOverview';
import { PerformanceModal } from '@/components/gallery/PerformanceModal';
// import { TopPerformers } from '@/components/gallery/TopPerformers';
import { ContentTypeEditor } from '@/components/gallery/ContentTypeEditor';
import { DetailModal } from '@/components/gallery/DetailModal';
import type { GalleryItemWithModel } from '@/types/gallery';

interface ModelStats {
  model: {
    id: string;
    name: string;
    displayName: string;
    profileImageUrl: string | null;
  } | null;
  count: number;
  revenue: number;
  salesCount: number;
}

interface GalleryStats {
  totals: {
    itemCount: number;
    totalRevenue: number;
    totalSales: number;
    totalViews: number;
    averageRevenue: number;
    averageConversionRate: number;
  };
  byContentType: {
    contentType: string;
    count: number;
    revenue: number;
    salesCount: number;
  }[];
  byPlatform: {
    platform: string;
    count: number;
    revenue: number;
    salesCount: number;
  }[];
  byModel?: ModelStats[];
}

interface Model {
  id: string;
  name: string;
  displayName: string;
}

const ITEMS_PER_PAGE = 24;

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItemWithModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GalleryItemWithModel | null>(null);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showContentTypeEditor, setShowContentTypeEditor] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  // const [topPerformerSort, setTopPerformerSort] = useState<'count' | 'revenue'>('count');
  const [exporting, setExporting] = useState(false);

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filters.contentType, filters.platform, filters.modelId, filters.isArchived]);

  // Load stats
  useEffect(() => {
    loadStats();
  }, []);

  // Load models for filter
  useEffect(() => {
    loadModels();
  }, []);

  // Load items when filters or page changes
  useEffect(() => {
    loadItems();
  }, [
    currentPage,
    debouncedSearch,
    filters.contentType,
    filters.platform,
    filters.modelId,
    filters.isArchived,
    filters.sortField,
    filters.sortOrder,
  ]);

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('/api/gallery/stats');
      if (response.ok) {
        const result = await response.json();
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const response = await fetch('/api/of-models?limit=500');
      if (response.ok) {
        const result = await response.json();
        setModels(result.data || []);
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', String(ITEMS_PER_PAGE));

      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.contentType !== 'all') params.set('contentType', filters.contentType);
      if (filters.platform !== 'all') params.set('platform', filters.platform);
      if (filters.modelId) params.set('modelId', filters.modelId);
      params.set('isArchived', String(filters.isArchived));
      params.set('sortField', filters.sortField);
      params.set('sortOrder', filters.sortOrder);

      const response = await fetch(`/api/gallery?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setItems(result.data.items || []);
        setTotalPages(result.data.pagination.totalPages);
        setTotalItems(result.data.pagination.total);
      } else {
        toast.error('Failed to load gallery');
      }
    } catch (error) {
      console.error('Error loading gallery:', error);
      toast.error('Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = useCallback((newFilters: Partial<GalleryFilterValues>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handlePerformance = (item: GalleryItemWithModel) => {
    setSelectedItem(item);
    setShowPerformanceModal(true);
  };

  const handleArchive = async (item: GalleryItemWithModel) => {
    try {
      const response = await fetch(`/api/gallery/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !item.isArchived }),
      });

      if (response.ok) {
        toast.success(item.isArchived ? 'Item unarchived' : 'Item archived');
        loadItems();
        loadStats();
      } else {
        toast.error('Failed to update item');
      }
    } catch (error) {
      console.error('Error archiving item:', error);
      toast.error('Failed to update item');
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

  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('format', format);
      if (filters.contentType !== 'all') params.set('contentType', filters.contentType);
      if (filters.platform !== 'all') params.set('platform', filters.platform);
      if (filters.modelId) params.set('modelId', filters.modelId);
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
    } catch (error) {
      console.error('Error exporting:', error);
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
        <StatsOverview stats={stats} loading={statsLoading} />

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
          </div>
        )}

        {/* Gallery Grid */}
        <GalleryGrid
          items={items}
          loading={loading}
          onItemClick={handleViewDetail}
          onItemEditType={handleEditContentType}
          onItemPerformance={handlePerformance}
          onItemArchive={handleArchive}
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
            loadItems();
            loadStats();
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
            loadItems();
            loadStats();
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
            handleArchive(selectedItem);
            setShowDetailModal(false);
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
