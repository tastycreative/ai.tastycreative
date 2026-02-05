/**
 * Reference Bank Store - Zustand state management
 * Provides centralized state with optimistic updates
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { 
  referenceBankAPI, 
  ReferenceItem, 
  ReferenceFolder, 
  Stats,
  UploadQueueItem,
  calculateFileHash,
  folderSortPreferences
} from "./api";

interface ReferenceBankState {
  // Data
  items: ReferenceItem[];
  folders: ReferenceFolder[];
  stats: Stats;
  
  // Loading states
  isLoading: boolean;
  isUploading: boolean;
  
  // Filters
  selectedFolderId: string | null;
  showFavoritesOnly: boolean;
  showRecentlyUsed: boolean;
  filterType: "all" | "image" | "video";
  searchQuery: string;
  sortBy: "recent" | "name" | "usage";
  
  // Selection
  selectedItems: Set<string>;
  
  // UI State
  viewMode: "grid" | "list";
  sidebarOpen: boolean;
  
  // Upload queue
  uploadQueue: UploadQueueItem[];
  
  // Preview
  previewItem: ReferenceItem | null;
  previewIndex: number;
  
  // Drag and drop
  draggedItemId: string | null;
  dropTargetFolderId: string | null;
  
  // Storage
  storageUsed: number;
  storageLimit: number;
  
  // Actions
  fetchData: () => Promise<void>;
  fetchRecentlyUsed: () => Promise<ReferenceItem[]>;
  setSelectedFolderId: (id: string | null) => void;
  setShowFavoritesOnly: (show: boolean) => void;
  setShowRecentlyUsed: (show: boolean) => void;
  setFilterType: (type: "all" | "image" | "video") => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "recent" | "name" | "usage") => void;
  setViewMode: (mode: "grid" | "list") => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Selection actions
  toggleItemSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // Item actions
  addItem: (item: ReferenceItem) => void;
  updateItem: (id: string, updates: Partial<ReferenceItem>) => void;
  deleteItem: (id: string) => Promise<void>;
  toggleFavorite: (item: ReferenceItem) => Promise<void>;
  moveItems: (itemIds: string[], targetFolderId: string | null) => Promise<void>;
  bulkFavorite: (itemIds: string[], isFavorite: boolean) => Promise<void>;
  bulkAddTags: (itemIds: string[], tags: string[]) => Promise<void>;
  bulkDelete: (itemIds: string[]) => Promise<void>;
  
  // Folder actions
  addFolder: (folder: ReferenceFolder) => void;
  updateFolder: (id: string, updates: Partial<ReferenceFolder>) => void;
  removeFolder: (id: string) => void;
  
  // Upload queue actions
  addToUploadQueue: (item: Omit<UploadQueueItem, "status" | "progress" | "retryCount">) => void;
  updateUploadItem: (id: string, updates: Partial<UploadQueueItem>) => void;
  removeFromUploadQueue: (id: string) => void;
  processUploadQueue: () => Promise<void>;
  retryUpload: (id: string) => Promise<void>;
  
  // Preview actions
  setPreviewItem: (item: ReferenceItem | null) => void;
  navigatePreview: (direction: "prev" | "next") => void;
  
  // Drag and drop actions
  setDraggedItemId: (id: string | null) => void;
  setDropTargetFolderId: (id: string | null) => void;
  handleDrop: (targetFolderId: string) => Promise<void>;
  
  // Storage
  fetchStorageQuota: () => Promise<void>;
}

export const useReferenceBankStore = create<ReferenceBankState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      folders: [],
      stats: { total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 },
      isLoading: true,
      isUploading: false,
      selectedFolderId: null,
      showFavoritesOnly: false,
      showRecentlyUsed: false,
      filterType: "all",
      searchQuery: "",
      sortBy: "recent",
      selectedItems: new Set(),
      viewMode: "grid",
      sidebarOpen: false,
      uploadQueue: [],
      previewItem: null,
      previewIndex: -1,
      draggedItemId: null,
      dropTargetFolderId: null,
      storageUsed: 0,
      storageLimit: 5 * 1024 * 1024 * 1024, // 5GB default

      // Fetch data
      fetchData: async () => {
        set({ isLoading: true });
        try {
          const { selectedFolderId, showFavoritesOnly, showRecentlyUsed, filterType, searchQuery } = get();
          
          const data = await referenceBankAPI.fetchData({
            folderId: selectedFolderId,
            favorites: showFavoritesOnly,
            fileType: filterType,
            search: searchQuery,
            recentlyUsed: showRecentlyUsed,
          });
          
          set({
            items: data.items || [],
            folders: data.folders || [],
            stats: data.stats || { total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 },
          });
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchRecentlyUsed: async () => {
        try {
          const data = await referenceBankAPI.fetchData({
            recentlyUsed: true,
            limit: 10,
          });
          return data.items || [];
        } catch (error) {
          console.error("Error fetching recently used:", error);
          return [];
        }
      },

      // Filter setters
      setSelectedFolderId: (id) => {
        const sortBy = folderSortPreferences.get(id);
        set({ 
          selectedFolderId: id, 
          showFavoritesOnly: false, 
          showRecentlyUsed: false,
          sortBy,
          selectedItems: new Set() 
        });
        get().fetchData();
      },

      setShowFavoritesOnly: (show) => {
        set({ showFavoritesOnly: show, selectedFolderId: null, showRecentlyUsed: false, selectedItems: new Set() });
        get().fetchData();
      },

      setShowRecentlyUsed: (show) => {
        set({ showRecentlyUsed: show, showFavoritesOnly: false, selectedFolderId: null, selectedItems: new Set() });
        get().fetchData();
      },

      setFilterType: (type) => {
        set({ filterType: type, selectedItems: new Set() });
        get().fetchData();
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query, selectedItems: new Set() });
        get().fetchData();
      },

      setSortBy: (sortBy) => {
        const { selectedFolderId } = get();
        folderSortPreferences.set(selectedFolderId, sortBy);
        set({ sortBy });
      },

      setViewMode: (mode) => set({ viewMode: mode }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Selection actions
      toggleItemSelection: (id) => {
        set((state) => {
          const newSet = new Set(state.selectedItems);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return { selectedItems: newSet };
        });
      },

      selectAll: () => {
        const { items } = get();
        set({ selectedItems: new Set(items.map((i) => i.id)) });
      },

      clearSelection: () => set({ selectedItems: new Set() }),

      // Item actions
      addItem: (item) => {
        set((state) => ({ items: [item, ...state.items] }));
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        }));
      },

      deleteItem: async (id) => {
        // Optimistic update
        const { items } = get();
        const item = items.find((i) => i.id === id);
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
          selectedItems: new Set([...state.selectedItems].filter((i) => i !== id)),
        }));

        try {
          await referenceBankAPI.deleteItem(id);
          get().fetchData(); // Refresh stats
        } catch (error) {
          // Revert on error
          if (item) {
            set((state) => ({ items: [item, ...state.items] }));
          }
          throw error;
        }
      },

      toggleFavorite: async (item) => {
        // Optimistic update
        const newFavorite = !item.isFavorite;
        set((state) => ({
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, isFavorite: newFavorite } : i
          ),
          stats: {
            ...state.stats,
            favorites: newFavorite ? state.stats.favorites + 1 : state.stats.favorites - 1,
          },
        }));

        try {
          await referenceBankAPI.updateItem(item.id, { isFavorite: newFavorite });
        } catch (error) {
          // Revert on error
          set((state) => ({
            items: state.items.map((i) =>
              i.id === item.id ? { ...i, isFavorite: !newFavorite } : i
            ),
            stats: {
              ...state.stats,
              favorites: newFavorite ? state.stats.favorites - 1 : state.stats.favorites + 1,
            },
          }));
          throw error;
        }
      },

      moveItems: async (itemIds, targetFolderId) => {
        // Optimistic update
        const { items, folders } = get();
        const previousItems = [...items];
        const targetFolder = folders.find((f) => f.id === targetFolderId);

        set((state) => ({
          items: state.items.map((i) =>
            itemIds.includes(i.id)
              ? {
                  ...i,
                  folderId: targetFolderId,
                  folder: targetFolder
                    ? { id: targetFolder.id, name: targetFolder.name, color: targetFolder.color }
                    : null,
                }
              : i
          ),
          selectedItems: new Set(),
        }));

        try {
          await referenceBankAPI.bulkMove(itemIds, targetFolderId);
          get().fetchData(); // Refresh to get updated folder counts
        } catch (error) {
          // Revert on error
          set({ items: previousItems });
          throw error;
        }
      },

      bulkFavorite: async (itemIds, isFavorite) => {
        // Optimistic update
        const { items } = get();
        const previousItems = [...items];

        set((state) => ({
          items: state.items.map((i) =>
            itemIds.includes(i.id) ? { ...i, isFavorite } : i
          ),
          selectedItems: new Set(),
        }));

        try {
          await referenceBankAPI.bulkFavorite(itemIds, isFavorite);
          get().fetchData();
        } catch (error) {
          set({ items: previousItems });
          throw error;
        }
      },

      bulkAddTags: async (itemIds, tags) => {
        // Optimistic update
        const { items } = get();
        const previousItems = [...items];

        set((state) => ({
          items: state.items.map((i) =>
            itemIds.includes(i.id)
              ? { ...i, tags: [...new Set([...i.tags, ...tags])] }
              : i
          ),
          selectedItems: new Set(),
        }));

        try {
          await referenceBankAPI.bulkAddTags(itemIds, tags);
        } catch (error) {
          set({ items: previousItems });
          throw error;
        }
      },

      bulkDelete: async (itemIds) => {
        // Optimistic update
        const { items } = get();
        const deletedItems = items.filter((i) => itemIds.includes(i.id));

        set((state) => ({
          items: state.items.filter((i) => !itemIds.includes(i.id)),
          selectedItems: new Set(),
        }));

        try {
          await Promise.all(itemIds.map((id) => referenceBankAPI.deleteItem(id)));
          get().fetchData();
        } catch (error) {
          // Revert on error
          set((state) => ({ items: [...deletedItems, ...state.items] }));
          throw error;
        }
      },

      // Folder actions
      addFolder: (folder) => {
        set((state) => ({ folders: [...state.folders, folder] }));
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          folders: state.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        }));
      },

      removeFolder: (id) => {
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
        }));
      },

      // Upload queue actions
      addToUploadQueue: (item) => {
        set((state) => ({
          uploadQueue: [
            ...state.uploadQueue,
            { ...item, status: "pending", progress: 0, retryCount: 0 },
          ],
        }));
      },

      updateUploadItem: (id, updates) => {
        set((state) => ({
          uploadQueue: state.uploadQueue.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      removeFromUploadQueue: (id) => {
        set((state) => ({
          uploadQueue: state.uploadQueue.filter((item) => item.id !== id),
        }));
      },

      processUploadQueue: async () => {
        const { uploadQueue, updateUploadItem, removeFromUploadQueue, addItem, fetchData } = get();
        const pendingItems = uploadQueue.filter((item) => item.status === "pending");

        set({ isUploading: true });

        for (const queueItem of pendingItems) {
          updateUploadItem(queueItem.id, { status: "uploading", progress: 0 });

          try {
            // Calculate hash for duplicate detection
            const hash = await calculateFileHash(queueItem.file);
            updateUploadItem(queueItem.id, { hash });

            // Check for duplicates
            const duplicateCheck = await referenceBankAPI.checkDuplicate(hash);
            if (duplicateCheck.exists) {
              updateUploadItem(queueItem.id, {
                status: "duplicate",
                error: `Duplicate of "${duplicateCheck.item?.name}"`,
              });
              continue;
            }

            // Get presigned URL
            const { uploadUrl, key } = await referenceBankAPI.getPresignedUrl(
              queueItem.file.name,
              queueItem.file.type,
              queueItem.folderId
            );
            updateUploadItem(queueItem.id, { progress: 20 });

            // Upload to S3
            await referenceBankAPI.uploadToS3(uploadUrl, queueItem.file, (progress) => {
              updateUploadItem(queueItem.id, { progress: 20 + Math.round(progress * 0.6) });
            });
            updateUploadItem(queueItem.id, { progress: 80 });

            // Create record
            const newItem = await referenceBankAPI.createItem({
              name: queueItem.name,
              description: queueItem.description,
              tags: queueItem.tags,
              fileType: queueItem.file.type.startsWith("video/") ? "video" : "image",
              mimeType: queueItem.file.type,
              fileSize: queueItem.file.size,
              awsS3Key: key,
              folderId: queueItem.folderId,
              fileHash: hash,
            });

            updateUploadItem(queueItem.id, { status: "success", progress: 100 });
            addItem(newItem);

            // Remove from queue after short delay
            setTimeout(() => removeFromUploadQueue(queueItem.id), 2000);
          } catch (error) {
            updateUploadItem(queueItem.id, {
              status: "error",
              error: error instanceof Error ? error.message : "Upload failed",
              retryCount: queueItem.retryCount + 1,
            });
          }
        }

        set({ isUploading: false });
        fetchData(); // Refresh stats
      },

      retryUpload: async (id) => {
        const { uploadQueue, processUploadQueue } = get();
        const item = uploadQueue.find((i) => i.id === id);
        if (item && item.status === "error" && item.retryCount < 3) {
          set((state) => ({
            uploadQueue: state.uploadQueue.map((i) =>
              i.id === id ? { ...i, status: "pending" } : i
            ),
          }));
          await processUploadQueue();
        }
      },

      // Preview actions
      setPreviewItem: (item) => {
        const { items } = get();
        const index = item ? items.findIndex((i) => i.id === item.id) : -1;
        set({ previewItem: item, previewIndex: index });
      },

      navigatePreview: (direction) => {
        const { items, previewIndex } = get();
        if (previewIndex === -1) return;

        let newIndex = direction === "next" ? previewIndex + 1 : previewIndex - 1;
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;

        set({ previewItem: items[newIndex], previewIndex: newIndex });
      },

      // Drag and drop
      setDraggedItemId: (id) => set({ draggedItemId: id }),
      setDropTargetFolderId: (id) => set({ dropTargetFolderId: id }),

      handleDrop: async (targetFolderId) => {
        const { draggedItemId, selectedItems, moveItems } = get();
        
        if (!draggedItemId) return;

        // If the dragged item is selected, move all selected items
        const itemsToMove = selectedItems.has(draggedItemId)
          ? Array.from(selectedItems)
          : [draggedItemId];

        await moveItems(itemsToMove, targetFolderId === "root" ? null : targetFolderId);
        set({ draggedItemId: null, dropTargetFolderId: null });
      },

      // Storage quota
      fetchStorageQuota: async () => {
        try {
          const { used, limit } = await referenceBankAPI.getStorageQuota();
          set({ storageUsed: used, storageLimit: limit });
        } catch (error) {
          console.error("Error fetching storage quota:", error);
        }
      },
    }),
    {
      name: "reference-bank-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
      }),
    }
  )
);

// Selector hooks for common patterns
export const useSelectedItems = () =>
  useReferenceBankStore((state) => state.selectedItems);

export const useSortedItems = () =>
  useReferenceBankStore((state) => {
    const items = [...state.items];
    switch (state.sortBy) {
      case "name":
        return items.sort((a, b) => a.name.localeCompare(b.name));
      case "usage":
        return items.sort((a, b) => b.usageCount - a.usageCount);
      case "recent":
      default:
        return items.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  });

export const useUploadQueue = () =>
  useReferenceBankStore((state) => state.uploadQueue);

export const useIsAnyUploading = () =>
  useReferenceBankStore((state) =>
    state.uploadQueue.some((item) => item.status === "uploading")
  );
