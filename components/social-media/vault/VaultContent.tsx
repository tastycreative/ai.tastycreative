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
  Copy,
  ChevronLeft,
  ChevronRight,
  Share2,
  Users,
  Eye,
  UserPlus,
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
  hasShares?: boolean; // Folder is shared with others
}

interface SharedVaultFolder {
  id: string; // share id
  folderId: string;
  folderName: string;
  profileId: string;
  profileName: string;
  profileUsername?: string | null;
  profileImageUrl?: string | null;
  isDefault: boolean;
  itemCount: number;
  permission: 'VIEW' | 'EDIT';
  sharedBy: string;
  ownerClerkId: string;
  ownerName: string;
  ownerImageUrl?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ShareInfo {
  id: string;
  sharedWithClerkId: string;
  permission: 'VIEW' | 'EDIT';
  createdAt: string;
  sharedBy?: string;
  note?: string;
  sharedWithUser?: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    displayName: string;
  };
}

interface AvailableUser {
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
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

  const [folders, setFolders] = useState<VaultFolder[]>([]); // Folders for current profile
  const [allFolders, setAllFolders] = useState<VaultFolder[]>([]); // All folders across all profiles
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
  const [isCopyMode, setIsCopyMode] = useState(false); // true = copy, false = move
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Sharing state
  const [sharedFolders, setSharedFolders] = useState<SharedVaultFolder[]>([]);
  const [loadingSharedFolders, setLoadingSharedFolders] = useState(false);
  const [selectedSharedFolder, setSelectedSharedFolder] = useState<SharedVaultFolder | null>(null);
  const [sharedFolderItems, setSharedFolderItems] = useState<VaultItem[]>([]); // Separate state to avoid overwriting user's items
  const [showShareModal, setShowShareModal] = useState(false);
  const [folderToShare, setFolderToShare] = useState<VaultFolder | null>(null);
  const [shareModalLoading, setShareModalLoading] = useState(false);
  const [currentShares, setCurrentShares] = useState<ShareInfo[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUserToShare, setSelectedUserToShare] = useState<AvailableUser | null>(null);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareNote, setShareNote] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

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
      // Update the correct state based on whether viewing shared folder or own folder
      if (selectedSharedFolder) {
        setSharedFolderItems(sharedFolderItems.filter(item => !selectedItems.has(item.id)));
      } else {
        setVaultItems(vaultItems.filter(item => !selectedItems.has(item.id)));
      }
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

  // Load shared folders on mount
  useEffect(() => {
    loadSharedFolders();
  }, []);

  // Load all folders across all profiles (for move/copy modal)
  useEffect(() => {
    if (profiles.length > 0) {
      loadAllFolders();
    }
  }, [profiles]);

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

  // Load all folders across all profiles (for move/copy modal)
  const loadAllFolders = async () => {
    try {
      const response = await fetch('/api/vault/folders');
      if (!response.ok) throw new Error("Failed to load all folders");

      const data = await response.json();
      setAllFolders(data);
    } catch (error) {
      console.error("Error loading all folders:", error);
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
      setAllFolders(prev => [...prev, folder]); // Also add to allFolders
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

  // Load items from a shared folder
  const loadSharedFolderItems = async (sharedFolder: SharedVaultFolder) => {
    setLoadingItems(true);
    setSelectedSharedFolder(sharedFolder);
    setSelectedFolderId(null); // Deselect owned folder
    
    try {
      const response = await fetch(`/api/vault/items?sharedFolderId=${sharedFolder.folderId}`);
      if (!response.ok) throw new Error("Failed to load shared folder items");

      const data = await response.json();
      // Use separate state for shared folder items to preserve user's own vault items
      setSharedFolderItems(data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })));
    } catch (error) {
      console.error("Error loading shared folder items:", error);
      showToast("Failed to load shared folder items", "error");
    } finally {
      setLoadingItems(false);
    }
  };

  // Load folders shared with the current user
  const loadSharedFolders = async () => {
    setLoadingSharedFolders(true);
    try {
      const response = await fetch('/api/vault/folders/shared');
      if (!response.ok) throw new Error("Failed to load shared folders");

      const data = await response.json();
      setSharedFolders(data.shares.map((share: any) => ({
        ...share,
        createdAt: new Date(share.createdAt),
        updatedAt: new Date(share.updatedAt),
      })));
    } catch (error) {
      console.error("Error loading shared folders:", error);
    } finally {
      setLoadingSharedFolders(false);
    }
  };

  // Load available users for sharing
  const loadAvailableUsers = async () => {
    try {
      const response = await fetch('/api/users/list');
      if (!response.ok) throw new Error("Failed to load users");

      const data = await response.json();
      setAvailableUsers(data.users.map((user: any) => ({
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.firstName || user.lastName || user.email || user.clerkId,
      })));
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  // Load current shares for a folder
  const loadCurrentShares = async (folderId: string) => {
    try {
      const response = await fetch(`/api/vault/folders/share?vaultFolderId=${folderId}`);
      if (!response.ok) throw new Error("Failed to load shares");

      const data = await response.json();
      setCurrentShares(data);
    } catch (error) {
      console.error("Error loading shares:", error);
    }
  };

  // Open share modal
  const handleOpenShareModal = async (folder: VaultFolder) => {
    setFolderToShare(folder);
    setShowShareModal(true);
    setShareModalLoading(true);
    
    await Promise.all([
      loadCurrentShares(folder.id),
      loadAvailableUsers(),
    ]);
    
    setShareModalLoading(false);
  };

  // Share folder with user
  const handleShareFolder = async () => {
    if (!folderToShare || !selectedUserToShare) return;

    setShareModalLoading(true);
    try {
      const response = await fetch('/api/vault/folders/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultFolderId: folderToShare.id,
          sharedWithClerkIds: [selectedUserToShare.clerkId],
          permission: sharePermission,
          note: shareNote.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to share folder");

      showToast(`Folder shared with ${selectedUserToShare.displayName}`, "success");
      
      // Reset form and reload shares
      setSelectedUserToShare(null);
      setUserSearchQuery('');
      setShareNote('');
      setSharePermission('VIEW');
      await loadCurrentShares(folderToShare.id);
      loadFolders(); // Refresh to show "shared" badge
    } catch (error) {
      console.error("Error sharing folder:", error);
      showToast("Failed to share folder", "error");
    } finally {
      setShareModalLoading(false);
    }
  };

  // Remove share
  const handleRemoveShare = async (sharedWithClerkId: string, displayName: string) => {
    if (!folderToShare) return;

    try {
      const response = await fetch('/api/vault/folders/share', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultFolderId: folderToShare.id,
          sharedWithClerkId,
        }),
      });

      if (!response.ok) throw new Error("Failed to remove share");

      showToast(`Removed access for ${displayName}`, "success");
      await loadCurrentShares(folderToShare.id);
      loadFolders(); // Refresh to update "shared" badge
    } catch (error) {
      console.error("Error removing share:", error);
      showToast("Failed to remove share", "error");
    }
  };

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setSelectedSharedFolder(null); // Deselect shared folder when changing profile
    setSharedFolderItems([]); // Clear shared folder items
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
      setAllFolders([...allFolders, newFolder]); // Also add to allFolders
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
      // Also update in allFolders
      setAllFolders((prev) =>
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
      setAllFolders(allFolders.filter((f) => f.id !== folderId)); // Also remove from allFolders
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

    setUploadProgress(0);
    const totalFiles = newFiles.length;
    let completedFiles = 0;

    try {
      const uploadPromises = newFiles.map(async (file) => {
        // Step 1: Get presigned URL from server
        const presignedResponse = await fetch("/api/vault/presigned-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            profileId: selectedProfileId,
            folderId: selectedFolderId,
          }),
        });

        if (!presignedResponse.ok) {
          const errorData = await presignedResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to get upload URL for ${file.name}`);
        }

        const { presignedUrl, s3Key, awsS3Url, fileName, fileType, fileSize, profileId, folderId } = await presignedResponse.json();

        // Step 2: Upload directly to S3 using presigned URL
        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name} to storage`);
        }

        // Step 3: Confirm upload and create database record
        const confirmResponse = await fetch("/api/vault/confirm-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            s3Key,
            awsS3Url,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            profileId,
            folderId,
          }),
        });

        if (!confirmResponse.ok) {
          const errorData = await confirmResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to confirm upload for ${file.name}`);
        }

        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));

        return confirmResponse.json();
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
      setUploadProgress(0);
      showToast(`Successfully uploaded ${uploadedItems.length} file(s)!`, "success");
    } catch (error: any) {
      console.error("Error uploading files:", error);
      showToast(error.message || "Failed to upload some files", "error");
      setUploadProgress(0);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(`/api/vault/items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete item");

      // Update the correct state based on whether viewing shared folder or own folder
      if (selectedSharedFolder) {
        setSharedFolderItems(sharedFolderItems.filter((item) => item.id !== id));
      } else {
        setVaultItems(vaultItems.filter((item) => item.id !== id));
      }
      showToast("File deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting item:", error);
      showToast("Failed to delete item", "error");
    }
  };

  const filteredItems = useMemo(() => {
    // If viewing a shared folder, use sharedFolderItems (not vaultItems)
    if (selectedSharedFolder) {
      return sharedFolderItems
        .filter((item) => item.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter((item) => {
          if (contentFilter === 'all') return true;
          if (contentFilter === 'photos') return item.fileType.startsWith('image/') && item.fileType !== 'image/gif';
          if (contentFilter === 'videos') return item.fileType.startsWith('video/');
          if (contentFilter === 'audio') return item.fileType.startsWith('audio/');
          if (contentFilter === 'gifs') return item.fileType === 'image/gif';
          return true;
        });
    }

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
  }, [vaultItems, sharedFolderItems, selectedFolderId, selectedProfileId, searchQuery, folders, contentFilter, selectedSharedFolder]);

  const visibleFolders = folders.filter((folder) => folder.profileId === selectedProfileId);
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || null;
  const selectedFolder = selectedSharedFolder 
    ? { id: selectedSharedFolder.folderId, name: selectedSharedFolder.folderName, profileId: selectedSharedFolder.profileId, isDefault: selectedSharedFolder.isDefault }
    : visibleFolders.find((folder) => folder.id === selectedFolderId) || null;
  
  // Check if viewing shared content (read-only mode)
  const isViewingShared = selectedSharedFolder !== null;
  const canEdit = !isViewingShared || selectedSharedFolder?.permission === 'EDIT';

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
      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .vault-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .vault-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .vault-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(34, 211, 238, 0.4), rgba(99, 102, 241, 0.4));
          border-radius: 3px;
        }
        .vault-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(34, 211, 238, 0.6), rgba(99, 102, 241, 0.6));
        }
      `}</style>

      {/* Upload Modal - React Portal */}
      {isAddingNew && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
            onClick={() => {
              setIsAddingNew(false);
              setNewFiles([]);
              setIsDragging(false);
            }}
          />
          
          {/* Modal */}
          <div className="relative rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-900/30 backdrop-blur w-full max-w-2xl animate-slideIn">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-cyan-900/50">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Upload Media</h3>
              </div>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewFiles([]);
                  setIsDragging(false);
                }}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5 text-slate-400" />
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
                className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02]'
                    : 'border-white/20 bg-white/5 hover:border-cyan-400/50 hover:bg-white/10'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-4 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-2xl">
                    <Upload className="w-8 h-8 text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white mb-1">
                      Drag and drop files here
                    </p>
                    <p className="text-xs text-slate-400">or click to browse</p>
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
                    <p className="text-sm font-semibold text-slate-200">
                      Selected Files ({newFiles.length})
                    </p>
                    <button
                      onClick={() => setNewFiles([])}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2 vault-scrollbar">
                    {newFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {file.type.startsWith('image/') ? (
                            <ImageIcon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                          ) : file.type.startsWith('video/') ? (
                            <VideoIcon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                          ) : file.type.startsWith('audio/') ? (
                            <Music4 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                          ) : (
                            <FileIcon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                            <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== index))}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors flex-shrink-0 ml-2"
                          title="Remove"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Supports images, videos, GIFs, and audio files (no size limit)</span>
              </div>

              {/* Upload Progress Bar */}
              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 font-medium">Uploading...</span>
                    <span className="text-cyan-400 font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-white/10">
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewFiles([]);
                  setIsDragging(false);
                  setUploadProgress(0);
                }}
                disabled={uploadProgress > 0}
                className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-white/10 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={newFiles.length === 0 || uploadProgress > 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-cyan-900/40 hover:shadow-xl transition-all flex items-center gap-2"
              >
                {uploadProgress > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Upload {newFiles.length > 0 && `(${newFiles.length})`}</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move/Copy Modal - React Portal */}
      {showMoveModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div 
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
            onClick={() => {
              setShowMoveModal(false);
              setIsCopyMode(false);
            }}
          />
          
          <div className="relative rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-900/30 backdrop-blur w-full max-w-md animate-slideIn">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl shadow-lg ${isCopyMode ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-900/50' : 'bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 shadow-cyan-900/50'}`}>
                  {isCopyMode ? <Copy className="w-5 h-5 text-white" /> : <Move className="w-5 h-5 text-white" />}
                </div>
                <h3 className="text-xl font-bold text-white">
                  {isCopyMode ? 'Copy' : 'Move'} {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setIsCopyMode(false);
                }}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Copy/Move Toggle - Always show */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-300">
                  Action Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsCopyMode(false)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                      !isCopyMode
                        ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-cyan-900/40'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Move className="w-4 h-4" />
                      Move
                    </button>
                    <button
                      onClick={() => setIsCopyMode(true)}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                        isCopyMode
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/40'
                          : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {isCopyMode 
                      ? '📋 Copy will duplicate files (originals stay in current folder)'
                      : '📦 Move will transfer files (removes from current folder)'}
                  </p>
                </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Select destination folder
                </label>
                <select
                  value={moveToFolderId || ''}
                  onChange={(e) => setMoveToFolderId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-white vault-scrollbar"
                >
                  <option value="" className="bg-slate-900">Choose folder...</option>
                  {isViewingShared ? (
                    <>
                      {/* When viewing shared folder, show user's own folders grouped by profile */}
                      {profiles.map(profile => {
                        const profileFolders = allFolders.filter(f => f.profileId === profile.id && !f.isDefault);
                        if (profileFolders.length === 0) return null;
                        return (
                          <optgroup key={profile.id} label={`Your Profile: ${profile.name}`} className="bg-slate-900">
                            {profileFolders.map(folder => (
                              <option key={folder.id} value={folder.id} className="bg-slate-900">{folder.name}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {/* Also show other shared folders with EDIT permission */}
                      {sharedFolders.filter(sf => sf.permission === 'EDIT' && sf.folderId !== selectedSharedFolder?.folderId).length > 0 && (
                        <optgroup label="Other Shared Folders (Edit Access)" className="bg-slate-900">
                          {sharedFolders
                            .filter(sf => sf.permission === 'EDIT' && sf.folderId !== selectedSharedFolder?.folderId)
                            .map(sf => (
                              <option key={sf.folderId} value={sf.folderId} className="bg-slate-900">
                                {sf.folderName} (from {sf.ownerName})
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    <>
                      {/* When viewing own folder, show folders from ALL profiles (exclude default/All Media folders) */}
                      {profiles.map(profile => {
                        const profileFolders = allFolders.filter(f => 
                          f.profileId === profile.id && 
                          !f.isDefault && // Exclude "All Media" default folders
                          !(profile.id === selectedProfileId && f.id === selectedFolderId) // Exclude current folder
                        );
                        if (profileFolders.length === 0) return null;
                        return (
                          <optgroup key={profile.id} label={`${profile.id === selectedProfileId ? '📍 Current: ' : ''}${profile.name}`} className="bg-slate-900">
                            {profileFolders.map(folder => (
                              <option key={folder.id} value={folder.id} className="bg-slate-900">{folder.name}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {/* Also show shared folders with EDIT permission */}
                      {sharedFolders.filter(sf => sf.permission === 'EDIT').length > 0 && (
                        <optgroup label="Shared Folders (Edit Access)" className="bg-slate-900">
                          {sharedFolders
                            .filter(sf => sf.permission === 'EDIT')
                            .map(sf => (
                              <option key={sf.folderId} value={sf.folderId} className="bg-slate-900">
                                {sf.folderName} (from {sf.ownerName})
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMoveModal(false);
                    setIsCopyMode(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl font-semibold hover:bg-white/10 transition-all"
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
                      const itemsToProcess = Array.from(selectedItems);
                      
                      if (isCopyMode) {
                        // COPY: Use the copy endpoint
                        const results = await Promise.all(
                          itemsToProcess.map(async (itemId) => {
                            const response = await fetch(`/api/vault/items/${itemId}/copy`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ folderId: moveToFolderId }),
                            });
                            
                            if (!response.ok) {
                              const error = await response.text();
                              console.error(`Failed to copy item ${itemId}:`, error);
                              return { success: false, itemId };
                            }
                            
                            return { success: true, itemId };
                          })
                        );
                        
                        const failedCopies = results.filter(r => !r.success);
                        
                        if (failedCopies.length > 0) {
                          showToast(`Failed to copy ${failedCopies.length} item(s)`, 'error');
                        } else {
                          showToast(`Successfully copied ${itemsToProcess.length} item(s)!`, 'success');
                        }
                        
                        // Reload user's own items to show the copied files
                        await loadItems();
                        
                      } else {
                        // MOVE: Use the existing move endpoint
                        const results = await Promise.all(
                          itemsToProcess.map(async (itemId) => {
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
                        
                        const failedMoves = results.filter(r => !r.success);
                        
                        if (failedMoves.length > 0) {
                          showToast(`Failed to move ${failedMoves.length} item(s)`, 'error');
                        } else {
                          showToast(`Successfully moved ${itemsToProcess.length} item(s)!`, 'success');
                        }
                        
                        // Update the correct state based on whether viewing shared folder
                        if (selectedSharedFolder) {
                          // Remove moved items from shared folder view
                          setSharedFolderItems(sharedFolderItems.filter(item => !selectedItems.has(item.id)));
                          // Also reload user's own items
                          await loadItems();
                        } else {
                          // Reload items from backend to get fresh data
                          await loadItems();
                        }
                      }
                      
                      setSelectedItems(new Set());
                      setShowMoveModal(false);
                      setMoveToFolderId(null);
                      setIsCopyMode(false);
                    } catch (error) {
                      console.error(`Error ${isCopyMode ? 'copying' : 'moving'} items:`, error);
                      showToast(`Failed to ${isCopyMode ? 'copy' : 'move'} items`, 'error');
                    } finally {
                      setIsMoving(false);
                    }
                  }}
                  disabled={!moveToFolderId || isMoving}
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${
                    isCopyMode 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-900/40'
                      : 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-700 shadow-cyan-900/40'
                  }`}
                >
                  {isMoving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isCopyMode ? 'Copying...' : 'Moving...'}
                    </>
                  ) : (
                    <>
                      {isCopyMode ? <Copy className="w-5 h-5" /> : <Move className="w-5 h-5" />}
                      {isCopyMode ? 'Copy Files' : 'Move Files'}
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
            className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm"
            onClick={() => setPreviewItem(null)}
          />
          
          <div className="relative rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-900/30 backdrop-blur w-full max-w-6xl max-h-[95vh] flex flex-col animate-slideIn">
            {/* Header with metadata */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="p-2.5 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-cyan-900/50 flex-shrink-0">
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
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">{previewItem.fileName}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-400 mt-1">
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
                className="p-2 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Content area with navigation */}
            <div className="flex-1 overflow-hidden flex items-center relative bg-slate-900/50">
              {/* Previous button */}
              {filteredItems.length > 1 && (
                <button
                  onClick={() => {
                    const currentIndex = filteredItems.findIndex(item => item.id === previewItem.id);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
                    setPreviewItem(filteredItems[prevIndex]);
                  }}
                  className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full shadow-lg transition-all hover:scale-110 border border-white/10"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </button>
              )}
              
              {/* Content */}
              <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-auto">
                {previewItem.fileType.startsWith('image/') ? (
                  <img
                    src={previewItem.awsS3Url}
                    alt={previewItem.fileName}
                    className="max-w-full max-h-[calc(95vh-220px)] object-contain rounded-xl"
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
                    className="max-w-full max-h-[calc(95vh-220px)] rounded-xl"
                  />
                ) : previewItem.fileType.startsWith('audio/') ? (
                  <div className="w-full max-w-2xl">
                    <div className="bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 rounded-2xl p-8 mb-6 border border-white/10">
                      <Music4 className="w-20 h-20 text-cyan-400 mx-auto mb-4" />
                      <p className="text-center text-slate-300 font-semibold">{previewItem.fileName}</p>
                    </div>
                    <audio src={previewItem.awsS3Url} controls autoPlay className="w-full" />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileIcon className="w-20 h-20 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">Preview not available for this file type</p>
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
                  className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full shadow-lg transition-all hover:scale-110 border border-white/10"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </button>
              )}
            </div>
            
            {/* Footer with actions and info */}
            <div className="border-t border-white/10">
              {/* Item counter */}
              {filteredItems.length > 1 && (
                <div className="px-4 sm:px-6 py-2 bg-white/5 text-center">
                  <span className="text-xs sm:text-sm text-slate-400 font-medium">
                    {filteredItems.findIndex(item => item.id === previewItem.id) + 1} of {filteredItems.length}
                  </span>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-6 gap-3">
                <a
                  href={previewItem.awsS3Url}
                  download={previewItem.fileName}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-cyan-900/40 hover:shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                {canEdit && (
                  <button
                    onClick={() => {
                      handleDeleteItem(previewItem.id);
                      setPreviewItem(null);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Share Folder Modal - React Portal */}
      {showShareModal && folderToShare && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div 
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
            onClick={() => {
              setShowShareModal(false);
              setFolderToShare(null);
              setSelectedUserToShare(null);
              setUserSearchQuery('');
              setShareNote('');
            }}
          />
          
          <div className="relative rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-900/30 backdrop-blur w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slideIn vault-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-slate-950/95 backdrop-blur z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-cyan-900/50">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Share Folder
                  </h3>
                  <p className="text-sm text-slate-400">{folderToShare.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setFolderToShare(null);
                  setSelectedUserToShare(null);
                  setUserSearchQuery('');
                  setShareNote('');
                }}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {shareModalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                </div>
              ) : (
                <>
                  {/* Share with new user */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-cyan-400" />
                      Share with User
                    </h4>
                    
                    {/* User search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-white placeholder-slate-400"
                      />
                    </div>
                    
                    {/* User list */}
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-white/10 rounded-xl p-2 bg-white/5 vault-scrollbar">
                      {availableUsers
                        .filter(user => {
                          const query = userSearchQuery.toLowerCase();
                          return user.displayName.toLowerCase().includes(query) ||
                            (user.email?.toLowerCase().includes(query) ?? false);
                        })
                        .filter(user => !currentShares.some(s => s.sharedWithClerkId === user.clerkId))
                        .slice(0, 10)
                        .map(user => (
                          <button
                            key={user.clerkId}
                            onClick={() => setSelectedUserToShare(user)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${
                              selectedUserToShare?.clerkId === user.clerkId
                                ? 'bg-cyan-500/20 border border-cyan-500/50'
                                : 'hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{user.displayName}</p>
                              {user.email && (
                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                              )}
                            </div>
                            {selectedUserToShare?.clerkId === user.clerkId && (
                              <Check className="w-5 h-5 text-cyan-400" />
                            )}
                          </button>
                        ))
                      }
                      {availableUsers.length === 0 && (
                        <p className="text-center py-4 text-slate-400 text-sm">
                          No users available to share with
                        </p>
                      )}
                    </div>

                    {/* Permission selector */}
                    {selectedUserToShare && (
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-slate-300">Permission:</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSharePermission('VIEW')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                              sharePermission === 'VIEW'
                                ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                            View Only
                          </button>
                          <button
                            onClick={() => setSharePermission('EDIT')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                              sharePermission === 'EDIT'
                                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <Edit2 className="w-4 h-4" />
                            Can Edit
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Optional note */}
                    {selectedUserToShare && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                          Note (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Add a message..."
                          value={shareNote}
                          onChange={(e) => setShareNote(e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-white placeholder-slate-400"
                        />
                      </div>
                    )}

                    {/* Share button */}
                    {selectedUserToShare && (
                      <button
                        onClick={handleShareFolder}
                        disabled={shareModalLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/40"
                      >
                        {shareModalLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sharing...
                          </>
                        ) : (
                          <>
                            <Share2 className="w-5 h-5" />
                            Share with {selectedUserToShare.displayName}
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Current shares */}
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-400" />
                        Currently Shared With
                      </h4>
                      <span className="px-2 py-0.5 text-xs font-bold bg-white/10 text-slate-300 rounded-full">
                        {currentShares.length}
                      </span>
                    </div>

                    {currentShares.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-white/20 rounded-2xl bg-white/5">
                        <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">
                          Not shared with anyone yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentShares.map((share) => (
                          <div
                            key={share.id}
                            className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                                {share.sharedWithUser?.displayName?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-white">
                                  {share.sharedWithUser?.displayName || share.sharedWithClerkId}
                                </p>
                                {share.sharedWithUser?.email && (
                                  <p className="text-xs text-slate-400">
                                    {share.sharedWithUser.email}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                                share.permission === 'EDIT'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}>
                                {share.permission === 'EDIT' ? <Edit2 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {share.permission}
                              </span>
                              <button
                                onClick={() => handleRemoveShare(share.sharedWithClerkId, share.sharedWithUser?.displayName || 'User')}
                                className="p-2 hover:bg-red-500/20 rounded-xl transition-colors"
                                title="Remove access"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative space-y-6 animate-fadeIn p-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slideInRight">
          <div className={`flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border ${
            toast.type === 'success' 
              ? 'bg-emerald-500/20 border-emerald-500/30 shadow-emerald-900/30' 
              : toast.type === 'error'
              ? 'bg-red-500/20 border-red-500/30 shadow-red-900/30'
              : 'bg-cyan-500/20 border-cyan-500/30 shadow-cyan-900/30'
          }`}>
            {toast.type === 'success' && <Check className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-cyan-400" />}
            <p className={`text-sm font-medium ${
              toast.type === 'success' 
                ? 'text-emerald-200' 
                : toast.type === 'error'
                ? 'text-red-200'
                : 'text-cyan-200'
            }`}>
              {toast.message}
            </p>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-900/50">
              <Shield className="w-6 h-6 text-white" />
              <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Secure Storage</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white">
                Vault
              </h1>
            </div>
          </div>
          <p className="text-sm text-slate-300 ml-14">
            {selectedProfile ? `Managing vault for ${selectedProfile.name}` : 'Select a profile to start'}
          </p>
        </div>
        {!isViewingShared && (
          <button
            onClick={() => setIsAddingNew(true)}
            disabled={!selectedProfileId || !selectedFolderId}
            className="group relative overflow-hidden flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-700 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-cyan-900/40 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Upload className="w-5 h-5 relative z-10" />
            <span className="font-semibold relative z-10">Upload Media</span>
            <Sparkles className="w-4 h-4 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {selectedProfileId && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all hover:bg-white/10 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">Total Files</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {totalItems}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200">
                <HardDrive className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all hover:bg-white/10 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Storage Used</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {(totalSize / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-200">
                <Shield className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all hover:bg-white/10 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Images</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {imageCount}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                <ImageIcon className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all hover:bg-white/10 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-200 uppercase tracking-wider">Videos</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {videoCount}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200">
                <VideoIcon className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:gap-6 xl:grid-cols-12">
        {/* Profiles */}
        <div className="xl:col-span-3 self-start">
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-cyan-900/20 p-5 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Profiles</p>
                <h3 className="text-xl font-bold text-white">Instagram</h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            {loadingProfiles ? (
              <div className="flex items-center justify-center py-12">
                <div className="relative">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-pulse" />
                </div>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-4 bg-white/10 rounded-2xl w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-white mb-1">No profiles found</p>
                <p className="text-xs text-slate-400">Create a profile to get started</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden pr-1 vault-scrollbar">
                {profiles.map((profile) => {
                  const isActive = profile.id === selectedProfileId;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => handleSelectProfile(profile.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 ${
                        isActive
                          ? "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-cyan-900/40"
                          : "bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">{profile.name}</span>
                        {profile.instagramUsername && (
                          <span className={`text-xs mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                            @{profile.instagramUsername}
                          </span>
                        )}
                      </div>
                      {profile.isDefault && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isActive 
                            ? 'bg-white/20 text-white' 
                            : 'bg-cyan-500/20 text-cyan-300'
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
        <div className="xl:col-span-3 self-start">
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-cyan-900/20 p-5 backdrop-blur space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Folders</p>
                <h3 className="text-xl font-bold text-white">Categories</h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-200">
                <Folder className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <FolderPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder="New folder name"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-white placeholder-slate-400"
                  disabled={!selectedProfileId}
                />
              </div>
              <button
                onClick={handleCreateFolder}
                disabled={!selectedProfileId || !folderNameInput.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-900/40 hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
                title="Create folder"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden pr-1 vault-scrollbar">
              {selectedProfileId && visibleFolders.length === 0 && (
                <div className="text-center py-6 px-2">
                  <div className="p-3 bg-white/10 rounded-2xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                    <Folder className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">No folders yet</p>
                  <p className="text-xs text-slate-400">Create one to organize items</p>
                </div>
              )}
              {visibleFolders.map((folder) => {
                const isActive = folder.id === selectedFolderId && !selectedSharedFolder;
                // For default "All Media" folder, count all items; otherwise count items in specific folder
                const itemCount = folder.isDefault
                  ? vaultItems.filter((item) => item.profileId === selectedProfileId).length
                  : vaultItems.filter((item) => item.folderId === folder.id && item.profileId === selectedProfileId).length;

                return (
                  <div
                    key={folder.id}
                    className={`group/folder flex items-center justify-between px-3 py-3 rounded-xl border transition-all duration-300 ${
                      isActive
                        ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg"
                        : "border-white/10 bg-white/5 hover:border-cyan-500/30 hover:bg-white/10"
                    }`}
                  >
                  {editingFolderId === folder.id ? (
                    <div className="flex-1 flex items-center space-x-2">
                      <input
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateFolder()}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 border border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                      />
                      <button
                        onClick={handleUpdateFolder}
                        className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-all"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingFolderId(null);
                          setEditingFolderName("");
                        }}
                        className="p-2 rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 transition-all"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setSelectedSharedFolder(null); // Deselect shared folder
                        setSharedFolderItems([]); // Clear shared folder items
                      }}
                      className="flex-1 flex items-center space-x-2.5 text-left min-w-0"
                    >
                      <Folder className={`h-5 w-5 flex-shrink-0 ${isActive && !selectedSharedFolder ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className={`font-semibold truncate ${isActive && !selectedSharedFolder ? 'text-white' : 'text-slate-200'}`}>{folder.name}</span>
                      <span className={`text-xs flex-shrink-0 px-2 py-0.5 rounded-full ${
                        isActive && !selectedSharedFolder
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-white/10 text-slate-400'
                      }`}>{itemCount}</span>
                      {folder.isDefault && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 flex-shrink-0">Default</span>
                      )}
                    </button>
                  )}

                  {editingFolderId !== folder.id && (
                    <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenShareModal(folder);
                        }}
                        className="p-2 rounded-xl hover:bg-cyan-500/20 transition-all"
                        title="Share folder"
                      >
                        <Share2 className="h-4 w-4 text-cyan-400" />
                      </button>
                      <button
                        onClick={() => startEditFolder(folder)}
                        disabled={folder.isDefault}
                        className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        title="Rename"
                      >
                        <Edit2 className="h-4 w-4 text-slate-400" />
                      </button>
                      {!folder.isDefault && (
                        <button
                          onClick={() => handleDeleteFolder(folder.id)}
                          className="p-2 rounded-xl hover:bg-red-500/20 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Shared With Me Section */}
          {sharedFolders.length > 0 && (
            <div className="mt-4 pt-4 border-t border-dashed border-white/20">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Shared With Me
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded-full">
                  {sharedFolders.length}
                </span>
              </div>
              <div className="space-y-2">
                {sharedFolders.map((shared) => {
                  const isActive = selectedSharedFolder?.folderId === shared.folderId;
                  return (
                    <button
                      key={shared.id}
                      onClick={() => loadSharedFolderItems(shared)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all duration-300 text-left ${
                        isActive
                          ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg"
                          : "border-white/10 bg-white/5 hover:border-cyan-500/30 hover:bg-white/10"
                      }`}
                    >
                      <Folder className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {shared.folderName}
                          </span>
                          <span className={`text-xs flex-shrink-0 px-2 py-0.5 rounded-full ${
                            isActive 
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-white/10 text-slate-400'
                          }`}>{shared.itemCount}</span>
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 flex-shrink-0">
                            <Eye className="w-3 h-3" />
                            {shared.permission}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          From: {shared.sharedBy} • {shared.profileName}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="xl:col-span-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-cyan-900/20 p-5 backdrop-blur space-y-4 max-h-[600px] flex flex-col">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {isViewingShared ? 'Shared Content' : 'Content'}
                </p>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">
                    {selectedFolder?.name || "Select a folder"}
                  </h3>
                  {isViewingShared && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                      <Users className="w-3 h-3" />
                      {selectedSharedFolder?.permission}
                    </span>
                  )}
                </div>
                {isViewingShared && selectedSharedFolder ? (
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Share2 className="w-3 h-3" />
                      Shared by {selectedSharedFolder.sharedBy} • {selectedSharedFolder.profileName}
                    </span>
                  </p>
                ) : selectedProfile && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {selectedProfile.name}
                    </span>
                  </p>
                )}
              </div>
              
              {/* View-only mode banner */}
              {isViewingShared && !canEdit && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">View Only</span>
                </div>
              )}
              
              {/* Search Input */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vault items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-white placeholder-slate-400"
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
                    className="w-4 h-4 text-cyan-500 border-white/20 rounded bg-white/5 focus:ring-2 focus:ring-cyan-500"
                  />
                  <span className="text-xs font-medium text-slate-400">
                    {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select all'}
                  </span>
                </div>
              )}
              
              {/* Action Bar - Show when items are selected */}
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2 animate-slideIn">
                  {canEdit && (
                    <button
                      onClick={handleBulkMove}
                      disabled={isMoving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Move className="h-3 w-3" />}
                      Move
                    </button>
                  )}
                  <button
                    onClick={handleDownloadZip}
                    disabled={isDownloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    ZIP
                  </button>
                  {canEdit && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  )}
                </div>
              )}
              
              {/* Content Type Filter */}
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <button
                  onClick={() => setContentFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    contentFilter === 'all'
                      ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-cyan-900/40'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setContentFilter('photos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                    contentFilter === 'photos'
                      ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-cyan-900/40'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  Photos
                </button>
                <button
                  onClick={() => setContentFilter('videos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                    contentFilter === 'videos'
                      ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-cyan-900/40'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <VideoIcon className="w-3 h-3" />
                  Videos
                </button>
                <button
                  onClick={() => setContentFilter('audio')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                    contentFilter === 'audio'
                      ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-cyan-900/40'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Music4 className="w-3 h-3" />
                  Audio
                </button>
                <button
                  onClick={() => setContentFilter('gifs')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    contentFilter === 'gifs'
                      ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-cyan-900/40'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  GIFs
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 vault-scrollbar">
          {!selectedProfileId && !selectedSharedFolder ? (
            <div className="border border-dashed border-white/20 rounded-2xl p-8 text-center text-slate-400">
              Select a profile to start using the vault.
            </div>
          ) : !selectedFolderId && !selectedSharedFolder ? (
            <div className="border border-dashed border-white/20 rounded-2xl p-8 text-center text-slate-400">
              Create a folder to organize your vault items.
            </div>
          ) : loadingItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-white/10 rounded w-3/4"></div>
                      <div className="h-3 bg-white/5 rounded w-1/2"></div>
                    </div>
                    <div className="h-8 w-8 bg-white/10 rounded-xl"></div>
                  </div>
                  <div className="h-48 bg-white/10 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredItems.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-10 text-center">
                  <Lock className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                  <p className="font-semibold text-white mb-1">No items in this folder</p>
                  <p className="text-sm text-slate-400">Upload some content to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-white/5 border rounded-2xl p-4 flex flex-col max-w-sm hover:shadow-lg hover:shadow-cyan-900/20 transition-all ${
                        selectedItems.has(item.id) 
                          ? 'border-cyan-500/50 bg-cyan-500/10' 
                          : 'border-white/10 hover:border-cyan-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="mt-1 w-4 h-4 text-cyan-500 border-white/20 rounded bg-white/5 focus:ring-2 focus:ring-cyan-500 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {item.fileType.startsWith("image/") ? (
                              <ImageIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                            ) : item.fileType.startsWith("video/") ? (
                              <VideoIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                            ) : item.fileType.startsWith("audio/") ? (
                              <Music4 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                            ) : (
                              <FileIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                            )}
                            <h4 className="font-semibold text-white text-sm truncate">{item.fileName}</h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {item.createdAt.toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            className="p-2 rounded-xl hover:bg-red-500/20 flex-shrink-0 ml-2 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        )}
                      </div>
                      <div 
                        className="flex-1 cursor-pointer group"
                        onClick={() => setPreviewItem(item)}
                      >
                        {item.fileType.startsWith("image/") ? (
                          <div className="relative overflow-hidden rounded-xl">
                            <img
                              src={item.awsS3Url}
                              alt={item.fileName}
                              className="w-full h-48 object-cover rounded-xl border border-white/10 group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-xl flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="p-3 bg-white/10 backdrop-blur rounded-full">
                                  <Search className="w-6 h-6 text-cyan-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : item.fileType.startsWith("video/") ? (
                          <div className="relative overflow-hidden rounded-xl">
                            <video
                              src={item.awsS3Url}
                              className="w-full h-48 object-cover rounded-xl border border-white/10"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-xl flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="p-3 bg-white/10 backdrop-blur rounded-full">
                                  <Search className="w-6 h-6 text-cyan-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : item.fileType.startsWith("audio/") ? (
                          <div className="h-48 flex items-center justify-center bg-gradient-to-br from-cyan-900/20 to-indigo-900/20 rounded-xl border border-white/10 group-hover:scale-105 transition-transform duration-300">
                            <Music4 className="w-16 h-16 text-cyan-400" />
                          </div>
                        ) : (
                          <div className="h-48 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 group-hover:scale-105 transition-transform duration-300">
                            <FileIcon className="w-16 h-16 text-slate-400" />
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
    </div>
    </>
  );
}
