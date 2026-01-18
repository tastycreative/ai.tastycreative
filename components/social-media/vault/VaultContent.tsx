"use client";

import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Constants for pagination - reduced for better initial load performance
const ITEMS_PER_PAGE = 30;
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Folder,
  FolderOpen,
  FolderPlus,
  Check,
  X,
  Loader2,
  File as FileIcon,
  Image as ImageIcon,
  Menu,
  PanelLeftClose,
  Video as VideoIcon,
  Music4,
  AlertCircle,
  Upload,
  Download,
  Move,
  Copy,
  ChevronLeft,
  ChevronRight,
  Share2,
  Users,
  Eye,
  Grid3X3,
  List,
  Calendar,
  HardDrive,
  ChevronDown,
  FolderClosed,
  PlayCircle,
  Info,
  Sparkles,
  Maximize2,
  Wand2,
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
  hasShares?: boolean;
}

interface SharedVaultFolder {
  id: string;
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

interface VaultItemMetadata {
  source?: string;
  generationType?: string;
  model?: string;
  prompt?: string;
  size?: string;
  resolution?: string;
  watermark?: boolean;
  numReferenceImages?: number;
  generatedAt?: string;
  // Additional fields for other generation types
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  sampler?: string;
  [key: string]: any; // Allow other custom fields
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
  metadata?: VaultItemMetadata | null;
}

// Memoized Grid Item Component for performance
interface GridItemProps {
  item: VaultItem;
  isSelected: boolean;
  selectionMode: boolean;
  canEdit: boolean;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onPreview: (item: VaultItem) => void;
  onDelete: (id: string) => void;
  formatFileSize: (bytes: number) => string;
}

const VaultGridItem = memo(function VaultGridItem({
  item,
  isSelected,
  selectionMode,
  canEdit,
  onSelect,
  onPreview,
  onDelete,
  formatFileSize,
}: GridItemProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault();
      onSelect(item.id, e);
    }
  }, [selectionMode, onSelect, item.id]);

  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    if (!selectionMode) {
      e.stopPropagation();
      onPreview(item);
    }
  }, [selectionMode, onPreview, item]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id, e);
  }, [onSelect, item.id]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  }, [onDelete, item.id]);

  return (
    <div
      className={`vault-item group bg-gray-900 rounded-lg sm:rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-gray-800 hover:border-gray-700 hover:shadow-lg'
      }`}
      onClick={handleClick}
    >
      <div className="relative">
        <div
          className={`absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 transition-opacity ${
            selectionMode || isSelected
              ? 'opacity-100'
              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
        >
          <label 
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-gray-900/80 backdrop-blur rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(item.id);
              }}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 shadow-sm cursor-pointer"
            />
          </label>
        </div>
        <div
          className="aspect-square p-2 sm:p-3"
          onClick={handlePreviewClick}
        >
          {item.fileType.startsWith('image/') ? (
            <img
              src={item.awsS3Url}
              alt={item.fileName}
              className="w-full h-full object-cover rounded-lg bg-gray-800"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = 'true';
                  img.src = item.awsS3Url + '?t=' + Date.now();
                }
              }}
            />
          ) : item.fileType.startsWith('video/') ? (
            <div className="relative w-full h-full bg-gray-800 rounded-lg overflow-hidden">
              <video
                src={item.awsS3Url}
                className="w-full h-full object-cover"
                muted
                playsInline
                preload="metadata"
                onLoadedData={(e) => {
                  const video = e.currentTarget;
                  video.currentTime = 0.1;
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-8 sm:w-10 h-8 sm:h-10 bg-white/30 backdrop-blur rounded-full flex items-center justify-center">
                  <PlayCircle className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
                </div>
              </div>
            </div>
          ) : item.fileType.startsWith('audio/') ? (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg flex items-center justify-center">
              <Music4 className="w-10 sm:w-12 h-10 sm:h-12 text-purple-400" />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
              <FileIcon className="w-10 sm:w-12 h-10 sm:h-12 text-gray-600" />
            </div>
          )}
        </div>
        <div
          className={`absolute top-1.5 sm:top-2 right-1.5 sm:right-2 flex items-center gap-1 transition-opacity ${
            !selectionMode && (isSelected ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100')
          } ${selectionMode ? 'hidden' : ''}`}
        >
          {item.metadata && (
            <div
              className="p-1 sm:p-1.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur shadow-sm rounded-lg"
              title="AI Generated - Click to view details"
            >
              <Sparkles className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-cyan-400" />
            </div>
          )}
          <a
            href={item.awsS3Url}
            download={item.fileName}
            onClick={(e) => e.stopPropagation()}
            className="p-1 sm:p-1.5 bg-gray-900/80 backdrop-blur shadow-sm rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-300" />
          </a>
          {canEdit && (
            <button
              onClick={handleDeleteClick}
              className="p-1 sm:p-1.5 bg-gray-900/80 backdrop-blur shadow-sm rounded-lg hover:bg-red-900/50 transition-colors"
            >
              <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-red-400" />
            </button>
          )}
        </div>
      </div>
      <div className="px-2 sm:px-3 pb-2 sm:pb-3">
        <p className="text-xs sm:text-sm font-medium text-gray-200 truncate">
          {item.fileName}
        </p>
        <div className="flex items-center justify-between mt-0.5 sm:mt-1">
          <span className="text-[10px] sm:text-xs text-gray-500">
            {formatFileSize(item.fileSize)}
          </span>
          <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:inline">
            {item.createdAt.toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
});

// Memoized List Item Component for performance
interface ListItemProps {
  item: VaultItem;
  isSelected: boolean;
  selectionMode: boolean;
  canEdit: boolean;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onPreview: (item: VaultItem) => void;
  onDelete: (id: string) => void;
  formatFileSize: (bytes: number) => string;
}

const VaultListItem = memo(function VaultListItem({
  item,
  isSelected,
  selectionMode,
  canEdit,
  onSelect,
  onPreview,
  onDelete,
  formatFileSize,
}: ListItemProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (selectionMode) {
      onSelect(item.id, e);
    } else {
      onPreview(item);
    }
  }, [selectionMode, onSelect, onPreview, item]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id, e);
  }, [onSelect, item.id]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  }, [onDelete, item.id]);

  return (
    <div
      onClick={handleClick}
      className={`vault-item group flex items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-gray-900 rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      <div
        className={`transition-opacity ${
          selectionMode || isSelected
            ? 'opacity-100'
            : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center justify-center w-8 h-8 cursor-pointer hover:bg-gray-800 rounded-lg transition-colors">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
            className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0 cursor-pointer"
          />
        </label>
      </div>
      <div className="w-10 sm:w-12 h-10 sm:h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
        {item.fileType.startsWith('image/') ? (
          <img
            src={item.awsS3Url}
            alt={item.fileName}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.retried) {
                img.dataset.retried = 'true';
                img.src = item.awsS3Url + '?t=' + Date.now();
              }
            }}
          />
        ) : item.fileType.startsWith('video/') ? (
          <div className="relative w-full h-full bg-gray-800">
            <video
              src={item.awsS3Url}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
              onLoadedData={(e) => {
                const video = e.currentTarget;
                video.currentTime = 0.1;
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <VideoIcon className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
            </div>
          </div>
        ) : item.fileType.startsWith('audio/') ? (
          <div className="w-full h-full bg-purple-900/30 flex items-center justify-center">
            <Music4 className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileIcon className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-gray-200 truncate">
          {item.fileName}
        </p>
        <p className="text-[10px] sm:text-xs text-gray-500">
          {formatFileSize(item.fileSize)}
        </p>
      </div>
      <div className="text-[10px] sm:text-xs text-gray-600 items-center gap-1 hidden md:flex">
        <Calendar className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
        {item.createdAt.toLocaleDateString()}
      </div>
      <div
        className={`flex items-center gap-1 transition-opacity flex-shrink-0 ${
          selectionMode ? 'hidden' : 'sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        <a
          href={item.awsS3Url}
          download={item.fileName}
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 sm:p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-400" />
        </a>
        {canEdit && (
          <button
            onClick={handleDeleteClick}
            className="p-1.5 sm:p-2 hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
});

export function VaultContent() {
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [allFolders, setAllFolders] = useState<VaultFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contentFilter, setContentFilter] = useState<'all' | 'photos' | 'videos' | 'audio' | 'gifs'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveToFolderId, setMoveToFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [sharedFolders, setSharedFolders] = useState<SharedVaultFolder[]>([]);
  const [loadingSharedFolders, setLoadingSharedFolders] = useState(false);
  const [selectedSharedFolder, setSelectedSharedFolder] = useState<SharedVaultFolder | null>(null);
  const [sharedFolderItems, setSharedFolderItems] = useState<VaultItem[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [folderToShare, setFolderToShare] = useState<VaultFolder | null>(null);
  const [shareModalLoading, setShareModalLoading] = useState(false);
  const [currentShares, setCurrentShares] = useState<ShareInfo[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUserToShare, setSelectedUserToShare] = useState<AvailableUser | null>(null);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareNote, setShareNote] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showPreviewInfo, setShowPreviewInfo] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Debounce search for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Reset display count when folder or filter changes
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [selectedFolderId, selectedSharedFolder, contentFilter, debouncedSearchQuery]);

  // Clear selection when changing folders
  useEffect(() => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  }, [selectedFolderId, selectedSharedFolder]);

  // Auto-enable selection mode when items are selected (but don't auto-disable)
  useEffect(() => {
    if (selectedItems.size > 0 && !selectionMode) {
      setSelectionMode(true);
    }
  }, [selectedItems.size, selectionMode]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSelectItem = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      return newSelected;
    });
  }, []);

  // Store last selected item for range selection
  const lastSelectedRef = useRef<string | null>(null);
  
  // Combined select handler that handles both range and single selection
  // Note: Range selection uses allFilteredItems which is computed in a useMemo below
  const handleSelectItem = useCallback((itemId: string, e?: React.MouseEvent, itemList?: VaultItem[]) => {
    // If shift key is pressed and we have a last selected item, do range selection
    if (e?.shiftKey && lastSelectedRef.current && itemList) {
      const itemIds = itemList.map(item => item.id);
      const lastIndex = itemIds.indexOf(lastSelectedRef.current);
      const currentIndex = itemIds.indexOf(itemId);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        setSelectedItems(prev => {
          const newSelected = new Set(prev);
          for (let i = start; i <= end; i++) {
            newSelected.add(itemIds[i]);
          }
          return newSelected;
        });
        return;
      }
    }
    
    // Regular toggle
    lastSelectedRef.current = itemId;
    toggleSelectItem(itemId);
  }, [toggleSelectItem]);

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectionMode(false);
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
      if (selectedSharedFolder) {
        setSharedFolderItems(sharedFolderItems.filter(item => !selectedItems.has(item.id)));
      } else {
        setVaultItems(vaultItems.filter(item => !selectedItems.has(item.id)));
      }
      setSelectedItems(new Set());
      showToast(`Deleted ${selectedItems.size} file(s)`, "success");
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
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-files-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast(`Downloaded ${selectedFiles.length} file(s)`, "success");
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
    loadSharedFolders();
  }, []);

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

      if (data.length === 0) {
        await createDefaultFolder();
      } else if (!selectedFolderId || !data.some((f: VaultFolder) => f.id === selectedFolderId)) {
        setSelectedFolderId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading folders:", error);
    }
  };

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
      setAllFolders(prev => [...prev, folder]);
      setSelectedFolderId(folder.id);
    } catch (error) {
      console.error("Error creating default folder:", error);
    }
  };

  const loadItems = async () => {
    if (!selectedFolderId || !selectedProfileId) return;

    setLoadingItems(true);
    try {
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

  const loadSharedFolderItems = async (sharedFolder: SharedVaultFolder) => {
    setLoadingItems(true);
    setSelectedSharedFolder(sharedFolder);
    setSelectedFolderId(null);
    
    try {
      const response = await fetch(`/api/vault/items?sharedFolderId=${sharedFolder.folderId}`);
      if (!response.ok) throw new Error("Failed to load shared folder items");

      const data = await response.json();
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

      showToast(`Shared with ${selectedUserToShare.displayName}`, "success");
      
      setSelectedUserToShare(null);
      setUserSearchQuery('');
      setShareNote('');
      setSharePermission('VIEW');
      await loadCurrentShares(folderToShare.id);
      loadFolders();
    } catch (error) {
      console.error("Error sharing folder:", error);
      showToast("Failed to share folder", "error");
    } finally {
      setShareModalLoading(false);
    }
  };

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
      loadFolders();
    } catch (error) {
      console.error("Error removing share:", error);
      showToast("Failed to remove share", "error");
    }
  };

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setSelectedSharedFolder(null);
    setSharedFolderItems([]);
    setProfileDropdownOpen(false);
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
      setAllFolders([...allFolders, newFolder]);
      setSelectedFolderId(newFolder.id);
      setFolderNameInput("");
      setShowNewFolderInput(false);
      showToast("Folder created", "success");
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
      setAllFolders((prev) =>
        prev.map((folder) =>
          folder.id === editingFolderId ? { ...folder, name: editingFolderName.trim() } : folder
        )
      );
      setEditingFolderId(null);
      setEditingFolderName("");
      showToast("Folder renamed", "success");
    } catch (error) {
      console.error("Error updating folder:", error);
      showToast("Failed to update folder", "error");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (folder?.isDefault) return;

    if (!confirm("Delete this folder and all its contents?")) return;

    try {
      const response = await fetch(`/api/vault/folders/${folderId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete folder");

      setFolders(folders.filter((f) => f.id !== folderId));
      setAllFolders(allFolders.filter((f) => f.id !== folderId));
      setVaultItems(vaultItems.filter((item) => item.folderId !== folderId));

      if (selectedFolderId === folderId) {
        const remaining = folders.filter((f) => f.id !== folderId && f.profileId === selectedProfileId);
        setSelectedFolderId(remaining[0]?.id || null);
      }
      showToast("Folder deleted", "success");
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

        const { presignedUrl, s3Key, awsS3Url, profileId, folderId } = await presignedResponse.json();

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
      showToast(`Uploaded ${uploadedItems.length} file(s)`, "success");
    } catch (error: any) {
      console.error("Error uploading files:", error);
      showToast(error.message || "Failed to upload some files", "error");
      setUploadProgress(0);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Delete this file?")) return;

    try {
      const response = await fetch(`/api/vault/items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete item");

      if (selectedSharedFolder) {
        setSharedFolderItems(sharedFolderItems.filter((item) => item.id !== id));
      } else {
        setVaultItems(vaultItems.filter((item) => item.id !== id));
      }
      showToast("File deleted", "success");
    } catch (error) {
      console.error("Error deleting item:", error);
      showToast("Failed to delete file", "error");
    }
  };

  // All filtered items (not paginated)
  const allFilteredItems = useMemo(() => {
    if (selectedSharedFolder) {
      return sharedFolderItems
        .filter((item) => item.fileName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
        .filter((item) => {
          if (contentFilter === 'all') return true;
          if (contentFilter === 'photos') return item.fileType.startsWith('image/') && item.fileType !== 'image/gif';
          if (contentFilter === 'videos') return item.fileType.startsWith('video/');
          if (contentFilter === 'audio') return item.fileType.startsWith('audio/');
          if (contentFilter === 'gifs') return item.fileType === 'image/gif';
          return true;
        });
    }

    const currentFolder = folders.find(f => f.id === selectedFolderId);
    const isDefaultFolder = currentFolder?.isDefault === true;

    return vaultItems
      .filter((item) => {
        if (item.profileId !== selectedProfileId) return false;
        if (!isDefaultFolder && item.folderId !== selectedFolderId) return false;
        return true;
      })
      .filter((item) => item.fileName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      .filter((item) => {
        if (contentFilter === 'all') return true;
        if (contentFilter === 'photos') return item.fileType.startsWith('image/') && item.fileType !== 'image/gif';
        if (contentFilter === 'videos') return item.fileType.startsWith('video/');
        if (contentFilter === 'audio') return item.fileType.startsWith('audio/');
        if (contentFilter === 'gifs') return item.fileType === 'image/gif';
        return true;
      });
  }, [vaultItems, sharedFolderItems, selectedFolderId, selectedProfileId, debouncedSearchQuery, folders, contentFilter, selectedSharedFolder]);

  // Paginated items for display
  const filteredItems = useMemo(() => {
    return allFilteredItems.slice(0, displayCount);
  }, [allFilteredItems, displayCount]);

  // Wrapped select handler that includes filteredItems for range selection
  const onSelectItem = useCallback((id: string, e?: React.MouseEvent) => {
    handleSelectItem(id, e, filteredItems);
  }, [handleSelectItem, filteredItems]);

  // Keyboard shortcuts for selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear selection
      if (e.key === 'Escape' && selectedItems.size > 0) {
        setSelectedItems(new Set());
        setSelectionMode(false);
      }
      // Ctrl/Cmd + A to select all (when not in an input)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && 
          !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (allFilteredItems.length > 0) {
          setSelectedItems(new Set(allFilteredItems.map(item => item.id)));
          setSelectionMode(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems.size, allFilteredItems]);

  const hasMoreItems = displayCount < allFilteredItems.length;
  
  const loadMoreItems = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, allFilteredItems.length));
  }, [allFilteredItems.length]);

  // Infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200 && hasMoreItems) {
      loadMoreItems();
    }
  }, [hasMoreItems, loadMoreItems]);

  const visibleFolders = folders.filter((folder) => folder.profileId === selectedProfileId);
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || null;
  const selectedFolder = selectedSharedFolder 
    ? { id: selectedSharedFolder.folderId, name: selectedSharedFolder.folderName, profileId: selectedSharedFolder.profileId, isDefault: selectedSharedFolder.isDefault }
    : visibleFolders.find((folder) => folder.id === selectedFolderId) || null;
  
  const isViewingShared = selectedSharedFolder !== null;
  const canEdit = !isViewingShared || selectedSharedFolder?.permission === 'EDIT';

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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  return (
    <>
      <style jsx global>{`
        .vault-scroll::-webkit-scrollbar { width: 8px; }
        .vault-scroll::-webkit-scrollbar-track { background: transparent; }
        .vault-scroll::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.3); border-radius: 4px; }
        .vault-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.5); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.2s ease-out; }
      `}</style>

      {/* Toast */}
      {toast && createPortal(
        <div className="fixed bottom-4 right-4 z-[100] animate-slideUp">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-700' : 
            toast.type === 'error' ? 'bg-red-900/90 text-red-100 border border-red-700' : 'bg-blue-900/90 text-blue-100 border border-blue-700'
          }`}>
            {toast.type === 'success' && <Check className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
            {toast.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-400" />}
            <p className="text-sm font-medium">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70"><X className="w-4 h-4" /></button>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Modal */}
      {isAddingNew && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setIsAddingNew(false); setNewFiles([]); }} />
          <div className="relative bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg animate-slideUp border-t sm:border border-gray-700 max-h-[90vh] sm:max-h-none overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-white">Upload Files</h3>
              <button onClick={() => { setIsAddingNew(false); setNewFiles([]); }} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[60vh] sm:max-h-none vault-scroll">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); setNewFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
                className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 transition-all ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'}`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-3 rounded-full ${isDragging ? 'bg-blue-500/20' : 'bg-gray-800'}`}>
                    <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-200">Tap to select files</p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">or drag and drop</p>
                  </div>
                  <input type="file" accept="image/*,video/*,audio/*" multiple onChange={(e) => setNewFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
              </div>
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-300">{newFiles.length} file(s) selected</p>
                    <button onClick={() => setNewFiles([])} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 vault-scroll">
                    {newFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                        <div className="p-2 bg-gray-700 rounded-lg">
                          {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-400" /> :
                           file.type.startsWith('video/') ? <VideoIcon className="w-4 h-4 text-purple-400" /> :
                           file.type.startsWith('audio/') ? <Music4 className="w-4 h-4 text-pink-400" /> : <FileIcon className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                        <button onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== index))} className="p-1 hover:bg-gray-700 rounded"><X className="w-4 h-4 text-gray-500" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Uploading...</span>
                    <span className="text-blue-400 font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-4 sm:p-5 border-t border-gray-700">
              <button onClick={() => { setIsAddingNew(false); setNewFiles([]); setUploadProgress(0); }} disabled={uploadProgress > 0} className="flex-1 px-4 py-2.5 text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleAddItem} disabled={newFiles.length === 0 || uploadProgress > 0} className="flex-1 px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {uploadProgress > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move/Copy Modal */}
      {showMoveModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowMoveModal(false); setIsCopyMode(false); }} />
          <div className="relative bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md animate-slideUp border-t sm:border border-gray-700">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-white">{isCopyMode ? 'Copy' : 'Move'} {selectedItems.size} item(s)</h3>
              <button onClick={() => { setShowMoveModal(false); setIsCopyMode(false); }} className="p-2 hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setIsCopyMode(false)} className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium transition-colors ${!isCopyMode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}><Move className="w-4 h-4" /> Move</button>
                <button onClick={() => setIsCopyMode(true)} className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium transition-colors ${isCopyMode ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}><Copy className="w-4 h-4" /> Copy</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Destination folder</label>
                <select value={moveToFolderId || ''} onChange={(e) => setMoveToFolderId(e.target.value)} className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                  <option value="">Select folder...</option>
                  {isViewingShared ? (
                    <>
                      {profiles.map(profile => {
                        const profileFolders = allFolders.filter(f => f.profileId === profile.id && !f.isDefault);
                        if (profileFolders.length === 0) return null;
                        return (<optgroup key={profile.id} label={profile.name}>{profileFolders.map(folder => (<option key={folder.id} value={folder.id}>{folder.name}</option>))}</optgroup>);
                      })}
                      {sharedFolders.filter(sf => sf.permission === 'EDIT' && sf.folderId !== selectedSharedFolder?.folderId).length > 0 && (
                        <optgroup label="Shared Folders">{sharedFolders.filter(sf => sf.permission === 'EDIT' && sf.folderId !== selectedSharedFolder?.folderId).map(sf => (<option key={sf.folderId} value={sf.folderId}>{sf.folderName} (from {sf.ownerName})</option>))}</optgroup>
                      )}
                    </>
                  ) : (
                    <>
                      {profiles.map(profile => {
                        const profileFolders = allFolders.filter(f => f.profileId === profile.id && !f.isDefault && !(profile.id === selectedProfileId && f.id === selectedFolderId));
                        if (profileFolders.length === 0) return null;
                        return (<optgroup key={profile.id} label={`${profile.id === selectedProfileId ? '📍 ' : ''}${profile.name}`}>{profileFolders.map(folder => (<option key={folder.id} value={folder.id}>{folder.name}</option>))}</optgroup>);
                      })}
                      {sharedFolders.filter(sf => sf.permission === 'EDIT').length > 0 && (
                        <optgroup label="Shared Folders">{sharedFolders.filter(sf => sf.permission === 'EDIT').map(sf => (<option key={sf.folderId} value={sf.folderId}>{sf.folderName} (from {sf.ownerName})</option>))}</optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowMoveModal(false); setIsCopyMode(false); }} className="flex-1 px-4 py-2.5 text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors">Cancel</button>
                <button
                  onClick={async () => {
                    if (!moveToFolderId) { showToast('Select a destination folder', 'error'); return; }
                    setIsMoving(true);
                    try {
                      const itemsToProcess = Array.from(selectedItems);
                      if (isCopyMode) {
                        const results = await Promise.all(itemsToProcess.map(async (itemId) => {
                          const response = await fetch(`/api/vault/items/${itemId}/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId: moveToFolderId }) });
                          return { success: response.ok, itemId };
                        }));
                        const failedCopies = results.filter(r => !r.success);
                        if (failedCopies.length > 0) showToast(`Failed to copy ${failedCopies.length} item(s)`, 'error');
                        else showToast(`Copied ${itemsToProcess.length} item(s)`, 'success');
                        await loadItems();
                      } else {
                        const results = await Promise.all(itemsToProcess.map(async (itemId) => {
                          const response = await fetch(`/api/vault/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId: moveToFolderId }) });
                          return { success: response.ok, itemId };
                        }));
                        const failedMoves = results.filter(r => !r.success);
                        if (failedMoves.length > 0) showToast(`Failed to move ${failedMoves.length} item(s)`, 'error');
                        else showToast(`Moved ${itemsToProcess.length} item(s)`, 'success');
                        if (selectedSharedFolder) { setSharedFolderItems(sharedFolderItems.filter(item => !selectedItems.has(item.id))); await loadItems(); }
                        else await loadItems();
                      }
                      setSelectedItems(new Set()); setShowMoveModal(false); setMoveToFolderId(null); setIsCopyMode(false);
                    } catch (error) { showToast(`Failed to ${isCopyMode ? 'copy' : 'move'} items`, 'error'); }
                    finally { setIsMoving(false); }
                  }}
                  disabled={!moveToFolderId || isMoving}
                  className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${isCopyMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isMoving ? <Loader2 className="w-4 h-4 animate-spin" /> : isCopyMode ? <Copy className="w-4 h-4" /> : <Move className="w-4 h-4" />} {isCopyMode ? 'Copy' : 'Move'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {previewItem && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fadeIn"
          onClick={() => { setPreviewItem(null); setShowPreviewInfo(false); }}
        >
          <button onClick={(e) => { e.stopPropagation(); setPreviewItem(null); setShowPreviewInfo(false); }} className="absolute top-3 sm:top-4 right-3 sm:right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"><X className="w-5 sm:w-6 h-5 sm:h-6 text-white" /></button>
          {filteredItems.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); const idx = filteredItems.findIndex(item => item.id === previewItem.id); setPreviewItem(filteredItems[idx > 0 ? idx - 1 : filteredItems.length - 1]); }} className="absolute left-2 sm:left-4 p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"><ChevronLeft className="w-5 sm:w-6 h-5 sm:h-6 text-white" /></button>
              <button onClick={(e) => { e.stopPropagation(); const idx = filteredItems.findIndex(item => item.id === previewItem.id); setPreviewItem(filteredItems[idx < filteredItems.length - 1 ? idx + 1 : 0]); }} className="absolute right-2 sm:right-4 p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"><ChevronRight className="w-5 sm:w-6 h-5 sm:h-6 text-white" /></button>
            </>
          )}
          
          {/* Main content area with info panel */}
          <div 
            className={`flex gap-4 max-w-[95vw] ${showPreviewInfo && previewItem.metadata ? 'max-w-6xl' : 'max-w-5xl'} mx-2 sm:mx-4 transition-all`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media preview */}
            <div className={`${showPreviewInfo && previewItem.metadata ? 'flex-1' : 'w-full'} max-h-[75vh] sm:max-h-[85vh]`}>
              {previewItem.fileType.startsWith('image/') ? <img src={previewItem.awsS3Url} alt={previewItem.fileName} className="max-w-full max-h-[75vh] sm:max-h-[85vh] object-contain rounded-lg" /> :
               previewItem.fileType.startsWith('video/') ? <video src={previewItem.awsS3Url} controls autoPlay playsInline className="max-w-full max-h-[75vh] sm:max-h-[85vh] rounded-lg" /> :
               previewItem.fileType.startsWith('audio/') ? (
                 <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 text-center border border-gray-700 mx-4">
                   <Music4 className="w-16 sm:w-20 h-16 sm:h-20 text-purple-400 mx-auto mb-4" />
                   <p className="text-white font-medium mb-4 text-sm sm:text-base truncate max-w-[250px] sm:max-w-none mx-auto">{previewItem.fileName}</p>
                   <audio src={previewItem.awsS3Url} controls autoPlay className="w-full" />
                 </div>
               ) : (
                 <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 text-center border border-gray-700 mx-4"><FileIcon className="w-16 sm:w-20 h-16 sm:h-20 text-gray-600 mx-auto mb-4" /><p className="text-gray-400 text-sm sm:text-base">Preview not available</p></div>
               )}
            </div>
            
            {/* Info panel - shows generation parameters */}
            {showPreviewInfo && previewItem.metadata && (
              <div className="hidden sm:block w-80 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-2xl p-5 overflow-y-auto max-h-[85vh] animate-slideUp">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
                  <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg">
                    <Wand2 className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Generation Info</h3>
                    <p className="text-xs text-gray-400">AI-generated content</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Source/Type */}
                  {(previewItem.metadata.source || previewItem.metadata.generationType) && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Source</label>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm text-gray-200">
                          {previewItem.metadata.source === 'seedream-i2i' ? 'SeeDream 4.5 Image-to-Image' :
                           previewItem.metadata.source || previewItem.metadata.generationType || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Prompt */}
                  {previewItem.metadata.prompt && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Prompt</label>
                      <p className="text-sm text-gray-200 bg-gray-800/50 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed">
                        {previewItem.metadata.prompt}
                      </p>
                    </div>
                  )}
                  
                  {/* Resolution & Size */}
                  {(previewItem.metadata.size || previewItem.metadata.resolution) && (
                    <div className="grid grid-cols-2 gap-3">
                      {previewItem.metadata.resolution && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Resolution</label>
                          <div className="flex items-center gap-2">
                            <Maximize2 className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-gray-200">{previewItem.metadata.resolution}</span>
                          </div>
                        </div>
                      )}
                      {previewItem.metadata.size && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dimensions</label>
                          <span className="text-sm text-gray-200">{previewItem.metadata.size}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Model */}
                  {previewItem.metadata.model && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Model</label>
                      <span className="text-sm text-gray-200">{previewItem.metadata.model}</span>
                    </div>
                  )}
                  
                  {/* Reference Images */}
                  {previewItem.metadata.numReferenceImages && previewItem.metadata.numReferenceImages > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reference Images</label>
                      <span className="text-sm text-gray-200">{previewItem.metadata.numReferenceImages}</span>
                    </div>
                  )}
                  
                  {/* Negative Prompt */}
                  {previewItem.metadata.negativePrompt && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Negative Prompt</label>
                      <p className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3 max-h-24 overflow-y-auto">
                        {previewItem.metadata.negativePrompt}
                      </p>
                    </div>
                  )}
                  
                  {/* Advanced params */}
                  {(previewItem.metadata.steps || previewItem.metadata.cfgScale || previewItem.metadata.seed) && (
                    <div className="grid grid-cols-2 gap-3">
                      {previewItem.metadata.steps && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Steps</label>
                          <span className="text-sm text-gray-200">{previewItem.metadata.steps}</span>
                        </div>
                      )}
                      {previewItem.metadata.cfgScale && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">CFG Scale</label>
                          <span className="text-sm text-gray-200">{previewItem.metadata.cfgScale}</span>
                        </div>
                      )}
                      {previewItem.metadata.seed && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Seed</label>
                          <span className="text-xs text-gray-200 font-mono">{previewItem.metadata.seed}</span>
                        </div>
                      )}
                      {previewItem.metadata.sampler && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sampler</label>
                          <span className="text-sm text-gray-200">{previewItem.metadata.sampler}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Generated At */}
                  {previewItem.metadata.generatedAt && (
                    <div className="space-y-1 pt-2 border-t border-gray-700">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</label>
                      <span className="text-sm text-gray-400">
                        {new Date(previewItem.metadata.generatedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom action bar */}
          <div 
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-full px-3 sm:px-6 py-2 sm:py-3 max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[200px]">{previewItem.fileName}</span>
            <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">{formatFileSize(previewItem.fileSize)}</span>
            {/* Info button - only show if metadata exists */}
            {previewItem.metadata && (
              <button 
                onClick={() => setShowPreviewInfo(!showPreviewInfo)} 
                className={`p-1.5 sm:p-2 rounded-full transition-colors hidden sm:block ${showPreviewInfo ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                title="View generation info"
              >
                <Info className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              </button>
            )}
            <a href={previewItem.awsS3Url} download={previewItem.fileName} className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><Download className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white" /></a>
            {canEdit && <button onClick={() => { handleDeleteItem(previewItem.id); setPreviewItem(null); setShowPreviewInfo(false); }} className="p-1.5 sm:p-2 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-colors"><Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-red-400" /></button>}
          </div>
        </div>,
        document.body
      )}

      {/* Share Modal */}
      {showShareModal && folderToShare && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowShareModal(false); setFolderToShare(null); setSelectedUserToShare(null); setUserSearchQuery(''); setShareNote(''); }} />
          <div className="relative bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-slideUp border-t sm:border border-gray-700">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-700">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">Share Folder</h3>
                <p className="text-xs sm:text-sm text-gray-400 truncate max-w-[200px] sm:max-w-none">{folderToShare.name}</p>
              </div>
              <button onClick={() => { setShowShareModal(false); setFolderToShare(null); setSelectedUserToShare(null); setUserSearchQuery(''); setShareNote(''); }} className="p-2 hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(85vh-120px)] sm:max-h-[calc(90vh-120px)] vault-scroll">
              {shareModalLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-300">Share with user</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input type="text" placeholder="Search users..." value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="max-h-32 overflow-y-auto border border-gray-700 rounded-lg vault-scroll">
                      {availableUsers.filter(user => { const q = userSearchQuery.toLowerCase(); return user.displayName.toLowerCase().includes(q) || (user.email?.toLowerCase().includes(q) ?? false); }).filter(user => !currentShares.some(s => s.sharedWithClerkId === user.clerkId)).slice(0, 10).map(user => (
                        <button key={user.clerkId} onClick={() => setSelectedUserToShare(user)} className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selectedUserToShare?.clerkId === user.clerkId ? 'bg-blue-600/20' : 'hover:bg-gray-800'}`}>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">{user.displayName.charAt(0).toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">{user.displayName}</p>
                            {user.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
                          </div>
                          {selectedUserToShare?.clerkId === user.clerkId && <Check className="w-5 h-5 text-blue-400" />}
                        </button>
                      ))}
                      {availableUsers.length === 0 && <p className="text-center py-4 text-gray-500 text-sm">No users available</p>}
                    </div>
                    {selectedUserToShare && (
                      <>
                        <div className="flex gap-2">
                          <button onClick={() => setSharePermission('VIEW')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sharePermission === 'VIEW' ? 'bg-blue-600/20 text-blue-400 border border-blue-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}><Eye className="w-4 h-4" /> View only</button>
                          <button onClick={() => setSharePermission('EDIT')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sharePermission === 'EDIT' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}><Edit2 className="w-4 h-4" /> Can edit</button>
                        </div>
                        <input type="text" placeholder="Add a note (optional)" value={shareNote} onChange={(e) => setShareNote(e.target.value)} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <button onClick={handleShareFolder} disabled={shareModalLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                          {shareModalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share with {selectedUserToShare.displayName}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-300">Currently shared with</label>
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{currentShares.length}</span>
                    </div>
                    {currentShares.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-gray-700 rounded-lg"><Users className="w-8 h-8 text-gray-600 mx-auto mb-2" /><p className="text-sm text-gray-500">Not shared yet</p></div>
                    ) : (
                      <div className="space-y-2">
                        {currentShares.map((share) => (
                          <div key={share.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">{share.sharedWithUser?.displayName?.charAt(0).toUpperCase() || '?'}</div>
                              <div>
                                <p className="text-sm font-medium text-gray-200">{share.sharedWithUser?.displayName || share.sharedWithClerkId}</p>
                                {share.sharedWithUser?.email && <p className="text-xs text-gray-500">{share.sharedWithUser.email}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${share.permission === 'EDIT' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-blue-900/50 text-blue-400'}`}>{share.permission}</span>
                              <button onClick={() => handleRemoveShare(share.sharedWithClerkId, share.sharedWithUser?.displayName || 'User')} className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-400" /></button>
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

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* Main Layout */}
      <div className="h-[calc(100vh-120px)] sm:h-[calc(100vh-120px)] flex bg-gray-950 rounded-xl border border-gray-800 overflow-hidden relative">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50 lg:z-auto w-72 lg:w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col rounded-l-xl overflow-hidden transition-transform duration-300 ease-in-out`}>
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-white">Media Vault</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <PanelLeftClose className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-3 border-b border-gray-800">
            <div className="relative">
              <button onClick={() => setProfileDropdownOpen(!profileDropdownOpen)} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-400">{selectedProfile?.name?.charAt(0) || '?'}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-200 truncate">{selectedProfile?.name || 'Select profile'}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
                  {loadingProfiles ? (
                    <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-500 mx-auto" /></div>
                  ) : profiles.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No profiles</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto vault-scroll">
                      {profiles.map((profile) => (
                        <button key={profile.id} onClick={() => handleSelectProfile(profile.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${profile.id === selectedProfileId ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-gray-700 text-gray-300'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${profile.id === selectedProfileId ? 'bg-blue-600/30' : 'bg-gray-700'}`}>
                            <span className="text-xs font-medium">{profile.name?.charAt(0) || '?'}</span>
                          </div>
                          <span className="text-sm font-medium truncate">{profile.name}</span>
                          {profile.id === selectedProfileId && <Check className="w-4 h-4 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto vault-scroll p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Folders</span>
              <button onClick={() => setShowNewFolderInput(true)} disabled={!selectedProfileId} className="p-1 hover:bg-gray-800 rounded transition-colors disabled:opacity-50">
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {showNewFolderInput && (
              <div className="flex items-center gap-2 mb-2">
                <input type="text" value={folderNameInput} onChange={(e) => setFolderNameInput(e.target.value)} placeholder="Folder name" onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()} autoFocus className="flex-1 px-2 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                <button onClick={handleCreateFolder} disabled={!folderNameInput.trim()} className="p-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setShowNewFolderInput(false); setFolderNameInput(''); }} className="p-1.5 bg-gray-800 text-gray-400 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            )}

            <div className="space-y-1">
              {visibleFolders.map((folder) => {
                const isActive = folder.id === selectedFolderId && !selectedSharedFolder;
                const itemCount = folder.isDefault ? vaultItems.filter((item) => item.profileId === selectedProfileId).length : vaultItems.filter((item) => item.folderId === folder.id && item.profileId === selectedProfileId).length;
                return (
                  <div key={folder.id} className="group">
                    {editingFolderId === folder.id ? (
                      <div className="flex items-center gap-2 px-2">
                        <input value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleUpdateFolder()} autoFocus className="flex-1 px-2 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <button onClick={handleUpdateFolder} className="p-1 text-emerald-400"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { setEditingFolderId(null); setEditingFolderName(''); }} className="p-1 text-gray-500"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div onClick={() => { setSelectedFolderId(folder.id); setSelectedSharedFolder(null); setSharedFolderItems([]); setSidebarOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${isActive ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-gray-800 text-gray-400'}`}>
                        {isActive ? <FolderOpen className="w-4 h-4" /> : <FolderClosed className="w-4 h-4" />}
                        <span className="flex-1 text-sm font-medium text-left truncate">{folder.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>{itemCount}</span>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleOpenShareModal(folder); }} className="p-1 hover:bg-gray-700 rounded" title="Share"><Share2 className="w-3.5 h-3.5 text-gray-500" /></button>
                          {!folder.isDefault && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); startEditFolder(folder); }} className="p-1 hover:bg-gray-700 rounded" title="Rename"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="p-1 hover:bg-gray-700 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {sharedFolders.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shared with me</span>
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded-full">{sharedFolders.length}</span>
                </div>
                <div className="space-y-1">
                  {sharedFolders.map((shared) => {
                    const isActive = selectedSharedFolder?.folderId === shared.folderId;
                    return (
                      <button key={shared.id} onClick={() => { loadSharedFolderItems(shared); setSidebarOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-gray-800 text-gray-400'}`}>
                        <Users className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-sm font-medium truncate block">{shared.folderName}</span>
                          <span className="text-xs text-gray-500 truncate block">From {shared.sharedBy}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${shared.permission === 'EDIT' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>{shared.permission === 'EDIT' ? 'Edit' : 'View'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {selectedProfileId && (
            <div className="p-4 border-t border-gray-800">
              <div className="text-xs text-gray-500 mb-2">Storage used</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold text-white">{formatFileSize(totalSize)}</span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {imageCount}</span>
                <span className="flex items-center gap-1"><VideoIcon className="w-3 h-3" /> {videoCount}</span>
                <span className="flex items-center gap-1"><FileIcon className="w-3 h-3" /> {totalItems}</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden w-full relative">
          <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
            {/* Mobile header row */}
            <div className="flex items-center gap-3 lg:hidden mb-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <Menu className="w-5 h-5 text-gray-300" />
              </button>
              <h1 className="text-lg font-semibold text-white truncate flex-1">{selectedFolder?.name || 'Select a folder'}</h1>
              {!isViewingShared && (
                <button onClick={() => setIsAddingNew(true)} disabled={!selectedProfileId || !selectedFolderId} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50">
                  <Upload className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Desktop header row */}
            <div className="hidden lg:flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white">{selectedFolder?.name || 'Select a folder'}</h1>
                {isViewingShared && selectedSharedFolder && (
                  <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                    <Share2 className="w-3.5 h-3.5" /> Shared by {selectedSharedFolder.sharedBy}
                    {!canEdit && <span className="text-amber-400 ml-2">(View only)</span>}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                </div>
                <div className="flex items-center bg-gray-800 rounded-lg p-1">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}><Grid3X3 className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}><List className="w-4 h-4" /></button>
                </div>
                {!isViewingShared && (
                  <button onClick={() => setIsAddingNew(true)} disabled={!selectedProfileId || !selectedFolderId} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                )}
              </div>
            </div>
            
            {/* Mobile shared folder info */}
            {isViewingShared && selectedSharedFolder && (
              <p className="text-sm text-gray-400 flex items-center gap-1 lg:hidden mb-3">
                <Share2 className="w-3.5 h-3.5" /> Shared by {selectedSharedFolder.sharedBy}
                {!canEdit && <span className="text-amber-400 ml-2">(View only)</span>}
              </p>
            )}
            
            {/* Mobile search and view toggle */}
            <div className="flex items-center gap-2 lg:hidden mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              </div>
              <div className="flex items-center bg-gray-800 rounded-lg p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}><Grid3X3 className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}><List className="w-4 h-4" /></button>
              </div>
            </div>
            
            {/* Filters and selection mode toggle */}
            <div className="flex items-center justify-between gap-3 mt-3 lg:mt-4">
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 vault-scroll">
                {['all', 'photos', 'videos', 'audio', 'gifs'].map((filter) => (
                  <button key={filter} onClick={() => setContentFilter(filter as any)} className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${contentFilter === filter ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}>{filter.charAt(0).toUpperCase() + filter.slice(1)}</button>
                ))}
              </div>
              {filteredItems.length > 0 && (
                <button 
                  onClick={() => {
                    if (selectionMode) {
                      clearSelection();
                    } else {
                      setSelectionMode(true);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${selectionMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'}`}
                >
                  <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span className="hidden sm:inline">{selectionMode ? 'Cancel' : 'Select'}</span>
                </button>
              )}
            </div>
          </div>

          <div ref={contentRef} onScroll={handleScroll} className="flex-1 overflow-y-auto vault-scroll p-3 sm:p-4 md:p-6 bg-gray-950 rounded-br-xl">
            {!selectedProfileId && !selectedSharedFolder ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 sm:w-16 h-14 sm:h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4"><Folder className="w-7 sm:w-8 h-7 sm:h-8 text-gray-600" /></div>
                <h3 className="text-base sm:text-lg font-medium text-white mb-1">Select a profile</h3>
                <p className="text-xs sm:text-sm text-gray-500">Choose a profile from the sidebar to view your files</p>
                <button onClick={() => setSidebarOpen(true)} className="mt-4 lg:hidden flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors">
                  <Menu className="w-4 h-4" /> Open sidebar
                </button>
              </div>
            ) : !selectedFolderId && !selectedSharedFolder ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 sm:w-16 h-14 sm:h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4"><FolderPlus className="w-7 sm:w-8 h-7 sm:h-8 text-gray-600" /></div>
                <h3 className="text-base sm:text-lg font-medium text-white mb-1">Create a folder</h3>
                <p className="text-xs sm:text-sm text-gray-500">Organize your files by creating folders</p>
                <button onClick={() => setSidebarOpen(true)} className="mt-4 lg:hidden flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors">
                  <Menu className="w-4 h-4" /> Open sidebar
                </button>
              </div>
            ) : loadingItems ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4' : 'space-y-2'}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={viewMode === 'grid' ? 'bg-gray-900 rounded-xl border border-gray-800 p-2 sm:p-3 animate-pulse' : 'bg-gray-900 rounded-lg border border-gray-800 p-3 animate-pulse flex items-center gap-3 sm:gap-4'}>
                    <div className={viewMode === 'grid' ? 'aspect-square bg-gray-800 rounded-lg mb-2 sm:mb-3' : 'w-10 sm:w-12 h-10 sm:h-12 bg-gray-800 rounded-lg flex-shrink-0'} />
                    <div className={viewMode === 'grid' ? '' : 'flex-1'}><div className="h-3 sm:h-4 bg-gray-800 rounded w-3/4 mb-2" /><div className="h-2 sm:h-3 bg-gray-800 rounded w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : allFilteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 sm:w-16 h-14 sm:h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4"><FileIcon className="w-7 sm:w-8 h-7 sm:h-8 text-gray-600" /></div>
                <h3 className="text-base sm:text-lg font-medium text-white mb-1">No files yet</h3>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">Upload some files to get started</p>
                {!isViewingShared && <button onClick={() => setIsAddingNew(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"><Upload className="w-4 h-4" /> Upload files</button>}
              </div>
            ) : viewMode === 'grid' ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                  {filteredItems.length > 0 && selectionMode && (
                    <div className="col-span-full flex items-center justify-between mb-2 px-2 py-2 bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-800">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedItems.size > 0 && selectedItems.size === allFilteredItems.length} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 cursor-pointer" />
                        <span className="text-xs sm:text-sm text-gray-300 font-medium">{selectedItems.size > 0 ? `${selectedItems.size} of ${allFilteredItems.length}` : 'Select all'}</span>
                      </div>
                      <span className="text-xs text-gray-500">Shift+click for range</span>
                    </div>
                  )}
                  {filteredItems.map((item) => (
                    <VaultGridItem
                      key={item.id}
                      item={item}
                      isSelected={selectedItems.has(item.id)}
                      selectionMode={selectionMode}
                      canEdit={canEdit}
                      onSelect={onSelectItem}
                      onPreview={setPreviewItem}
                      onDelete={handleDeleteItem}
                      formatFileSize={formatFileSize}
                    />
                  ))}
                </div>
                {hasMoreItems && (
                  <div className="flex justify-center mt-4 sm:mt-6">
                    <button onClick={loadMoreItems} className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm sm:text-base font-medium transition-colors flex items-center gap-2">
                      <Loader2 className="w-4 h-4" /> Load more ({allFilteredItems.length - filteredItems.length})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {filteredItems.length > 0 && selectionMode && (
                    <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-900/80 backdrop-blur-sm rounded-lg mb-2 border border-gray-800">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <input type="checkbox" checked={selectedItems.size > 0 && selectedItems.size === allFilteredItems.length} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 cursor-pointer" />
                        <span className="text-xs sm:text-sm text-gray-300 font-medium">{selectedItems.size > 0 ? `${selectedItems.size} of ${allFilteredItems.length}` : 'Select all'}</span>
                      </div>
                      <span className="text-xs text-gray-500">Shift+click for range</span>
                    </div>
                  )}
                  {filteredItems.map((item) => (
                    <VaultListItem
                      key={item.id}
                      item={item}
                      isSelected={selectedItems.has(item.id)}
                      selectionMode={selectionMode}
                      canEdit={canEdit}
                      onSelect={onSelectItem}
                      onPreview={setPreviewItem}
                      onDelete={handleDeleteItem}
                      formatFileSize={formatFileSize}
                    />
                  ))}
                </div>
                {hasMoreItems && (
                  <div className="flex justify-center mt-6">
                    <button onClick={loadMoreItems} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2">
                      <Loader2 className="w-4 h-4" /> Load more ({allFilteredItems.length - filteredItems.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Floating Selection Action Bar */}
          {selectedItems.size > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-slideUp">
              <div className="flex items-center gap-2 sm:gap-3 bg-gray-900/95 backdrop-blur-lg border border-gray-700 rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 shadow-2xl shadow-black/50">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-gray-700">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-bold text-white">{selectedItems.size}</span>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-300 hidden sm:inline">selected</span>
                </div>
                
                {/* Select all */}
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">{selectedItems.size === allFilteredItems.length ? 'Deselect all' : 'Select all'}</span>
                </button>
                
                {/* Divider */}
                <div className="w-px h-6 bg-gray-700" />
                
                {/* Actions */}
                {canEdit && (
                  <button 
                    onClick={handleBulkMove} 
                    disabled={isMoving}
                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-400 hover:bg-blue-600/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Move"
                  >
                    <Move className="w-4 h-4" />
                    <span className="hidden md:inline">Move</span>
                  </button>
                )}
                
                <button 
                  onClick={handleDownloadZip} 
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-emerald-400 hover:bg-emerald-600/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Download"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden md:inline">Download</span>
                </button>
                
                {canEdit && (
                  <button 
                    onClick={handleBulkDelete} 
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-400 hover:bg-red-600/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span className="hidden md:inline">Delete</span>
                  </button>
                )}
                
                {/* Divider */}
                <div className="w-px h-6 bg-gray-700" />
                
                {/* Close */}
                <button 
                  onClick={clearSelection}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  title="Clear selection (Esc)"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
