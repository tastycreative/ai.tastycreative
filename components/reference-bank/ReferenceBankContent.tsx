"use client";

import { useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  X,
  Plus,
  AlertCircle,
  FolderPlus,
  ArrowLeft,
  Loader2,
  Grid3X3,
  List,
  Search,
  Heart,
  Clock,
  Folder,
  Check,
  PlayCircle,
  BarChart3,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
  Download,
  Move,
  Tag,
  SlidersHorizontal,
  Copy,
  Instagram,
  GripVertical,
  RefreshCw,
  Share2,
  Users,
} from "lucide-react";
import { useReferenceBankStore } from "@/lib/reference-bank/store";
import { invalidateRBQueries } from "@/lib/reference-bank/queryClientBridge";
import {
  referenceBankAPI,
  type ReferenceItem,
  type ReferenceFolder,
} from "@/lib/reference-bank/api";
import {
  useReferenceBankData,
  useStorageQuotaQuery,
  useToggleFavoriteMutation,
  useDeleteItemMutation,
  useUpdateItemMutation,
  useMoveItemsMutation,
  useBulkDeleteMutation,
  useBulkFavoriteMutation,
  useBulkAddTagsMutation,
} from "@/lib/hooks/useReferenceBank.query";

// Modal components
import { UploadModal } from "./modals/UploadModal";
import { EditModal } from "./modals/EditModal";
import { DeleteModal } from "./modals/DeleteModal";
import { FolderModal } from "./modals/FolderModal";
import { MoveModal } from "./modals/MoveModal";
import { InstagramImportModal } from "./modals/InstagramImportModal";
import { ConfirmModal } from "./modals/ConfirmModal";
import { ShareFolderModal } from "./modals/ShareFolderModal";
import {
  useSharedFolders,
  useSharedFolderItems,
} from "@/lib/hooks/useSharedFolders.query";

export function ReferenceBankContent() {
  // -------------------------------------------------------------------------
  // TanStack Query — server data + mutations
  // -------------------------------------------------------------------------
  const { data, isLoading, isFetching } = useReferenceBankData();
  const { data: storageData } = useStorageQuotaQuery();
  const { data: sharedData } = useSharedFolders();

  const items = data?.items ?? [];
  const folders = data?.folders ?? [];
  const stats = data?.stats ?? { total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 };
  const storageUsed = storageData?.used ?? 0;
  const storageLimit = storageData?.limit ?? 5 * 1024 * 1024 * 1024;

  const sharedFolders = sharedData?.sharedFolders ?? [];
  const ownSharedFolderIds: string[] = sharedData?.ownSharedFolderIds ?? [];

  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const deleteItemMutation = useDeleteItemMutation();
  const updateItemMutation = useUpdateItemMutation();
  const moveItemsMutation = useMoveItemsMutation();
  const bulkDeleteMutation = useBulkDeleteMutation();
  const bulkFavoriteMutation = useBulkFavoriteMutation();
  const bulkAddTagsMutation = useBulkAddTagsMutation();

  // -------------------------------------------------------------------------
  // Zustand store — UI-only state
  // -------------------------------------------------------------------------
  const {
    selectedFolderId,
    showFavoritesOnly,
    showRecentlyUsed,
    filterType,
    searchQuery,
    viewMode,
    sortBy,
    previewItem,
    uploadQueue,
    selectedItems,
    draggedItemId,
    dropTargetFolderId,
    setSelectedFolderId,
    setShowFavoritesOnly,
    setShowRecentlyUsed,
    setFilterType,
    setSearchQuery,
    setViewMode,
    setSortBy,
    toggleItemSelection,
    clearSelection,
    setPreviewItem,
    addToUploadQueue,
    removeFromUploadQueue,
    processUploadQueue,
    retryUpload,
    addFolder,
    updateFolder,
    removeFolder,
    setDraggedItemId,
    setDropTargetFolderId,
  } = useReferenceBankStore();

  // Local modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [editItem, setEditItem] = useState<ReferenceItem | null>(null);
  const [editFolder, setEditFolder] = useState<ReferenceFolder | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadQueueExpanded, setIsUploadQueueExpanded] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showInstagramImportModal, setShowInstagramImportModal] = useState(false);
  // Confirm-dialog state (replaces native confirm())
  const [pendingFolderDelete, setPendingFolderDelete] = useState<ReferenceFolder | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Shared folder state
  const [selectedSharedFolderId, setSelectedSharedFolderId] = useState<string | null>(null);
  const [shareFolderTarget, setShareFolderTarget] = useState<ReferenceFolder | null>(null);
  const { data: sharedFolderItemsData, isLoading: sharedItemsLoading } = useSharedFolderItems(selectedSharedFolderId);

  // Convert selectedItems Set to array for easier use
  const selectedIds = useMemo(
    () => Array.from(selectedItems || new Set()),
    [selectedItems]
  );

  // Local selectAll — uses filteredItems (not store.items) as source of truth
  const selectAll = useCallback(() => {
    useReferenceBankStore.setState({
      selectedItems: new Set(filteredItems.map((i) => i.id)),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* filteredItems added below after it's declared */]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    // If viewing a shared folder, use shared folder items
    let result = selectedSharedFolderId
      ? (sharedFolderItemsData?.items ?? [])
      : (items || []);

    // Don't apply folder/favorites/recently used filters here - they're handled by the store's fetchData
    // Only apply local filtering for search and type

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((item) =>
        filterType === "image"
          ? item.fileType === "image" || item.fileType.startsWith("image/")
          : item.fileType === "video" || item.fileType.startsWith("video/")
      );
    }

    // Sort
    switch (sortBy) {
      case "name":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "usage":
        result = [...result].sort(
          (a, b) => (b.usageCount || 0) - (a.usageCount || 0)
        );
        break;
      case "recent":
      default:
        result = [...result].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return result;
  }, [
    items,
    searchQuery,
    filterType,
    sortBy,
    selectedSharedFolderId,
    sharedFolderItemsData,
  ]);

  // Preview index & navigation (local — uses filteredItems, not store.items)
  const previewIndex = filteredItems.findIndex((i) => i.id === previewItem?.id);
  const handleNavigatePreview = useCallback(
    (direction: "prev" | "next") => {
      if (previewIndex === -1) return;
      let next =
        direction === "next" ? previewIndex + 1 : previewIndex - 1;
      if (next < 0) next = filteredItems.length - 1;
      if (next >= filteredItems.length) next = 0;
      setPreviewItem(filteredItems[next]);
    },
    [filteredItems, previewIndex, setPreviewItem]
  );

  // selectAll is fully defined here (needs filteredItems)
  const handleSelectAll = useCallback(() => {
    useReferenceBankStore.setState({
      selectedItems: new Set(filteredItems.map((i) => i.id)),
    });
  }, [filteredItems]);

  // Drag and drop handlers for file upload
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setShowUploadModal(true);
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (item: ReferenceItem) => {
      toggleFavoriteMutation.mutate({ id: item.id, isFavorite: !item.isFavorite });
    },
    [toggleFavoriteMutation]
  );

  const handleEditItem = useCallback((item: ReferenceItem) => {
    setEditItem(item);
    setShowEditModal(true);
  }, []);

  const handleDeleteItem = useCallback((item: ReferenceItem) => {
    setEditItem(item);
    setShowDeleteModal(true);
  }, []);

  const handlePreview = useCallback(
    (item: ReferenceItem) => {
      setPreviewItem(item);
    },
    [setPreviewItem]
  );

  // Bulk actions
  const handleBulkFavorite = useCallback(async () => {
    bulkFavoriteMutation.mutate({ itemIds: selectedIds, isFavorite: true });
    clearSelection();
  }, [selectedIds, bulkFavoriteMutation, clearSelection]);

  const handleBulkTag = useCallback(
    async (tags: string[]) => {
      bulkAddTagsMutation.mutate({ itemIds: selectedIds, tags });
    },
    [selectedIds, bulkAddTagsMutation]
  );

  const handleBulkMove = useCallback(() => {
    setShowMoveModal(true);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    await bulkDeleteMutation.mutateAsync(selectedIds);
    clearSelection();
    setShowBulkDeleteConfirm(false);
  }, [selectedIds, bulkDeleteMutation, clearSelection]);

  const handleDownloadSingleFile = useCallback(async (item: ReferenceItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      // Use proxy endpoint to avoid CORS issues
      const response = await fetch('/api/vault/proxy-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.awsS3Url }),
      });
      
      if (!response.ok) throw new Error('Failed to download file');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  }, []);

  const handleBulkDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const itemsToDownload = items.filter((i) => selectedIds.includes(i.id));
      for (const item of itemsToDownload) {
        // Use proxy endpoint to avoid CORS issues
        const response = await fetch('/api/vault/proxy-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.awsS3Url }),
        });
        
        if (!response.ok) {
          console.error(`Failed to download ${item.name}`);
          continue;
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      setIsDownloading(false);
    }
  }, [items, selectedIds]);

  // Folder actions
  const handleCreateFolder = useCallback(() => {
    setEditFolder(null);
    setShowFolderModal(true);
  }, []);

  const handleEditFolder = useCallback((folder: ReferenceFolder) => {
    setEditFolder(folder);
    setShowFolderModal(true);
  }, []);

  const handleDeleteFolder = useCallback(
    (folder: ReferenceFolder) => {
      setPendingFolderDelete(folder);
    },
    []
  );

  const handleConfirmFolderDelete = useCallback(async () => {
    if (!pendingFolderDelete) return;
    try {
      await referenceBankAPI.folders.delete(pendingFolderDelete.id);
      removeFolder(pendingFolderDelete.id);
      if (selectedFolderId === pendingFolderDelete.id) {
        setSelectedFolderId(null);
      }
    } catch (err) {
      console.error("Failed to delete folder:", err);
    } finally {
      setPendingFolderDelete(null);
    }
  }, [pendingFolderDelete, removeFolder, selectedFolderId, setSelectedFolderId]);

  const handleShareFolder = useCallback((folder: ReferenceFolder) => {
    setShareFolderTarget(folder);
  }, []);

  const handleSelectSharedFolder = useCallback((folderId: string | null) => {
    setSelectedSharedFolderId(folderId);
    // Clear own folder selection when viewing shared folder
    if (folderId) {
      setSelectedFolderId(null);
      setShowFavoritesOnly(false);
      setShowRecentlyUsed(false);
    }
  }, [setSelectedFolderId, setShowFavoritesOnly, setShowRecentlyUsed]);

  const handleSaveFolder = useCallback(
    async (data: { name: string; color?: string }) => {
      try {
        if (editFolder) {
          const updated = await referenceBankAPI.folders.update(editFolder.id, {
            name: data.name,
            color: data.color || "#8B5CF6",
          });
          updateFolder(editFolder.id, updated);
        } else {
          const created = await referenceBankAPI.folders.create({
            name: data.name,
            color: data.color || "#8B5CF6",
          });
          addFolder(created);
        }
        setShowFolderModal(false);
      } catch (err) {
        console.error("Failed to save folder:", err);
      }
    },
    [editFolder, updateFolder, addFolder]
  );

  // Move modal handler
  const handleMoveConfirm = useCallback(
    async (targetFolderId: string | null) => {
      try {
        await moveItemsMutation.mutateAsync({ itemIds: selectedIds, targetFolderId });
        clearSelection();
        setShowMoveModal(false);
      } catch (err) {
        console.error("Failed to move items:", err);
      }
    },
    [selectedIds, moveItemsMutation, clearSelection]
  );

  // Edit modal handler
  const handleSaveItem = useCallback(
    async (data: Partial<ReferenceItem>) => {
      if (!editItem) return;
      try {
        const updates: Parameters<typeof referenceBankAPI.updateItem>[1] = {};
        if (data.name) updates.name = data.name;
        if (data.tags) updates.tags = data.tags;
        await updateItemMutation.mutateAsync({ id: editItem.id, updates });
        setShowEditModal(false);
        setEditItem(null);
      } catch (err) {
        console.error("Failed to update item:", err);
      }
    },
    [editItem, updateItemMutation]
  );

  // Delete modal handler
  const handleDeleteConfirm = useCallback(async () => {
    if (!editItem) return;
    try {
      await deleteItemMutation.mutateAsync(editItem.id);
      setShowDeleteModal(false);
      setEditItem(null);
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  }, [editItem, deleteItemMutation]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
  }, []);

  // Get current folder name
  const currentFolder = folders.find((f) => f.id === selectedFolderId);

  // Determine current filter state for display
  const getCurrentFilterLabel = () => {
    if (selectedSharedFolderId) {
      const sf = sharedFolders.find((f) => f.id === selectedSharedFolderId);
      return sf ? `Shared: ${sf.name}` : "Shared Folder";
    }
    if (showFavoritesOnly) return "Favorites";
    if (showRecentlyUsed) return "Recently Used";
    if (currentFolder) return currentFolder.name;
    return "All References";
  };

  // Format storage size
  const formatStorage = useCallback((bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }, []);

  const storagePercentage = Math.min(
    ((storageUsed || 0) / (storageLimit || 1)) * 100,
    100
  );

  // Format date helper
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  if (isLoading && (items || []).length === 0) {
    return <ReferenceBankSkeleton />;
  }

  return (
    <div
      className="flex max-h-[85vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-white/5 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg backdrop-blur-sm custom-scrollbar"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Subtle re-fetch indicator */}
      {isFetching && !isLoading && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1a1625] border border-[#EC67A1]/20 rounded-full shadow-lg text-xs text-header-muted">
          <RefreshCw className="w-3 h-3 animate-spin text-[#EC67A1]" />
          Syncing…
        </div>
      )}
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-[#EC67A1]/10"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="w-5 h-5 text-sidebar-foreground" />
        ) : (
          <FolderPlus className="w-5 h-5 text-sidebar-foreground" />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-white dark:bg-[#1a1625] border-r border-[#EC67A1]/10 dark:border-[#EC67A1]/20 transform transition-transform duration-300 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo/Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 rounded-xl">
              <ImageIcon className="w-6 h-6 text-[#EC67A1]" />
            </div>
            <div>
              <h2 className="font-semibold text-sidebar-foreground">Reference Bank</h2>
              <p className="text-xs text-header-muted">
                {stats?.total || 0} items
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1 mb-6">
            <button
              onClick={() => { setSelectedFolderId(null); setSelectedSharedFolderId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                !showFavoritesOnly && !showRecentlyUsed && !selectedFolderId && !selectedSharedFolderId
                  ? "bg-[#EC67A1]/20 text-[#EC67A1] border border-[#EC67A1]/30"
                  : "text-header-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-sidebar-foreground border border-transparent"
              }`}
            >
              <ImageIcon className="w-5 h-5" />
              <span>All References</span>
              <span className="ml-auto text-xs text-header-muted">
                {stats?.total || 0}
              </span>
            </button>

            <button
              onClick={() => { setShowFavoritesOnly(true); setSelectedSharedFolderId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                showFavoritesOnly
                  ? "bg-[#EC67A1]/20 text-[#EC67A1] border border-[#EC67A1]/30"
                  : "text-header-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-sidebar-foreground border border-transparent"
              }`}
            >
              <Heart className="w-5 h-5" />
              <span>Favorites</span>
              <span className="ml-auto text-xs text-header-muted">
                {stats?.favorites || 0}
              </span>
            </button>

            <button
              onClick={() => { setShowRecentlyUsed(true); setSelectedSharedFolderId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                showRecentlyUsed
                  ? "bg-[#5DC3F8]/20 text-[#5DC3F8] border border-[#5DC3F8]/30"
                  : "text-header-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-sidebar-foreground border border-transparent"
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Recently Used</span>
            </button>
          </nav>

          {/* Folders */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-header-muted uppercase tracking-wider">
                Folders
              </span>
              <button
                onClick={handleCreateFolder}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
              >
                <Plus className="w-4 h-4 text-header-muted hover:text-sidebar-foreground" />
              </button>
            </div>

            <div className="space-y-1">
              {(folders || []).map((folder) => (
                <div
                  key={folder.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer border ${
                    selectedFolderId === folder.id
                      ? "bg-zinc-100 dark:bg-zinc-800 text-sidebar-foreground border-[#EC67A1]/20"
                      : dropTargetFolderId === folder.id
                      ? "bg-[#EC67A1]/20 text-[#EC67A1] border-[#EC67A1]/30"
                      : "text-header-muted hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-sidebar-foreground border-transparent"
                  }`}
                  onClick={() => { setSelectedFolderId(folder.id); setSelectedSharedFolderId(null); }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTargetFolderId(folder.id);
                  }}
                  onDragLeave={() => setDropTargetFolderId(null)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDropTargetFolderId(null);
                    if (draggedItemId) {
                      const itemsToMove = selectedIds.includes(draggedItemId)
                        ? selectedIds
                        : [draggedItemId];
                      await moveItemsMutation.mutateAsync({ itemIds: itemsToMove, targetFolderId: folder.id });
                      setDraggedItemId(null);
                    }
                  }}
                >
                  <Folder
                    className="w-5 h-5 shrink-0"
                    style={{ color: folder.color || "#EC67A1" }}
                  />
                  <span className="truncate flex-1">{folder.name}</span>
                  <span className="text-xs text-header-muted">
                    {(items || []).filter((i) => i.folderId === folder.id).length}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareFolder(folder);
                      }}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-sidebar-foreground"
                      title="Share folder"
                    >
                      <Share2 className={`w-3 h-3 ${ownSharedFolderIds.includes(folder.id) ? "text-[#EC67A1]" : ""}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditFolder(folder);
                      }}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-sidebar-foreground"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      className="p-1 hover:bg-red-500/20 rounded text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {ownSharedFolderIds.includes(folder.id) && (
                    <Share2 className="w-3 h-3 text-[#EC67A1]/50 shrink-0 group-hover:hidden" />
                  )}
                </div>
              ))}
            </div>

            {/* Shared with you */}
            {sharedFolders.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-header-muted" />
                  <span className="text-xs font-medium text-header-muted uppercase tracking-wider">
                    Shared with You
                  </span>
                </div>
                <div className="space-y-1">
                  {sharedFolders.map((sf) => (
                    <div
                      key={sf.id}
                      onClick={() => handleSelectSharedFolder(sf.id)}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer border ${
                        selectedSharedFolderId === sf.id
                          ? "bg-[#5DC3F8]/10 text-[#5DC3F8] border-[#5DC3F8]/30"
                          : "text-header-muted hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-sidebar-foreground border-transparent"
                      }`}
                    >
                      <Folder
                        className="w-5 h-5 shrink-0"
                        style={{ color: sf.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-sm">{sf.name}</span>
                        <span className="block text-xs text-header-muted/70 truncate">
                          by {sf.sharedBy}
                        </span>
                      </div>
                      {sf.itemCount > 0 && (
                        <span className="text-xs text-header-muted shrink-0">
                          {sf.itemCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Storage quota */}
          {(storageLimit || 0) > 0 && (
            <div className="mt-2 pt-4 border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
              <div className="flex items-center justify-between text-xs text-header-muted mb-1.5">
                <span>Storage</span>
                <span>{formatStorage(storageUsed || 0)} / {formatStorage(storageLimit)}</span>
              </div>
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    storagePercentage > 90
                      ? "bg-red-500"
                      : storagePercentage > 70
                      ? "bg-amber-500"
                      : "bg-[#EC67A1]"
                  }`}
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
              {storagePercentage > 80 && (
                <p className="text-xs text-amber-500 mt-1.5">
                  {storagePercentage > 90 ? "Storage almost full!" : "Running low on storage"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && createPortal(
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />,
        document.body
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 min-w-0">
              {(selectedFolderId || selectedSharedFolderId) && (
                <button
                  onClick={() => { setSelectedFolderId(null); setSelectedSharedFolderId(null); }}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-header-muted hover:text-sidebar-foreground" />
                </button>
              )}
              <h1 className="text-lg font-semibold text-sidebar-foreground truncate">
                {getCurrentFilterLabel()}
              </h1>
              <span className="text-sm text-header-muted">
                ({filteredItems.length} items)
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Hide upload when viewing a shared folder without EDIT permission */}
              {(!selectedSharedFolderId || sharedFolders.find(f => f.id === selectedSharedFolderId)?.permission === 'EDIT') && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
              )}
              <button
                onClick={() => setShowInstagramImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-90 text-white font-medium rounded-lg transition-all shadow-lg shadow-[#E1306C]/20"
              >
                <Instagram className="w-4 h-4" />
                <span className="hidden sm:inline">Import IG</span>
              </button>
              <button
                onClick={handleCreateFolder}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sidebar-foreground rounded-lg transition-colors border border-[#EC67A1]/10"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Folder</span>
              </button>
            </div>
          </div>

          {/* Search and view controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-header-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search references..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-sidebar-foreground placeholder-header-muted focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-header-muted hover:text-sidebar-foreground" />
                </button>
              )}
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#1a1625] rounded-lg p-1 border border-[#EC67A1]/10">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filterType === "all"
                    ? "bg-[#EC67A1] text-white shadow-sm"
                    : "text-header-muted hover:text-sidebar-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("image")}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filterType === "image"
                    ? "bg-[#5DC3F8] text-white shadow-sm"
                    : "text-header-muted hover:text-sidebar-foreground"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFilterType("video")}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filterType === "video"
                    ? "bg-[#F774B9] text-white shadow-sm"
                    : "text-header-muted hover:text-sidebar-foreground"
                }`}
              >
                <VideoIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "recent" | "name" | "usage")
              }
              className="px-3 py-2 bg-white dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-sidebar-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1]"
            >
              <option value="recent" className="bg-white dark:bg-[#1a1625] text-sidebar-foreground">Most Recent</option>
              <option value="name" className="bg-white dark:bg-[#1a1625] text-sidebar-foreground">Name</option>
              <option value="usage" className="bg-white dark:bg-[#1a1625] text-sidebar-foreground">Most Used</option>
            </select>

            {/* View mode */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#1a1625] rounded-lg p-1 border border-[#EC67A1]/10">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "grid"
                    ? "bg-[#EC67A1] text-white shadow-sm"
                    : "text-header-muted hover:text-sidebar-foreground"
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-[#EC67A1] text-white shadow-sm"
                    : "text-header-muted hover:text-sidebar-foreground"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.length > 0 && (
          <div className="shrink-0 px-4 py-3 bg-[#EC67A1]/5 dark:bg-[#EC67A1]/10 border-b border-[#EC67A1]/20 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#EC67A1] rounded flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-sidebar-foreground">
                {selectedIds.length} selected
              </span>
              <button
                onClick={
                  selectedIds.length === filteredItems.length
                    ? clearSelection
                    : handleSelectAll
                }
                className="text-sm text-[#EC67A1] hover:text-[#E1518E]"
              >
                {selectedIds.length === filteredItems.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkFavorite}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-sidebar-foreground text-sm rounded-lg transition-colors border border-[#EC67A1]/10"
              >
                <Heart className="w-4 h-4" />
                Favorite
              </button>
              <button
                onClick={handleBulkMove}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-sidebar-foreground text-sm rounded-lg transition-colors border border-[#EC67A1]/10"
              >
                <Move className="w-4 h-4" />
                Move
              </button>
              <button
                onClick={handleBulkDownload}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-sidebar-foreground text-sm rounded-lg transition-colors disabled:opacity-50 border border-[#EC67A1]/10"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 text-sm rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-header-muted" />
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-auto p-4">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-sidebar-foreground mb-2">
                Error Loading References
              </h2>
              <p className="text-header-muted mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  invalidateRBQueries();
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-lg transition-colors shadow-lg shadow-[#EC67A1]/30"
              >
                Try Again
              </button>
            </div>
          ) : isLoading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => (
                  <GridCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <ListRowSkeleton key={i} />
                ))}
              </div>
            )
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              {searchQuery ? (
                <>
                  <Search className="w-12 h-12 text-header-muted mb-4" />
                  <h2 className="text-xl font-semibold text-sidebar-foreground mb-2">
                    No matches found
                  </h2>
                  <p className="text-header-muted">
                    No references match &quot;{searchQuery}&quot;
                  </p>
                </>
              ) : showFavoritesOnly ? (
                <>
                  <Heart className="w-12 h-12 text-header-muted mb-4" />
                  <h2 className="text-xl font-semibold text-sidebar-foreground mb-2">
                    No favorites yet
                  </h2>
                  <p className="text-header-muted">
                    Mark items as favorites to see them here
                  </p>
                </>
              ) : selectedFolderId ? (
                <>
                  <Folder className="w-12 h-12 text-header-muted mb-4" />
                  <h2 className="text-xl font-semibold text-sidebar-foreground mb-2">
                    This folder is empty
                  </h2>
                  <p className="text-header-muted mb-4">
                    Upload files or drag items here to fill it up
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-lg transition-colors shadow-lg shadow-[#EC67A1]/30"
                  >
                    Upload Files
                  </button>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-header-muted mb-4" />
                  <h2 className="text-xl font-semibold text-sidebar-foreground mb-2">
                    No references yet
                  </h2>
                  <p className="text-header-muted mb-4">
                    Upload images and videos to build your reference library
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-lg transition-colors shadow-lg shadow-[#EC67A1]/30"
                  >
                    Upload Files
                  </button>
                </>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map((item) => (
                <GridItemCard
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.includes(item.id)}
                  onSelect={() => toggleItemSelection(item.id)}
                  onPreview={() => handlePreview(item)}
                  onToggleFavorite={() => handleToggleFavorite(item)}
                  onEdit={() => handleEditItem(item)}
                  onDelete={() => handleDeleteItem(item)}
                  onDragStart={() => setDraggedItemId(item.id)}
                  onDragEnd={() => setDraggedItemId(null)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.includes(item.id)}
                  onSelect={() => toggleItemSelection(item.id)}
                  onPreview={() => handlePreview(item)}
                  onToggleFavorite={() => handleToggleFavorite(item)}
                  onEdit={() => handleEditItem(item)}
                  onDelete={() => handleDeleteItem(item)}
                  onDragStart={() => setDraggedItemId(item.id)}
                  onDragEnd={() => setDraggedItemId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setPreviewItem(null)}
        >
          <button
            onClick={() => setPreviewItem(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Navigation */}
          {filteredItems.length > 1 && (
            <>
              <button
                onClick={() => handleNavigatePreview("prev")}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-colors z-10"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => handleNavigatePreview("next")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-colors rotate-180 z-10"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Content */}
          <div 
            className="max-w-5xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {(previewItem.fileType === "video" || previewItem.fileType.startsWith("video/")) ? (
              <video
                src={previewItem.awsS3Url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-lg"
              />
            ) : (
              <img
                src={previewItem.awsS3Url}
                alt={previewItem.name}
                className="max-w-full max-h-[80vh] rounded-lg object-contain"
              />
            )}
          </div>

          {/* Info panel */}
          <div 
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-3 bg-zinc-800/90 rounded-xl flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Name + counter */}
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">{previewItem.name}</span>
              <span className="text-xs text-gray-400">
                {previewIndex + 1} / {filteredItems.length}
              </span>
            </div>
            {/* Metadata row */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {previewItem.width && previewItem.height && (
                <span>{previewItem.width}&times;{previewItem.height}</span>
              )}
              {previewItem.fileSize && (
                <span>{(previewItem.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              )}
              {previewItem.createdAt && (
                <span>Uploaded {formatDate(previewItem.createdAt)}</span>
              )}
            </div>
            {/* Actions row */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleToggleFavorite(previewItem)}
                className={`p-2 rounded-lg transition-colors ${
                  previewItem.isFavorite
                    ? "text-[#EC67A1]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Heart
                  className={`w-5 h-5 ${
                    previewItem.isFavorite ? "fill-current" : ""
                  }`}
                />
              </button>
              <button
                onClick={() => handleCopyUrl(previewItem.awsS3Url)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <Copy className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => handleDownloadSingleFile(previewItem, e)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setPreviewItem(null);
                  handleEditItem(previewItem);
                }}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setPreviewItem(null);
                  handleDeleteItem(previewItem);
                }}
                className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Drag overlay */}
      {isDraggingFile && createPortal(
        <div className="fixed inset-0 bg-[#EC67A1]/20 border-4 border-dashed border-[#EC67A1] z-50 pointer-events-none flex items-center justify-center">
          <div className="bg-white dark:bg-[#1a1625] rounded-xl p-8 text-center shadow-2xl border border-[#EC67A1]/20">
            <Upload className="w-12 h-12 text-[#EC67A1] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-sidebar-foreground">
              Drop files to upload
            </h3>
            <p className="text-header-muted mt-2">Images and videos supported</p>
          </div>
        </div>,
        document.body
      )}

      {/* Modals */}
      {showUploadModal && createPortal(
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onFilesSelected={async (files) => {
            const targetFolderId = selectedSharedFolderId || selectedFolderId;
            const isShared = !!selectedSharedFolderId;
            for (const file of Array.from(files)) {
              addToUploadQueue({
                id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                name: file.name,
                description: "",
                tags: [],
                folderId: targetFolderId,
                isSharedFolder: isShared,
              });
            }
            setShowUploadModal(false);
            // Process the upload queue
            await processUploadQueue();
          }}
          currentFolderId={selectedSharedFolderId || selectedFolderId}
        />,
        document.body
      )}

      {showEditModal && editItem && createPortal(
        <EditModal
          item={editItem}
          onClose={() => {
            setShowEditModal(false);
            setEditItem(null);
          }}
          onSave={handleSaveItem}
        />,
        document.body
      )}

      {showDeleteModal && editItem && createPortal(
        <DeleteModal
          item={editItem}
          onClose={() => {
            setShowDeleteModal(false);
            setEditItem(null);
          }}
          onConfirm={handleDeleteConfirm}
        />,
        document.body
      )}

      {showFolderModal && createPortal(
        <FolderModal
          folder={editFolder}
          onClose={() => {
            setShowFolderModal(false);
            setEditFolder(null);
          }}
          onSave={handleSaveFolder}
        />,
        document.body
      )}

      {showMoveModal && createPortal(
        <MoveModal
          folders={folders || []}
          currentFolderId={selectedFolderId}
          selectedCount={selectedIds.length}
          onClose={() => setShowMoveModal(false)}
          onMove={handleMoveConfirm}
        />,
        document.body
      )}

      {showInstagramImportModal && createPortal(
        <InstagramImportModal
          onClose={() => setShowInstagramImportModal(false)}
          onImportComplete={() => {
            // TanStack will invalidate automatically via the bridge;
            // nothing extra needed here.
          }}
          folders={folders || []}
          currentFolderId={selectedFolderId}
        />,
        document.body
      )}

      {/* Folder delete confirmation */}
      {pendingFolderDelete && createPortal(
        <ConfirmModal
          title="Delete Folder"
          description={`"${pendingFolderDelete.name}" will be deleted. Items inside will be moved to root.`}
          confirmLabel="Delete Folder"
          onClose={() => setPendingFolderDelete(null)}
          onConfirm={handleConfirmFolderDelete}
        />,
        document.body
      )}

      {/* Bulk delete confirmation */}
      {showBulkDeleteConfirm && createPortal(
        <ConfirmModal
          title={`Delete ${selectedIds.length} items`}
          description={`All ${selectedIds.length} selected items will be permanently deleted. This cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.length} items`}
          isLoading={bulkDeleteMutation.isPending}
          onClose={() => setShowBulkDeleteConfirm(false)}
          onConfirm={handleBulkDelete}
        />,
        document.body
      )}

      {/* Share folder modal */}
      {shareFolderTarget && createPortal(
        <ShareFolderModal
          folderId={shareFolderTarget.id}
          folderName={shareFolderTarget.name}
          onClose={() => setShareFolderTarget(null)}
        />,
        document.body
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function GridCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1a1625] rounded-xl overflow-hidden border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 animate-pulse">
      <div className="aspect-square bg-zinc-200 dark:bg-zinc-800" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 bg-white dark:bg-[#1a1625] rounded-lg border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 animate-pulse">
      <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-700 shrink-0" />
      <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/5" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4" />
      </div>
    </div>
  );
}

function ReferenceBankSkeleton() {
  return (
    <div className="flex max-h-[85vh] overflow-hidden bg-white dark:bg-white/5 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg backdrop-blur-sm">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex flex-col w-72 border-r border-[#EC67A1]/10 dark:border-[#EC67A1]/20 p-4 animate-pulse shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-1.5 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
          ))}
        </div>
        <div className="mb-2 h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-16" />
        <div className="flex-1 space-y-1.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
          ))}
        </div>
        <div className="mt-auto pt-4 space-y-2">
          <div className="flex justify-between">
            <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-14" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-20" />
          </div>
          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-7 bg-zinc-200 dark:bg-zinc-700 rounded w-40" />
            <div className="ml-auto flex gap-2">
              <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              <div className="h-9 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
            <div className="w-24 h-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
            <div className="w-28 h-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
            <div className="w-20 h-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <GridCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Grid Item Card Component
function GridItemCard({
  item,
  isSelected,
  onSelect,
  onPreview,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  item: ReferenceItem;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const isVideo = item.fileType === "video" || item.fileType.startsWith("video/");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative bg-white dark:bg-[#1a1625] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02] hover:shadow-xl border ${
        isSelected ? "ring-2 ring-[#EC67A1] shadow-lg shadow-[#EC67A1]/20 border-[#EC67A1]/30" : "border-[#EC67A1]/10 dark:border-[#EC67A1]/20"
      }`}
    >
      {/* Drag handle indicator */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-60 transition-opacity z-10 text-white pointer-events-none">
        <GripVertical className="w-4 h-4" />
      </div>
      <div
        className="aspect-square bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden"
        onClick={onPreview}
      >
        {isVideo ? (
          <>
            {item.thumbnailUrl && item.thumbnailUrl !== item.awsS3Url ? (
              <img
                src={item.thumbnailUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <video
                src={item.awsS3Url}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <PlayCircle className="w-12 h-12 text-white opacity-80" />
            </div>
          </>
        ) : (
          <img
            src={item.thumbnailUrl || item.awsS3Url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
              item.isFavorite
                ? "bg-[#EC67A1]/90 text-white"
                : "bg-black/50 text-white hover:bg-[#EC67A1]/90"
            }`}
          >
            <Heart
              className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`}
            />
          </button>
        </div>

        <div className="absolute top-2 left-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`w-5 h-5 rounded border-2 transition-all ${
              isSelected
                ? "bg-[#EC67A1] border-[#EC67A1]"
                : "bg-black/30 border-white/50 hover:border-white"
            } backdrop-blur-sm flex items-center justify-center`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>

        <div className="absolute bottom-2 left-2">
          {isVideo ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F774B9]/90 backdrop-blur-sm text-white text-xs rounded-md">
              <VideoIcon className="w-3 h-3" />
              Video
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#5DC3F8]/90 backdrop-blur-sm text-white text-xs rounded-md">
              <ImageIcon className="w-3 h-3" />
              Image
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium text-sidebar-foreground truncate mb-1">
          {item.name}
        </h3>
        <div className="flex items-center justify-between text-xs text-header-muted">
          <span>
            {item.width && item.height
              ? `${item.width}×${item.height}`
              : item.fileSize
              ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB`
              : "Unknown"}
          </span>
          {item.usageCount > 0 && (
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {item.usageCount}
            </span>
          )}
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-[#EC67A1]/20 text-[#EC67A1] text-xs rounded"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 2 && (
              <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-header-muted text-xs rounded">
                +{item.tags.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-sidebar-foreground text-xs rounded transition-colors"
          >
            <Edit2 className="w-3 h-3 mx-auto" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 text-xs rounded transition-colors"
          >
            <Trash2 className="w-3 h-3 mx-auto" />
          </button>
        </div>
      </div>
    </div>
  );
}

// List Item Row Component
function ListItemRow({
  item,
  isSelected,
  onSelect,
  onPreview,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  item: ReferenceItem;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const isVideo = item.fileType === "video" || item.fileType.startsWith("video/");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-4 p-3 bg-white dark:bg-[#1a1625] rounded-lg cursor-grab active:cursor-grabbing transition-all hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/50 border ${
        isSelected ? "ring-2 ring-[#EC67A1] border-[#EC67A1]/30" : "border-[#EC67A1]/10 dark:border-[#EC67A1]/20"
      }`}
      onClick={onPreview}
    >
      {/* Drag handle */}
      <GripVertical className="w-4 h-4 text-header-muted opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`w-5 h-5 rounded border-2 transition-all shrink-0 ${
          isSelected
            ? "bg-[#EC67A1] border-[#EC67A1]"
            : "bg-zinc-100 dark:bg-zinc-700 border-[#EC67A1]/30 hover:border-[#EC67A1]"
        } flex items-center justify-center`}
      >
        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
      </button>

      <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden shrink-0 relative">
        {isVideo ? (
          <>
            {item.thumbnailUrl && item.thumbnailUrl !== item.awsS3Url ? (
              <img
                src={item.thumbnailUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <video
                src={item.awsS3Url}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayCircle className="w-6 h-6 text-white opacity-80" />
            </div>
          </>
        ) : (
          <img
            src={item.thumbnailUrl || item.awsS3Url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-sidebar-foreground truncate">
            {item.name}
          </h3>
          {item.isFavorite && (
            <Heart className="w-4 h-4 text-[#EC67A1] fill-current shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-header-muted">
          <span className="flex items-center gap-1">
            {isVideo ? (
              <VideoIcon className="w-3 h-3" />
            ) : (
              <ImageIcon className="w-3 h-3" />
            )}
            {isVideo ? "Video" : "Image"}
          </span>
          {item.width && item.height && (
            <span>
              {item.width}×{item.height}
            </span>
          )}
          {item.fileSize && (
            <span>{(item.fileSize / 1024 / 1024).toFixed(2)} MB</span>
          )}
          {item.usageCount > 0 && (
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {item.usageCount} uses
            </span>
          )}
        </div>
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-[#EC67A1]/20 text-[#EC67A1] text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-2 rounded-lg transition-colors ${
            item.isFavorite
              ? "text-[#EC67A1] hover:bg-[#EC67A1]/20"
              : "text-header-muted hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-sidebar-foreground"
          }`}
        >
          <Heart className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-2 text-header-muted hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-sidebar-foreground rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 text-header-muted hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
