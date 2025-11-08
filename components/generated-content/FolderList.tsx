"use client";

import { useState, useEffect } from "react";
import { Folder, ChevronRight, Trash2, RefreshCw, Share2, Users, Search, X, FolderOpen, Sparkles, Lock, Eye } from "lucide-react";
import { FolderManager } from "./FolderManager";
import { useApiClient } from "@/lib/apiClient";
import ShareFolderModal from "../ShareFolderModal";

interface CustomFolder {
  name: string;
  prefix: string;
  fileCount?: number;
  lastModified?: string;
  isShared?: boolean;
  sharedBy?: string;
  permission?: 'VIEW' | 'EDIT';
  hasShares?: boolean; // Folder is shared with others
  parentPrefix?: string | null;
  depth?: number;
  path?: string;
}

interface FolderListProps {
  onFolderSelect?: (folderPrefix: string) => void;
  selectedFolder?: string;
}

const sanitizePrefix = (prefix: string) => prefix.replace(/\/+$/, '/');

const computeFolderMeta = (prefix: string) => {
  const sanitized = sanitizePrefix(prefix);
  const parts = sanitized.split('/').filter(Boolean);
  const depth = Math.max(parts.length - 2, 1);
  const path = parts.slice(2).join('/');
  const parentPrefix = parts.length <= 3 ? null : `${parts.slice(0, -1).join('/')}/`;
  return { sanitized, depth, path, parentPrefix };
};

export function FolderList({ onFolderSelect, selectedFolder }: FolderListProps) {
  const apiClient = useApiClient();
  const [folders, setFolders] = useState<CustomFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [folderToShare, setFolderToShare] = useState<CustomFolder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (apiClient) {
      loadCustomFolders();
    }
  }, [apiClient]);

  const loadCustomFolders = async () => {
    if (!apiClient) return;

    try {
      setLoading(true);
      setError(null);

      // List all folders under instagram/ prefix
      const response = await apiClient.get("/api/s3/folders/list-custom");

      if (response.ok) {
        const data = await response.json();
        const folderList = Array.isArray(data.folders) ? data.folders : [];
        const normalizedFolders = (folderList as CustomFolder[])
          .map((folder: CustomFolder) => {
            const meta = computeFolderMeta(folder.prefix);
            return {
              ...folder,
              prefix: meta.sanitized,
              depth: folder.depth ?? meta.depth,
              path: folder.path ?? meta.path,
              parentPrefix: folder.parentPrefix ?? meta.parentPrefix,
            } as CustomFolder;
          })
          .sort((a: CustomFolder, b: CustomFolder) => (a.path || a.name).localeCompare(b.path || b.name));
        setFolders(normalizedFolders);
      } else {
        throw new Error("Failed to load custom folders");
      }
    } catch (err) {
      console.error("Error loading custom folders:", err);
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  const handleFolderCreated = (folderName: string, folderPrefix: string, parentPrefix: string | null = null) => {
    const meta = computeFolderMeta(folderPrefix);
    const newFolder: CustomFolder = {
      name: folderName,
      prefix: meta.sanitized,
      parentPrefix: parentPrefix ?? meta.parentPrefix,
      depth: meta.depth,
      path: meta.path,
      fileCount: 0,
      isShared: false,
      hasShares: false,
    };
    setFolders((prev) => {
      const exists = prev.some(f => sanitizePrefix(f.prefix) === newFolder.prefix);
      if (exists) {
        return prev;
      }
      const updated = [...prev, newFolder];
      updated.sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name));
      return updated;
    });
  };

  const handleDeleteFolder = async (folderPrefix: string) => {
    if (!apiClient) return;
    
    if (!confirm("Are you sure you want to delete this folder? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await apiClient.delete("/api/s3/folders/delete", { folderPrefix, force: true });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete folder" }));
        throw new Error(errorData.error || "Failed to delete folder");
      }

      // Remove from list
  const sanitizedPrefix = sanitizePrefix(folderPrefix);
  setFolders((prev) => prev.filter((f) => !sanitizePrefix(f.prefix).startsWith(sanitizedPrefix)));
      alert("Folder deleted successfully");
    } catch (err) {
      console.error("Error deleting folder:", err);
      alert(err instanceof Error ? err.message : "Failed to delete folder");
    }
  };

  const handleShareFolder = (e: React.MouseEvent<HTMLButtonElement>, folder: CustomFolder) => {
    e.stopPropagation();
    setFolderToShare(folder);
    setShareModalOpen(true);
  };

  // Filter folders based on search query
  const lowerSearch = searchQuery.toLowerCase();
  const filteredFolders = folders.filter(folder => {
    const nameMatch = folder.name.toLowerCase().includes(lowerSearch);
    const sharedByMatch = folder.sharedBy ? folder.sharedBy.toLowerCase().includes(lowerSearch) : false;
    const pathMatch = folder.path ? folder.path.toLowerCase().includes(lowerSearch) : false;
    return nameMatch || sharedByMatch || pathMatch;
  });

  const ownedFolders = filteredFolders.filter(f => !f.isShared);
  const sharedFolders = filteredFolders.filter(f => f.isShared);
  const ownedHierarchyFolders = folders.filter(f => !f.isShared);
  const defaultParentForCreation = (() => {
    if (!selectedFolder) {
      return null;
    }
    const sanitizedSelected = sanitizePrefix(selectedFolder);
    const match = ownedHierarchyFolders.find(f => sanitizePrefix(f.prefix) === sanitizedSelected);
    return match?.prefix ?? null;
  })();

  return (
    <div className="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden backdrop-blur-sm">
      {/* Header with Gradient */}
      <div className="relative p-6 border-b border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 animate-gradient-x" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
                  My Workspace
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Organize & collaborate
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadCustomFolders}
                disabled={loading}
                className="p-2.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all duration-200 disabled:opacity-50 group"
                title="Refresh folders"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
              </button>
              <FolderManager 
                onFolderCreated={handleFolderCreated}
                existingFolders={ownedHierarchyFolders}
                defaultParentPrefix={defaultParentForCreation}
              />
            </div>
          </div>

          {/* Enhanced Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search your folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-10 py-3 border border-gray-300/50 dark:border-gray-600/50 rounded-xl bg-white/80 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm shadow-sm hover:shadow-md backdrop-blur-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {/* Search hint */}
            {!searchQuery && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                ⌘K
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes gradient-x {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .animate-gradient-x {
            background-size: 200% 200%;
            animation: gradient-x 15s ease infinite;
          }
        `}</style>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {error && (
          <div className="p-4 mb-4 border border-red-200/50 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 rounded-xl backdrop-blur-sm">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            // Enhanced Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-pulse rounded-xl"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))
          ) : filteredFolders.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-xl opacity-20 animate-pulse" />
                <Folder className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 relative" />
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {searchQuery ? "No folders found" : "No folders yet"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {searchQuery 
                  ? `No folders match "${searchQuery}"`
                  : "Create your first folder to organize your content"
                }
              </p>
            </div>
          ) : (
            <>
              {/* Owned Folders */}
              {ownedFolders.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-700 to-transparent" />
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      My Folders
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-700 to-transparent" />
                  </div>
                  {ownedFolders.map((folder, index) => {
                    const isSelected = selectedFolder === folder.prefix;
                    return (
                      <div
                        key={`owned-${index}-${folder.prefix}`}
                        className={`relative flex items-center gap-3 p-3.5 rounded-xl transition-all duration-300 cursor-pointer group overflow-hidden ${
                          isSelected
                            ? "bg-gradient-to-r from-blue-500/10 via-blue-400/10 to-purple-500/10 dark:from-blue-500/20 dark:via-blue-400/20 dark:to-purple-500/20 shadow-lg shadow-blue-500/10 border-2 border-blue-300/50 dark:border-blue-600/50 scale-[1.02]"
                            : "bg-white/50 dark:bg-gray-700/30 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/10 dark:hover:to-purple-900/10 border-2 border-transparent hover:border-blue-200/50 dark:hover:border-blue-700/50 hover:shadow-md"
                        }`}
                        onClick={() => onFolderSelect?.(folder.prefix)}
                        style={{ marginLeft: Math.max((folder.depth ?? 1) - 1, 0) * 12 }}
                      >
                        {/* Animated background effect */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 via-purple-400/5 to-pink-400/5 animate-gradient-x" />
                        )}
                        
                        {/* Icon with gradient background */}
                        <div className={`relative z-10 p-2 rounded-lg transition-all duration-300 ${
                          isSelected 
                            ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg scale-110" 
                            : "bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 group-hover:from-blue-400 group-hover:to-purple-500"
                        }`}>
                          <Folder className={`w-4 h-4 ${isSelected ? "text-white" : "text-gray-600 dark:text-gray-300 group-hover:text-white"}`} />
                        </div>

                        {/* Folder Info */}
                        <div className="flex-1 min-w-0 relative z-10">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold truncate ${
                              isSelected ? "text-blue-900 dark:text-blue-100" : "text-gray-700 dark:text-gray-300"
                            }`}>
                              {folder.name}
                            </span>
                            {folder.hasShares && (
                              <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-sm">
                                <Share2 className="w-2.5 h-2.5" />
                                SHARED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {(folder.depth ?? 1) > 1 && folder.path && (
                              <span className="truncate text-gray-500 dark:text-gray-400">
                                {folder.path}
                              </span>
                            )}
                            {(folder.depth ?? 1) > 1 && folder.path && folder.fileCount !== undefined && (
                              <span className="text-gray-400">•</span>
                            )}
                            {folder.fileCount !== undefined && (
                              <span>
                                {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={(e) => handleShareFolder(e, folder)}
                            className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                            title="Share folder"
                          >
                            <Share2 className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder.prefix);
                            }}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                            title="Delete folder"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                          </button>
                        </div>

                        {/* Arrow indicator */}
                        <ChevronRight className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                          isSelected ? "text-blue-600 dark:text-blue-400 translate-x-1" : "text-gray-400 group-hover:text-blue-500"
                        }`} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shared Folders */}
              {sharedFolders.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 dark:via-purple-700 to-transparent" />
                    <span className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      <Users className="w-3.5 h-3.5" />
                      Shared With Me
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 dark:via-purple-700 to-transparent" />
                  </div>
                  {sharedFolders.map((folder, index) => {
                    const isSelected = selectedFolder === folder.prefix;
                    return (
                      <div
                        key={`shared-${index}-${folder.prefix}`}
                        className={`relative flex items-center gap-3 p-3.5 rounded-xl transition-all duration-300 cursor-pointer group overflow-hidden ${
                          isSelected
                            ? "bg-gradient-to-r from-purple-500/10 via-pink-400/10 to-purple-500/10 dark:from-purple-500/20 dark:via-pink-400/20 dark:to-purple-500/20 shadow-lg shadow-purple-500/10 border-2 border-purple-300/50 dark:border-purple-600/50 scale-[1.02]"
                            : "bg-white/50 dark:bg-gray-700/30 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/10 dark:hover:to-pink-900/10 border-2 border-transparent hover:border-purple-200/50 dark:hover:border-purple-700/50 hover:shadow-md"
                        }`}
                        onClick={() => onFolderSelect?.(folder.prefix)}
                        style={{ marginLeft: Math.max((folder.depth ?? 1) - 1, 0) * 12 }}
                      >
                        {/* Animated background effect */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-400/5 via-pink-400/5 to-purple-400/5 animate-gradient-x" />
                        )}
                        
                        {/* Icon with gradient background */}
                        <div className={`relative z-10 p-2 rounded-lg transition-all duration-300 ${
                          isSelected 
                            ? "bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg scale-110" 
                            : "bg-gradient-to-br from-purple-200 to-pink-300 dark:from-purple-600 dark:to-pink-700 group-hover:from-purple-400 group-hover:to-pink-500"
                        }`}>
                          <Folder className={`w-4 h-4 ${isSelected || !isSelected ? "text-white" : "text-purple-600 dark:text-purple-300"}`} />
                        </div>

                        {/* Folder Info */}
                        <div className="flex-1 min-w-0 relative z-10">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm font-semibold truncate ${
                              isSelected ? "text-purple-900 dark:text-purple-100" : "text-gray-700 dark:text-gray-300"
                            }`}>
                              {folder.name}
                            </span>
                            <div className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              folder.permission === 'VIEW' 
                                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                                : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                            }`}>
                              {folder.permission === 'VIEW' ? <Eye className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                              {folder.permission === 'VIEW' ? 'VIEW' : 'EDIT'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                            <span className="truncate">
                              by {folder.sharedBy}
                            </span>
                            {folder.fileCount !== undefined && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span>
                                  {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
                                </span>
                              </>
                            )}
                            {(folder.depth ?? 1) > 1 && folder.path && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span className="truncate">{folder.path}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <ChevronRight className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                          isSelected ? "text-purple-600 dark:text-purple-400 translate-x-1" : "text-gray-400 group-hover:text-purple-500"
                        }`} />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Share Folder Modal */}
      {folderToShare && (
        <ShareFolderModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setFolderToShare(null);
          }}
          folderPrefix={folderToShare.prefix}
          folderName={folderToShare.name}
          onShareComplete={() => {
            // Refresh folder list to show "SHARED" badge
            loadCustomFolders();
          }}
        />
      )}
    </div>
  );
}
