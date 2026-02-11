"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
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
} from "lucide-react";
import { useReferenceBankStore } from "@/lib/reference-bank/store";
import {
  referenceBankAPI,
  type ReferenceItem,
  type ReferenceFolder,
} from "@/lib/reference-bank/api";

// Modal components
import { UploadModal } from "./modals/UploadModal";
import { EditModal } from "./modals/EditModal";
import { DeleteModal } from "./modals/DeleteModal";
import { FolderModal } from "./modals/FolderModal";
import { MoveModal } from "./modals/MoveModal";

export function ReferenceBankContent() {
  // Get state from store - using the actual store interface
  const {
    items,
    folders,
    stats,
    isLoading,
    selectedFolderId,
    showFavoritesOnly,
    showRecentlyUsed,
    filterType,
    searchQuery,
    viewMode,
    sortBy,
    previewItem,
    storageUsed,
    storageLimit,
    uploadQueue,
    selectedItems,
    draggedItemId,
    dropTargetFolderId,
    sidebarOpen,
    fetchData,
    setSelectedFolderId,
    setShowFavoritesOnly,
    setShowRecentlyUsed,
    setFilterType,
    setSearchQuery,
    setViewMode,
    setSortBy,
    toggleItemSelection,
    selectAll,
    clearSelection,
    setPreviewItem,
    addToUploadQueue,
    removeFromUploadQueue,
    processUploadQueue,
    retryUpload,
    updateItem,
    deleteItem,
    toggleFavorite,
    moveItems,
    bulkFavorite,
    bulkAddTags,
    bulkDelete,
    addFolder,
    updateFolder,
    removeFolder,
    navigatePreview,
    previewIndex,
    setDraggedItemId,
    setDropTargetFolderId,
    fetchStorageQuota,
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

  // Convert selectedItems Set to array for easier use
  const selectedIds = useMemo(
    () => Array.from(selectedItems || new Set()),
    [selectedItems]
  );

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = items || [];

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
          ? item.fileType.startsWith("image/")
          : item.fileType.startsWith("video/")
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
  ]);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    fetchStorageQuota();
  }, []);

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

  // Item actions
  const handleToggleFavorite = useCallback(
    async (item: ReferenceItem) => {
      try {
        await toggleFavorite(item);
      } catch (err) {
        console.error("Failed to toggle favorite:", err);
      }
    },
    [toggleFavorite]
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
    try {
      await bulkFavorite(selectedIds, true);
    } catch (err) {
      console.error("Failed to favorite items:", err);
    }
  }, [selectedIds, bulkFavorite]);

  const handleBulkTag = useCallback(
    async (tags: string[]) => {
      try {
        await bulkAddTags(selectedIds, tags);
      } catch (err) {
        console.error("Failed to tag items:", err);
      }
    },
    [selectedIds, bulkAddTags]
  );

  const handleBulkMove = useCallback(() => {
    setShowMoveModal(true);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (!confirm(`Delete ${selectedIds.length} items?`)) return;
    try {
      await bulkDelete(selectedIds);
    } catch (err) {
      console.error("Failed to delete items:", err);
    }
  }, [selectedIds, bulkDelete]);

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
    async (folder: ReferenceFolder) => {
      if (!confirm("Delete this folder? Items will be moved to root.")) return;
      try {
        await referenceBankAPI.folders.delete(folder.id);
        removeFolder(folder.id);
        if (selectedFolderId === folder.id) {
          setSelectedFolderId(null);
        }
      } catch (err) {
        console.error("Failed to delete folder:", err);
      }
    },
    [removeFolder, selectedFolderId, setSelectedFolderId]
  );

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
        await moveItems(selectedIds, targetFolderId);
        setShowMoveModal(false);
      } catch (err) {
        console.error("Failed to move items:", err);
      }
    },
    [selectedIds, moveItems]
  );

  // Edit modal handler
  const handleSaveItem = useCallback(
    async (data: Partial<ReferenceItem>) => {
      if (!editItem) return;
      try {
        // Only send allowed fields
        const updateData: { name?: string; description?: string; tags?: string[]; isFavorite?: boolean; folderId?: string | null } = {};
        if (data.name) updateData.name = data.name;
        if (data.tags) updateData.tags = data.tags;
        
        await referenceBankAPI.updateItem(editItem.id, updateData);
        updateItem(editItem.id, data);
        setShowEditModal(false);
        setEditItem(null);
      } catch (err) {
        console.error("Failed to update item:", err);
      }
    },
    [editItem, updateItem]
  );

  // Delete modal handler
  const handleDeleteConfirm = useCallback(async () => {
    if (!editItem) return;
    try {
      await deleteItem(editItem.id);
      setShowDeleteModal(false);
      setEditItem(null);
      fetchStorageQuota();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  }, [editItem, deleteItem, fetchStorageQuota]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
  }, []);

  // Get current folder name
  const currentFolder = folders.find((f) => f.id === selectedFolderId);

  // Determine current filter state for display
  const getCurrentFilterLabel = () => {
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

  if (isLoading && (items || []).length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-mid-pink animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="flex h-full bg-white dark:bg-[#1a1625]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
        className={`fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-[#F8F8F8] dark:bg-[#1a1625] border-r border-[#EC67A1]/10 dark:border-[#EC67A1]/20 transform transition-transform duration-300 ${
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
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                !showFavoritesOnly && !showRecentlyUsed && !selectedFolderId
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
              onClick={() => setShowFavoritesOnly(true)}
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
              onClick={() => setShowRecentlyUsed(true)}
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
                  onClick={() => setSelectedFolderId(folder.id)}
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
                      await moveItems(itemsToMove, folder.id);
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
                </div>
              ))}
            </div>
          </div>
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
              {selectedFolderId && (
                <button
                  onClick={() => setSelectedFolderId(null)}
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
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
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
                className="w-full pl-10 pr-4 py-2 bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-sidebar-foreground placeholder-header-muted focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1]"
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
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-[#EC67A1]/10">
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
              className="px-3 py-2 bg-white dark:bg-[#1a1625] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-sidebar-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1]"
            >
              <option value="recent">Most Recent</option>
              <option value="name">Name</option>
              <option value="usage">Most Used</option>
            </select>

            {/* View mode */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-[#EC67A1]/10">
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
                    : selectAll
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
                onClick={handleBulkDelete}
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
        <div className="flex-1 overflow-auto p-4 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-[#1a1625]/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-brand-mid-pink animate-spin" />
                <p className="text-sm text-header-muted">Loading...</p>
              </div>
            </div>
          )}
          
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
                  fetchData();
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-lg transition-colors shadow-lg shadow-[#EC67A1]/30"
              >
                Try Again
              </button>
            </div>
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
                onClick={() => navigatePreview("prev")}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-colors z-10"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => navigatePreview("next")}
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
            {previewItem.fileType.startsWith("video/") ? (
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
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-zinc-800/90 rounded-xl z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white font-medium">{previewItem.name}</span>
            <div className="flex items-center gap-2">
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
            <span className="text-sm text-gray-400">
              {previewIndex + 1} / {filteredItems.length}
            </span>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Queue */}
      {(uploadQueue || []).length > 0 && createPortal(
        <div className="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)]">
          <div className="bg-white dark:bg-[#1a1625] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl shadow-2xl overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 bg-[#F8F8F8] dark:bg-[#1a1625]/50 cursor-pointer border-b border-[#EC67A1]/10"
              onClick={() => setIsUploadQueueExpanded(!isUploadQueueExpanded)}
            >
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-[#EC67A1]" />
                <span className="text-sm font-medium text-sidebar-foreground">
                  Uploading {uploadQueue.filter((i) => i.status === "uploading").length} files
                </span>
              </div>
              {isUploadQueueExpanded ? (
                <X className="w-4 h-4 text-header-muted" />
              ) : (
                <SlidersHorizontal className="w-4 h-4 text-header-muted" />
              )}
            </div>
            {isUploadQueueExpanded && (
              <div className="max-h-64 overflow-y-auto p-2 space-y-2">
                {uploadQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 bg-[#F8F8F8] dark:bg-zinc-800 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-sidebar-foreground truncate">{item.name}</p>
                      {item.status === "uploading" && (
                        <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-[#EC67A1] transition-all"
                            style={{ width: `${item.progress || 0}%` }}
                          />
                        </div>
                      )}
                      {item.status === "error" && (
                        <p className="text-xs text-red-500 truncate">
                          {item.error}
                        </p>
                      )}
                    </div>
                    {item.status === "uploading" && (
                      <Loader2 className="w-4 h-4 text-[#EC67A1] animate-spin" />
                    )}
                    {item.status === "success" && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                    {item.status === "error" && (
                      <button
                        onClick={() => retryUpload(item.id)}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                      >
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFromUploadQueue(item.id)}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                    >
                      <X className="w-4 h-4 text-header-muted" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            for (const file of Array.from(files)) {
              addToUploadQueue({
                id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                name: file.name,
                description: "",
                tags: [],
                folderId: selectedFolderId,
              });
            }
            setShowUploadModal(false);
            // Process the upload queue
            await processUploadQueue();
          }}
          currentFolderId={selectedFolderId}
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
  const isVideo = item.fileType.startsWith("video/");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative bg-white dark:bg-[#1a1625] rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl border ${
        isSelected ? "ring-2 ring-[#EC67A1] shadow-lg shadow-[#EC67A1]/20 border-[#EC67A1]/30" : "border-[#EC67A1]/10 dark:border-[#EC67A1]/20"
      }`}
    >
      <div
        className="aspect-square bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden"
        onClick={onPreview}
      >
        {isVideo ? (
          <>
            <video
              src={item.thumbnailUrl || item.awsS3Url}
              className="w-full h-full object-cover"
              muted
            />
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
  const isVideo = item.fileType.startsWith("video/");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-4 p-3 bg-white dark:bg-[#1a1625] rounded-lg cursor-pointer transition-all hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/50 border ${
        isSelected ? "ring-2 ring-[#EC67A1] border-[#EC67A1]/30" : "border-[#EC67A1]/10 dark:border-[#EC67A1]/20"
      }`}
      onClick={onPreview}
    >
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
            <video
              src={item.thumbnailUrl || item.awsS3Url}
              className="w-full h-full object-cover"
              muted
            />
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
