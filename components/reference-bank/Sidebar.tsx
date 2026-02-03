"use client";

import { memo, useState, useCallback } from "react";
import {
  Library,
  Heart,
  FolderOpen,
  Folder,
  FolderPlus,
  Clock,
  Image as ImageIcon,
  Video as VideoIcon,
  BarChart3,
  Edit2,
  Trash2,
  PanelLeftClose,
  Info,
  HardDrive,
} from "lucide-react";
import { ReferenceFolder, Stats } from "@/lib/reference-bank/api";

interface SidebarProps {
  stats: Stats;
  folders: ReferenceFolder[];
  selectedFolderId: string | null;
  showFavoritesOnly: boolean;
  showRecentlyUsed: boolean;
  filterType: "all" | "image" | "video";
  sortBy: "recent" | "name" | "usage";
  storageUsed: number;
  storageLimit: number;
  isOpen: boolean;
  dropTargetFolderId: string | null;
  onClose: () => void;
  onSelectFolder: (id: string | null) => void;
  onShowFavorites: () => void;
  onShowRecentlyUsed: () => void;
  onSetFilterType: (type: "all" | "image" | "video") => void;
  onSetSortBy: (sortBy: "recent" | "name" | "usage") => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: ReferenceFolder) => void;
  onDeleteFolder: (folder: ReferenceFolder) => void;
  onDropOnFolder: (folderId: string) => void;
  onDragOverFolder: (folderId: string | null) => void;
}

export const Sidebar = memo(function Sidebar({
  stats,
  folders,
  selectedFolderId,
  showFavoritesOnly,
  showRecentlyUsed,
  filterType,
  sortBy,
  storageUsed,
  storageLimit,
  isOpen,
  dropTargetFolderId,
  onClose,
  onSelectFolder,
  onShowFavorites,
  onShowRecentlyUsed,
  onSetFilterType,
  onSetSortBy,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onDropOnFolder,
  onDragOverFolder,
}: SidebarProps) {
  // Format storage size
  const formatStorage = useCallback((bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }, []);

  const storagePercentage = Math.min((storageUsed / storageLimit) * 100, 100);

  // Handle folder drag events
  const handleFolderDragOver = useCallback(
    (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      onDragOverFolder(folderId);
    },
    [onDragOverFolder]
  );

  const handleFolderDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDragOverFolder(null);
    },
    [onDragOverFolder]
  );

  const handleFolderDrop = useCallback(
    (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      onDropOnFolder(folderId);
    },
    [onDropOnFolder]
  );

  return (
    <div
      className={`${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 fixed lg:relative z-50 lg:z-auto w-72 lg:w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col rounded-l-xl overflow-hidden transition-transform duration-300 ease-in-out`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Library className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">Reference Bank</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <PanelLeftClose className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Statistics
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Total Items</span>
            <span className="text-white font-medium">{stats.total}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Images
            </span>
            <span className="text-white font-medium">{stats.images}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-1">
              <Video className="w-3 h-3" /> Videos
            </span>
            <span className="text-white font-medium">{stats.videos}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-1">
              <Heart className="w-3 h-3" /> Favorites
            </span>
            <span className="text-white font-medium">{stats.favorites}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex-1 overflow-y-auto reference-scroll">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Browse
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => onSelectFolder(null)}
            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
              !selectedFolderId && !showFavoritesOnly && !showRecentlyUsed
                ? "bg-violet-600/20 text-violet-300"
                : "text-gray-400 hover:bg-gray-800"
            }`}
          >
            <Library className="w-4 h-4" />
            All Files
          </button>
          
          <button
            onClick={onShowFavorites}
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
            onClick={onShowRecentlyUsed}
            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
              showRecentlyUsed
                ? "bg-blue-600/20 text-blue-300"
                : "text-gray-400 hover:bg-gray-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            Recently Used
          </button>
          
          <button
            onClick={() => onSelectFolder("root")}
            onDragOver={(e) => handleFolderDragOver(e, "root")}
            onDragLeave={handleFolderDragLeave}
            onDrop={(e) => handleFolderDrop(e, "root")}
            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-all flex items-center gap-2 ${
              selectedFolderId === "root"
                ? "bg-violet-600/20 text-violet-300"
                : dropTargetFolderId === "root"
                ? "bg-violet-500/30 border-2 border-violet-500 border-dashed"
                : "text-gray-400 hover:bg-gray-800"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Unfiled
            {stats.unfiled > 0 && (
              <span className="ml-auto text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                {stats.unfiled}
              </span>
            )}
          </button>
        </div>

        {/* Folders */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Folders
            </h3>
            <button
              onClick={onCreateFolder}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
              title="Create folder"
            >
              <FolderPlus className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="space-y-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
                className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                  selectedFolderId === folder.id
                    ? "bg-violet-600/20 text-violet-300"
                    : dropTargetFolderId === folder.id
                    ? "bg-violet-500/30 border-2 border-violet-500 border-dashed"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <Folder className="w-4 h-4" style={{ color: folder.color }} />
                <span className="flex-1 truncate">{folder.name}</span>
                {folder._count && folder._count.items > 0 && (
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                    {folder._count.items}
                  </span>
                )}
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFolder(folder);
                    }}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(folder);
                    }}
                    className="p-1 hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
            {folders.length === 0 && (
              <p className="text-xs text-gray-500 px-3 py-2">
                No folders yet. Create one to organize your files.
              </p>
            )}
          </div>
        </div>

        {/* File Type Filter */}
        <div className="mt-6">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            File Type
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => onSetFilterType("all")}
              className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                filterType === "all"
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              All Files
            </button>
            <button
              onClick={() => onSetFilterType("image")}
              className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                filterType === "image"
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Images Only
            </button>
            <button
              onClick={() => onSetFilterType("video")}
              className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                filterType === "video"
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <Video className="w-4 h-4" />
              Videos Only
            </button>
          </div>
        </div>

        {/* Sort */}
        <div className="mt-6">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Sort By
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => onSetSortBy("recent")}
              className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                sortBy === "recent"
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <Clock className="w-4 h-4" />
              Most Recent
            </button>
            <button
              onClick={() => onSetSortBy("name")}
              className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                sortBy === "name"
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center text-xs">A-Z</span>
              Name
            </button>
            <button
              onClick={() => onSetSortBy("usage")}
              className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                sortBy === "usage"
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Most Used
            </button>
          </div>
        </div>
      </div>

      {/* Storage quota */}
      <div className="p-4 border-t border-gray-800 bg-gray-800/30">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Storage</span>
        </div>
        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                storagePercentage > 90
                  ? "bg-red-500"
                  : storagePercentage > 70
                  ? "bg-yellow-500"
                  : "bg-gradient-to-r from-violet-500 to-purple-500"
              }`}
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{formatStorage(storageUsed)} used</span>
            <span>{formatStorage(storageLimit)}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 border-t border-gray-800 bg-gray-800/30">
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Store reference images and videos here to quickly reuse them in SeeDream,
            Kling, and other generation tools.
          </p>
        </div>
      </div>
    </div>
  );
});

// Fix: VideoIcon import name conflict
const Video = VideoIcon;
