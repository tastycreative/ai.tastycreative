import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OfModel, OfModelStatus, OfModelFilters } from '@/types/of-model';

interface OfModelState {
  // Selected model for detail view/editing
  selectedModel: OfModel | null;

  // View preferences
  viewMode: 'grid' | 'table';

  // Filters
  filters: OfModelFilters;

  // UI State
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteModalOpen: boolean;

  // Actions - Model Selection
  setSelectedModel: (model: OfModel | null) => void;
  clearSelectedModel: () => void;

  // Actions - View Mode
  setViewMode: (mode: 'grid' | 'table') => void;
  toggleViewMode: () => void;

  // Actions - Filters
  setFilters: (filters: Partial<OfModelFilters>) => void;
  setSearch: (search: string) => void;
  setStatus: (status: OfModelStatus | 'all') => void;
  setSort: (sort: 'name' | 'createdAt' | 'launchDate') => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  resetFilters: () => void;

  // Actions - Modals
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (model: OfModel) => void;
  closeEditModal: () => void;
  openDeleteModal: (model: OfModel) => void;
  closeDeleteModal: () => void;
}

const defaultFilters: OfModelFilters = {
  search: '',
  status: 'all',
  sort: 'createdAt',
  sortDirection: 'desc',
};

export const useOfModelStore = create<OfModelState>()(
  persist(
    (set, get) => ({
      // Initial State
      selectedModel: null,
      viewMode: 'grid',
      filters: defaultFilters,
      isCreateModalOpen: false,
      isEditModalOpen: false,
      isDeleteModalOpen: false,

      // Model Selection
      setSelectedModel: (model) => set({ selectedModel: model }),
      clearSelectedModel: () => set({ selectedModel: null }),

      // View Mode
      setViewMode: (viewMode) => set({ viewMode }),
      toggleViewMode: () => set((state) => ({
        viewMode: state.viewMode === 'grid' ? 'table' : 'grid'
      })),

      // Filters
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      setSearch: (search) => set((state) => ({
        filters: { ...state.filters, search }
      })),
      setStatus: (status) => set((state) => ({
        filters: { ...state.filters, status }
      })),
      setSort: (sort) => set((state) => ({
        filters: { ...state.filters, sort }
      })),
      setSortDirection: (sortDirection) => set((state) => ({
        filters: { ...state.filters, sortDirection }
      })),
      resetFilters: () => set({ filters: defaultFilters }),

      // Modals
      openCreateModal: () => set({ isCreateModalOpen: true }),
      closeCreateModal: () => set({ isCreateModalOpen: false }),
      openEditModal: (model) => set({
        selectedModel: model,
        isEditModalOpen: true
      }),
      closeEditModal: () => set({
        isEditModalOpen: false,
        // Don't clear selectedModel in case we need it after close
      }),
      openDeleteModal: (model) => set({
        selectedModel: model,
        isDeleteModalOpen: true
      }),
      closeDeleteModal: () => set({
        isDeleteModalOpen: false,
        // Don't clear selectedModel in case we need it after close
      }),
    }),
    {
      name: 'of-model-store',
      // Only persist view preferences and filters, not transient UI state
      partialize: (state) => ({
        viewMode: state.viewMode,
        filters: state.filters,
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useOfModelFilters = () => useOfModelStore((state) => state.filters);
export const useOfModelViewMode = () => useOfModelStore((state) => state.viewMode);
export const useSelectedOfModel = () => useOfModelStore((state) => state.selectedModel);
