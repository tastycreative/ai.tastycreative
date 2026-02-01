"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Folder,
  FolderOpen,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  Check,
  Search,
  ChevronLeft,
  RefreshCw,
  FileIcon,
} from "lucide-react";

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault?: boolean;
}

interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Key: string;
  awsS3Url: string;
  createdAt: Date | string;
  folderId: string;
  profileId: string;
}

interface VaultPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  onSelect: (items: VaultItem[]) => void;
  multiple?: boolean;
  acceptTypes?: "image" | "video" | "all";
  title?: string;
}

// Memoized media item component for performance
const MediaItem = memo(function MediaItem({
  item,
  isSelected,
  onToggle,
}: {
  item: VaultItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const isVideo = item.fileType?.startsWith("video/");
  const isImage = item.fileType?.startsWith("image/");

  return (
    <button
      onClick={onToggle}
      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      {/* Thumbnail */}
      {isImage ? (
        <img
          src={item.awsS3Url}
          alt={item.fileName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : isVideo ? (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
          <video
            src={item.awsS3Url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <VideoIcon className="w-8 h-8 text-white" />
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <FileIcon className="w-8 h-8 text-gray-400" />
        </div>
      )}

      {/* Selection indicator */}
      <div
        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          isSelected
            ? "bg-blue-500 text-white"
            : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
        }`}
      >
        {isSelected ? (
          <Check className="w-4 h-4" />
        ) : (
          <div className="w-4 h-4 border-2 border-white rounded-full" />
        )}
      </div>

      {/* File name overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-xs text-white truncate">{item.fileName}</p>
      </div>
    </button>
  );
});

export default function VaultPickerModal({
  isOpen,
  onClose,
  profileId,
  onSelect,
  multiple = true,
  acceptTypes = "all",
  title = "Select from Vault",
}: VaultPickerModalProps) {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<VaultFolder | null>(null);
  const [isAllMedia, setIsAllMedia] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"folders" | "items">("folders");

  // Fetch folders for profile
  const fetchFolders = useCallback(async () => {
    if (!profileId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/vault/folders?profileId=${profileId}`);
      if (!response.ok) throw new Error("Failed to fetch folders");
      const data = await response.json();
      // API returns folders array directly, not wrapped in { folders: [...] }
      setFolders(Array.isArray(data) ? data : (data.folders || []));
    } catch (error) {
      console.error("Error fetching folders:", error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // Fetch items for folder
  const fetchItems = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      // Build URL - if folderId is null, fetch ALL items for the profile
      let url = `/api/vault/items?profileId=${profileId}`;
      if (folderId) {
        url += `&folderId=${folderId}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch items");
      const data = await response.json();
      
      // API returns items array directly, not wrapped in { items: [...] }
      let filteredItems = Array.isArray(data) ? data : (data.items || []);
      if (acceptTypes === "image") {
        filteredItems = filteredItems.filter((item: VaultItem) => 
          item.fileType?.startsWith("image/")
        );
      } else if (acceptTypes === "video") {
        filteredItems = filteredItems.filter((item: VaultItem) => 
          item.fileType?.startsWith("video/")
        );
      }
      
      setItems(filteredItems);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  }, [acceptTypes, profileId]);

  // Load folders when modal opens
  useEffect(() => {
    if (isOpen && profileId) {
      fetchFolders();
      setSelectedFolder(null);
      setIsAllMedia(false);
      setSelectedItems(new Set());
      setView("folders");
      setSearchQuery("");
      setItems([]);
    }
  }, [isOpen, profileId, fetchFolders]);

  // Load items when folder is selected or "All Media" is selected
  useEffect(() => {
    if (isAllMedia) {
      fetchItems(null); // Pass null for all items
      setView("items");
    } else if (selectedFolder) {
      fetchItems(selectedFolder.id);
      setView("items");
    }
  }, [selectedFolder, isAllMedia, fetchItems]);

  // Toggle item selection
  const toggleItem = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        if (!multiple) {
          newSet.clear();
        }
        newSet.add(itemId);
      }
      return newSet;
    });
  }, [multiple]);

  // Handle confirm selection
  const handleConfirm = () => {
    const selectedItemsList = items.filter((item) => selectedItems.has(item.id));
    onSelect(selectedItemsList);
    onClose();
  };

  // Filter items by search
  const filteredItems = searchQuery
    ? items.filter((item) =>
        item.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {view === "items" && (
              <button
                onClick={() => {
                  setView("folders");
                  setSelectedFolder(null);
                  setIsAllMedia(false);
                  setItems([]);
                  setSelectedItems(new Set());
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {view === "folders"
                  ? `${folders.filter(f => !f.isDefault).length + 1} folder${folders.filter(f => !f.isDefault).length !== 0 ? "s" : ""}`
                  : isAllMedia ? "All Media" : selectedFolder?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search (only in items view) */}
        {view === "items" && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : view === "folders" ? (
            // Folders view
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {/* All Media option - always show first */}
              <button
                onClick={() => {
                  setSelectedFolder(null);
                  setIsAllMedia(true);
                }}
                className="p-4 rounded-xl border border-purple-200 dark:border-purple-700 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all group text-left bg-purple-50/30 dark:bg-purple-900/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                    <ImageIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      All Media
                    </p>
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      All files
                    </span>
                  </div>
                </div>
              </button>
              
              {/* Filter out default folders - All Media already shows everything */}
              {folders.filter(f => !f.isDefault).length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <Folder className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">No other folders found</p>
                  <p className="text-xs mt-1">Create folders in the Vault tab</p>
                </div>
              ) : (
                folders.filter(f => !f.isDefault).map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setIsAllMedia(false);
                      setSelectedFolder(folder);
                    }}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                        <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {folder.name}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            // Items view
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredItems.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">No files found in this folder</p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <MediaItem
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.has(item.id)}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer with selection info and actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedItems.size > 0 ? (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""} selected
              </span>
            ) : (
              <span>Select items to add to your queue</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Add to Queue ({selectedItems.size})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
