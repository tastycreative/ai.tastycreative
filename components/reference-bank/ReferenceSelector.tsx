"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Library,
  Search,
  X,
  Check,
  Image as ImageIcon,
  Video as VideoIcon,
  BarChart3,
  ChevronDown,
  Loader2,
  PlayCircle,
  Heart,
  Folder,
  FolderOpen,
} from "lucide-react";
import { ReferenceItem, ReferenceFolder } from "@/hooks/useReferenceBank";

interface ReferenceSelectorProps {
  profileId?: string;
  onSelect: (item: ReferenceItem) => void;
  /** For multi-select mode, called when confirming selection */
  onSelectMultiple?: (items: ReferenceItem[]) => void;
  onClose?: () => void;
  filterType?: "all" | "image" | "video";
  selectedItemId?: string | null;
  /** For multi-select mode, track already selected items */
  selectedItemIds?: string[];
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  /** When true, the modal opens immediately without a trigger button */
  isOpen?: boolean;
  /** Enable multi-select mode */
  multiSelect?: boolean;
  /** Maximum number of items that can be selected (0 = unlimited) */
  maxSelect?: number;
}

export function ReferenceSelector({
  onSelect,
  onSelectMultiple,
  onClose,
  filterType = "all",
  selectedItemId = null,
  selectedItemIds = [],
  className = "",
  buttonClassName = "",
  disabled = false,
  placeholder = "Select from Reference Bank",
  isOpen: controlledIsOpen,
  multiSelect = false,
  maxSelect = 0,
}: ReferenceSelectorProps) {
  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledIsOpen !== undefined;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  
  const setIsOpen = (value: boolean) => {
    if (isControlled) {
      if (!value && onClose) {
        onClose();
      }
    } else {
      setInternalIsOpen(value);
    }
  };
  
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "usage" | "name">("recent");
  
  // Folder and favorites state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Multi-select state
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set(selectedItemIds));
  
  // Data state
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [folders, setFolders] = useState<ReferenceFolder[]>([]);
  const [stats, setStats] = useState({ total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Stabilize selectedItemIds to prevent infinite loops
  const selectedItemIdsKey = useMemo(() => 
    JSON.stringify([...selectedItemIds].sort()), 
    [selectedItemIds]
  );
  
  // Reset local selection when selectedItemIds prop changes
  useEffect(() => {
    setLocalSelectedIds(new Set(selectedItemIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemIdsKey]);

  // Fetch data when modal opens or filters change
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (selectedFolderId === "root") {
        params.set("folderId", "root");
      } else if (selectedFolderId) {
        params.set("folderId", selectedFolderId);
      }
      
      if (showFavoritesOnly) {
        params.set("favorites", "true");
      }
      
      if (filterType !== "all") {
        params.set("fileType", filterType);
      }
      
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      
      const response = await fetch(`/api/reference-bank?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        setFolders(data.folders || []);
        setStats(data.stats || { total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 });
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFolderId, showFavoritesOnly, filterType, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "usage":
        return b.usageCount - a.usageCount;
      case "recent":
      default:
        if (a.lastUsedAt && b.lastUsedAt) {
          return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const handleSelect = (item: ReferenceItem) => {
    if (multiSelect) {
      // Toggle selection
      setLocalSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          // Check max limit
          if (maxSelect > 0 && newSet.size >= maxSelect) {
            return prev; // Don't add if at max
          }
          newSet.add(item.id);
        }
        return newSet;
      });
    } else {
      // Single select mode - immediately select and close
      trackUsage(item.id);
      onSelect(item);
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const handleConfirmSelection = () => {
    if (multiSelect && onSelectMultiple) {
      const selectedItems = items.filter(item => localSelectedIds.has(item.id));
      // Track usage for all selected items
      selectedItems.forEach(item => trackUsage(item.id));
      onSelectMultiple(selectedItems);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  const trackUsage = async (itemId: string) => {
    try {
      await fetch(`/api/reference-bank/${itemId}/use`, { method: "POST" });
    } catch (err) {
      console.error("Error tracking usage:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const isItemSelected = (itemId: string) => {
    if (multiSelect) {
      return localSelectedIds.has(itemId);
    }
    return selectedItemId === itemId;
  };

  const renderModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                <Library className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Reference Bank
                </h3>
                <p className="text-sm text-gray-400">
                  {multiSelect 
                    ? `Select reference ${filterType !== "all" ? filterType : "file"}s (${localSelectedIds.size}${maxSelect > 0 ? `/${maxSelect}` : ""} selected)`
                    : `Select a reference ${filterType !== "all" ? filterType : "file"}`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Search and Sort */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search references..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="recent">Recently Used</option>
              <option value="usage">Most Used</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Content with Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-gray-700 p-3 overflow-y-auto flex-shrink-0">
            <div className="space-y-1">
              <button
                onClick={() => { setSelectedFolderId(null); setShowFavoritesOnly(false); }}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  !selectedFolderId && !showFavoritesOnly 
                    ? "bg-violet-600/20 text-violet-300" 
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <Library className="w-4 h-4" />
                All Files
                <span className="ml-auto text-xs bg-gray-700 px-1.5 py-0.5 rounded">{stats.total}</span>
              </button>
              
              <button
                onClick={() => { setSelectedFolderId(null); setShowFavoritesOnly(true); }}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  showFavoritesOnly 
                    ? "bg-pink-600/20 text-pink-300" 
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <Heart className="w-4 h-4" />
                Favorites
                {stats.favorites > 0 && (
                  <span className="ml-auto text-xs bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded">
                    {stats.favorites}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => { setSelectedFolderId("root"); setShowFavoritesOnly(false); }}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  selectedFolderId === "root" 
                    ? "bg-violet-600/20 text-violet-300" 
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                Unfiled
                {stats.unfiled > 0 && (
                  <span className="ml-auto text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                    {stats.unfiled}
                  </span>
                )}
              </button>
            </div>

            {/* Folders */}
            {folders.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
                  Folders
                </h4>
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => { setSelectedFolderId(folder.id); setShowFavoritesOnly(false); }}
                      className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        selectedFolderId === folder.id 
                          ? "bg-violet-600/20 text-violet-300" 
                          : "text-gray-400 hover:bg-gray-800"
                      }`}
                    >
                      <Folder className="w-4 h-4" style={{ color: folder.color }} />
                      <span className="truncate flex-1">{folder.name}</span>
                      {folder._count && folder._count.items > 0 && (
                        <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                          {folder._count.items}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                {searchQuery ? (
                  <>
                    <Search className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-gray-400">No matches found</p>
                    <p className="text-sm text-gray-500">Try a different search term</p>
                  </>
                ) : showFavoritesOnly ? (
                  <>
                    <Heart className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-gray-400">No favorites yet</p>
                    <p className="text-sm text-gray-500">Mark items as favorites to see them here</p>
                  </>
                ) : (
                  <>
                    <Library className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-gray-400">No references found</p>
                    <p className="text-sm text-gray-500">
                      {selectedFolderId ? "This folder is empty" : "Upload images to the Reference Bank"}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sortedItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    disabled={multiSelect && maxSelect > 0 && localSelectedIds.size >= maxSelect && !localSelectedIds.has(item.id)}
                    className={`group relative bg-gray-800 rounded-xl border ${
                      isItemSelected(item.id)
                        ? "border-violet-500 ring-2 ring-violet-500/30"
                        : "border-gray-700 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    } overflow-hidden transition-all text-left`}
                  >
                    {/* Selection indicator */}
                    {isItemSelected(item.id) && (
                      <div className="absolute top-2 right-2 z-10 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* Multi-select checkbox (always visible in multi-select mode) */}
                    {multiSelect && !isItemSelected(item.id) && (
                      <div className="absolute top-2 right-2 z-10 w-5 h-5 bg-gray-900/80 border border-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}

                    {/* Favorite indicator */}
                    {item.isFavorite && (
                      <div className="absolute top-2 left-8 z-10">
                        <Heart className="w-3.5 h-3.5 text-pink-500 fill-current" />
                      </div>
                    )}

                    {/* Type badge */}
                    <div className="absolute top-2 left-2 z-10">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          item.fileType === "video"
                            ? "bg-purple-500/80 text-white"
                            : "bg-blue-500/80 text-white"
                        }`}
                      >
                        {item.fileType === "video" ? (
                          <VideoIcon className="w-3 h-3 inline" />
                        ) : (
                          <ImageIcon className="w-3 h-3 inline" />
                        )}
                      </span>
                    </div>

                    {/* Preview */}
                    <div className="aspect-square relative bg-gray-900">
                      {item.fileType === "video" ? (
                        <div className="relative w-full h-full">
                          <video
                            src={item.awsS3Url}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <PlayCircle className="w-8 h-8 text-white/80" />
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.thumbnailUrl || item.awsS3Url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2">
                      {item.folder && (
                        <div className="flex items-center gap-1 mb-1">
                          <Folder className="w-2.5 h-2.5" style={{ color: item.folder.color }} />
                          <span className="text-[9px] truncate" style={{ color: item.folder.color }}>
                            {item.folder.name}
                          </span>
                        </div>
                      )}
                      <h4 className="text-xs font-medium text-white truncate">
                        {item.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                        <span>{formatFileSize(item.fileSize)}</span>
                        <span className="flex items-center gap-0.5">
                          <BarChart3 className="w-2.5 h-2.5" />
                          {item.usageCount}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {multiSelect && localSelectedIds.size > 0 && (
              <span>{localSelectedIds.size} item{localSelectedIds.size > 1 ? 's' : ''} selected</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            {multiSelect && (
              <button
                onClick={handleConfirmSelection}
                disabled={localSelectedIds.size === 0}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Add Selected ({localSelectedIds.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // When controlled externally, don't render the trigger button
  if (isControlled) {
    if (!isOpen) return null;
    return mounted && createPortal(renderModal(), document.body);
  }

  return (
    <>
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm transition-colors hover:bg-gray-700 hover:border-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName} ${className}`}
      >
        <Library className="w-4 h-4 text-violet-400" />
        <span className="text-gray-300 truncate flex-1 text-left">
          {placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {mounted && isOpen && createPortal(renderModal(), document.body)}
    </>
  );
}
