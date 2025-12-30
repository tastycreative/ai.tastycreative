"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Shield,
  Lock,
  Plus,
  Search,
  Trash2,
  Edit2,
  Folder,
  FolderPlus,
  Check,
  X,
  Loader2,
  File as FileIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Music4,
  AlertCircle,
  Sparkles,
  HardDrive,
  Upload,
  Download,
  Move,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername?: string | null;
  isDefault?: boolean;
}

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
  awsS3Url: string;
  createdAt: Date;
  updatedAt: Date;
  folderId: string;
  profileId: string;
}

export function VaultContent() {
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contentFilter, setContentFilter] = useState<'all' | 'photos' | 'videos' | 'audio' | 'gifs'>('all');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveToFolderId, setMoveToFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} file(s)?`)) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedItems).map(id => 
        fetch(`/api/vault/items/${id}`, { method: "DELETE" })
      );
      
      await Promise.all(deletePromises);
      setVaultItems(vaultItems.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      showToast(`Successfully deleted ${selectedItems.size} file(s)!`, "success");
    } catch (error) {
      console.error("Error deleting items:", error);
      showToast("Failed to delete some files", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkMove = () => {
    if (selectedItems.size === 0) return;
    setShowMoveModal(true);
  };

  const handleDownloadZip = async () => {
    if (selectedItems.size === 0) return;

    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      const selectedFiles = vaultItems.filter(item => selectedItems.has(item.id));
      
      // Download all files and add to zip
      const promises = selectedFiles.map(async (item) => {
        try {
          const response = await fetch(item.awsS3Url);
          const blob = await response.blob();
          zip.file(item.fileName, blob);
        } catch (error) {
          console.error(`Failed to download ${item.fileName}:`, error);
        }
      });
      
      await Promise.all(promises);
      
      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-files-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast(`Downloaded ${selectedFiles.length} file(s) as ZIP!`, "success");
    } catch (error) {
      console.error("Error creating zip:", error);
      showToast("Failed to create ZIP file", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setLoadingProfiles(true);
        const response = await fetch("/api/instagram/profiles");
        const data = await response.json();
        const profileList: InstagramProfile[] = Array.isArray(data)
          ? data
          : data.profiles || [];

        const sorted = [...profileList].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
        );

        setProfiles(sorted);

        const savedProfileId = typeof window !== "undefined" ? localStorage.getItem("vaultSelectedProfileId") : null;
        const initialProfile = sorted.find((p) => p.id === savedProfileId) || sorted[0];
        if (initialProfile) {
          setSelectedProfileId(initialProfile.id);
          localStorage.setItem("vaultSelectedProfileId", initialProfile.id);
        }
      } catch (error) {
        console.error("Error loading profiles", error);
      } finally {
        setLoadingProfiles(false);
      }
    };

    loadProfiles();
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      localStorage.setItem("vaultSelectedProfileId", selectedProfileId);
      loadFolders();
    }
  }, [selectedProfileId]);

  useEffect(() => {
    if (selectedFolderId && selectedProfileId) {
      loadItems();
    }
  }, [selectedFolderId, selectedProfileId, folders]);

  const loadFolders = async () => {
    if (!selectedProfileId) return;

    try {
      const response = await fetch(`/api/vault/folders?profileId=${selectedProfileId}`);
      if (!response.ok) throw new Error("Failed to load folders");

      const data = await response.json();
      setFolders(data);

      // Auto-select first folder or create default
      if (data.length === 0) {
        await createDefaultFolder();
      } else if (!selectedFolderId || !data.some((f: VaultFolder) => f.id === selectedFolderId)) {
        setSelectedFolderId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading folders:", error);
    }
  };

  const createDefaultFolder = async () => {
    if (!selectedProfileId) return;

    try {
      const response = await fetch("/api/vault/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          name: "All Media",
          isDefault: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to create default folder");

      const folder = await response.json();
      setFolders([folder]);
      setSelectedFolderId(folder.id);
    } catch (error) {
      console.error("Error creating default folder:", error);
    }
  };

  const loadItems = async () => {
    if (!selectedFolderId || !selectedProfileId) return;

    setLoadingItems(true);
    try {
      // Always load all items for the profile to ensure accurate folder counts
      const url = `/api/vault/items?profileId=${selectedProfileId}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load items");

      const data = await response.json();
      setVaultItems(data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })));
    } catch (error) {
      console.error("Error loading items:", error);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    const profileFolders = folders.filter((f) => f.profileId === id);
    const nextFolder = profileFolders[0];
    setSelectedFolderId(nextFolder ? nextFolder.id : null);
  };

  const handleCreateFolder = async () => {
    if (!selectedProfileId || !folderNameInput.trim()) return;

    try {
      const response = await fetch("/api/vault/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          name: folderNameInput.trim(),
        }),
      });

      if (!response.ok) throw new Error("Failed to create folder");

      const newFolder = await response.json();
      setFolders([...folders, newFolder]);
      setSelectedFolderId(newFolder.id);
      setFolderNameInput("");
      showToast("Folder created successfully!", "success");
    } catch (error) {
      console.error("Error creating folder:", error);
      showToast("Failed to create folder", "error");
    }
  };

  const startEditFolder = (folder: VaultFolder) => {
    if (folder.isDefault) return;
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleUpdateFolder = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return;

    try {
      const response = await fetch(`/api/vault/folders/${editingFolderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingFolderName.trim() }),
      });

      if (!response.ok) throw new Error("Failed to update folder");

      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === editingFolderId ? { ...folder, name: editingFolderName.trim() } : folder
        )
      );
      setEditingFolderId(null);
      setEditingFolderName("");
      showToast("Folder renamed successfully!", "success");
    } catch (error) {
      console.error("Error updating folder:", error);
      showToast("Failed to update folder", "error");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (folder?.isDefault) return;

    if (!confirm("Are you sure you want to delete this folder and all its contents?")) return;

    try {
      const response = await fetch(`/api/vault/folders/${folderId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete folder");

      setFolders(folders.filter((f) => f.id !== folderId));
      setVaultItems(vaultItems.filter((item) => item.folderId !== folderId));

      if (selectedFolderId === folderId) {
        const remaining = folders.filter((f) => f.id !== folderId && f.profileId === selectedProfileId);
        setSelectedFolderId(remaining[0]?.id || null);
      }
      showToast("Folder deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting folder:", error);
      showToast("Failed to delete folder", "error");
    }
  };

  const handleAddItem = async () => {
    if (!selectedProfileId || !selectedFolderId) return;
    if (newFiles.length === 0) return;

    try {
      const uploadPromises = newFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("profileId", selectedProfileId);
        formData.append("folderId", selectedFolderId);

        const response = await fetch("/api/vault/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
        return response.json();
      });

      const uploadedItems = await Promise.all(uploadPromises);
      
      setVaultItems([
        ...uploadedItems.map(item => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        })),
        ...vaultItems,
      ]);
      setNewFiles([]);
      setIsAddingNew(false);
      showToast(`Successfully uploaded ${uploadedItems.length} file(s)!`, "success");
    } catch (error) {
      console.error("Error uploading files:", error);
      showToast("Failed to upload some files", "error");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(`/api/vault/items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete item");

      setVaultItems(vaultItems.filter((item) => item.id !== id));
      showToast("File deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting item:", error);
      showToast("Failed to delete item", "error");
    }
  };

  const filteredItems = useMemo(() => {
    // Check if current folder is the default "All Media" folder
    const currentFolder = folders.find(f => f.id === selectedFolderId);
    const isDefaultFolder = currentFolder?.isDefault === true;

    return vaultItems
      .filter((item) => {
        // Always filter by profile
        if (item.profileId !== selectedProfileId) return false;
        
        // If it's the default folder, show all items for this profile
        // Otherwise, only show items from the selected folder
        if (!isDefaultFolder && item.folderId !== selectedFolderId) return false;
        
        return true;
      })
      .filter((item) => item.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((item) => {
        // Filter by content type
        if (contentFilter === 'all') return true;
        if (contentFilter === 'photos') return item.fileType.startsWith('image/') && item.fileType !== 'image/gif';
        if (contentFilter === 'videos') return item.fileType.startsWith('video/');
        if (contentFilter === 'audio') return item.fileType.startsWith('audio/');
        if (contentFilter === 'gifs') return item.fileType === 'image/gif';
        return true;
      });
  }, [vaultItems, selectedFolderId, selectedProfileId, searchQuery, folders, contentFilter]);

  const visibleFolders = folders.filter((folder) => folder.profileId === selectedProfileId);
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || null;
  const selectedFolder = visibleFolders.find((folder) => folder.id === selectedFolderId) || null;

  // Calculate stats
  const totalItems = vaultItems.filter(item => item.profileId === selectedProfileId).length;
  const totalSize = vaultItems
    .filter(item => item.profileId === selectedProfileId)
    .reduce((acc, item) => acc + item.fileSize, 0);
  const imageCount = vaultItems.filter(item => 
    item.profileId === selectedProfileId && item.fileType.startsWith('image/')
  ).length;
  const videoCount = vaultItems.filter(item => 
    item.profileId === selectedProfileId && item.fileType.startsWith('video/')
  ).length;

  return (
    <>
      {/* Upload Modal - React Portal */}
      {isAddingNew && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsAddingNew(false);
              setNewFiles([]);
              setIsDragging(false);
            }}
          />
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl animate-slideIn">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Upload Media</h3>
              </div>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewFiles([]);
                  setIsDragging(false);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Drag and Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = Array.from(e.dataTransfer.files);
                  setNewFiles(prev => [...prev, ...files]);
                }}
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${
                  isDragging
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-105'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 hover:border-purple-400 dark:hover:border-purple-500'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-4 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full">
                    <Upload className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      Drag and drop files here
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setNewFiles(prev => [...prev, ...files]);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Selected Files List */}
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Selected Files ({newFiles.length})
                    </p>
                    <button
                      onClick={() => setNewFiles([])}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                    {newFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {file.type.startsWith('image/') ? (
                            <ImageIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          ) : file.type.startsWith('video/') ? (
                            <VideoIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          ) : file.type.startsWith('audio/') ? (
                            <Music4 className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          ) : (
                            <FileIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== index))}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex-shrink-0 ml-2"
                          title="Remove"
                        >
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <Sparkles className="w-3 h-3" />
                <span>Supports images, videos, GIFs, and audio files</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewFiles([]);
                  setIsDragging(false);
                }}
                className="px-5 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={newFiles.length === 0}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Upload {newFiles.length > 0 && `(${newFiles.length})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move Modal - React Portal */}
      {showMoveModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMoveModal(false)}
          />
          
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md animate-slideIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                  <Move className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Move {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''}
                </h3>
              </div>
              <button
                onClick={() => setShowMoveModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Select destination folder
                </label>
                <select
                  value={moveToFolderId || ''}
                  onChange={(e) => setMoveToFolderId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900 dark:text-white"
                >
                  <option value="">Choose folder...</option>
                  {visibleFolders
                    .filter(f => f.id !== selectedFolderId)
                    .map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))
                  }
                </select>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMoveModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!moveToFolderId) {
                      showToast('Please select a destination folder', 'error');
                      return;
                    }
                    
                    setIsMoving(true);
                    try {
                      const itemsToMove = Array.from(selectedItems);
                      
                      // Make API calls to update backend
                      const results = await Promise.all(
                        itemsToMove.map(async (itemId) => {
                          const response = await fetch(`/api/vault/items/${itemId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folderId: moveToFolderId }),
                          });
                          
                          if (!response.ok) {
                            const error = await response.text();
                            console.error(`Failed to move item ${itemId}:`, error);
                            return { success: false, itemId };
                          }
                          
                          return { success: true, itemId };
                        })
                      );
                      
                      // Check if all succeeded
                      const failedMoves = results.filter(r => !r.success);
                      
                      if (failedMoves.length > 0) {
                        showToast(`Failed to move ${failedMoves.length} item(s)`, 'error');
                      } else {
                        showToast(`Successfully moved ${itemsToMove.length} item(s)!`, 'success');
                      }
                      
                      // Reload items from backend to get fresh data
                      await loadItems();
                      
                      setSelectedItems(new Set());
                      setShowMoveModal(false);
                      setMoveToFolderId(null);
                    } catch (error) {
                      console.error('Error moving items:', error);
                      showToast('Failed to move items', 'error');
                    } finally {
                      setIsMoving(false);
                    }
                  }}
                  disabled={!moveToFolderId || isMoving}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isMoving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Moving...
                    </>
                  ) : (
                    <>
                      <Move className="w-5 h-5" />
                      Move Files
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Enhanced Preview Modal - React Portal */}
      {previewItem && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewItem(null)}
          />
          
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-6xl max-h-[95vh] flex flex-col animate-slideIn">
            {/* Header with metadata */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex-shrink-0">
                  {previewItem.fileType.startsWith('image/') ? (
                    <ImageIcon className="w-5 h-5 text-white" />
                  ) : previewItem.fileType.startsWith('video/') ? (
                    <VideoIcon className="w-5 h-5 text-white" />
                  ) : previewItem.fileType.startsWith('audio/') ? (
                    <Music4 className="w-5 h-5 text-white" />
                  ) : (
                    <FileIcon className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{previewItem.fileName}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>{(previewItem.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                    <span>•</span>
                    <span>{previewItem.fileType}</span>
                    <span>•</span>
                    <span>{previewItem.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Content area with navigation */}
            <div className="flex-1 overflow-hidden flex items-center relative">
              {/* Previous button */}
              {filteredItems.length > 1 && (
                <button
                  onClick={() => {
                    const currentIndex = filteredItems.findIndex(item => item.id === previewItem.id);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
                    setPreviewItem(filteredItems[prevIndex]);
                  }}
                  className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow-lg transition-all hover:scale-110"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-300" />
                </button>
              )}
              
              {/* Content */}
              <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-auto">
                {previewItem.fileType.startsWith('image/') ? (
                  <img
                    src={previewItem.awsS3Url}
                    alt={previewItem.fileName}
                    className="max-w-full max-h-[calc(95vh-220px)] object-contain rounded-lg"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      console.log(`Image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
                    }}
                  />
                ) : previewItem.fileType.startsWith('video/') ? (
                  <video
                    src={previewItem.awsS3Url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[calc(95vh-220px)] rounded-lg"
                  />
                ) : previewItem.fileType.startsWith('audio/') ? (
                  <div className="w-full max-w-2xl">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-8 mb-6">
                      <Music4 className="w-20 h-20 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
                      <p className="text-center text-gray-600 dark:text-gray-400 font-semibold">{previewItem.fileName}</p>
                    </div>
                    <audio src={previewItem.awsS3Url} controls autoPlay className="w-full" />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileIcon className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Preview not available for this file type</p>
                  </div>
                )}
              </div>
              
              {/* Next button */}
              {filteredItems.length > 1 && (
                <button
                  onClick={() => {
                    const currentIndex = filteredItems.findIndex(item => item.id === previewItem.id);
                    const nextIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
                    setPreviewItem(filteredItems[nextIndex]);
                  }}
                  className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow-lg transition-all hover:scale-110"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-300" />
                </button>
              )}
            </div>
            
            {/* Footer with actions and info */}
            <div className="border-t border-gray-200 dark:border-gray-700">
              {/* Item counter */}
              {filteredItems.length > 1 && (
                <div className="px-4 sm:px-6 py-2 bg-gray-50 dark:bg-gray-900/50 text-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {filteredItems.findIndex(item => item.id === previewItem.id) + 1} of {filteredItems.length}
                  </span>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-6 gap-3">
                <a
                  href={previewItem.awsS3Url}
                  download={previewItem.fileName}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  onClick={() => {
                    handleDeleteItem(previewItem.id);
                    setPreviewItem(null);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slideInRight">
          <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md border ${
            toast.type === 'success' 
              ? 'bg-green-50/90 dark:bg-green-900/90 border-green-200 dark:border-green-700' 
              : toast.type === 'error'
              ? 'bg-red-50/90 dark:bg-red-900/90 border-red-200 dark:border-red-700'
              : 'bg-blue-50/90 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700'
          }`}>
            {toast.type === 'success' && <Check className="w-5 h-5 text-green-600 dark:text-green-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            <p className={`text-sm font-medium ${
              toast.type === 'success' 
                ? 'text-green-800 dark:text-green-200' 
                : toast.type === 'error'
                ? 'text-red-800 dark:text-red-200'
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {toast.message}
            </p>
            <button onClick={() => setToast(null)} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
              Secure Vault
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 ml-14">
            {selectedProfile ? `Managing vault for ${selectedProfile.name}` : 'Select a profile to start'}
          </p>
        </div>
        <button
          onClick={() => setIsAddingNew(true)}
          disabled={!selectedProfileId || !selectedFolderId}
          className="group relative flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <Upload className="w-5 h-5 relative z-10" />
          <span className="font-semibold relative z-10">Upload Media</span>
          <Sparkles className="w-4 h-4 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Stats Cards */}
      {selectedProfileId && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 dark:from-blue-900/30 dark:via-cyan-900/30 dark:to-blue-800/30 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Files</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-2">
                    {totalItems}
                  </p>
                </div>
                <div className="p-3 bg-blue-600 dark:bg-blue-500 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                  <HardDrive className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative bg-gradient-to-br from-purple-50 via-fuchsia-50 to-purple-100 dark:from-purple-900/30 dark:via-fuchsia-900/30 dark:to-purple-800/30 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Storage Used</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-2">
                    {(totalSize / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <div className="p-3 bg-purple-600 dark:bg-purple-500 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                  <Shield className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-600 to-rose-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 dark:from-pink-900/30 dark:via-rose-900/30 dark:to-pink-800/30 rounded-xl p-6 border-2 border-pink-200 dark:border-pink-800 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Images</p>
                  <p className="text-3xl font-bold text-pink-700 dark:text-pink-300 mt-2">
                    {imageCount}
                  </p>
                </div>
                <div className="p-3 bg-pink-600 dark:bg-pink-500 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                  <ImageIcon className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100 dark:from-indigo-900/30 dark:via-blue-900/30 dark:to-indigo-800/30 rounded-xl p-6 border-2 border-indigo-200 dark:border-indigo-800 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Videos</p>
                  <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 mt-2">
                    {videoCount}
                  </p>
                </div>
                <div className="p-3 bg-indigo-600 dark:bg-indigo-500 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                  <VideoIcon className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:gap-6 xl:grid-cols-12">
        {/* Profiles */}
        <div className="xl:col-span-3 relative group self-start">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl opacity-30 group-hover:opacity-50 blur transition-all duration-300"></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Profiles</p>
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">Instagram</h3>
              </div>
              <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            {loadingProfiles ? (
              <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <div className="relative">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
                  <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                </div>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No profiles found</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Create a profile to get started</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden pr-1">
                {profiles.map((profile) => {
                  const isActive = profile.id === selectedProfileId;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => handleSelectProfile(profile.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${
                        isActive
                          ? "bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white shadow-lg"
                          : "bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">{profile.name}</span>
                        {profile.instagramUsername && (
                          <span className={`text-xs mt-0.5 ${isActive ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>
                            @{profile.instagramUsername}
                          </span>
                        )}
                      </div>
                      {profile.isDefault && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isActive 
                            ? 'bg-white/20 border border-white/30 text-white' 
                            : 'bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400'
                        }`}>Default</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Folders */}
        <div className="xl:col-span-3 relative group self-start">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 rounded-xl opacity-20 group-hover:opacity-40 blur transition-all duration-300"></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 border border-gray-200 dark:border-gray-700 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Folders</p>
                <h3 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 dark:from-pink-400 dark:to-purple-400 bg-clip-text text-transparent">Categories</h3>
              </div>
              <div className="p-2 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-lg">
                <Folder className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <FolderPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder="New folder name"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900 dark:text-white"
                  disabled={!selectedProfileId}
                />
              </div>
              <button
                onClick={handleCreateFolder}
                disabled={!selectedProfileId || !folderNameInput.trim()}
                className="p-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                title="Create folder"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden pr-1">
              {selectedProfileId && visibleFolders.length === 0 && (
                <div className="text-center py-6 px-2">
                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                    <Folder className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No folders yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Create one to organize items</p>
                </div>
              )}
              {visibleFolders.map((folder) => {
                const isActive = folder.id === selectedFolderId;
                // For default "All Media" folder, count all items; otherwise count items in specific folder
                const itemCount = folder.isDefault
                  ? vaultItems.filter((item) => item.profileId === selectedProfileId).length
                  : vaultItems.filter((item) => item.folderId === folder.id && item.profileId === selectedProfileId).length;

                return (
                  <div
                    key={folder.id}
                    className={`group/folder flex items-center justify-between px-3 py-3 rounded-lg border-2 transition-all duration-300 ${
                      isActive
                        ? "border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 shadow-lg"
                        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 hover:border-purple-300 dark:hover:border-purple-700"
                    }`}
                  >
                  {editingFolderId === folder.id ? (
                    <div className="flex-1 flex items-center space-x-2">
                      <input
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateFolder()}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border-2 border-purple-300 dark:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={handleUpdateFolder}
                        className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all shadow-lg hover:scale-105"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingFolderId(null);
                          setEditingFolderName("");
                        }}
                        className="p-2 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="flex-1 flex items-center space-x-2.5 text-left min-w-0"
                    >
                      <Folder className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`} />
                      <span className={`font-semibold truncate ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{folder.name}</span>
                      <span className={`text-xs flex-shrink-0 px-2 py-0.5 rounded-full ${
                        isActive 
                          ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                      }`}>{itemCount}</span>
                      {folder.isDefault && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex-shrink-0">Default</span>
                      )}
                    </button>
                  )}

                  {editingFolderId !== folder.id && (
                    <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                      <button
                        onClick={() => startEditFolder(folder)}
                        disabled={folder.isDefault}
                        className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        title="Rename"
                      >
                        <Edit2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </button>
                      {!folder.isDefault && (
                        <button
                          onClick={() => handleDeleteFolder(folder.id)}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="xl:col-span-6 relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl opacity-20 blur transition-all duration-300"></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 border border-gray-200 dark:border-gray-700 backdrop-blur-sm space-y-4 max-h-[600px] flex flex-col">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Content</p>
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {selectedFolder?.name || "Select a folder"}
                </h3>
                {selectedProfile && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {selectedProfile.name}
                    </span>
                  </p>
                )}
              </div>
              {/* Search Input */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search vault items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Bulk Selection & Actions Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Bulk Selection */}
              {filteredItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedItems.size > 0 && selectedItems.size === filteredItems.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select all'}
                  </span>
                </div>
              )}
              
              {/* Action Bar - Show when items are selected */}
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2 animate-slideIn">
                  <button
                    onClick={handleBulkMove}
                    disabled={isMoving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Move className="h-3 w-3" />}
                    Move
                  </button>
                  <button
                    onClick={handleDownloadZip}
                    disabled={isDownloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    ZIP
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Delete
                  </button>
                </div>
              )}
              
              {/* Content Type Filter */}
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <button
                  onClick={() => setContentFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    contentFilter === 'all'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setContentFilter('photos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    contentFilter === 'photos'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  Photos
                </button>
                <button
                  onClick={() => setContentFilter('videos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    contentFilter === 'videos'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <VideoIcon className="w-3 h-3" />
                  Videos
                </button>
                <button
                  onClick={() => setContentFilter('audio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    contentFilter === 'audio'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Music4 className="w-3 h-3" />
                  Audio
                </button>
                <button
                  onClick={() => setContentFilter('gifs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    contentFilter === 'gifs'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  GIFs
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1">
          {!selectedProfileId ? (
            <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center text-gray-600 dark:text-gray-400">
              Select a profile to start using the vault.
            </div>
          ) : !selectedFolderId ? (
            <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center text-gray-600 dark:text-gray-400">
              Create a folder to organize your vault items.
            </div>
          ) : loadingItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm animate-pulse">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                    </div>
                    <div className="h-8 w-8 bg-gray-300 dark:bg-gray-700 rounded-md"></div>
                  </div>
                  <div className="h-48 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredItems.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800/70 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-10 text-center">
                  <Lock className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">No items in this folder</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Upload some content to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-white dark:bg-gray-800 border-2 rounded-lg p-4 shadow-sm flex flex-col max-w-sm hover:shadow-lg transition-all ${
                        selectedItems.has(item.id) 
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20' 
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {item.fileType.startsWith("image/") ? (
                              <ImageIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
                            ) : item.fileType.startsWith("video/") ? (
                              <VideoIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
                            ) : item.fileType.startsWith("audio/") ? (
                              <Music4 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                            ) : (
                              <FileIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
                            )}
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{item.fileName}</h4>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.createdAt.toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0 ml-2"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                      <div 
                        className="flex-1 cursor-pointer group"
                        onClick={() => setPreviewItem(item)}
                      >
                        {item.fileType.startsWith("image/") ? (
                          <div className="relative overflow-hidden rounded-lg">
                            <img
                              src={item.awsS3Url}
                              alt={item.fileName}
                              className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-lg flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="p-3 bg-white/90 dark:bg-gray-800/90 rounded-full">
                                  <Search className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : item.fileType.startsWith("video/") ? (
                          <div className="relative overflow-hidden rounded-lg">
                            <video
                              src={item.awsS3Url}
                              className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-lg flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="p-3 bg-white/90 dark:bg-gray-800/90 rounded-full">
                                  <Search className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : item.fileType.startsWith("audio/") ? (
                          <div className="h-48 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform duration-300">
                            <Music4 className="w-16 h-16 text-purple-600 dark:text-purple-400" />
                          </div>
                        ) : (
                          <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform duration-300">
                            <FileIcon className="w-16 h-16 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
