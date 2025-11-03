"use client";

import { useState, useEffect } from "react";
import { Folder, ChevronRight, Trash2, RefreshCw } from "lucide-react";
import { FolderManager } from "./FolderManager";
import { useApiClient } from "@/lib/apiClient";

interface CustomFolder {
  name: string;
  prefix: string;
  fileCount?: number;
  lastModified?: string;
}

interface FolderListProps {
  onFolderSelect?: (folderPrefix: string) => void;
  selectedFolder?: string;
}

export function FolderList({ onFolderSelect, selectedFolder }: FolderListProps) {
  const apiClient = useApiClient();
  const [folders, setFolders] = useState<CustomFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setFolders(data.folders || []);
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

  const handleFolderCreated = (folderName: string, folderPrefix: string) => {
    // Add new folder to list
    const newFolder: CustomFolder = {
      name: folderName,
      prefix: folderPrefix,
    };
    setFolders((prev) => [...prev, newFolder]);
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
      setFolders((prev) => prev.filter((f) => f.prefix !== folderPrefix));
      alert("Folder deleted successfully");
    } catch (err) {
      console.error("Error deleting folder:", err);
      alert(err instanceof Error ? err.message : "Failed to delete folder");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">My Folders</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Organize your generated content into folders
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadCustomFolders}
              disabled={loading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh folders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <FolderManager onFolderCreated={handleFolderCreated} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="p-4 mb-4 border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-1">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"
              />
            ))
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No folders yet</p>
              <p className="text-sm mt-1">Create your first folder to organize your content</p>
            </div>
          ) : (
            folders.map((folder) => {
              const isSelected = selectedFolder === folder.prefix;
              // All folders are custom now - show delete button for all
              const isCustom = true;

              return (
                <div
                  key={folder.prefix}
                  className={`flex items-center gap-2 p-3 rounded-lg transition-all cursor-pointer group ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent"
                  }`}
                  onClick={() => onFolderSelect?.(folder.prefix)}
                >
                  <Folder
                    className={`w-5 h-5 flex-shrink-0 ${
                      isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                  <span className={`flex-1 text-sm font-medium truncate ${
                    isSelected ? "text-blue-900 dark:text-blue-100" : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {folder.name}
                  </span>
                  {folder.fileCount !== undefined && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {folder.fileCount} files
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                    isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  }`} />
                  {isCustom && (
                    <button
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.prefix);
                      }}
                      className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
