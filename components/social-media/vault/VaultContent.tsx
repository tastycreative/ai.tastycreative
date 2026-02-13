"use client";

import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams } from "next/navigation";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Constants for pagination
const ITEMS_PER_PAGE = 50;

// Lazy loading image component with intersection observer
const LazyImage = memo(function LazyImage({
  src,
  alt,
  className,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isInView ? (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={onError}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      )}
      {isInView && !isLoaded && (
        <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      )}
    </div>
  );
});

// Lazy loading video thumbnail component
const LazyVideoThumbnail = memo(function LazyVideoThumbnail({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [isInView, setIsInView] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    
    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={videoRef} className={className}>
      {isInView ? (
        <video
          src={src}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          onLoadedData={(e) => {
            const video = e.currentTarget;
            video.currentTime = 0.1;
          }}
        />
      ) : (
        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      )}
    </div>
  );
});
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
  Crown,
  UserCheck,
  Wand2,
  FileOutput,
  RotateCcw,
  Link,
  ExternalLink,
  RefreshCw,
  LogOut,
  CheckCircle2,
  User,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Columns2,
  History,
  Fingerprint,
  Zap,
  Grid2X2,
  Smartphone,
  HelpCircle,
  Settings,
  CheckSquare,
} from "lucide-react";

import { PlatformExportModal } from "@/components/export";
import { VaultEnhancements, FavoriteStar } from './VaultEnhancements';
import { CompareModal } from './CompareModal';

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
  isOwnedProfile?: boolean;
  ownerName?: string | null;
  parentId?: string | null;
  subfolders?: Array<{ id: string }>;
  organizationSlug?: string | null;
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
  aspectRatio?: string;
  watermark?: boolean;
  numReferenceImages?: number;
  referenceImageUrl?: string | null; // Single reference image (for I2V, I2I)
  referenceImageUrls?: string[]; // Multiple reference images
  referenceVideoUrl?: string | null; // Reference video (for motion control)
  sourceImageUrls?: string[]; // Source images (for multi-image to video)
  imageUrl?: string | null; // Alternative field name for reference image
  generatedAt?: string;
  // Additional fields for other generation types
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  sampler?: string;
  // Generator info - who created this item
  generatedByClerkId?: string;
  generatedByName?: string;
  generatedByImageUrl?: string | null;
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
  // Admin view fields
  creatorName?: string;
  creatorId?: string;
  folder?: {
    id: string;
    name: string;
    isDefault?: boolean;
  };
  profile?: {
    id: string;
    name: string;
    instagramUsername?: string | null;
  };
}

// Content Creator interface for admin view
interface ContentCreator {
  id: string;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

// Google Drive interfaces
interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  shared?: boolean;
}

interface GoogleDriveBreadcrumb {
  id: string | null;
  name: string;
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
  onDownload: (item: VaultItem, e?: React.MouseEvent) => void;
  formatFileSize: (bytes: number) => string;
  favorites?: Set<string>;
  toggleFavorite?: (id: string) => void;
  compareMode?: boolean;
  isInCompare?: boolean;
  onCompareToggle?: (item: VaultItem) => void;
  showGeneratorInfo?: boolean;
}

const VaultGridItem = memo(function VaultGridItem({
  item,
  isSelected,
  selectionMode,
  canEdit,
  onSelect,
  onPreview,
  onDelete,
  onDownload,
  formatFileSize,
  favorites,
  toggleFavorite,
  compareMode,
  isInCompare,
  onCompareToggle,
  showGeneratorInfo,
}: GridItemProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (compareMode) {
      e.preventDefault();
      onCompareToggle?.(item);
    } else if (selectionMode) {
      e.preventDefault();
      onSelect(item.id, e);
    }
  }, [compareMode, selectionMode, onSelect, onCompareToggle, item]);

  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    if (compareMode || selectionMode) {
      // In compare or selection mode, let the click bubble up to parent handler
      return;
    }
    e.stopPropagation();
    onPreview(item);
  }, [compareMode, selectionMode, onPreview, item]);

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
      className={`vault-item group bg-white dark:bg-[#1a1625]/50 rounded-lg sm:rounded-xl border transition-all cursor-pointer active:scale-95 ${
        isInCompare
          ? 'border-[#5DC3F8] ring-2 ring-[#5DC3F8]/30'
          : isSelected
          ? 'border-[#EC67A1] ring-2 ring-[#EC67A1]/30'
          : 'border-[#EC67A1]/20 dark:border-[#EC67A1]/30 hover:border-[#EC67A1]/50 hover:shadow-lg'
      }`}
      onClick={handleClick}
    >
      <div className="relative">
        {/* Favorite Star */}
        {!selectionMode && !compareMode && typeof toggleFavorite === 'function' && (
          <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10">
            <FavoriteStar
              isFavorite={favorites?.has(item.id) || false}
              onToggle={(e) => {
                e.stopPropagation();
                toggleFavorite(item.id);
              }}
            />
          </div>
        )}
        {/* Compare Mode Indicator */}
        {compareMode && (
          <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10">
            <div className={`p-1.5 rounded-lg transition-all ${
              isInCompare
                ? 'bg-[#5DC3F8]/20 text-[#5DC3F8]'
                : 'bg-white/90 dark:bg-[#1a1625]/90 text-header-muted'
            }`}>
              <Columns2 className="w-4 h-4" />
            </div>
          </div>
        )}
        <div
          className={`absolute top-1 sm:top-2 left-1 sm:left-2 z-20 transition-opacity ${
            selectionMode || isSelected
              ? 'opacity-100'
              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
          } ${compareMode ? 'hidden' : ''}`}
        >
          <label 
            className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 bg-white/90 dark:bg-[#1a1625]/90 backdrop-blur rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(item.id);
              }}
              className="w-5 h-5 sm:w-4 sm:h-4 text-[#EC67A1] bg-white dark:bg-[#1a1625] border-[#EC67A1]/30 rounded focus:ring-[#EC67A1] shadow-sm cursor-pointer"
            />
          </label>
        </div>
        <div
          className="aspect-square p-2 sm:p-3"
          onClick={handlePreviewClick}
        >
          {item.fileType.startsWith('image/') ? (
            <LazyImage
              src={item.awsS3Url}
              alt={item.fileName}
              className="w-full h-full rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (!img.dataset.retried) {
                  img.dataset.retried = 'true';
                  img.src = item.awsS3Url + '?t=' + Date.now();
                }
              }}
            />
          ) : item.fileType.startsWith('video/') ? (
            <div className="relative w-full h-full bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
              <LazyVideoThumbnail
                src={item.awsS3Url}
                className="w-full h-full"
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
            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
              <FileIcon className="w-10 sm:w-12 h-10 sm:h-12 text-zinc-400 dark:text-zinc-600" />
            </div>
          )}
        </div>
        <div
          className={`absolute top-1 sm:top-2 right-1 sm:right-2 flex items-center gap-0.5 sm:gap-1 transition-opacity ${
            !selectionMode && (isSelected ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100')
          } ${selectionMode ? 'hidden' : ''}`}
        >
          {item.metadata && (
            <div
              className="p-1.5 sm:p-1.5 bg-gradient-to-br from-[#5DC3F8]/20 to-[#EC67A1]/20 backdrop-blur shadow-sm rounded-lg"
              title="AI Generated - Click to view details"
            >
              <Sparkles className="w-4 sm:w-4 h-4 sm:h-4 text-[#5DC3F8]" />
            </div>
          )}
          <button
            onClick={(e) => onDownload(item, e)}
            className="p-2 sm:p-1.5 bg-white/90 dark:bg-[#1a1625]/90 backdrop-blur shadow-sm rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 touch-manipulation"
            title="Download"
          >
            <Download className="w-4 sm:w-4 h-4 sm:h-4 text-sidebar-foreground" />
          </button>
          {canEdit && (
            <button
              onClick={handleDeleteClick}
              className="p-2 sm:p-1.5 bg-white/90 dark:bg-[#1a1625]/90 backdrop-blur shadow-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors active:scale-95 touch-manipulation"
            >
              <Trash2 className="w-4 sm:w-4 h-4 sm:h-4 text-red-500 dark:text-red-400" />
            </button>
          )}
        </div>
      </div>
      <div className="px-2 sm:px-3 pb-2 sm:pb-3">
        <p className="text-xs sm:text-sm font-medium text-sidebar-foreground truncate leading-tight">
          {item.fileName}
        </p>
        {showGeneratorInfo && (
          <p className="text-[10px] sm:text-xs text-amber-300 mt-0.5 truncate">
            Generated by {item.metadata?.generatedByName || item.creatorName || 'Unknown creator'}
          </p>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs sm:text-xs text-header-muted font-medium">
            {formatFileSize(item.fileSize)}
          </span>
          <span className="text-[10px] sm:text-xs text-header-muted hidden sm:inline">
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
  onDownload: (item: VaultItem, e?: React.MouseEvent) => void;
  formatFileSize: (bytes: number) => string;
  favorites?: Set<string>;
  toggleFavorite?: (id: string) => void;
  showGeneratorInfo?: boolean;
}

const VaultListItem = memo(function VaultListItem({
  item,
  isSelected,
  selectionMode,
  canEdit,
  onSelect,
  onPreview,
  onDelete,
  onDownload,
  formatFileSize,
  favorites,
  toggleFavorite,
  showGeneratorInfo,
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
      className={`vault-item group flex items-center gap-2 sm:gap-4 p-2.5 sm:p-3 bg-white dark:bg-[#1a1625]/50 rounded-lg border transition-all cursor-pointer active:scale-[0.99] touch-manipulation ${
        isSelected
          ? 'border-[#EC67A1] ring-2 ring-[#EC67A1]/30'
          : 'border-[#EC67A1]/20 dark:border-[#EC67A1]/30 hover:border-[#EC67A1]/50'
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
        <label className="flex items-center justify-center w-8 h-8 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
            className="w-4 h-4 text-[#EC67A1] bg-white dark:bg-[#1a1625] border-[#EC67A1]/30 rounded focus:ring-[#EC67A1] flex-shrink-0 cursor-pointer"
          />
        </label>
      </div>
      <div className="w-10 sm:w-12 h-10 sm:h-12 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {item.fileType.startsWith('image/') ? (
          <LazyImage
            src={item.awsS3Url}
            alt={item.fileName}
            className="w-full h-full relative"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.retried) {
                img.dataset.retried = 'true';
                img.src = item.awsS3Url + '?t=' + Date.now();
              }
            }}
          />
        ) : item.fileType.startsWith('video/') ? (
          <div className="relative w-full h-full bg-zinc-100 dark:bg-zinc-800">
            <LazyVideoThumbnail
              src={item.awsS3Url}
              className="w-full h-full"
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
            <FileIcon className="w-4 sm:w-5 h-4 sm:h-5 text-header-muted" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm sm:text-sm font-medium text-sidebar-foreground truncate leading-tight">
          {item.fileName}
        </p>
        {showGeneratorInfo && (
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-300 truncate">
            Generated by {item.metadata?.generatedByName || item.creatorName || 'Unknown creator'}
          </p>
        )}
        <p className="text-xs sm:text-xs text-header-muted mt-0.5">
          {formatFileSize(item.fileSize)}
        </p>
      </div>
      <div className="text-[10px] sm:text-xs text-header-muted items-center gap-1 hidden md:flex">
        <Calendar className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
        {item.createdAt.toLocaleDateString()}
      </div>
      <div
        className={`flex items-center gap-0.5 sm:gap-1 transition-opacity flex-shrink-0 ${
          selectionMode ? 'hidden' : 'sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        <button
          onClick={(e) => onDownload(item, e)}
          className="p-2 sm:p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors active:scale-95 touch-manipulation"
          title="Download"
        >
          <Download className="w-4 sm:w-4 h-4 sm:h-4 text-header-muted" />
        </button>
        {canEdit && (
          <button
            onClick={handleDeleteClick}
            className="p-2 sm:p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors active:scale-95 touch-manipulation"
          >
            <Trash2 className="w-4 sm:w-4 h-4 sm:h-4 text-red-500 dark:text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
});

// Recursive folder tree component
interface FolderTreeItemProps {
  folder: VaultFolder;
  level: number;
  isActive: boolean;
  isExpanded: boolean;
  expandedFolders: Set<string>;
  allFolders: VaultFolder[];
  vaultItems: VaultItem[];
  selectedProfileId: string | null;
  selectedFolderId: string | null;
  editingFolderId: string | null;
  editingFolderName: string;
  onToggleExpand: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onEditFolder: (folder: VaultFolder) => void;
  onUpdateFolder: () => void;
  onCancelEdit: () => void;
  setEditingFolderName: (name: string) => void;
  onOpenShareModal: (folder: VaultFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  onMoveFolder: (folder: VaultFolder) => void;
  onDropFolder?: (sourceFolderId: string, destinationFolderId: string) => void;
  folderSelectionMode?: boolean;
  selectedFolderIds?: Set<string>;
  onToggleFolderSelection?: (folderId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setAdminViewMode: (mode: 'personal' | 'creators') => void;
  setSelectedSharedFolder: (folder: any) => void;
  setSharedFolderItems: (items: any[]) => void;
}

const FolderTreeItem = memo(function FolderTreeItem({
  folder,
  level,
  isActive,
  isExpanded,
  expandedFolders,
  allFolders,
  vaultItems,
  selectedProfileId,
  selectedFolderId,
  editingFolderId,
  editingFolderName,
  onToggleExpand,
  onSelectFolder,
  onEditFolder,
  onUpdateFolder,
  onCancelEdit,
  setEditingFolderName,
  onOpenShareModal,
  onDeleteFolder,
  onCreateSubfolder,
  onMoveFolder,
  onDropFolder,
  folderSelectionMode,
  selectedFolderIds,
  onToggleFolderSelection,
  setSidebarOpen,
  setAdminViewMode,
  setSelectedSharedFolder,
  setSharedFolderItems,
}: FolderTreeItemProps) {
  const subfolders = allFolders
    .filter(f => f.parentId === folder.id)
    .sort((a, b) => {
      // Default folders (All Media) always first
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  const hasSubfolders = subfolders.length > 0;
  const [isDragOver, setIsDragOver] = useState(false);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/vault-folder-id', folder.id);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }, [folder.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const draggedFolderId = e.dataTransfer.types.includes('text/vault-folder-id');
    if (!draggedFolderId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const sourceFolderId = e.dataTransfer.getData('text/vault-folder-id');
    if (sourceFolderId && sourceFolderId !== folder.id && onDropFolder) {
      onDropFolder(sourceFolderId, folder.id);
    }
  }, [folder.id, onDropFolder]);
  
  const itemCount = folder.isDefault 
    ? vaultItems.filter(item => item.profileId === folder.profileId).length 
    : vaultItems.filter(item => item.folderId === folder.id).length;

  const handleClick = () => {
    onSelectFolder(folder.id);
    setSelectedSharedFolder(null);
    setSharedFolderItems([]);
    setSidebarOpen(false);
    setAdminViewMode('personal');
  };

  return (
    <div>
      {editingFolderId === folder.id ? (
        <div className="flex items-center gap-2 px-2" style={{ paddingLeft: `${level * 12 + 8}px` }}>
          <input 
            value={editingFolderName} 
            onChange={(e) => setEditingFolderName(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && onUpdateFolder()} 
            autoFocus 
            className="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/20 rounded-xl text-sidebar-foreground focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1]" 
          />
          <button onClick={onUpdateFolder} className="p-1.5 text-emerald-600 dark:text-emerald-400"><Check className="w-4 h-4" /></button>
          <button onClick={onCancelEdit} className="p-1.5 text-header-muted"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div 
          className={`group w-full flex items-center gap-2 py-2.5 rounded-xl transition-all cursor-pointer ${
            isDragOver 
              ? 'bg-[#5DC3F8]/20 text-[#5DC3F8] dark:text-[#5DC3F8] border-2 border-dashed border-[#5DC3F8]/50 ring-1 ring-[#5DC3F8]/30'
              : isActive ? 'bg-gradient-to-r from-[#EC67A1]/20 to-[#F774B9]/20 text-[#E1518E] dark:text-[#F774B9] border border-[#EC67A1]/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-sidebar-foreground border border-transparent'
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px`, paddingRight: '12px' }}
          draggable={!folder.isDefault}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Expand/collapse button */}
          {hasSubfolders && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleExpand(folder.id); }}
              className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors flex-shrink-0"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
          {!hasSubfolders && <div className="w-4" />}
          
          {/* Folder selection checkbox for bulk operations */}
          {folderSelectionMode && !folder.isDefault && (
            <div 
              className="flex items-center justify-center w-5 h-5 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selectedFolderIds?.has(folder.id) || false}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleFolderSelection?.(folder.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-[#EC67A1] bg-white dark:bg-[#1a1625] border-[#EC67A1]/30 rounded focus:ring-[#EC67A1] cursor-pointer"
              />
            </div>
          )}
          
          {/* Folder icon and name */}
          <div onClick={handleClick} className="flex items-center gap-2 flex-1 min-w-0">
            {isActive ? <FolderOpen className="w-4 h-4 flex-shrink-0" /> : <FolderClosed className="w-4 h-4 flex-shrink-0" />}
            <span 
              className="text-sm font-medium truncate" 
              title={folder.name}
              style={{ 
                display: 'block',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {folder.name}
            </span>
          </div>
          
          {/* Item count */}
          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#EC67A1]/30 text-[#E1518E] dark:text-[#F774B9]' : 'bg-zinc-100 dark:bg-zinc-800 text-header-muted'}`}>
            {itemCount}
          </span>
          
          {/* Action buttons */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onCreateSubfolder(folder.id); }} 
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg" 
              title="Create subfolder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-header-muted" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenShareModal(folder); }} 
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg" 
              title="Share"
            >
              <Share2 className="w-3.5 h-3.5 text-header-muted" />
            </button>
            {!folder.isDefault && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); onMoveFolder(folder); }} 
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg" 
                  title="Move folder"
                >
                  <Move className="w-3.5 h-3.5 text-header-muted" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onEditFolder(folder); }} 
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg" 
                  title="Rename"
                >
                  <Edit2 className="w-3.5 h-3.5 text-header-muted" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} 
                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" 
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Render subfolders */}
      {isExpanded && hasSubfolders && (
        <div className="space-y-1">
          {subfolders.map(subfolder => (
            <FolderTreeItem
              key={subfolder.id}
              folder={subfolder}
              level={level + 1}
              isActive={subfolder.id === selectedFolderId}
              isExpanded={expandedFolders.has(subfolder.id)}
              expandedFolders={expandedFolders}
              allFolders={allFolders}
              vaultItems={vaultItems}
              selectedProfileId={selectedProfileId}
              selectedFolderId={selectedFolderId}
              editingFolderId={editingFolderId}
              editingFolderName={editingFolderName}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              onEditFolder={onEditFolder}
              onUpdateFolder={onUpdateFolder}
              onCancelEdit={onCancelEdit}
              setEditingFolderName={setEditingFolderName}
              onOpenShareModal={onOpenShareModal}
              onDeleteFolder={onDeleteFolder}
              onCreateSubfolder={onCreateSubfolder}
              onMoveFolder={onMoveFolder}
              onDropFolder={onDropFolder}
              folderSelectionMode={folderSelectionMode}
              selectedFolderIds={selectedFolderIds}
              onToggleFolderSelection={onToggleFolderSelection}
              setSidebarOpen={setSidebarOpen}
              setAdminViewMode={setAdminViewMode}
              setSelectedSharedFolder={setSelectedSharedFolder}
              setSharedFolderItems={setSharedFolderItems}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function VaultContent() {
  // Router for navigation
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;
  
  // Use global profile selector - now includes isAllProfiles
  const { profileId: globalProfileId, profiles: globalProfiles, loadingProfiles, isAllProfiles } = useInstagramProfile();
  
  // Admin state
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [adminViewMode, setAdminViewMode] = useState<'personal' | 'creators'>('personal');
  const [contentCreators, setContentCreators] = useState<ContentCreator[]>([]);
  const [selectedContentCreator, setSelectedContentCreator] = useState<ContentCreator | null>(null);
  const [contentCreatorItems, setContentCreatorItems] = useState<VaultItem[]>([]);
  const [loadingCreatorItems, setLoadingCreatorItems] = useState(false);
  // Content creator folders (admin view)
  const [creatorFolders, setCreatorFolders] = useState<Array<{
    id: string;
    name: string;
    profileId: string;
    isDefault: boolean;
    itemCount: number;
    profileName: string;
  }>>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Array<{ id: string; name: string; instagramUsername?: string | null }>>([]);
  const [selectedCreatorFolderId, setSelectedCreatorFolderId] = useState<string | null>(null);
  
  // Local state derived from global profile - sync with global selector
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(globalProfileId);
  const profiles = useMemo(() => 
    [...globalProfiles].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    ), 
    [globalProfiles]
  );

  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [allFolders, setAllFolders] = useState<VaultFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null);

  // Move Folder state
  const [showMoveFolderModal, setShowMoveFolderModal] = useState(false);
  const [folderToMove, setFolderToMove] = useState<VaultFolder | null>(null);
  const [moveFolderDestinationId, setMoveFolderDestinationId] = useState<string | null>(null);
  const [isMovingFolder, setIsMovingFolder] = useState(false);

  // Bulk folder selection state
  const [folderSelectionMode, setFolderSelectionMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [showBulkMoveFoldersModal, setShowBulkMoveFoldersModal] = useState(false);
  const [bulkMoveFolderDestinationId, setBulkMoveFolderDestinationId] = useState<string | null>(null);
  const [isBulkMovingFolders, setIsBulkMovingFolders] = useState(false);

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

  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showPreviewInfo, setShowPreviewInfo] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAllReferenceImages, setShowAllReferenceImages] = useState(false);
  const [referenceImagePopup, setReferenceImagePopup] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Import from Google Drive state
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveAccessToken, setGoogleDriveAccessToken] = useState<string | null>(null);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [googleDriveFolders, setGoogleDriveFolders] = useState<GoogleDriveFolder[]>([]);
  const [googleDriveBreadcrumbs, setGoogleDriveBreadcrumbs] = useState<GoogleDriveBreadcrumb[]>([{ id: null, name: 'My Drive' }]);
  const [currentGoogleDriveFolderId, setCurrentGoogleDriveFolderId] = useState<string | null>(null);
  const [selectedGoogleDriveFiles, setSelectedGoogleDriveFiles] = useState<Set<string>>(new Set());
  const [loadingGoogleDriveFiles, setLoadingGoogleDriveFiles] = useState(false);
  const [importingFromGoogleDrive, setImportingFromGoogleDrive] = useState(false);
  const [googleDriveImportSuccess, setGoogleDriveImportSuccess] = useState<{ itemCount: number } | null>(null);
  const [googleDriveError, setGoogleDriveError] = useState<string | null>(null);
  const [googleDriveLinkInput, setGoogleDriveLinkInput] = useState("");

  // NEW FEATURES STATE
  // Sorting & Organization
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'name' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Duplicate Detection
  const [duplicates, setDuplicates] = useState<Map<string, string[]>>(new Map());
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [detectingDuplicates, setDetectingDuplicates] = useState(false);
  
  // Enhanced Search
  const [searchInMetadata, setSearchInMetadata] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  
  // Compare Mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareItems, setCompareItems] = useState<VaultItem[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  
  // Thumbnail Quality
  const [thumbnailSize, setThumbnailSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [disableVideoThumbnails, setDisableVideoThumbnails] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Sidebar Resize
  const [sidebarWidth, setSidebarWidth] = useState(288); // Default 72 (18rem in pixels)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(288);
  const minSidebarWidth = 240; // 60rem (15rem)
  const maxSidebarWidth = 600; // 150rem (37.5rem)

  // Load sidebar width from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vault-sidebar-width');
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= minSidebarWidth && width <= maxSidebarWidth) {
          setSidebarWidth(width);
        }
      }
    }
  }, []);

  // Save sidebar width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && sidebarWidth !== 288) {
      localStorage.setItem('vault-sidebar-width', sidebarWidth.toString());
    }
  }, [sidebarWidth]);

  // Handle sidebar resize
  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    setResizeStartX(e.clientX);
    setResizeStartWidth(sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    // Add cursor style to body during resize
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta from start position
      const deltaX = e.clientX - resizeStartX;
      const newWidth = resizeStartWidth + deltaX;
      
      // Clamp to min/max values
      const clampedWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, resizeStartX, resizeStartWidth, minSidebarWidth, maxSidebarWidth]);

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

  // Reset showAllReferenceImages and referenceImagePopup when preview item changes
  useEffect(() => {
    setShowAllReferenceImages(false);
    setReferenceImagePopup(null);
  }, [previewItem?.id]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load favorites and recently viewed from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFavorites = localStorage.getItem('vault-favorites');
      const savedRecentlyViewed = localStorage.getItem('vault-recently-viewed');
      if (savedFavorites) setFavorites(new Set(JSON.parse(savedFavorites)));
      if (savedRecentlyViewed) setRecentlyViewed(JSON.parse(savedRecentlyViewed));
    }
  }, []);

  // Toggle favorite
  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(itemId)) {
        newFavorites.delete(itemId);
        showToast('Removed from favorites', 'info');
      } else {
        newFavorites.add(itemId);
        showToast('Added to favorites', 'success');
      }
      localStorage.setItem('vault-favorites', JSON.stringify([...newFavorites]));
      return newFavorites;
    });
  }, []);

  // Add to recently viewed
  const addToRecentlyViewed = useCallback((itemId: string) => {
    setRecentlyViewed(prev => {
      const newRecent = [itemId, ...prev.filter(id => id !== itemId)].slice(0, 20);
      localStorage.setItem('vault-recently-viewed', JSON.stringify(newRecent));
      return newRecent;
    });
  }, []);

  // Fuzzy search helper (simple Levenshtein-inspired matching)
  const fuzzyMatch = (searchTerm: string, target: string): boolean => {
    searchTerm = searchTerm.toLowerCase();
    target = target.toLowerCase();
    
    // Exact match
    if (target.includes(searchTerm)) return true;
    
    // Check if all characters in search term appear in order in target
    let searchIndex = 0;
    for (let i = 0; i < target.length && searchIndex < searchTerm.length; i++) {
      if (target[i] === searchTerm[searchIndex]) {
        searchIndex++;
      }
    }
    return searchIndex === searchTerm.length;
  };

  // Detect duplicates (by file size and name similarity)
  const detectDuplicates = useCallback(async () => {
    setDetectingDuplicates(true);
    try {
      const items = isAdmin && adminViewMode === 'creators' ? contentCreatorItems : vaultItems;
      const duplicateMap = new Map<string, string[]>();
      const sizeGroups = new Map<number, VaultItem[]>();
      
      // Group by file size first (fast duplicate detection)
      items.forEach(item => {
        const group = sizeGroups.get(item.fileSize) || [];
        group.push(item);
        sizeGroups.set(item.fileSize, group);
      });
      
      // Find potential duplicates in same-size groups
      sizeGroups.forEach((group, size) => {
        if (group.length > 1) {
          // Further group by similar names or identical hashes
          const nameGroups = new Map<string, VaultItem[]>();
          group.forEach(item => {
            const baseName = item.fileName.replace(/\d+/, '').replace(/\.[^/.]+$/, '');
            const key = `${baseName}_${size}`;
            const items = nameGroups.get(key) || [];
            items.push(item);
            nameGroups.set(key, items);
          });
          
          nameGroups.forEach((items, key) => {
            if (items.length > 1) {
              duplicateMap.set(key, items.map(i => i.id));
            }
          });
        }
      });
      
      setDuplicates(duplicateMap);
      if (duplicateMap.size > 0) {
        showToast(`Found ${duplicateMap.size} duplicate groups`, 'info');
      } else {
        showToast('No duplicates found', 'success');
      }
    } catch (error) {
      showToast('Failed to detect duplicates', 'error');
    } finally {
      setDetectingDuplicates(false);
    }
  }, [vaultItems, contentCreatorItems, isAdmin, adminViewMode]);

  // Add search to recent searches
  const addToRecentSearches = useCallback((query: string) => {
    if (!query.trim()) return;
    setRecentSearches(prev => {
      const newSearches = [query, ...prev.filter(s => s !== query)].slice(0, 5);
      localStorage.setItem('vault-recent-searches', JSON.stringify(newSearches));
      return newSearches;
    });
  }, []);

  // Load recent searches
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vault-recent-searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Enhanced search with metadata and fuzzy matching
  const searchItems = useCallback((items: VaultItem[], query: string) => {
    if (!query.trim()) return items;
    
    const lowerQuery = query.toLowerCase();
    
    return items.filter(item => {
      // Search in filename
      if (fuzzyMatch(query, item.fileName)) return true;
      
      // Search in metadata if enabled
      if (searchInMetadata && item.metadata) {
        if (item.metadata.prompt && fuzzyMatch(query, item.metadata.prompt)) return true;
        if (item.metadata.model && fuzzyMatch(query, item.metadata.model)) return true;
        if (item.metadata.source && fuzzyMatch(query, item.metadata.source)) return true;
        if (item.metadata.generationType && fuzzyMatch(query, item.metadata.generationType)) return true;
      }
      
      return false;
    });
  }, [searchInMetadata]);

  // Handle preview with recently viewed tracking
  const handlePreview = useCallback((item: VaultItem) => {
    setPreviewItem(item);
    addToRecentlyViewed(item.id);
  }, [addToRecentlyViewed]);

  // Toggle item in compare mode
  const toggleCompareItem = useCallback((item: VaultItem) => {
    setCompareItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        // Remove item
        return prev.filter(i => i.id !== item.id);
      } else if (prev.length < 4) {
        // Add item (max 4)
        return [...prev, item];
      }
      return prev;
    });
  }, []);

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

  const handleDownloadSingleFile = async (item: VaultItem, e?: React.MouseEvent) => {
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
      a.download = item.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Download started', 'success');
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast('Failed to download file', 'error');
    }
  };

  const handleDownloadZip = async () => {
    if (selectedItems.size === 0) return;

    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Get the correct items source based on current view
      const itemsSource = isViewingCreators 
        ? contentCreatorItems 
        : (selectedSharedFolder ? sharedFolderItems : vaultItems);
      
      const selectedFiles = itemsSource.filter(item => selectedItems.has(item.id));
      
      let successCount = 0;
      let failCount = 0;
      
      // Process files in batches to avoid overwhelming the browser
      const batchSize = 5;
      for (let i = 0; i < selectedFiles.length; i += batchSize) {
        const batch = selectedFiles.slice(i, i + batchSize);
        
        const promises = batch.map(async (item) => {
          try {
            // Use proxy endpoint to avoid CORS issues
            const response = await fetch('/api/vault/proxy-download', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: item.awsS3Url }),
            });
            
            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            zip.file(item.fileName, blob);
            successCount++;
          } catch (error: any) {
            console.error(`Failed to download ${item.fileName}:`, error);
            failCount++;
          }
        });
        
        await Promise.all(promises);
      }
      
      if (successCount === 0) {
        throw new Error('Failed to download any files. Please check your connection and try again.');
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-files-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (failCount > 0) {
        showToast(`Downloaded ${successCount} of ${selectedFiles.length} file(s)`, 'info');
      } else {
        showToast(`Downloaded ${successCount} file(s)`, 'success');
      }
    } catch (error: any) {
      console.error("Error creating zip:", error);
      showToast(error.message || "Failed to create ZIP file", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // Load content creator items (admin only)
  const loadContentCreatorItems = useCallback(async (creatorId?: string) => {
    if (!isAdmin) return;
    
    setLoadingCreatorItems(true);
    try {
      const url = creatorId 
        ? `/api/vault/admin/content-creator-items?contentCreatorId=${creatorId}`
        : '/api/vault/admin/content-creator-items';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch content creator items');
      
      const data = await response.json();
      setContentCreators(data.contentCreators || []);
      setContentCreatorItems((data.items || []).map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })));
      if (data.selectedContentCreator) {
        setSelectedContentCreator(data.selectedContentCreator);
      }
      // Set creator folders and profiles if available
      setCreatorFolders(data.folders || []);
      setCreatorProfiles(data.profiles || []);
      // Reset selected folder when changing creators
      if (!creatorId || creatorId !== selectedContentCreator?.id) {
        setSelectedCreatorFolderId(null);
      }
    } catch (error) {
      console.error("Error loading content creator items:", error);
      showToast("Failed to load content creator items", "error");
    } finally {
      setLoadingCreatorItems(false);
    }
  }, [isAdmin]);

  // Load content creator items when admin view mode changes
  useEffect(() => {
    if (isAdmin && adminViewMode === 'creators') {
      loadContentCreatorItems(selectedContentCreator?.id);
    }
  }, [isAdmin, adminViewMode, selectedContentCreator?.id, loadContentCreatorItems]);

  // Sync with global profile selector
  useEffect(() => {
    if (globalProfileId && globalProfileId !== selectedProfileId) {
      setSelectedProfileId(globalProfileId);
      setSelectedFolderId(null); // Reset folder selection when profile changes
      setSelectedSharedFolder(null);
      setSharedFolderItems([]);
    }
  }, [globalProfileId]);

  // Listen for profile changes from global selector
  useEffect(() => {
    const handleProfileChange = (event: CustomEvent<{ profileId: string }>) => {
      const newProfileId = event.detail.profileId;
      if (newProfileId && newProfileId !== selectedProfileId) {
        setSelectedProfileId(newProfileId);
        setSelectedFolderId(null); // Reset folder selection when profile changes
        setSelectedSharedFolder(null);
        setSharedFolderItems([]);
      }
    };

    window.addEventListener('profileChanged', handleProfileChange as EventListener);
    return () => window.removeEventListener('profileChanged', handleProfileChange as EventListener);
  }, [selectedProfileId]);

  useEffect(() => {
    if (selectedProfileId === 'all') {
      // When viewing all profiles, load all folders
      loadAllFolders();
    } else if (selectedProfileId) {
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
    if (selectedProfileId === 'all' || (selectedFolderId && selectedProfileId)) {
      loadItems();
    }
  }, [selectedFolderId, selectedProfileId, folders]);

  const loadFolders = async () => {
    if (!selectedProfileId || selectedProfileId === 'all') return;

    try {
      const url = tenant 
        ? `/api/vault/folders?profileId=${selectedProfileId}&organizationSlug=${tenant}`
        : `/api/vault/folders?profileId=${selectedProfileId}`;
      const response = await fetch(url);
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
      // Pass profileId=all to get folders from all profiles including shared organization profiles
      const url = tenant 
        ? `/api/vault/folders?profileId=all&organizationSlug=${tenant}`
        : '/api/vault/folders?profileId=all';
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load all folders");

      const data = await response.json();
      setAllFolders(data);
      // When viewing all profiles, also set folders for display
      if (selectedProfileId === 'all') {
        setFolders(data);
      }
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
          organizationSlug: tenant,
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
    // When viewing all profiles, we need either a selected folder or just load all items
    if (selectedProfileId === 'all') {
      // Load all items across all profiles (including shared org profiles)
      setLoadingItems(true);
      try {
        const url = tenant 
          ? `/api/vault/items?profileId=all&organizationSlug=${tenant}`
          : '/api/vault/items?profileId=all';
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
      return;
    }
    
    if (!selectedFolderId || !selectedProfileId) return;

    setLoadingItems(true);
    try {
      const url = tenant 
        ? `/api/vault/items?profileId=${selectedProfileId}&organizationSlug=${tenant}`
        : `/api/vault/items?profileId=${selectedProfileId}`;

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

  // ==================== Google Drive Functions ====================
  
  // Check for Google Drive access token in URL (after OAuth callback) or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      if (accessToken) {
        setGoogleDriveAccessToken(accessToken);
        localStorage.setItem('googleDriveAccessToken', accessToken);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        const savedToken = localStorage.getItem('googleDriveAccessToken');
        if (savedToken) {
          setGoogleDriveAccessToken(savedToken);
        }
      }
    }
  }, []);

  // Connect to Google Drive
  const connectToGoogleDrive = async () => {
    try {
      const currentPath = window.location.pathname;
      const response = await fetch(`/api/auth/google?redirect=${encodeURIComponent(currentPath)}`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Error connecting to Google Drive:", error);
      setGoogleDriveError("Failed to connect to Google Drive");
    }
  };

  // Fetch Google Drive contents (folders and files) for current folder
  const fetchGoogleDriveContents = async (folderId: string | null = null) => {
    if (!googleDriveAccessToken) return;

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      
      const params = new URLSearchParams({
        accessToken: googleDriveAccessToken,
      });
      if (folderId) {
        params.append('folderId', folderId);
      }
      
      const response = await fetch(`/api/google-drive/browse?${params}`);
      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        localStorage.removeItem('googleDriveAccessToken');
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (data.error) {
        if (data.permissionError || data.error.includes('access') || data.error.includes('permission') || data.error.includes('not found')) {
          setGoogleDriveError("Unable to access this folder. You may not have permission or the link may be invalid.");
        } else {
          setGoogleDriveError(data.error);
        }
        return;
      }

      const folders = data.folders || [];
      const mediaFiles = data.mediaFiles || [];
      
      setGoogleDriveFolders(folders);
      setGoogleDriveFiles(mediaFiles);
    } catch (error) {
      console.error("Error fetching Google Drive contents:", error);
      setGoogleDriveError("Failed to fetch contents from Google Drive");
    } finally {
      setLoadingGoogleDriveFiles(false);
    }
  };

  // Navigate into a Google Drive folder
  const navigateToGoogleDriveFolder = (folder: GoogleDriveFolder) => {
    setCurrentGoogleDriveFolderId(folder.id);
    setGoogleDriveBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedGoogleDriveFiles(new Set());
    fetchGoogleDriveContents(folder.id);
  };

  // Navigate to a specific breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const breadcrumb = googleDriveBreadcrumbs[index];
    setCurrentGoogleDriveFolderId(breadcrumb.id);
    setGoogleDriveBreadcrumbs(prev => prev.slice(0, index + 1));
    setSelectedGoogleDriveFiles(new Set());
    fetchGoogleDriveContents(breadcrumb.id);
  };

  // Extract folder ID from Google Drive link
  const extractFolderIdFromLink = (link: string): string | null => {
    const patterns = [
      /\/folders\/([a-zA-Z0-9_-]+)/,
      /\/drive\/.*folders\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Browse a Google Drive folder from a link
  const browseGoogleDriveLink = async () => {
    if (!googleDriveAccessToken || !googleDriveLinkInput.trim()) return;
    
    const folderId = extractFolderIdFromLink(googleDriveLinkInput.trim());
    if (!folderId) {
      setGoogleDriveError("Invalid Google Drive link. Please paste a valid folder link.");
      return;
    }

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      setGoogleDriveBreadcrumbs([{ id: folderId, name: 'Linked Folder' }]);
      setCurrentGoogleDriveFolderId(folderId);
      
      await fetchGoogleDriveContents(folderId);
    } catch (error) {
      console.error("Error browsing Google Drive link:", error);
      setGoogleDriveError("Failed to access the linked folder. Make sure you have permission.");
    }
  };

  // Open Google Drive import modal
  const openGoogleDriveModal = () => {
    if (!selectedFolderId || !selectedProfileId || selectedProfileId === 'all') return;
    setShowGoogleDriveModal(true);
    setGoogleDriveImportSuccess(null);
    setSelectedGoogleDriveFiles(new Set());
    setGoogleDriveError(null);
    setGoogleDriveLinkInput("");
    setGoogleDriveBreadcrumbs([{ id: null, name: 'From Link' }]);
    setCurrentGoogleDriveFolderId(null);
    setGoogleDriveFolders([]);
    setGoogleDriveFiles([]);
  };

  // Toggle Google Drive file selection
  const toggleGoogleDriveFileSelection = (fileId: string) => {
    setSelectedGoogleDriveFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Select all Google Drive files
  const selectAllGoogleDriveFiles = () => {
    if (selectedGoogleDriveFiles.size === googleDriveFiles.length) {
      setSelectedGoogleDriveFiles(new Set());
    } else {
      setSelectedGoogleDriveFiles(new Set(googleDriveFiles.map(file => file.id)));
    }
  };

  // Import from Google Drive
  const importFromGoogleDrive = async () => {
    if (!selectedFolderId || !selectedProfileId || selectedGoogleDriveFiles.size === 0 || !googleDriveAccessToken) return;

    try {
      setImportingFromGoogleDrive(true);
      setGoogleDriveError(null);
      const response = await fetch("/api/vault/import-from-google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolderId,
          profileId: selectedProfileId,
          fileIds: Array.from(selectedGoogleDriveFiles),
          accessToken: googleDriveAccessToken,
        }),
      });

      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        localStorage.removeItem('googleDriveAccessToken');
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to import");
      }

      // Reload vault items
      loadItems();

      setGoogleDriveImportSuccess({ itemCount: data.itemCount });
      showToast(`Imported ${data.itemCount} file(s) from Google Drive`, "success");

      // Reset and close after success
      setTimeout(() => {
        setShowGoogleDriveModal(false);
        setGoogleDriveImportSuccess(null);
        setSelectedGoogleDriveFiles(new Set());
        setGoogleDriveFiles([]);
      }, 2000);
    } catch (error) {
      console.error("Error importing from Google Drive:", error);
      setGoogleDriveError(
        error instanceof Error ? error.message : "Failed to import from Google Drive"
      );
    } finally {
      setImportingFromGoogleDrive(false);
    }
  };

  // ==================== End Google Drive Functions ====================

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

  const handleCreateFolder = async () => {
    if (!selectedProfileId || !folderNameInput.trim()) return;

    try {
      const response = await fetch("/api/vault/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          name: folderNameInput.trim(),
          parentId: parentFolderForNew,
          organizationSlug: tenant,
        }),
      });

      if (!response.ok) throw new Error("Failed to create folder");

      const newFolder = await response.json();
      setFolders([...folders, newFolder]);
      setAllFolders([...allFolders, newFolder]);
      
      // If creating a subfolder, expand the parent
      if (parentFolderForNew) {
        setExpandedFolders(prev => new Set([...prev, parentFolderForNew]));
      }
      
      setSelectedFolderId(newFolder.id);
      setFolderNameInput("");
      setShowNewFolderInput(false);
      setParentFolderForNew(null);
      showToast("Folder created", "success");
    } catch (error) {
      console.error("Error creating folder:", error);
      showToast("Failed to create folder", "error");
    }
  };

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const startCreateSubfolder = (parentId: string) => {
    setParentFolderForNew(parentId);
    setShowNewFolderInput(true);
  };

  // Move Folder helpers
  const getDescendantFolderIds = useCallback((folderId: string, folderList: VaultFolder[]): Set<string> => {
    const descendants = new Set<string>();
    const queue = [folderId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = folderList.filter(f => f.parentId === currentId);
      for (const child of children) {
        if (!descendants.has(child.id)) {
          descendants.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return descendants;
  }, []);

  const startMoveFolder = useCallback((folder: VaultFolder) => {
    if (folder.isDefault) return;
    setFolderToMove(folder);
    setMoveFolderDestinationId(null);
    setShowMoveFolderModal(true);
  }, []);

  const handleMoveFolder = useCallback(async (sourceFolderId: string, destinationFolderId: string | null) => {
    const source = [...folders, ...allFolders].find(f => f.id === sourceFolderId);
    if (!source || source.isDefault) return;

    // Client-side circular check
    if (destinationFolderId) {
      const descendants = getDescendantFolderIds(sourceFolderId, allFolders);
      if (descendants.has(destinationFolderId) || destinationFolderId === sourceFolderId) {
        showToast("Cannot move a folder into itself or its subfolders", "error");
        return;
      }
    }

    // Don't move if already at same parent
    if (source.parentId === destinationFolderId) {
      showToast("Folder is already in this location", "info");
      return;
    }

    setIsMovingFolder(true);
    try {
      const response = await fetch(`/api/vault/folders/${sourceFolderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: destinationFolderId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to move folder");
      }

      // Update local state
      const updatedFolder = await response.json();
      const updateFolderInList = (list: VaultFolder[]) =>
        list.map(f => f.id === sourceFolderId ? { ...f, parentId: destinationFolderId } : f);
      
      setFolders(updateFolderInList);
      setAllFolders(updateFolderInList);

      // Expand destination folder so user can see the moved folder
      if (destinationFolderId) {
        setExpandedFolders(prev => new Set([...prev, destinationFolderId]));
      }

      setShowMoveFolderModal(false);
      setFolderToMove(null);
      setMoveFolderDestinationId(null);
      showToast("Folder moved successfully", "success");
    } catch (error: any) {
      console.error("Error moving folder:", error);
      showToast(error.message || "Failed to move folder", "error");
    } finally {
      setIsMovingFolder(false);
    }
  }, [folders, allFolders, getDescendantFolderIds, showToast]);

  // Drag-and-drop handler for folders
  const handleDropFolderOnFolder = useCallback((sourceFolderId: string, destinationFolderId: string) => {
    handleMoveFolder(sourceFolderId, destinationFolderId);
  }, [handleMoveFolder]);

  // Bulk folder selection handlers
  const toggleFolderSelectionMode = useCallback(() => {
    setFolderSelectionMode(prev => {
      if (prev) {
        // Turning off → clear selections
        setSelectedFolderIds(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleFolderSelection = useCallback((folderId: string) => {
    setSelectedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleBulkMoveFolders = useCallback(async () => {
    if (selectedFolderIds.size === 0) return;

    setIsBulkMovingFolders(true);
    try {
      const response = await fetch("/api/vault/folders/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderIds: Array.from(selectedFolderIds),
          destinationParentId: bulkMoveFolderDestinationId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to move folders");
      }

      const data = await response.json();

      // Update local state for successfully moved folders
      const movedIds = new Set(
        data.results
          .filter((r: { folderId: string; success: boolean }) => r.success)
          .map((r: { folderId: string }) => r.folderId)
      );

      const updateFolderParent = (list: VaultFolder[]) =>
        list.map(f =>
          movedIds.has(f.id) ? { ...f, parentId: bulkMoveFolderDestinationId } : f
        );

      setFolders(updateFolderParent);
      setAllFolders(updateFolderParent);

      // Expand destination so user sees moved folders
      if (bulkMoveFolderDestinationId) {
        setExpandedFolders(prev => new Set([...prev, bulkMoveFolderDestinationId]));
      }

      setShowBulkMoveFoldersModal(false);
      setBulkMoveFolderDestinationId(null);
      setSelectedFolderIds(new Set());
      setFolderSelectionMode(false);

      if (data.failCount > 0) {
        showToast(`Moved ${data.successCount} folder(s), ${data.failCount} failed`, "error");
      } else {
        showToast(`Moved ${data.successCount} folder(s) successfully`, "success");
      }
    } catch (error: any) {
      console.error("Error bulk moving folders:", error);
      showToast(error.message || "Failed to move folders", "error");
    } finally {
      setIsBulkMovingFolders(false);
    }
  }, [selectedFolderIds, bulkMoveFolderDestinationId, showToast]);

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
            organizationSlug: tenant,
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete item" }));
        console.error("Delete failed with status:", response.status, errorData);
        throw new Error(errorData.error || "Failed to delete item");
      }

      if (selectedSharedFolder) {
        setSharedFolderItems(sharedFolderItems.filter((item) => item.id !== id));
      } else {
        setVaultItems(vaultItems.filter((item) => item.id !== id));
      }
      showToast("File deleted", "success");
    } catch (error: any) {
      console.error("Error deleting item:", error);
      showToast(error.message || "Failed to delete file", "error");
    }
  };

  // Handle reuse in SeeDream I2I - stores data in sessionStorage and navigates
  const handleReuseInSeeDreamI2I = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      resolution: item.metadata.resolution || '2K',
      aspectRatio: item.metadata.aspectRatio || null,
      referenceImageUrls: item.metadata.referenceImageUrls || [],
      outputImageUrl: item.awsS3Url, // The generated image that user wants to reuse settings from
    };
    
    // Store in sessionStorage for the SeeDream I2I page to pick up
    sessionStorage.setItem('seedream-i2i-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to SeeDream Image-to-Image page
    router.push(`/${tenant}/workspace/generate-content/seedream-image-to-image`);
  };

  // Handle reuse in SeeDream T2I - stores data in sessionStorage and navigates
  const handleReuseInSeeDreamT2I = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      resolution: item.metadata.resolution || '2K',
      aspectRatio: item.metadata.aspectRatio || null,
      negativePrompt: item.metadata.negativePrompt || '',
      watermark: item.metadata.watermark || false,
    };
    
    // Store in sessionStorage for the SeeDream T2I page to pick up
    sessionStorage.setItem('seedream-t2i-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to SeeDream Text-to-Image page
    router.push(`/${tenant}/workspace/generate-content/seedream-text-to-image`);
  };

  // Handle reuse in FLUX T2I - stores data in sessionStorage and navigates
  const handleReuseInFluxT2I = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data matching the format expected by the FLUX T2I page
    const reuseData = {
      prompt: item.metadata.prompt || '',
      negativePrompt: item.metadata.negativePrompt || '',
      width: item.metadata.width || 832,
      height: item.metadata.height || 1216,
      steps: item.metadata.steps || 40,
      cfg: item.metadata.cfg || 1,
      guidance: item.metadata.guidance || 4,
      samplerName: item.metadata.samplerName || 'euler',
      scheduler: item.metadata.scheduler || 'beta',
      seed: item.metadata.seed || null,
      loras: item.metadata.loras || [],
    };
    
    // Store in sessionStorage for the FLUX T2I page to pick up
    sessionStorage.setItem('flux-t2i-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to FLUX Text-to-Image page
    router.push(`/${tenant}/workspace/generate-content/text-to-image`);
  };

  // Handle reuse in FLUX Style Transfer - stores data in sessionStorage and navigates
  const handleReuseInFluxStyleTransfer = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data matching the format expected by the FLUX Style Transfer page
    const reuseData = {
      prompt: item.metadata.prompt || '',
      width: item.metadata.width || 832,
      height: item.metadata.height || 1216,
      steps: item.metadata.steps || 40,
      cfg: item.metadata.cfg || 1,
      guidance: item.metadata.guidance || 3.5,
      samplerName: item.metadata.samplerName || 'euler',
      scheduler: item.metadata.scheduler || 'beta',
      seed: item.metadata.seed || null,
      loraStrength: item.metadata.loraStrength || 0.95,
      selectedLora: item.metadata.selectedLora || 'AI MODEL 3.safetensors',
      weight: item.metadata.weight || 0.8,
      mode: item.metadata.mode || 'center crop (square)',
      downsamplingFactor: item.metadata.downsamplingFactor || 1,
      downsamplingFunction: item.metadata.downsamplingFunction || 'area',
      autocropMargin: item.metadata.autocropMargin || 0.1,
      referenceImageUrl: item.metadata.referenceImageUrl || null,
    };
    
    // Store in sessionStorage for the FLUX Style Transfer page to pick up
    sessionStorage.setItem('flux-style-transfer-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to FLUX Style Transfer page
    router.push(`/${tenant}/workspace/generate-content/style-transfer`);
  };

  // Handle reuse in SeeDream T2V - stores data in sessionStorage and navigates
  const handleReuseInSeeDreamT2V = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      resolution: item.metadata.resolution || '720p',
      ratio: item.metadata.ratio || item.metadata.aspectRatio || '16:9',
      duration: item.metadata.duration || 4,
      cameraFixed: item.metadata.cameraFixed || false,
      generateAudio: item.metadata.generateAudio ?? true,
    };
    
    // Store in sessionStorage for the SeeDream T2V page to pick up
    sessionStorage.setItem('seedream-t2v-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to SeeDream Text-to-Video page
    router.push(`/${tenant}/workspace/generate-content/seedream-text-to-video`);
  };

  // Handle reuse in SeeDream I2V - stores data in sessionStorage and navigates
  const handleReuseInSeeDreamI2V = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      resolution: item.metadata.resolution || '720p',
      ratio: item.metadata.ratio || item.metadata.aspectRatio || '16:9',
      duration: item.metadata.duration || 4,
      cameraFixed: item.metadata.cameraFixed || false,
      generateAudio: item.metadata.generateAudio ?? true,
      referenceImageUrl: item.metadata.referenceImageUrl || null,
    };
    
    // Store in sessionStorage for the SeeDream I2V page to pick up
    sessionStorage.setItem('seedream-i2v-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to SeeDream Image-to-Video page
    router.push(`/${tenant}/workspace/generate-content/seedream-image-to-video`);
  };

  // Handle reuse in Kling T2V - stores data in sessionStorage and navigates
  const handleReuseInKlingT2V = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      negativePrompt: item.metadata.negativePrompt || '',
      model: item.metadata.model || 'kling-v1-6',
      mode: item.metadata.mode || 'std',
      duration: item.metadata.duration || '5',
      aspectRatio: item.metadata.aspectRatio || '16:9',
      cfgScale: item.metadata.cfgScale || 0.5,
      sound: item.metadata.sound || 'off',
      cameraControl: item.metadata.cameraControl || null,
    };
    
    // Store in sessionStorage for the Kling T2V page to pick up
    sessionStorage.setItem('kling-t2v-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to Kling Text-to-Video page
    router.push(`/${tenant}/workspace/generate-content/kling-text-to-video`);
  };

  // Handle reuse in Kling I2V - stores data in sessionStorage and navigates
  const handleReuseInKlingI2V = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      negativePrompt: item.metadata.negativePrompt || '',
      model: item.metadata.model || 'kling-v1-6',
      mode: item.metadata.mode || 'std',
      duration: item.metadata.duration || '5',
      cfgScale: item.metadata.cfgScale || 0.5,
      sound: item.metadata.sound || 'off',
      imageMode: item.metadata.imageMode || 'normal',
      cameraControl: item.metadata.cameraControl || null,
      referenceImageUrl: item.metadata.referenceImageUrl || null, // Use the original reference image from metadata, not the video URL
    };
    
    // Store in sessionStorage for the Kling I2V page to pick up
    sessionStorage.setItem('kling-i2v-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to Kling Image-to-Video page
    router.push(`/${tenant}/workspace/generate-content/kling-image-to-video`);
  };

  // Handle reuse in Kling Motion Control - stores data in sessionStorage and navigates
  const handleReuseInKlingMotionControl = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      mode: item.metadata.mode || 'std',
      characterOrientation: item.metadata.character_orientation || 'image',
      keepOriginalSound: item.metadata.keep_original_sound === 'yes',
      imageUrl: item.metadata.imageUrl || null, // Reference image URL
      referenceVideoUrl: item.metadata.referenceVideoUrl || null, // Reference video URL
    };
    
    // Store in sessionStorage for the Kling Motion Control page to pick up
    sessionStorage.setItem('kling-motion-control-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to Kling Motion Control page
    router.push(`/${tenant}/workspace/generate-content/kling-motion-control`);
  };

  // Handle reuse in Kling Multi-Image to Video - stores data in sessionStorage and navigates
  const handleReuseInKlingMultiI2V = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      negativePrompt: item.metadata.negativePrompt || '',
      model: item.metadata.model || 'kling-v1-6',
      mode: item.metadata.mode || 'std',
      duration: item.metadata.duration || '5',
      aspectRatio: item.metadata.aspectRatio || '16:9',
      cfgScale: item.metadata.cfgScale || 0.5,
      imageCount: item.metadata.imageCount || 0,
      sourceImageUrls: item.metadata.sourceImageUrls || [],
    };
    
    // Store in sessionStorage for the Kling Multi-I2V page to pick up
    sessionStorage.setItem('kling-multi-i2v-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to Kling Multi-Image to Video page
    router.push(`/${tenant}/workspace/generate-content/kling-multi-image-to-video`);
  };

  // Handle reuse in Wan T2V (Text to Video Studio) - stores data in sessionStorage and navigates
  const handleReuseInWanT2V = (item: VaultItem) => {
    if (!item.metadata) return;
    
    // Prepare reuse data
    const reuseData = {
      prompt: item.metadata.prompt || '',
      negativePrompt: item.metadata.negativePrompt || '',
      width: item.metadata.width || 640,
      height: item.metadata.height || 640,
      videoLength: item.metadata.videoLength || 81,
      highNoiseSteps: item.metadata.highNoiseSteps || 4,
      highNoiseCfg: item.metadata.highNoiseCfg || 1,
      highNoiseSeed: item.metadata.highNoiseSeed || Math.floor(Math.random() * 1000000000000),
      lowNoiseSteps: item.metadata.lowNoiseSteps || 4,
      lowNoiseCfg: item.metadata.lowNoiseCfg || 1,
      presetMode: item.metadata.presetMode || '',
      customHighNoiseLoraList: item.metadata.customHighNoiseLoraList || [],
      customLowNoiseLoraList: item.metadata.customLowNoiseLoraList || [],
    };
    
    // Store in sessionStorage for the Wan T2V page to pick up
    sessionStorage.setItem('wan-t2v-reuse', JSON.stringify(reuseData));
    
    // Close preview and navigate
    setPreviewItem(null);
    setShowPreviewInfo(false);
    
    // Navigate to Text to Video Studio page
    router.push(`/${tenant}/workspace/generate-content/text-to-video`);
  };

  // All filtered items (not paginated) - NOW WITH ENHANCED FEATURES
  const allFilteredItems = useMemo(() => {
    // Helper function to extract sequence number from filename for proper sorting
    const getSequenceNumber = (fileName: string): number => {
      const match = fileName.match(/^(\d+)_/);
      if (match) return parseInt(match[1], 10);
      return Infinity;
    };

    const getExportBatchKey = (item: VaultItem): string | null => {
      if (item.metadata?.source === 'sexting-set-export' && item.metadata?.originalSetId) {
        const exportedAt = item.metadata?.exportedAt;
        if (exportedAt) {
          const date = new Date(exportedAt);
          date.setSeconds(0, 0);
          return `${item.metadata.originalSetId}_${date.getTime()}`;
        }
        return item.metadata.originalSetId;
      }
      return null;
    };

    const getBatchSequence = (item: VaultItem): number => {
      if (item.metadata?.sequence) return item.metadata.sequence;
      return getSequenceNumber(item.fileName);
    };

    // Generic sorting function
    const sortItems = (items: VaultItem[]) => {
      return [...items].sort((a, b) => {
        // Favorites always on top if showing them
        const aFav = favorites.has(a.id);
        const bFav = favorites.has(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        // Check for batch grouping
        const batchA = getExportBatchKey(a);
        const batchB = getExportBatchKey(b);
        if (batchA && batchB && batchA === batchB) {
          return getBatchSequence(a) - getBatchSequence(b);
        }

        // Apply user-selected sorting
        let comparison = 0;
        switch (sortBy) {
          case 'date':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'size':
            comparison = a.fileSize - b.fileSize;
            break;
          case 'name':
            comparison = a.fileName.localeCompare(b.fileName);
            break;
          case 'type':
            comparison = a.fileType.localeCompare(b.fileType);
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    };

    let baseItems: VaultItem[] = [];

    if (selectedSharedFolder) {
      baseItems = sharedFolderItems;
    } else {
      const currentFolder = folders.find(f => f.id === selectedFolderId);
      const isDefaultFolder = currentFolder?.isDefault === true;
      const viewingAllProfiles = selectedProfileId === 'all';

      baseItems = vaultItems.filter((item) => {
        if (viewingAllProfiles && !selectedFolderId) return true;
        if (viewingAllProfiles && selectedFolderId) {
          if (isDefaultFolder && currentFolder) {
            return item.profileId === currentFolder.profileId;
          }
          return item.folderId === selectedFolderId;
        }
        if (!viewingAllProfiles) {
          if (item.profileId !== selectedProfileId) return false;
          if (isDefaultFolder) return true;
          return item.folderId === selectedFolderId;
        }
        return true;
      });
    }

    // Filter by content type
    baseItems = baseItems.filter((item) => {
      if (contentFilter === 'all') return true;
      if (contentFilter === 'photos') return item.fileType.startsWith('image/') && item.fileType !== 'image/gif';
      if (contentFilter === 'videos') return item.fileType.startsWith('video/');
      if (contentFilter === 'audio') return item.fileType.startsWith('audio/');
      if (contentFilter === 'gifs') return item.fileType === 'image/gif';
      return true;
    });

    // Show duplicates view if enabled
    if (showDuplicates && duplicates.size > 0) {
      const duplicateIds = new Set(Array.from(duplicates.values()).flat());
      baseItems = baseItems.filter(item => duplicateIds.has(item.id));
    }

    // Apply enhanced search
    baseItems = searchItems(baseItems, debouncedSearchQuery);

    // Sort items
    return sortItems(baseItems);
  }, [vaultItems, sharedFolderItems, selectedFolderId, selectedProfileId, debouncedSearchQuery, folders, contentFilter, selectedSharedFolder, sortBy, sortOrder, favorites, showDuplicates, duplicates, searchItems]);

  // Helper function to get grid classes based on thumbnail size
  const getGridClasses = useMemo(() => {
    if (viewMode !== 'grid') return 'space-y-2';
    
    switch (thumbnailSize) {
      case 'small':
        return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-2 md:gap-3';
      case 'large':
        return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5';
      default: // medium
        return 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4';
    }
  }, [viewMode, thumbnailSize]);

  // Filtered items for admin creator view
  const allFilteredCreatorItems = useMemo(() => {
    if (!isAdmin || adminViewMode !== 'creators') return [];
    
    // Find the selected folder to check if it's a default folder
    const selectedFolder = creatorFolders.find(f => f.id === selectedCreatorFolderId);
    const isDefaultFolder = selectedFolder?.isDefault === true;
    
    return contentCreatorItems
      .filter((item) => {
        // Filter by selected content creator if one is selected
        if (selectedContentCreator && item.creatorId !== selectedContentCreator.id) {
          return false;
        }
        return true;
      })
      .filter((item) => {
        // Filter by selected folder if one is selected
        if (selectedCreatorFolderId) {
          // If it's a default folder (like "All Media"), show all items from that profile
          if (isDefaultFolder && selectedFolder) {
            return item.profileId === selectedFolder.profileId;
          }
          // Otherwise filter by the specific folder
          return item.folderId === selectedCreatorFolderId;
        }
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
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
  }, [isAdmin, adminViewMode, contentCreatorItems, selectedContentCreator, selectedCreatorFolderId, creatorFolders, debouncedSearchQuery, contentFilter]);

  // Combined filtered items based on current view
  const currentFilteredItems = useMemo(() => {
    if (isAdmin && adminViewMode === 'creators') {
      return allFilteredCreatorItems;
    }
    return allFilteredItems;
  }, [isAdmin, adminViewMode, allFilteredCreatorItems, allFilteredItems]);

  // Paginated items for display (still keeping some limit for initial render)
  const filteredItems = useMemo(() => {
    return currentFilteredItems.slice(0, displayCount);
  }, [currentFilteredItems, displayCount]);

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
        if (currentFilteredItems.length > 0) {
          setSelectedItems(new Set(currentFilteredItems.map(item => item.id)));
          setSelectionMode(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems.size, currentFilteredItems]);

  const hasMoreItems = displayCount < currentFilteredItems.length;
  
  const loadMoreItems = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, currentFilteredItems.length));
  }, [currentFilteredItems.length]);

  // Infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200 && hasMoreItems) {
      loadMoreItems();
    }
  }, [hasMoreItems, loadMoreItems]);

  // isAllProfiles comes from the useInstagramProfile hook
  const visibleFolders = isAllProfiles 
    ? folders 
    : folders.filter((folder) => folder.profileId === selectedProfileId);
  const selectedProfile = isAllProfiles 
    ? { id: 'all', name: 'All Profiles', instagramUsername: null, isDefault: false } as InstagramProfile
    : profiles.find((p) => p.id === selectedProfileId) || null;
  const selectedFolder = selectedSharedFolder 
    ? { id: selectedSharedFolder.folderId, name: selectedSharedFolder.folderName, profileId: selectedSharedFolder.profileId, isDefault: selectedSharedFolder.isDefault }
    : visibleFolders.find((folder) => folder.id === selectedFolderId) || null;
  
  // Helper to get profile name for a folder
  const getProfileNameForFolder = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    return profile?.name || 'Unknown';
  };
  
  const isViewingShared = selectedSharedFolder !== null;
  const isViewingCreators = isAdmin && adminViewMode === 'creators';
  const canEdit = (!isViewingShared && !isViewingCreators) || selectedSharedFolder?.permission === 'EDIT';

  const totalItems = isAllProfiles 
    ? vaultItems.length 
    : vaultItems.filter(item => item.profileId === selectedProfileId).length;
  const totalSize = isAllProfiles
    ? vaultItems.reduce((acc, item) => acc + item.fileSize, 0)
    : vaultItems.filter(item => item.profileId === selectedProfileId).reduce((acc, item) => acc + item.fileSize, 0);
  const imageCount = vaultItems.filter(item => 
    (isAllProfiles || item.profileId === selectedProfileId) && item.fileType.startsWith('image/')
  ).length;
  const videoCount = vaultItems.filter(item => 
    (isAllProfiles || item.profileId === selectedProfileId) && item.fileType.startsWith('video/')
  ).length;

  // Creator items stats
  const creatorTotalItems = contentCreatorItems.length;
  const creatorTotalSize = contentCreatorItems.reduce((acc, item) => acc + item.fileSize, 0);
  const creatorImageCount = contentCreatorItems.filter(item => item.fileType.startsWith('image/')).length;
  const creatorVideoCount = contentCreatorItems.filter(item => item.fileType.startsWith('video/')).length;

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
        .vault-scroll::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 4px; }
        .vault-scroll::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); } 50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.5); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.2s ease-out; }
        .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); }
        .glass-card-hover:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.12); }
      `}</style>

      {/* Toast */}
      {toast && createPortal(
        <div className="fixed bottom-4 right-4 z-[100] animate-slideUp">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-xl ${
            toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30' : 
            toast.type === 'error' ? 'bg-red-500/20 text-red-100 border border-red-500/30' : 'bg-[#EC67A1]/20 text-[#F774B9] border border-[#EC67A1]/30'
          }`}>
            {toast.type === 'success' && <Check className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
            {toast.type === 'info' && <AlertCircle className="w-5 h-5 text-[#EC67A1]" />}
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
          <div className="relative bg-white dark:bg-[#1a1625] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg animate-slideUp max-h-[90vh] sm:max-h-none overflow-hidden border border-[#EC67A1]/20">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#EC67A1]/10">
              <h3 className="text-base sm:text-lg font-semibold text-sidebar-foreground">Upload Files</h3>
              <button onClick={() => { setIsAddingNew(false); setNewFiles([]); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-header-muted" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[60vh] sm:max-h-none vault-scroll">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); setNewFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
                className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 transition-all ${isDragging ? 'border-[#EC67A1] bg-[#EC67A1]/10' : 'border-[#EC67A1]/30 hover:border-[#EC67A1]/50 hover:bg-[#EC67A1]/5'}`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-3 rounded-full ${isDragging ? 'bg-[#5DC3F8]/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    <Upload className={`w-6 h-6 ${isDragging ? 'text-[#5DC3F8]' : 'text-header-muted'}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-sidebar-foreground">Tap to select files</p>
                    <p className="text-xs text-header-muted mt-1 hidden sm:block">or drag and drop</p>
                  </div>
                  <input type="file" accept="image/*,video/*,audio/*" multiple onChange={(e) => setNewFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
              </div>
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-sidebar-foreground">{newFiles.length} file(s) selected</p>
                    <button onClick={() => setNewFiles([])} className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300">Clear all</button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 vault-scroll">
                    {newFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <div className="p-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg">
                          {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-[#5DC3F8]" /> :
                           file.type.startsWith('video/') ? <VideoIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" /> :
                           file.type.startsWith('audio/') ? <Music4 className="w-4 h-4 text-[#EC67A1]" /> : <FileIcon className="w-4 h-4 text-header-muted" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-sidebar-foreground truncate">{file.name}</p>
                          <p className="text-xs text-header-muted">{formatFileSize(file.size)}</p>
                        </div>
                        <button onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== index))} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"><X className="w-4 h-4 text-header-muted" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-header-muted">Uploading...</span>
                    <span className="text-[#5DC3F8] font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5DC3F8] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-4 sm:p-5 border-t border-[#EC67A1]/10">
              <button onClick={() => { setIsAddingNew(false); setNewFiles([]); setUploadProgress(0); }} disabled={uploadProgress > 0} className="flex-1 px-4 py-2.5 text-sidebar-foreground bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleAddItem} disabled={newFiles.length === 0 || uploadProgress > 0} className="flex-1 px-4 py-2.5 text-white bg-[#EC67A1] hover:bg-[#E1518E] rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
          <div className="relative bg-white dark:bg-[#1a1625] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md animate-slideUp border-t sm:border border-[#EC67A1]/20">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#EC67A1]/10">
              <h3 className="text-base sm:text-lg font-semibold text-sidebar-foreground">{isCopyMode ? 'Copy' : 'Move'} {selectedItems.size} item(s)</h3>
              <button onClick={() => { setShowMoveModal(false); setIsCopyMode(false); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><X className="w-5 h-5 text-header-muted" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setIsCopyMode(false)} className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium transition-colors ${!isCopyMode ? 'bg-[#5DC3F8] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><Move className="w-4 h-4" /> Move</button>
                <button onClick={() => setIsCopyMode(true)} className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium transition-colors ${isCopyMode ? 'bg-emerald-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><Copy className="w-4 h-4" /> Copy</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Destination folder</label>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[#EC67A1]/20 bg-zinc-50 dark:bg-zinc-800/50 vault-scroll">
                  {(() => {
                    // Build tree-based folder picker
                    const renderFolderTree = (
                      foldersForProfile: VaultFolder[],
                      parentId: string | null,
                      depth: number,
                      excludeFolderIds: Set<string>
                    ): React.ReactNode[] => {
                      const children = foldersForProfile
                        .filter(f => f.parentId === parentId && !f.isDefault)
                        .sort((a, b) => a.name.localeCompare(b.name));
                      return children.flatMap(folder => {
                        const isExcluded = excludeFolderIds.has(folder.id);
                        return [
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => !isExcluded && setMoveToFolderId(folder.id)}
                            disabled={isExcluded}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                              isExcluded
                                ? 'text-header-muted cursor-not-allowed opacity-50'
                                : moveToFolderId === folder.id
                                  ? 'bg-[#EC67A1]/20 text-[#E1518E] dark:text-[#F774B9] border-l-2 border-[#EC67A1]'
                                  : 'text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                            style={{ paddingLeft: `${12 + depth * 16}px` }}
                          >
                            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-header-muted" />
                            <span className="truncate">{folder.name}</span>
                            {isExcluded && (
                              <span className="text-[10px] text-header-muted ml-auto flex-shrink-0">(current)</span>
                            )}
                          </button>,
                          ...renderFolderTree(foldersForProfile, folder.id, depth + 1, excludeFolderIds),
                        ];
                      });
                    };

                    // Determine which folders to exclude (current source folder)
                    const excludeIds = new Set<string>();
                    if (!isViewingShared && selectedFolderId) {
                      excludeIds.add(selectedFolderId);
                    }

                    // Sort profiles: current profile first, then alphabetical
                    const sortedProfiles = [...profiles].sort((a, b) => {
                      if (a.id === selectedProfileId) return -1;
                      if (b.id === selectedProfileId) return 1;
                      return a.name.localeCompare(b.name);
                    });

                    return (
                      <>
                        {isViewingShared ? (
                          <>
                            {sortedProfiles.map(profile => {
                              const profileFolders = allFolders.filter(f => f.profileId === profile.id);
                              const hasVisibleFolders = profileFolders.some(f => !f.isDefault);
                              if (!hasVisibleFolders) return null;
                              return (
                                <div key={profile.id}>
                                  <div className="px-3 py-1.5 text-[10px] font-semibold text-header-muted uppercase tracking-wider bg-zinc-100/80 dark:bg-zinc-800/80 sticky top-0">
                                    {profile.name}
                                  </div>
                                  {renderFolderTree(profileFolders, null, 0, excludeIds)}
                                </div>
                              );
                            })}
                            {sharedFolders.filter(sf => sf.permission === 'EDIT' && sf.folderId !== selectedSharedFolder?.folderId).length > 0 && (
                              <div>
                                <div className="px-3 py-1.5 text-[10px] font-semibold text-header-muted uppercase tracking-wider bg-zinc-100/80 dark:bg-zinc-800/80 sticky top-0">
                                  Shared Folders
                                </div>
                                {sharedFolders
                                  .filter(sf => sf.permission === 'EDIT' && sf.folderId !== selectedSharedFolder?.folderId)
                                  .sort((a, b) => a.folderName.localeCompare(b.folderName))
                                  .map(sf => (
                                    <button
                                      key={sf.folderId}
                                      type="button"
                                      onClick={() => setMoveToFolderId(sf.folderId)}
                                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                                        moveToFolderId === sf.folderId
                                          ? 'bg-[#EC67A1]/20 text-[#E1518E] dark:text-[#F774B9] border-l-2 border-[#EC67A1]'
                                          : 'text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                      }`}
                                    >
                                      <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-header-muted" />
                                      <span className="truncate">{sf.folderName}</span>
                                      <span className="text-[10px] text-header-muted ml-auto flex-shrink-0">from {sf.ownerName}</span>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {sortedProfiles.map(profile => {
                              const profileFolders = allFolders.filter(f => f.profileId === profile.id);
                              const visibleNonDefault = profileFolders.filter(f => !f.isDefault && !excludeIds.has(f.id));
                              if (visibleNonDefault.length === 0) return null;
                              return (
                                <div key={profile.id}>
                                  <div className="px-3 py-1.5 text-[10px] font-semibold text-header-muted uppercase tracking-wider bg-zinc-100/80 dark:bg-zinc-800/80 sticky top-0 flex items-center gap-1">
                                    {profile.id === selectedProfileId && <span className="text-[#EC67A1]">●</span>}
                                    {profile.name}
                                  </div>
                                  {renderFolderTree(profileFolders, null, 0, excludeIds)}
                                </div>
                              );
                            })}
                            {sharedFolders.filter(sf => sf.permission === 'EDIT').length > 0 && (
                              <div>
                                <div className="px-3 py-1.5 text-[10px] font-semibold text-header-muted uppercase tracking-wider bg-zinc-100/80 dark:bg-zinc-800/80 sticky top-0">
                                  Shared Folders
                                </div>
                                {sharedFolders
                                  .filter(sf => sf.permission === 'EDIT')
                                  .sort((a, b) => a.folderName.localeCompare(b.folderName))
                                  .map(sf => (
                                    <button
                                      key={sf.folderId}
                                      type="button"
                                      onClick={() => setMoveToFolderId(sf.folderId)}
                                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                                        moveToFolderId === sf.folderId
                                          ? 'bg-[#EC67A1]/20 text-[#E1518E] dark:text-[#F774B9] border-l-2 border-[#EC67A1]'
                                          : 'text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                      }`}
                                    >
                                      <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-header-muted" />
                                      <span className="truncate">{sf.folderName}</span>
                                      <span className="text-[10px] text-header-muted ml-auto flex-shrink-0">from {sf.ownerName}</span>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowMoveModal(false); setIsCopyMode(false); }} className="flex-1 px-4 py-2.5 text-sidebar-foreground bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg font-medium transition-colors">Cancel</button>
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
                  className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${isCopyMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#5DC3F8] hover:bg-[#4AB3E8]'}`}
                >
                  {isMoving ? <Loader2 className="w-4 h-4 animate-spin" /> : isCopyMode ? <Copy className="w-4 h-4" /> : <Move className="w-4 h-4" />} {isCopyMode ? 'Copy' : 'Move'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move Folder Modal */}
      {showMoveFolderModal && folderToMove && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowMoveFolderModal(false); setFolderToMove(null); setMoveFolderDestinationId(null); }} />
          <div className="relative bg-white dark:bg-[#1a1625] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md animate-slideUp border-t sm:border border-[#EC67A1]/20">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#EC67A1]/10">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-sidebar-foreground">Move Folder</h3>
                <p className="text-xs text-header-muted mt-0.5">Moving &ldquo;{folderToMove.name}&rdquo;</p>
              </div>
              <button onClick={() => { setShowMoveFolderModal(false); setFolderToMove(null); setMoveFolderDestinationId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><X className="w-5 h-5 text-header-muted" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Destination</label>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[#EC67A1]/20 bg-zinc-50 dark:bg-zinc-800/50">
                  {/* Root level option */}
                  <button
                    onClick={() => setMoveFolderDestinationId(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors border-b border-[#EC67A1]/10 ${
                      moveFolderDestinationId === null 
                        ? 'bg-[#5DC3F8]/20 text-[#5DC3F8] border-l-2 border-l-[#5DC3F8]' 
                        : 'text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">Root (top level)</span>
                  </button>
                  {/* Folder tree for destination selection */}
                  {(() => {
                    const descendantIds = getDescendantFolderIds(folderToMove.id, allFolders);
                    const invalidIds = new Set([folderToMove.id, ...descendantIds]);

                    const renderFolderOption = (folder: VaultFolder, depth: number): React.ReactNode => {
                      const isInvalid = invalidIds.has(folder.id);
                      const isSelected = moveFolderDestinationId === folder.id;
                      const children = allFolders
                        .filter(f => f.parentId === folder.id && !f.isDefault)
                        .sort((a, b) => a.name.localeCompare(b.name));

                      return (
                        <div key={folder.id}>
                          <button
                            onClick={() => !isInvalid && setMoveFolderDestinationId(folder.id)}
                            disabled={isInvalid}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              isInvalid 
                                ? 'text-header-muted cursor-not-allowed opacity-50' 
                                : isSelected 
                                  ? 'bg-[#5DC3F8]/20 text-[#5DC3F8] border-l-2 border-l-[#5DC3F8]' 
                                  : 'text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                            style={{ paddingLeft: `${depth * 16 + 12}px` }}
                          >
                            {isSelected ? <FolderOpen className="w-4 h-4 flex-shrink-0 text-[#5DC3F8]" /> : <FolderClosed className="w-4 h-4 flex-shrink-0" />}
                            <span className="truncate">{folder.name}</span>
                            {isInvalid && folder.id === folderToMove.id && (
                              <span className="text-[10px] text-header-muted ml-auto flex-shrink-0">(source)</span>
                            )}
                            {isInvalid && folder.id !== folderToMove.id && (
                              <span className="text-[10px] text-header-muted ml-auto flex-shrink-0">(child)</span>
                            )}
                          </button>
                          {children.length > 0 && children.map(child => renderFolderOption(child, depth + 1))}
                        </div>
                      );
                    };

                    // Render folders for selected profile, or all profiles
                    const relevantFolders = selectedProfileId === 'all' 
                      ? allFolders 
                      : allFolders.filter(f => f.profileId === folderToMove.profileId);
                    const rootFolders = relevantFolders
                      .filter(f => !f.parentId && !f.isDefault)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    
                    return rootFolders.map(folder => renderFolderOption(folder, 1));
                  })()}
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowMoveFolderModal(false); setFolderToMove(null); setMoveFolderDestinationId(null); }} 
                  className="flex-1 px-4 py-2.5 text-sidebar-foreground bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (folderToMove) {
                      handleMoveFolder(folderToMove.id, moveFolderDestinationId);
                    }
                  }}
                  disabled={isMovingFolder || (moveFolderDestinationId === folderToMove.parentId)}
                  className="flex-1 px-4 py-2.5 text-white bg-[#5DC3F8] hover:bg-[#4AB3E8] rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isMovingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Move className="w-4 h-4" />} Move
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Move Folders Modal */}
      {showBulkMoveFoldersModal && selectedFolderIds.size > 0 && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowBulkMoveFoldersModal(false); setBulkMoveFolderDestinationId(null); }} />
          <div className="relative bg-white dark:bg-[#1a1625] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md animate-slideUp border-t sm:border border-[#EC67A1]/20">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#EC67A1]/10">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-sidebar-foreground">Move {selectedFolderIds.size} Folder(s)</h3>
                <p className="text-xs text-header-muted mt-0.5">Select destination for the selected folders</p>
              </div>
              <button onClick={() => { setShowBulkMoveFoldersModal(false); setBulkMoveFolderDestinationId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><X className="w-5 h-5 text-header-muted" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Destination</label>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[#EC67A1]/20 bg-zinc-50 dark:bg-zinc-800/50">
                  {/* Root level option */}
                  <button
                    onClick={() => setBulkMoveFolderDestinationId(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors border-b border-[#EC67A1]/10 ${
                      bulkMoveFolderDestinationId === null 
                        ? 'bg-[#5DC3F8]/20 text-[#5DC3F8] border-l-2 border-l-[#5DC3F8]' 
                        : 'text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">Root (top level)</span>
                  </button>
                  {/* Folder tree for bulk move destination */}
                  {(() => {
                    // Collect all descendants of every selected folder for circular prevention
                    const allInvalidIds = new Set<string>();
                    selectedFolderIds.forEach(id => {
                      allInvalidIds.add(id);
                      const descendants = getDescendantFolderIds(id, allFolders);
                      descendants.forEach(d => allInvalidIds.add(d));
                    });

                    const renderFolderOption = (folder: VaultFolder, depth: number): React.ReactNode => {
                      const isInvalid = allInvalidIds.has(folder.id);
                      const isSelected = bulkMoveFolderDestinationId === folder.id;
                      const children = allFolders
                        .filter(f => f.parentId === folder.id && !f.isDefault)
                        .sort((a, b) => a.name.localeCompare(b.name));

                      return (
                        <div key={folder.id}>
                          <button
                            onClick={() => !isInvalid && setBulkMoveFolderDestinationId(folder.id)}
                            disabled={isInvalid}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              isInvalid 
                                ? 'text-header-muted cursor-not-allowed opacity-50' 
                                : isSelected 
                                  ? 'bg-[#5DC3F8]/20 text-[#5DC3F8] border-l-2 border-l-[#5DC3F8]' 
                                  : 'text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                            style={{ paddingLeft: `${depth * 16 + 12}px` }}
                          >
                            {isSelected ? <FolderOpen className="w-4 h-4 flex-shrink-0 text-[#5DC3F8]" /> : <FolderClosed className="w-4 h-4 flex-shrink-0" />}
                            <span className="truncate">{folder.name}</span>
                            {selectedFolderIds.has(folder.id) && (
                              <span className="text-[10px] text-header-muted ml-auto flex-shrink-0">(selected)</span>
                            )}
                            {isInvalid && !selectedFolderIds.has(folder.id) && (
                              <span className="text-[10px] text-header-muted ml-auto flex-shrink-0">(child)</span>
                            )}
                          </button>
                          {children.length > 0 && children.map(child => renderFolderOption(child, depth + 1))}
                        </div>
                      );
                    };

                    // Only show folders for profiles that have selected folders
                    const selectedProfileIds = new Set(
                      allFolders.filter(f => selectedFolderIds.has(f.id)).map(f => f.profileId)
                    );
                    const relevantFolders = allFolders.filter(f => selectedProfileIds.has(f.profileId));
                    const rootFolders = relevantFolders
                      .filter(f => !f.parentId && !f.isDefault)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    
                    return rootFolders.map(folder => renderFolderOption(folder, 1));
                  })()}
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowBulkMoveFoldersModal(false); setBulkMoveFolderDestinationId(null); }} 
                  className="flex-1 px-4 py-2.5 text-sidebar-foreground bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkMoveFolders}
                  disabled={isBulkMovingFolders}
                  className="flex-1 px-4 py-2.5 text-white bg-[#5DC3F8] hover:bg-[#4AB3E8] rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBulkMovingFolders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Move className="w-4 h-4" />} Move {selectedFolderIds.size}
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
                 <div className="bg-white dark:bg-[#1a1625] rounded-2xl p-6 sm:p-8 text-center border border-[#EC67A1]/20 mx-4">
                   <Music4 className="w-16 sm:w-20 h-16 sm:h-20 text-[#EC67A1] mx-auto mb-4" />
                   <p className="text-sidebar-foreground font-medium mb-4 text-sm sm:text-base truncate max-w-[250px] sm:max-w-none mx-auto">{previewItem.fileName}</p>
                   <audio src={previewItem.awsS3Url} controls autoPlay className="w-full" />
                 </div>
               ) : (
                 <div className="bg-white dark:bg-[#1a1625] rounded-2xl p-6 sm:p-8 text-center border border-[#EC67A1]/20 mx-4"><FileIcon className="w-16 sm:w-20 h-16 sm:h-20 text-header-muted mx-auto mb-4" /><p className="text-header-muted text-sm sm:text-base">Preview not available</p></div>
               )}
            </div>
            
            {/* Info panel - shows generation parameters */}
            {showPreviewInfo && previewItem.metadata && (
              <div className="hidden sm:block w-80 bg-white/95 dark:bg-[#1a1625]/95 backdrop-blur border border-[#EC67A1]/20 rounded-2xl p-5 overflow-y-auto max-h-[85vh] animate-slideUp">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#EC67A1]/10">
                  <div className="p-2 bg-gradient-to-br from-[#5DC3F8]/20 to-[#EC67A1]/20 rounded-lg">
                    <Wand2 className="w-5 h-5 text-[#5DC3F8]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-sidebar-foreground">Generation Info</h3>
                    <p className="text-xs text-header-muted">AI-generated content</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Generated By - show who created this content */}
                  {previewItem.metadata.generatedByName && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Generated By</label>
                      <div className="flex items-center gap-2 bg-gradient-to-r from-[#EC67A1]/10 to-[#F774B9]/10 rounded-lg p-2.5 border border-[#EC67A1]/20">
                        {previewItem.metadata.generatedByImageUrl ? (
                          <img 
                            src={previewItem.metadata.generatedByImageUrl} 
                            alt={previewItem.metadata.generatedByName}
                            className="w-7 h-7 rounded-full object-cover ring-2 ring-[#EC67A1]/30"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-[#E1518E] dark:text-[#F774B9]">
                          {previewItem.metadata.generatedByName}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Source/Type */}
                  {(previewItem.metadata.source || previewItem.metadata.generationType) && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Source</label>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#5DC3F8]" />
                        <span className="text-sm text-sidebar-foreground">
                          {previewItem.metadata.source === 'seedream-i2i' ? 'SeeDream 4.5 Image-to-Image' :
                           previewItem.metadata.source || previewItem.metadata.generationType || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Prompt */}
                  {previewItem.metadata.prompt && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Prompt</label>
                      <p className="text-sm text-sidebar-foreground bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed">
                        {previewItem.metadata.prompt}
                      </p>
                    </div>
                  )}
                  
                  {/* Resolution & Size */}
                  {(previewItem.metadata.size || previewItem.metadata.resolution) && (
                    <div className="grid grid-cols-2 gap-3">
                      {previewItem.metadata.resolution && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Resolution</label>
                          <div className="flex items-center gap-2">
                            <Maximize2 className="w-4 h-4 text-[#EC67A1]" />
                            <span className="text-sm text-sidebar-foreground">{previewItem.metadata.resolution}</span>
                          </div>
                        </div>
                      )}
                      {previewItem.metadata.size && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Dimensions</label>
                          <span className="text-sm text-sidebar-foreground">{previewItem.metadata.size}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Model */}
                  {previewItem.metadata.model && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Model</label>
                      <span className="text-sm text-sidebar-foreground">{previewItem.metadata.model}</span>
                    </div>
                  )}
                  
                  {/* Reference Images - Show in 2x2 grid with popup */}
                  {(() => {
                    // Collect all reference images from various metadata fields
                    const refImages: string[] = [];
                    if (previewItem.metadata.referenceImageUrl) refImages.push(previewItem.metadata.referenceImageUrl);
                    if (previewItem.metadata.imageUrl && !refImages.includes(previewItem.metadata.imageUrl)) refImages.push(previewItem.metadata.imageUrl);
                    if (previewItem.metadata.referenceImageUrls) refImages.push(...previewItem.metadata.referenceImageUrls.filter((url: string) => !refImages.includes(url)));
                    if (previewItem.metadata.sourceImageUrls) refImages.push(...previewItem.metadata.sourceImageUrls.filter((url: string) => !refImages.includes(url)));
                    
                    if (refImages.length === 0) return null;
                    
                    const displayedImages = showAllReferenceImages ? refImages : refImages.slice(0, 4);
                    
                    return (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Reference Image{refImages.length > 1 ? 's' : ''}</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {displayedImages.map((url, idx) => (
                            <button 
                              key={idx} 
                              onClick={() => setReferenceImagePopup(url)}
                              className="block rounded-lg overflow-hidden border border-[#EC67A1]/20 hover:border-[#EC67A1]/50 transition-all bg-zinc-100 dark:bg-zinc-800/50 p-0.5 cursor-pointer"
                              title="Click to view full size"
                            >
                              <img 
                                src={url} 
                                alt={`Reference ${idx + 1}`}
                                className="w-full h-16 object-cover rounded"
                                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                              />
                            </button>
                          ))}
                        </div>
                        {refImages.length > 4 && (
                          <button
                            onClick={() => setShowAllReferenceImages(!showAllReferenceImages)}
                            className="text-xs text-[#EC67A1] hover:text-[#F774B9] transition-colors cursor-pointer"
                          >
                            {showAllReferenceImages 
                              ? 'Show less' 
                              : `+${refImages.length - 4} more (click to view all)`
                            }
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Reference Video - Show full video with max dimensions */}
                  {previewItem.metadata.referenceVideoUrl && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Reference Video</label>
                      <a 
                        href={previewItem.metadata.referenceVideoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-[#EC67A1]/20 hover:border-[#EC67A1]/50 transition-all bg-zinc-100 dark:bg-zinc-800/50 p-1"
                        title="Click to view full size"
                      >
                        <video 
                          src={previewItem.metadata.referenceVideoUrl}
                          className="max-w-full max-h-40 w-auto h-auto mx-auto rounded object-contain"
                          muted
                          loop
                          playsInline
                          onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                          onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                        />
                      </a>
                    </div>
                  )}
                  
                  {/* Negative Prompt */}
                  {previewItem.metadata.negativePrompt && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Negative Prompt</label>
                      <p className="text-sm text-header-muted bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 max-h-24 overflow-y-auto">
                        {previewItem.metadata.negativePrompt}
                      </p>
                    </div>
                  )}
                  
                  {/* Advanced params */}
                  {(previewItem.metadata.steps || previewItem.metadata.cfgScale || previewItem.metadata.seed) && (
                    <div className="grid grid-cols-2 gap-3">
                      {previewItem.metadata.steps && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Steps</label>
                          <span className="text-sm text-sidebar-foreground">{previewItem.metadata.steps}</span>
                        </div>
                      )}
                      {previewItem.metadata.cfgScale && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-header-muted uppercase tracking-wider">CFG Scale</label>
                          <span className="text-sm text-sidebar-foreground">{previewItem.metadata.cfgScale}</span>
                        </div>
                      )}
                      {previewItem.metadata.seed && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Seed</label>
                          <span className="text-xs text-sidebar-foreground font-mono">{previewItem.metadata.seed}</span>
                        </div>
                      )}
                      {previewItem.metadata.sampler && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Sampler</label>
                          <span className="text-sm text-sidebar-foreground">{previewItem.metadata.sampler}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Generated At */}
                  {previewItem.metadata.generatedAt && (
                    <div className="space-y-1 pt-2 border-t border-[#EC67A1]/10">
                      <label className="text-xs font-medium text-header-muted uppercase tracking-wider">Generated</label>
                      <span className="text-sm text-header-muted">
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
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-white/80 dark:bg-[#1a1625]/80 backdrop-blur border border-[#EC67A1]/20 rounded-full px-3 sm:px-6 py-2 sm:py-3 max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sidebar-foreground text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[200px]">{previewItem.fileName}</span>
            <span className="text-header-muted text-xs sm:text-sm hidden sm:inline">{formatFileSize(previewItem.fileSize)}</span>
            {/* Info button - only show if metadata exists */}
            {previewItem.metadata && (
              <button 
                onClick={() => setShowPreviewInfo(!showPreviewInfo)} 
                className={`p-1.5 sm:p-2 rounded-full transition-colors hidden sm:block ${showPreviewInfo ? 'bg-[#5DC3F8]/30 text-[#5DC3F8]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                title="View generation info"
              >
                <Info className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              </button>
            )}
            {/* Reuse in SeeDream I2I button - only for seedream-i2i source items */}
            {previewItem.metadata?.source === 'seedream-i2i' && (
              <button 
                onClick={() => handleReuseInSeeDreamI2I(previewItem)}
                className="p-1.5 sm:p-2 bg-[#5DC3F8]/20 hover:bg-[#5DC3F8]/30 rounded-full transition-colors"
                title="Reuse settings in SeeDream I2I"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#5DC3F8]" />
              </button>
            )}
            {/* Reuse in SeeDream T2I button - only for seedream-t2i source items */}
            {previewItem.metadata?.source === 'seedream-t2i' && (
              <button 
                onClick={() => handleReuseInSeeDreamT2I(previewItem)}
                className="p-1.5 sm:p-2 bg-[#5DC3F8]/20 hover:bg-[#5DC3F8]/30 rounded-full transition-colors"
                title="Reuse settings in SeeDream T2I"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#5DC3F8]" />
              </button>
            )}
            {/* Reuse in FLUX T2I button - only for flux-t2i source items */}
            {previewItem.metadata?.source === 'flux-t2i' && (
              <button 
                onClick={() => handleReuseInFluxT2I(previewItem)}
                className="p-1.5 sm:p-2 bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 rounded-full transition-colors"
                title="Reuse settings in FLUX T2I"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#EC67A1]" />
              </button>
            )}
            {/* Reuse in FLUX Style Transfer button - only for flux-style-transfer source items */}
            {previewItem.metadata?.source === 'flux-style-transfer' && (
              <button 
                onClick={() => handleReuseInFluxStyleTransfer(previewItem)}
                className="p-1.5 sm:p-2 bg-[#F774B9]/20 hover:bg-[#F774B9]/30 rounded-full transition-colors"
                title="Reuse settings in FLUX Style Transfer"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#F774B9]" />
              </button>
            )}
            {/* Reuse in SeeDream T2V button - only for seedream-t2v source items */}
            {previewItem.metadata?.source === 'seedream-t2v' && (
              <button 
                onClick={() => handleReuseInSeeDreamT2V(previewItem)}
                className="p-1.5 sm:p-2 bg-[#5DC3F8]/20 hover:bg-[#5DC3F8]/30 rounded-full transition-colors"
                title="Reuse settings in SeeDream T2V"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#5DC3F8]" />
              </button>
            )}
            {/* Reuse in SeeDream I2V button - only for seedream-i2v source items */}
            {previewItem.metadata?.source === 'seedream-i2v' && (
              <button 
                onClick={() => handleReuseInSeeDreamI2V(previewItem)}
                className="p-1.5 sm:p-2 bg-[#5DC3F8]/20 hover:bg-[#5DC3F8]/30 rounded-full transition-colors"
                title="Reuse settings in SeeDream I2V"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#5DC3F8]" />
              </button>
            )}
            {/* Reuse in Kling T2V button - only for kling-t2v source items */}
            {previewItem.metadata?.source === 'kling-t2v' && (
              <button 
                onClick={() => handleReuseInKlingT2V(previewItem)}
                className="p-1.5 sm:p-2 bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 rounded-full transition-colors"
                title="Reuse settings in Kling T2V"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#EC67A1]" />
              </button>
            )}
            {/* Reuse in Kling I2V button - only for kling-i2v source items */}
            {previewItem.metadata?.source === 'kling-i2v' && (
              <button 
                onClick={() => handleReuseInKlingI2V(previewItem)}
                className="p-1.5 sm:p-2 bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 rounded-full transition-colors"
                title="Reuse settings in Kling I2V"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#EC67A1]" />
              </button>
            )}
            {/* Reuse in Kling Motion Control button - only for kling-motion-control source items */}
            {previewItem.metadata?.source === 'kling-motion-control' && (
              <button 
                onClick={() => handleReuseInKlingMotionControl(previewItem)}
                className="p-1.5 sm:p-2 bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 rounded-full transition-colors"
                title="Reuse settings in Kling Motion Control"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#EC67A1]" />
              </button>
            )}
            {/* Reuse in Kling Multi-I2V button - only for kling-multi-i2v source items */}
            {previewItem.metadata?.source === 'kling-multi-i2v' && (
              <button 
                onClick={() => handleReuseInKlingMultiI2V(previewItem)}
                className="p-1.5 sm:p-2 bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 rounded-full transition-colors"
                title="Reuse settings in Kling Multi-Image to Video"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#EC67A1]" />
              </button>
            )}
            {/* Reuse in Wan T2V button - only for wan-t2v source items */}
            {previewItem.metadata?.source === 'wan-t2v' && (
              <button 
                onClick={() => handleReuseInWanT2V(previewItem)}
                className="p-1.5 sm:p-2 bg-[#F774B9]/20 hover:bg-[#F774B9]/30 rounded-full transition-colors"
                title="Reuse settings in Text to Video Studio"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#F774B9]" />
              </button>
            )}
            <button onClick={(e) => handleDownloadSingleFile(previewItem, e)} className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors" title="Download"><Download className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white" /></button>
            {canEdit && <button onClick={() => { handleDeleteItem(previewItem.id); setPreviewItem(null); setShowPreviewInfo(false); }} className="p-1.5 sm:p-2 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-colors"><Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-red-500 dark:text-red-400" /></button>}
          </div>
        </div>,
        document.body
      )}

      {/* Share Modal */}
      {showShareModal && folderToShare && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowShareModal(false); setFolderToShare(null); setSelectedUserToShare(null); setUserSearchQuery(''); setShareNote(''); }} />
          <div className="relative bg-white dark:bg-[#1a1625] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-slideUp border-t sm:border border-[#EC67A1]/20">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#EC67A1]/10">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-sidebar-foreground">Share Folder</h3>
                <p 
                  className="text-xs sm:text-sm text-header-muted truncate max-w-[200px] sm:max-w-none" 
                  title={folderToShare.name}
                >
                  {folderToShare.name}
                </p>
              </div>
              <button onClick={() => { setShowShareModal(false); setFolderToShare(null); setSelectedUserToShare(null); setUserSearchQuery(''); setShareNote(''); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"><X className="w-5 h-5 text-header-muted" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(85vh-120px)] sm:max-h-[calc(90vh-120px)] vault-scroll">
              {shareModalLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#5DC3F8]" /></div>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-sidebar-foreground">Share with user</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-header-muted" />
                      <input type="text" placeholder="Search users..." value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-[#EC67A1]/20 rounded-lg text-sidebar-foreground placeholder-header-muted focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1]" />
                    </div>
                    <div className="max-h-32 overflow-y-auto border border-[#EC67A1]/20 rounded-lg vault-scroll">
                      {availableUsers.filter(user => { const q = userSearchQuery.toLowerCase(); return user.displayName.toLowerCase().includes(q) || (user.email?.toLowerCase().includes(q) ?? false); }).filter(user => !currentShares.some(s => s.sharedWithClerkId === user.clerkId)).slice(0, 10).map(user => (
                        <button key={user.clerkId} onClick={() => setSelectedUserToShare(user)} className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selectedUserToShare?.clerkId === user.clerkId ? 'bg-[#5DC3F8]/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5DC3F8] to-[#EC67A1] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">{user.displayName.charAt(0).toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <p 
                              className="text-sm font-medium text-sidebar-foreground truncate" 
                              title={user.displayName}
                            >
                              {user.displayName}
                            </p>
                            {user.email && <p className="text-xs text-header-muted truncate" title={user.email}>{user.email}</p>}
                          </div>
                          {selectedUserToShare?.clerkId === user.clerkId && <Check className="w-5 h-5 text-[#5DC3F8] flex-shrink-0" />}
                        </button>
                      ))}
                      {availableUsers.length === 0 && <p className="text-center py-4 text-header-muted text-sm">No users available</p>}
                    </div>
                    {selectedUserToShare && (
                      <>
                        <div className="flex gap-2">
                          <button onClick={() => setSharePermission('VIEW')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sharePermission === 'VIEW' ? 'bg-[#5DC3F8]/20 text-[#5DC3F8] border border-[#5DC3F8]' : 'bg-zinc-100 dark:bg-zinc-800 text-header-muted hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><Eye className="w-4 h-4" /> View only</button>
                          <button onClick={() => setSharePermission('EDIT')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sharePermission === 'EDIT' ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500' : 'bg-zinc-100 dark:bg-zinc-800 text-header-muted hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><Edit2 className="w-4 h-4" /> Can edit</button>
                        </div>
                        <input type="text" placeholder="Add a note (optional)" value={shareNote} onChange={(e) => setShareNote(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-[#EC67A1]/20 rounded-lg text-sidebar-foreground placeholder-header-muted focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1]" />
                        <button onClick={handleShareFolder} disabled={shareModalLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EC67A1] hover:bg-[#E1518E] text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                          {shareModalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share with {selectedUserToShare.displayName}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="pt-4 border-t border-[#EC67A1]/10">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-sidebar-foreground">Currently shared with</label>
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-header-muted px-2 py-1 rounded-full">{currentShares.length}</span>
                    </div>
                    {currentShares.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-[#EC67A1]/20 rounded-lg"><Users className="w-8 h-8 text-header-muted mx-auto mb-2" /><p className="text-sm text-header-muted">Not shared yet</p></div>
                    ) : (
                      <div className="space-y-2">
                        {currentShares.map((share) => (
                          <div key={share.id} className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5DC3F8] to-[#EC67A1] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">{share.sharedWithUser?.displayName?.charAt(0).toUpperCase() || '?'}</div>
                              <div className="flex-1 min-w-0">
                                <p 
                                  className="text-sm font-medium text-sidebar-foreground truncate" 
                                  title={share.sharedWithUser?.displayName || share.sharedWithClerkId}
                                >
                                  {share.sharedWithUser?.displayName || share.sharedWithClerkId}
                                </p>
                                {share.sharedWithUser?.email && <p className="text-xs text-header-muted truncate" title={share.sharedWithUser.email}>{share.sharedWithUser.email}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs px-2 py-1 rounded-full ${share.permission === 'EDIT' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-[#5DC3F8]/20 text-[#5DC3F8]'}`}>{share.permission}</span>
                              <button onClick={() => handleRemoveShare(share.sharedWithClerkId, share.sharedWithUser?.displayName || 'User')} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" /></button>
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
      <div className="h-[calc(100vh-120px)] sm:h-[calc(100vh-120px)] flex bg-white dark:bg-[#0a0a0f] rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 shadow-lg overflow-hidden relative">
        {/* Background ambient effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-[#EC67A1]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#F774B9]/5 rounded-full blur-3xl" />
        </div>

        {/* Sidebar */}
        <div 
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50 lg:z-auto h-full bg-zinc-50/95 dark:bg-[#1a1625]/95 backdrop-blur border-r border-[#EC67A1]/10 flex flex-col rounded-l-2xl overflow-hidden ${
            isResizingSidebar ? '' : 'transition-transform duration-300 ease-in-out'
          } relative`}
          style={{ 
            width: `${sidebarWidth}px`,
            minWidth: `${minSidebarWidth}px`,
            maxWidth: `${maxSidebarWidth}px`,
            transition: isResizingSidebar ? 'none' : undefined,
          }}
        >
          <div className="p-5 border-b border-[#EC67A1]/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#EC67A1] to-[#F774B9] rounded-xl flex items-center justify-center shadow-lg shadow-[#EC67A1]/25">
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-sidebar-foreground">Media Vault</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                <PanelLeftClose className="w-5 h-5 text-header-muted" />
              </button>
            </div>
          </div>

          {/* Admin View Mode Toggle */}
          {isAdmin && !adminLoading && (
            <div className="px-4 py-3 border-b border-[#EC67A1]/10">
              <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl">
                <button
                  onClick={() => { setAdminViewMode('personal'); setSelectedContentCreator(null); setSelectedCreatorFolderId(null); setCreatorFolders([]); setCreatorProfiles([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    adminViewMode === 'personal'
                      ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-lg shadow-[#EC67A1]/25'
                      : 'text-header-muted hover:text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  <span>My Vault</span>
                </button>
                <button
                  onClick={() => setAdminViewMode('creators')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    adminViewMode === 'creators'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25'
                      : 'text-header-muted hover:text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                  <span>Creators</span>
                </button>
              </div>
            </div>
          )}

          {/* Content Creator Selection (Admin only) */}
          {isAdmin && adminViewMode === 'creators' && (
            <div className="px-4 py-3 border-b border-[#EC67A1]/10">
              <label className="text-xs font-semibold text-header-muted uppercase tracking-wider mb-2 block">Content Creators</label>
              <select
                value={selectedContentCreator?.id || 'all'}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedCreatorFolderId(null); // Reset folder selection when changing creators
                  if (value === 'all') {
                    setSelectedContentCreator(null);
                    setCreatorFolders([]);
                    setCreatorProfiles([]);
                    loadContentCreatorItems();
                  } else {
                    const creator = contentCreators.find(c => c.id === value);
                    if (creator) {
                      setSelectedContentCreator(creator);
                      loadContentCreatorItems(creator.id);
                    }
                  }
                }}
                className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-[#EC67A1]/20 rounded-xl text-sm text-sidebar-foreground focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1] transition-colors [&>option]:bg-white [&>option]:dark:bg-zinc-800 [&>option]:text-sidebar-foreground"
              >
                <option value="all" className="bg-white dark:bg-zinc-800 text-sidebar-foreground">All Content Creators ({contentCreators.length})</option>
                {contentCreators.map((creator) => (
                  <option key={creator.id} value={creator.id} className="bg-white dark:bg-zinc-800 text-sidebar-foreground">
                    {`${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email || 'Unknown'}
                  </option>
                ))}
              </select>
              {contentCreators.length === 0 && !loadingCreatorItems && (
                <p className="text-xs text-header-muted mt-2">No content creators found</p>
              )}
            </div>
          )}

          {/* Current Profile Display - controlled by global sidebar selector */}
          {adminViewMode === 'personal' && selectedProfileId && (
            <div className="px-4 py-3 border-b border-[#EC67A1]/10">
              <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl">
                {isAllProfiles ? (
                  <>
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span 
                        className="text-sm font-medium text-sidebar-foreground truncate block" 
                        title="All Profiles"
                      >
                        All Profiles
                      </span>
                      <span className="text-[10px] text-header-muted">{profiles.length} profile{profiles.length !== 1 ? 's' : ''}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 bg-gradient-to-br from-[#EC67A1] to-[#F774B9] rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-white">{selectedProfile?.name?.charAt(0) || '?'}</span>
                    </div>
                    <span 
                      className="text-sm font-medium text-sidebar-foreground truncate flex-1 min-w-0" 
                      title={selectedProfile?.name}
                    >
                      {selectedProfile?.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto vault-scroll p-4">
            {adminViewMode === 'personal' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-header-muted uppercase tracking-wider">Folders</span>
                  <div className="flex items-center gap-1">
                    {folderSelectionMode && selectedFolderIds.size > 0 && (
                      <button
                        onClick={() => setShowBulkMoveFoldersModal(true)}
                        className="px-2 py-1 text-[10px] font-medium bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white rounded-lg hover:opacity-90 transition-opacity"
                        title={`Move ${selectedFolderIds.size} selected folder(s)`}
                      >
                        Move {selectedFolderIds.size}
                      </button>
                    )}
                    <button
                      onClick={toggleFolderSelectionMode}
                      className={`p-1.5 rounded-lg transition-colors ${folderSelectionMode ? 'bg-[#EC67A1]/20 text-[#EC67A1]' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-header-muted'}`}
                      title={folderSelectionMode ? 'Cancel selection' : 'Select folders to move'}
                      disabled={!selectedProfileId || isAllProfiles}
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowNewFolderInput(true)} disabled={!selectedProfileId || isAllProfiles} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50" title={isAllProfiles ? 'Select a specific profile to create folders' : undefined}>
                      <Plus className="w-4 h-4 text-header-muted" />
                    </button>
                  </div>
                </div>

                {showNewFolderInput && (
                  <div className="mb-3">
                    {parentFolderForNew && (
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-header-muted mb-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg border border-[#EC67A1]/10">
                        <FolderOpen className="w-3.5 h-3.5 text-[#EC67A1] flex-shrink-0" />
                        <span className="flex-shrink-0">Creating subfolder in:</span>
                        <span 
                          className="font-medium text-[#EC67A1] truncate" 
                          title={visibleFolders.find(f => f.id === parentFolderForNew)?.name}
                        >
                          {visibleFolders.find(f => f.id === parentFolderForNew)?.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input type="text" value={folderNameInput} onChange={(e) => setFolderNameInput(e.target.value)} placeholder="Folder name" onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()} autoFocus className="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 border border-[#EC67A1]/20 rounded-xl text-sidebar-foreground placeholder-header-muted focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1]" />
                      <button onClick={handleCreateFolder} disabled={!folderNameInput.trim()} className="p-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white rounded-xl disabled:opacity-50"><Check className="w-4 h-4" /></button>
                      <button onClick={() => { setShowNewFolderInput(false); setFolderNameInput(''); setParentFolderForNew(null); }} className="p-2 bg-zinc-200 dark:bg-zinc-700 text-header-muted rounded-xl"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {/* Group folders by profile when viewing all profiles */}
                  {isAllProfiles ? (
                    // Group folders by profile - owned profiles first, then shared
                    (() => {
                      // Separate owned and shared profiles based on folder ownership info
                      const ownedProfiles: typeof profiles = [];
                      const sharedProfiles: typeof profiles = [];
                      
                      for (const profile of profiles) {
                        const profileFolders = visibleFolders.filter(f => f.profileId === profile.id);
                        if (profileFolders.length === 0) continue;
                        
                        // Check if any folder for this profile is owned by current user
                        const isOwned = profileFolders.some(f => f.isOwnedProfile === true);
                        if (isOwned) {
                          ownedProfiles.push(profile);
                        } else {
                          sharedProfiles.push(profile);
                        }
                      }
                      
                      const sortedProfiles = [...ownedProfiles, ...sharedProfiles];
                      
                      return sortedProfiles.map(profile => {
                        const profileFolders = visibleFolders.filter(f => f.profileId === profile.id);
                        if (profileFolders.length === 0) return null;
                        
                        // Determine if this is an owned or shared profile
                        const isOwned = profileFolders.some(f => f.isOwnedProfile === true);
                        const ownerName = !isOwned ? profileFolders[0]?.ownerName : null;
                        
                        // Get root folders for this profile (folders without a parent)
                        const rootFolders = profileFolders
                          .filter(f => !f.parentId)
                          .sort((a, b) => {
                            // Default folders (All Media) always first
                            if (a.isDefault && !b.isDefault) return -1;
                            if (!a.isDefault && b.isDefault) return 1;
                            // Then alphabetical
                            return a.name.localeCompare(b.name);
                          });
                        
                        return (
                          <div key={profile.id} className="mb-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-header-muted border-b border-[#EC67A1]/10 mb-1">
                              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${isOwned ? 'bg-gradient-to-br from-[#EC67A1]/50 to-[#F774B9]/50' : 'bg-gradient-to-br from-amber-500/50 to-orange-500/50'}`}>
                                <span className="text-[10px] font-medium text-white">{profile.name?.charAt(0) || '?'}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span 
                                    className="font-medium truncate" 
                                    title={profile.name}
                                  >
                                    {profile.name}
                                  </span>
                                  {profile.instagramUsername && (
                                    <span 
                                      className="text-header-muted flex-shrink-0" 
                                      title={`@${profile.instagramUsername}`}
                                    >
                                      @{profile.instagramUsername}
                                    </span>
                                  )}
                                </div>
                                {!isOwned && ownerName && (
                                  <div 
                                    className="text-[10px] text-amber-500 mt-0.5 truncate" 
                                    title={`Shared by ${ownerName}`}
                                  >
                                    Shared by {ownerName}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1 pl-2">
                              {rootFolders.map((folder) => (
                                <FolderTreeItem
                                  key={folder.id}
                                  folder={folder}
                                  level={0}
                                  isActive={folder.id === selectedFolderId && !selectedSharedFolder && adminViewMode === 'personal'}
                                  isExpanded={expandedFolders.has(folder.id)}
                                  expandedFolders={expandedFolders}
                                  allFolders={profileFolders}
                                  vaultItems={vaultItems}
                                  selectedProfileId={selectedProfileId}
                                  selectedFolderId={selectedFolderId}
                                  editingFolderId={editingFolderId}
                                  editingFolderName={editingFolderName}
                                  onToggleExpand={toggleFolderExpand}
                                  onSelectFolder={(id) => { setSelectedFolderId(id); setSelectedSharedFolder(null); setSharedFolderItems([]); setSidebarOpen(false); setAdminViewMode('personal'); }}
                                  onEditFolder={startEditFolder}
                                  onUpdateFolder={handleUpdateFolder}
                                  onCancelEdit={() => { setEditingFolderId(null); setEditingFolderName(''); }}
                                  setEditingFolderName={setEditingFolderName}
                                  onOpenShareModal={handleOpenShareModal}
                                  onDeleteFolder={handleDeleteFolder}
                                  onCreateSubfolder={startCreateSubfolder}
                                  onMoveFolder={startMoveFolder}
                                  onDropFolder={handleDropFolderOnFolder}
                                  folderSelectionMode={folderSelectionMode}
                                  selectedFolderIds={selectedFolderIds}
                                  onToggleFolderSelection={toggleFolderSelection}
                                  setSidebarOpen={setSidebarOpen}
                                  setAdminViewMode={setAdminViewMode}
                                  setSelectedSharedFolder={setSelectedSharedFolder}
                                  setSharedFolderItems={setSharedFolderItems}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    // Single profile view - tree structure for nested folders
                    (() => {
                      // Get root folders (folders without a parent)
                      const rootFolders = visibleFolders
                        .filter(f => !f.parentId)
                        .sort((a, b) => {
                          // Default folders (All Media) always first
                          if (a.isDefault && !b.isDefault) return -1;
                          if (!a.isDefault && b.isDefault) return 1;
                          // Then alphabetical
                          return a.name.localeCompare(b.name);
                        });
                      
                      return rootFolders.map((folder) => (
                        <FolderTreeItem
                          key={folder.id}
                          folder={folder}
                          level={0}
                          isActive={folder.id === selectedFolderId && !selectedSharedFolder && adminViewMode === 'personal'}
                          isExpanded={expandedFolders.has(folder.id)}
                          expandedFolders={expandedFolders}
                          allFolders={visibleFolders}
                          vaultItems={vaultItems}
                          selectedProfileId={selectedProfileId}
                          selectedFolderId={selectedFolderId}
                          editingFolderId={editingFolderId}
                          editingFolderName={editingFolderName}
                          onToggleExpand={toggleFolderExpand}
                          onSelectFolder={(id) => { setSelectedFolderId(id); setSelectedSharedFolder(null); setSharedFolderItems([]); setSidebarOpen(false); setAdminViewMode('personal'); }}
                          onEditFolder={startEditFolder}
                          onUpdateFolder={handleUpdateFolder}
                          onCancelEdit={() => { setEditingFolderId(null); setEditingFolderName(''); }}
                          setEditingFolderName={setEditingFolderName}
                          onOpenShareModal={handleOpenShareModal}
                          onDeleteFolder={handleDeleteFolder}
                          onCreateSubfolder={startCreateSubfolder}
                          onMoveFolder={startMoveFolder}
                          onDropFolder={handleDropFolderOnFolder}
                          folderSelectionMode={folderSelectionMode}
                          selectedFolderIds={selectedFolderIds}
                          onToggleFolderSelection={toggleFolderSelection}
                          setSidebarOpen={setSidebarOpen}
                          setAdminViewMode={setAdminViewMode}
                          setSelectedSharedFolder={setSelectedSharedFolder}
                          setSharedFolderItems={setSharedFolderItems}
                        />
                      ));
                    })()
                  )}
                </div>

                {sharedFolders.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold text-header-muted uppercase tracking-wider">Shared with me</span>
                      <span className="text-xs bg-[#EC67A1]/20 text-[#EC67A1] px-2 py-0.5 rounded-full">{sharedFolders.length}</span>
                    </div>
                    <div className="space-y-1">
                      {sharedFolders.map((shared) => {
                        const isActive = selectedSharedFolder?.folderId === shared.folderId && adminViewMode === 'personal';
                        return (
                          <button key={shared.id} onClick={() => { loadSharedFolderItems(shared); setSidebarOpen(false); setAdminViewMode('personal'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive ? 'bg-gradient-to-r from-[#EC67A1]/20 to-[#F774B9]/20 text-[#EC67A1] border border-[#EC67A1]/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-header-muted border border-transparent'}`}>
                            <Users className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#EC67A1]' : 'text-header-muted'}`} />
                            <div className="flex-1 min-w-0 text-left">
                              <span 
                                className="text-sm font-medium truncate block" 
                                title={shared.folderName}
                              >
                                {shared.folderName}
                              </span>
                              <span 
                                className="text-xs text-header-muted truncate block" 
                                title={`From ${shared.sharedBy}`}
                              >
                                From {shared.sharedBy}
                              </span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${shared.permission === 'EDIT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700 text-header-muted'}`}>{shared.permission === 'EDIT' ? 'Edit' : 'View'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Admin Creator View - Stats */}
            {isAdmin && adminViewMode === 'creators' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-header-muted uppercase tracking-wider mb-3">Creator Stats</div>
                {selectedContentCreator ? (
                  <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-[#EC67A1]/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <UserCheck className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p 
                          className="text-sm font-medium text-sidebar-foreground truncate" 
                          title={`${selectedContentCreator.firstName || ''} ${selectedContentCreator.lastName || ''}`.trim() || 'Unknown'}
                        >
                          {`${selectedContentCreator.firstName || ''} ${selectedContentCreator.lastName || ''}`.trim() || 'Unknown'}
                        </p>
                        <p 
                          className="text-xs text-header-muted truncate" 
                          title={selectedContentCreator.email || 'No email'}
                        >
                          {selectedContentCreator.email || 'No email'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-zinc-200 dark:bg-zinc-700/50 rounded-lg text-center">
                        <p className="text-lg font-semibold text-sidebar-foreground">{contentCreatorItems.filter(i => i.creatorId === selectedContentCreator.id).length}</p>
                        <p className="text-xs text-header-muted">Items</p>
                      </div>
                      <div className="p-2 bg-zinc-200 dark:bg-zinc-700/50 rounded-lg text-center">
                        <p className="text-lg font-semibold text-sidebar-foreground">{formatFileSize(contentCreatorItems.filter(i => i.creatorId === selectedContentCreator.id).reduce((acc, i) => acc + i.fileSize, 0))}</p>
                        <p className="text-xs text-header-muted">Total Size</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-[#EC67A1]/10">
                    <p className="text-sm text-header-muted mb-2">All Creators</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-zinc-200 dark:bg-zinc-700/50 rounded-lg text-center">
                        <p className="text-lg font-semibold text-sidebar-foreground">{creatorTotalItems}</p>
                        <p className="text-xs text-header-muted">Total Items</p>
                      </div>
                      <div className="p-2 bg-zinc-200 dark:bg-zinc-700/50 rounded-lg text-center">
                        <p className="text-lg font-semibold text-sidebar-foreground">{formatFileSize(creatorTotalSize)}</p>
                        <p className="text-xs text-header-muted">Total Size</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-header-muted">
                      <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {creatorImageCount}</span>
                      <span className="flex items-center gap-1"><VideoIcon className="w-3 h-3" /> {creatorVideoCount}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {contentCreators.length} creators</span>
                    </div>
                  </div>
                )}

                {/* Creator Folders - shown when a specific creator is selected */}
                {selectedContentCreator && creatorFolders.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-header-muted uppercase tracking-wider">Creator Folders</span>
                      <span className="text-xs bg-[#EC67A1]/20 text-[#EC67A1] px-2 py-0.5 rounded-full">{creatorFolders.length}</span>
                    </div>
                    
                    {/* All Items option */}
                    <button
                      onClick={() => { setSelectedCreatorFolderId(null); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-1 ${
                        !selectedCreatorFolderId 
                          ? 'bg-gradient-to-r from-[#EC67A1]/20 to-[#F774B9]/20 text-[#EC67A1] border border-[#EC67A1]/30' 
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-header-muted border border-transparent'
                      }`}
                    >
                      <Folder className={`w-4 h-4 ${!selectedCreatorFolderId ? 'text-[#EC67A1]' : 'text-header-muted'}`} />
                      <span className="flex-1 text-sm font-medium text-left">All Items</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${!selectedCreatorFolderId ? 'bg-[#EC67A1]/30 text-[#EC67A1]' : 'bg-zinc-200 dark:bg-zinc-700 text-header-muted'}`}>
                        {contentCreatorItems.filter(i => i.creatorId === selectedContentCreator.id).length}
                      </span>
                    </button>

                    {/* Group folders by profile */}
                    {creatorProfiles.map(profile => {
                      const profileFolders = creatorFolders.filter(f => f.profileId === profile.id);
                      if (profileFolders.length === 0) return null;
                      
                      return (
                        <div key={profile.id} className="mb-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-header-muted">
                            <span className="truncate">{profile.name}</span>
                            {profile.instagramUsername && (
                              <span className="text-header-muted">@{profile.instagramUsername}</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {profileFolders.map((folder) => {
                              const isActive = selectedCreatorFolderId === folder.id;
                              return (
                                <button
                                  key={folder.id}
                                  onClick={() => { setSelectedCreatorFolderId(folder.id); setSidebarOpen(false); }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                    isActive 
                                      ? 'bg-gradient-to-r from-[#EC67A1]/20 to-[#F774B9]/20 text-[#EC67A1] border border-[#EC67A1]/30' 
                                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-header-muted border border-transparent'
                                  }`}
                                >
                                  {isActive ? <FolderOpen className="w-4 h-4" /> : <FolderClosed className="w-4 h-4" />}
                                  <span className="flex-1 text-sm font-medium text-left truncate">{folder.name}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-[#EC67A1]/30 text-[#EC67A1]' : 'bg-zinc-200 dark:bg-zinc-700 text-header-muted'}`}>
                                    {folder.itemCount}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Storage Stats Footer */}
          {adminViewMode === 'personal' && selectedProfileId && (
            <div className="p-4 border-t border-[#EC67A1]/10">
              <div className="text-xs text-header-muted mb-2">
                {isAllProfiles ? 'Total storage (all profiles)' : 'Storage used'}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold text-sidebar-foreground">{formatFileSize(totalSize)}</span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-header-muted">
                <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {imageCount}</span>
                <span className="flex items-center gap-1"><VideoIcon className="w-3 h-3" /> {videoCount}</span>
                <span className="flex items-center gap-1"><FileIcon className="w-3 h-3" /> {totalItems}</span>
                {isAllProfiles && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {profiles.length} profiles</span>}
              </div>
            </div>
          )}

          {/* Resize Handle */}
          <div
            className={`hidden lg:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize group z-10 ${
              isResizingSidebar ? 'bg-[#EC67A1]/50' : 'bg-transparent hover:bg-[#EC67A1]/30'
            }`}
            onMouseDown={handleMouseDownResize}
            style={{
              userSelect: 'none',
              right: '-1px', // Slightly overlap the border
            }}
            title="Drag to resize sidebar"
          >
            {/* Visible indicator on hover */}
            <div className={`absolute top-1/2 -translate-y-1/2 left-0 w-full h-20 transition-all ${
              isResizingSidebar 
                ? 'bg-gradient-to-b from-[#EC67A1]/50 via-[#EC67A1] to-[#EC67A1]/50' 
                : 'bg-gradient-to-b from-[#EC67A1]/0 via-[#EC67A1]/30 to-[#EC67A1]/0 group-hover:via-[#EC67A1]/60'
            }`} />
            
            {/* Grip dots indicator */}
            <div className={`absolute top-1/2 -translate-y-1/2 left-0.5 flex flex-col gap-1 transition-opacity ${
              isResizingSidebar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <div className="w-0.5 h-0.5 rounded-full bg-[#F774B9]" />
              <div className="w-0.5 h-0.5 rounded-full bg-[#F774B9]" />
              <div className="w-0.5 h-0.5 rounded-full bg-[#F774B9]" />
            </div>
            
            {/* Extended hover area for easier grabbing */}
            <div className="absolute inset-y-0 -left-2 -right-2 w-6" />
          </div>
        </div>

        {/* Resize Overlay - prevents interaction during resize */}
        {isResizingSidebar && (
          <div className="fixed inset-0 z-40 bg-black/5" style={{ cursor: 'col-resize' }} />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden w-full relative">
          <div className="bg-zinc-50/95 dark:bg-[#1a1625]/95 backdrop-blur border-b border-[#EC67A1]/10 px-4 sm:px-6 py-3 sm:py-4">
            {/* Mobile header row */}
            <div className="flex items-center gap-3 lg:hidden mb-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-xl transition-colors">
                <Menu className="w-5 h-5 text-header-muted" />
              </button>
              <h1 className="text-lg font-semibold text-sidebar-foreground truncate flex-1">
                {isViewingCreators 
                  ? (selectedContentCreator 
                      ? `${selectedContentCreator.firstName || ''} ${selectedContentCreator.lastName || ''}`.trim() || 'Creator Files'
                      : 'All Creator Files')
                  : isAllProfiles 
                    ? (selectedFolder ? `${selectedFolder.name}` : 'All Profiles')
                    : (selectedFolder?.name || 'Select a folder')}
              </h1>
              {!isViewingShared && !isViewingCreators && (
                <button onClick={() => setIsAddingNew(true)} disabled={!selectedProfileId || selectedProfileId === 'all' || !selectedFolderId} className="p-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-[#EC67A1]/25" title={selectedProfileId === 'all' ? 'Select a specific profile to upload' : undefined}>
                  <Upload className="w-5 h-5" />
                </button>
              )}
              {/* Mobile Export button */}
              {vaultItems.filter(item => item.fileType.startsWith('image/')).length > 0 && (
                <button
                  onClick={() => setShowExportModal(true)}
                  className="p-2 bg-[#5DC3F8] hover:bg-[#4ab3e8] text-white rounded-lg transition-colors"
                  title="Platform Export"
                >
                  <FileOutput className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Desktop header row */}
            <div className="hidden lg:flex items-center justify-between gap-1.5 xl:gap-3">
              <div className="flex-shrink min-w-0 max-w-[30%] xl:max-w-none">
                <h1 className="text-sm xl:text-xl font-semibold text-sidebar-foreground truncate">
                  {isViewingCreators 
                    ? (selectedContentCreator 
                        ? `${selectedContentCreator.firstName || ''} ${selectedContentCreator.lastName || ''}`.trim() || 'Creator Files'
                        : 'All Creator Files')
                    : isAllProfiles 
                      ? (selectedFolder ? `${selectedFolder.name} (${getProfileNameForFolder(selectedFolder.profileId)})` : 'All Profiles')
                      : (selectedFolder?.name || 'Select a folder')}
                </h1>
                {isAllProfiles && !selectedFolder && (
                  <p className="text-xs xl:text-sm text-header-muted flex items-center gap-1 mt-0.5 hidden xl:flex">
                    <Users className="w-3.5 h-3.5" /> Viewing all {profiles.length} profiles
                  </p>
                )}
                {isViewingShared && selectedSharedFolder && (
                  <p className="text-xs xl:text-sm text-header-muted flex items-center gap-1 mt-0.5 hidden xl:flex">
                    <Share2 className="w-3.5 h-3.5" /> Shared by {selectedSharedFolder.sharedBy}
                    {!canEdit && <span className="text-amber-500 ml-2">(View only)</span>}
                  </p>
                )}
                {isViewingCreators && (
                  <p className="text-xs xl:text-sm text-header-muted flex items-center gap-1 mt-0.5 hidden xl:flex">
                    <Crown className="w-3.5 h-3.5 text-amber-500" /> 
                    Content Creator Generations
                    <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full ml-2">Admin View</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 xl:gap-3 flex-shrink-0">
                <div className="relative w-24 xl:w-64">
                  <Search className="absolute left-2 xl:left-3 top-1/2 -translate-y-1/2 w-3.5 xl:w-4 h-3.5 xl:h-4 text-header-muted" />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-7 xl:pl-9 pr-2 xl:pr-4 py-1.5 xl:py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-[#EC67A1]/20 rounded-lg xl:rounded-xl text-xs xl:text-sm text-sidebar-foreground placeholder-header-muted focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1] transition-colors" />
                </div>
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg xl:rounded-xl p-0.5 xl:p-1 border border-[#EC67A1]/20">
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 xl:p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-lg shadow-[#EC67A1]/25' : 'text-header-muted hover:text-sidebar-foreground'}`}><Grid3X3 className="w-3.5 xl:w-4 h-3.5 xl:h-4" /></button>
                  <button onClick={() => setViewMode('list')} className={`p-1.5 xl:p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-lg shadow-[#EC67A1]/25' : 'text-header-muted hover:text-sidebar-foreground'}`}><List className="w-3.5 xl:w-4 h-3.5 xl:h-4" /></button>
                </div>
                {!isViewingShared && !isViewingCreators && (
                  <button onClick={() => setIsAddingNew(true)} disabled={!selectedProfileId || selectedProfileId === 'all' || !selectedFolderId} className="flex items-center justify-center gap-1.5 w-9 h-9 xl:w-auto xl:h-auto xl:px-4 xl:py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-lg xl:rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-[#EC67A1]/25" title="Upload">
                    <Upload className="w-4 h-4" /> <span className="hidden xl:inline">Upload</span>
                  </button>
                )}
                {!isViewingShared && !isViewingCreators && (
                  <button onClick={openGoogleDriveModal} disabled={!selectedProfileId || selectedProfileId === 'all' || !selectedFolderId} className="flex items-center justify-center gap-1.5 w-9 h-9 xl:w-auto xl:h-auto xl:px-4 xl:py-2.5 bg-gradient-to-r from-[#5DC3F8] to-[#4ab3e8] hover:from-[#4ab3e8] hover:to-[#3aa3d8] text-white rounded-lg xl:rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-[#5DC3F8]/25" title="Google Drive">
                    <HardDrive className="w-4 h-4" /> <span className="hidden xl:inline">Google Drive</span>
                  </button>
                )}
                {/* Desktop Export button */}
                {vaultItems.filter(item => item.fileType.startsWith('image/')).length > 0 && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center justify-center gap-1.5 w-9 h-9 xl:w-auto xl:h-auto xl:px-4 xl:py-2.5 bg-gradient-to-r from-[#F774B9] to-[#EC67A1] hover:from-[#EC67A1] hover:to-[#E1518E] text-white rounded-lg xl:rounded-xl font-medium transition-all shadow-lg shadow-[#F774B9]/25"
                    title="Export"
                  >
                    <FileOutput className="w-4 h-4" /> <span className="hidden xl:inline">Export</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mobile shared folder info */}
            {isViewingShared && selectedSharedFolder && (
              <p className="text-sm text-header-muted flex items-center gap-1 lg:hidden mb-3">
                <Share2 className="w-3.5 h-3.5" /> Shared by {selectedSharedFolder.sharedBy}
                {!canEdit && <span className="text-amber-500 ml-2">(View only)</span>}
              </p>
            )}
            
            {/* Mobile search and view toggle */}
            <div className="flex items-center gap-2 lg:hidden mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-header-muted" />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-[#EC67A1]/20 rounded-xl text-sm text-sidebar-foreground placeholder-header-muted focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1] transition-colors" />
              </div>
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 border border-[#EC67A1]/20">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white' : 'text-header-muted hover:text-sidebar-foreground'}`}><Grid3X3 className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white' : 'text-header-muted hover:text-sidebar-foreground'}`}><List className="w-4 h-4" /></button>
              </div>
            </div>
            
            {/* Filters and selection mode toggle */}
            <div className="flex items-center justify-between gap-3 mt-3 lg:mt-4">
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 vault-scroll">
                {['all', 'photos', 'videos', 'audio', 'gifs'].map((filter) => (
                  <button key={filter} onClick={() => setContentFilter(filter as any)} className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${contentFilter === filter ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-lg shadow-[#EC67A1]/25' : 'text-header-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-sidebar-foreground'}`}>{filter.charAt(0).toUpperCase() + filter.slice(1)}</button>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${selectionMode ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-lg shadow-[#EC67A1]/25' : 'text-header-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-sidebar-foreground'}`}
                >
                  <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span className="hidden sm:inline">{selectionMode ? 'Cancel' : 'Select'}</span>
                </button>
              )}
            </div>

            {/* Vault Enhancements Component */}
            <VaultEnhancements
              sortBy={sortBy}
              sortOrder={sortOrder}
              showSortMenu={showSortMenu}
              setShowSortMenu={setShowSortMenu}
              onSortByChange={(sort: 'date' | 'size' | 'name' | 'type') => {
                setSortBy(sort);
                setShowSortMenu(false);
              }}
              onSortOrderToggle={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              showDuplicates={showDuplicates}
              duplicatesCount={duplicates.size}
              onToggleDuplicates={() => setShowDuplicates(!showDuplicates)}
              detectingDuplicates={detectingDuplicates}
              onDetectDuplicates={detectDuplicates}
              selectedCount={compareItems.length}
              compareMode={compareMode}
              onCompareClick={() => {
                if (compareMode && compareItems.length >= 2) {
                  // Open compare modal
                  setShowCompareModal(true);
                } else if (compareMode) {
                  // Exit compare mode
                  setCompareMode(false);
                  setCompareItems([]);
                } else {
                  // Enable compare mode
                  setCompareMode(true);
                }
              }}
              onExitCompare={() => {
                setCompareMode(false);
                setCompareItems([]);
              }}
              thumbnailSize={thumbnailSize}
              disableVideoThumbnails={disableVideoThumbnails}
              searchInMetadata={searchInMetadata}
              showSettingsMenu={showSettingsMenu}
              setShowSettingsMenu={setShowSettingsMenu}
              onThumbnailSizeChange={(size: 'small' | 'medium' | 'large') => {
                setThumbnailSize(size);
                setShowSettingsMenu(false);
              }}
              onSearchInMetadataToggle={() => setSearchInMetadata(!searchInMetadata)}
              onDisableVideoThumbnailsToggle={() => setDisableVideoThumbnails(!disableVideoThumbnails)}
              filteredCount={allFilteredItems.length}
            />
          </div>

          <div ref={contentRef} onScroll={handleScroll} className="flex-1 overflow-y-auto vault-scroll p-3 sm:p-4 md:p-6 bg-white dark:bg-[#0a0a0f] rounded-br-2xl">
            {/* Admin Creator View - Loading/Empty States */}
            {isViewingCreators && loadingCreatorItems && (
              <div className={getGridClasses}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={viewMode === 'grid' ? 'bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/10 rounded-xl p-2 sm:p-3 animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/10 rounded-xl p-3 animate-pulse flex items-center gap-3 sm:gap-4'}>
                    <div className={viewMode === 'grid' ? 'aspect-square bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2 sm:mb-3' : 'w-10 sm:w-12 h-10 sm:h-12 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex-shrink-0'} />
                    <div className={viewMode === 'grid' ? '' : 'flex-1'}><div className="h-3 sm:h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-2" /><div className="h-2 sm:h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" /></div>
                  </div>
                ))}
              </div>
            )}

            {isViewingCreators && !loadingCreatorItems && contentCreatorItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/30">
                  <Crown className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-medium text-sidebar-foreground mb-1">No Content Creator Files</h3>
                <p className="text-sm text-header-muted max-w-sm">
                  {contentCreators.length === 0 
                    ? "No users with the Content Creator role found in the system."
                    : "Content creators haven't uploaded any files to their vault yet."}
                </p>
              </div>
            )}

            {!isViewingCreators && !selectedProfileId && !selectedSharedFolder ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#EC67A1]/20 to-[#F774B9]/20 rounded-2xl flex items-center justify-center mb-4 border border-[#EC67A1]/30"><Folder className="w-8 h-8 text-[#EC67A1]" /></div>
                <h3 className="text-lg font-medium text-sidebar-foreground mb-1">Select a profile</h3>
                <p className="text-sm text-header-muted">Choose a profile from the sidebar to view your files</p>
                <button onClick={() => setSidebarOpen(true)} className="mt-4 lg:hidden flex items-center gap-2 px-4 py-2.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-header-muted rounded-xl font-medium transition-colors">
                  <Menu className="w-4 h-4" /> Open sidebar
                </button>
              </div>
            ) : !isViewingCreators && !selectedFolderId && !selectedSharedFolder ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#EC67A1]/20 to-[#F774B9]/20 rounded-2xl flex items-center justify-center mb-4 border border-[#EC67A1]/30"><FolderPlus className="w-8 h-8 text-[#EC67A1]" /></div>
                <h3 className="text-lg font-medium text-sidebar-foreground mb-1">Create a folder</h3>
                <p className="text-sm text-header-muted">Organize your files by creating folders</p>
                <button onClick={() => setSidebarOpen(true)} className="mt-4 lg:hidden flex items-center gap-2 px-4 py-2.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-header-muted rounded-xl font-medium transition-colors">
                  <Menu className="w-4 h-4" /> Open sidebar
                </button>
              </div>
            ) : (loadingItems || loadingCreatorItems) && !isViewingCreators ? (
              <div className={getGridClasses}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={viewMode === 'grid' ? 'bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/10 rounded-xl p-2 sm:p-3 animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/10 rounded-xl p-3 animate-pulse flex items-center gap-3 sm:gap-4'}>
                    <div className={viewMode === 'grid' ? 'aspect-square bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2 sm:mb-3' : 'w-10 sm:w-12 h-10 sm:h-12 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex-shrink-0'} />
                    <div className={viewMode === 'grid' ? '' : 'flex-1'}><div className="h-3 sm:h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-2" /><div className="h-2 sm:h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : allFilteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#EC67A1]/20 to-[#F774B9]/20 rounded-2xl flex items-center justify-center mb-4 border border-[#EC67A1]/30"><FileIcon className="w-8 h-8 text-[#EC67A1]" /></div>
                <h3 className="text-lg font-medium text-sidebar-foreground mb-1">No files yet</h3>
                <p className="text-sm text-header-muted mb-4">
                  {isAllProfiles ? 'Select a specific profile to upload files' : 'Upload some files to get started'}
                </p>
                {!isViewingShared && !isViewingCreators && !isAllProfiles && <button onClick={() => setIsAddingNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-xl font-medium transition-all shadow-lg shadow-[#EC67A1]/25"><Upload className="w-4 h-4" /> Upload files</button>}
              </div>
            ) : viewMode === 'grid' ? (
              <>
                {/* Selection header */}
                {filteredItems.length > 0 && selectionMode && (
                  <div className="flex items-center justify-between mb-2 px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/10 rounded-xl">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedItems.size > 0 && selectedItems.size === currentFilteredItems.length} onChange={toggleSelectAll} className="w-4 h-4 text-[#EC67A1] bg-zinc-100 dark:bg-zinc-800 border-[#EC67A1]/30 rounded focus:ring-[#EC67A1] cursor-pointer" />
                      <span className="text-xs sm:text-sm text-sidebar-foreground font-medium">{selectedItems.size > 0 ? `${selectedItems.size} of ${currentFilteredItems.length}` : 'Select all'}</span>
                    </div>
                    <span className="text-xs text-header-muted">Shift+click for range</span>
                  </div>
                )}
                {/* Standard Grid with lazy loaded images */}
                <div className={getGridClasses}>
                  {filteredItems.map((item) => (
                    <VaultGridItem
                      key={item.id}
                      item={item}
                      isSelected={selectedItems.has(item.id)}
                      selectionMode={selectionMode}
                      canEdit={canEdit && !isViewingCreators}
                      onSelect={onSelectItem}
                      onPreview={handlePreview}
                      onDelete={handleDeleteItem}
                      onDownload={handleDownloadSingleFile}
                      formatFileSize={formatFileSize}
                      favorites={favorites}
                      toggleFavorite={toggleFavorite}
                      compareMode={compareMode}
                      isInCompare={compareItems.some(i => i.id === item.id)}
                      onCompareToggle={toggleCompareItem}
                      showGeneratorInfo={isViewingCreators}
                    />
                  ))}
                </div>
                {hasMoreItems && (
                  <div className="flex justify-center mt-4 sm:mt-6">
                    <button onClick={loadMoreItems} className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-header-muted rounded-xl text-sm sm:text-base font-medium transition-all flex items-center gap-2 border border-[#EC67A1]/20">
                      <Loader2 className="w-4 h-4" /> Load more ({currentFilteredItems.length - filteredItems.length})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Selection header for list view */}
                {filteredItems.length > 0 && selectionMode && (
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/10 rounded-xl mb-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input type="checkbox" checked={selectedItems.size > 0 && selectedItems.size === currentFilteredItems.length} onChange={toggleSelectAll} className="w-4 h-4 text-[#EC67A1] bg-zinc-100 dark:bg-zinc-800 border-[#EC67A1]/30 rounded focus:ring-[#EC67A1] cursor-pointer" />
                      <span className="text-xs sm:text-sm text-sidebar-foreground font-medium">{selectedItems.size > 0 ? `${selectedItems.size} of ${currentFilteredItems.length}` : 'Select all'}</span>
                    </div>
                    <span className="text-xs text-header-muted">Shift+click for range</span>
                  </div>
                )}
                {/* Standard List with lazy loaded images */}
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <VaultListItem
                      key={item.id}
                      item={item}
                      isSelected={selectedItems.has(item.id)}
                      selectionMode={selectionMode}
                      canEdit={canEdit && !isViewingCreators}
                      onSelect={onSelectItem}
                      onPreview={handlePreview}
                      onDelete={handleDeleteItem}
                      onDownload={handleDownloadSingleFile}
                      formatFileSize={formatFileSize}
                      favorites={favorites}
                      toggleFavorite={toggleFavorite}
                      showGeneratorInfo={isViewingCreators}
                    />
                  ))}
                </div>
                {hasMoreItems && (
                  <div className="flex justify-center mt-6">
                    <button onClick={loadMoreItems} className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-header-muted rounded-xl font-medium transition-all flex items-center gap-2 border border-[#EC67A1]/20">
                      <Loader2 className="w-4 h-4" /> Load more ({currentFilteredItems.length - filteredItems.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Floating Selection Action Bar */}
          {selectedItems.size > 0 && (
            <div className="fixed sm:absolute bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 animate-slideUp w-[calc(100%-2rem)] sm:w-auto max-w-2xl">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-zinc-100/95 dark:bg-[#1a1625]/95 backdrop-blur-xl border border-[#EC67A1]/20 rounded-2xl px-2.5 sm:px-5 py-2.5 sm:py-3 shadow-2xl shadow-[#EC67A1]/10">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-[#EC67A1]/20">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] rounded-full flex items-center justify-center shadow-lg shadow-[#EC67A1]/25">
                    <span className="text-xs sm:text-sm font-bold text-white">{selectedItems.size}</span>
                  </div>
                  <span className="text-xs sm:text-sm text-header-muted hidden sm:inline">selected</span>
                </div>
                
                {/* Select all */}
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 text-xs sm:text-sm font-medium text-header-muted hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors active:scale-95 touch-manipulation min-w-[44px] justify-center"
                >
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">{selectedItems.size === currentFilteredItems.length ? 'Deselect all' : 'Select all'}</span>
                </button>
                
                {/* Divider */}
                <div className="w-px h-6 bg-[#EC67A1]/20 hidden xs:block" />
                
                {/* Actions */}
                {canEdit && !isViewingCreators && (
                  <button 
                    onClick={handleBulkMove} 
                    disabled={isMoving}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 text-xs sm:text-sm font-medium text-[#EC67A1] hover:bg-[#EC67A1]/20 rounded-lg transition-colors disabled:opacity-50 active:scale-95 touch-manipulation min-w-[44px] justify-center"
                    title="Move"
                  >
                    <Move className="w-4 h-4" />
                    <span className="hidden md:inline">Move</span>
                  </button>
                )}
                
                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 text-xs sm:text-sm font-medium text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50 active:scale-95 touch-manipulation min-w-[44px] justify-center"
                  title="Download"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden md:inline">Download</span>
                </button>

                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 text-xs sm:text-sm font-medium text-[#F774B9] hover:bg-[#F774B9]/20 rounded-lg transition-colors active:scale-95 touch-manipulation min-w-[44px] justify-center"
                  title="Platform Export"
                >
                  <FileOutput className="w-4 h-4" />
                  <span className="hidden md:inline">Export</span>
                </button>

                {canEdit && !isViewingCreators && (
                  <button 
                    onClick={handleBulkDelete} 
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 text-xs sm:text-sm font-medium text-red-500 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 active:scale-95 touch-manipulation min-w-[44px] justify-center"
                    title="Delete"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span className="hidden md:inline">Delete</span>
                  </button>
                )}
                
                {/* Divider */}
                <div className="w-px h-6 bg-[#EC67A1]/20" />
                
                {/* Close */}
                <button 
                  onClick={clearSelection}
                  className="p-1.5 sm:p-2 text-header-muted hover:text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                  title="Clear selection (Esc)"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import from Google Drive Modal */}
      {showGoogleDriveModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!importingFromGoogleDrive) {
              setShowGoogleDriveModal(false);
              setSelectedGoogleDriveFiles(new Set());
              setGoogleDriveFiles([]);
              setGoogleDriveImportSuccess(null);
              setGoogleDriveError(null);
            }
          }}
        >
          <div
            className="bg-white dark:bg-[#1a1625] border border-[#EC67A1]/20 rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[#EC67A1]/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-[#5DC3F8] to-[#4ab3e8] rounded-xl">
                  <HardDrive className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-sidebar-foreground">
                    Import from Google Drive
                  </h3>
                  <p className="text-sm text-header-muted">
                    Add files to your vault
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {googleDriveImportSuccess ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <h4 className="text-xl font-semibold text-sidebar-foreground mb-2">
                    Import Successful!
                  </h4>
                  <p className="text-header-muted">
                    {googleDriveImportSuccess.itemCount} file
                    {googleDriveImportSuccess.itemCount !== 1 ? "s" : ""} imported to your vault
                  </p>
                </div>
              ) : !googleDriveAccessToken ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-[#5DC3F8]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HardDrive className="w-10 h-10 text-[#5DC3F8]" />
                  </div>
                  <h4 className="text-xl font-semibold text-sidebar-foreground mb-2">
                    Connect to Google Drive
                  </h4>
                  <p className="text-header-muted mb-6 max-w-md mx-auto">
                    To import files from Google Drive, you need to connect your account first.
                  </p>
                  <button
                    onClick={connectToGoogleDrive}
                    className="px-6 py-3 bg-gradient-to-r from-[#5DC3F8] to-[#4ab3e8] hover:from-[#4ab3e8] hover:to-[#3aa3d8] text-white rounded-xl font-medium shadow-lg shadow-[#5DC3F8]/25 transition-all duration-200 flex items-center gap-2 mx-auto"
                  >
                    <HardDrive className="w-5 h-5" />
                    Connect Google Drive
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Link Input Section */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sidebar-foreground">
                      <Link className="w-5 h-5 text-[#5DC3F8]" />
                      <span className="font-medium">Paste a Google Drive folder link to browse</span>
                    </div>
                    <div className="flex gap-2 p-4 bg-zinc-100/50 dark:bg-zinc-800/30 rounded-xl border border-[#EC67A1]/10">
                      <div className="flex-1 relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-header-muted" />
                        <input
                          type="text"
                          placeholder="Paste Google Drive folder link here..."
                          value={googleDriveLinkInput}
                          onChange={(e) => setGoogleDriveLinkInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && googleDriveLinkInput.trim()) {
                              browseGoogleDriveLink();
                            }
                          }}
                          className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-[#EC67A1]/20 rounded-xl text-sidebar-foreground placeholder-header-muted focus:outline-none focus:border-[#5DC3F8]/50 focus:ring-1 focus:ring-[#5DC3F8]/30 transition-all text-sm"
                        />
                      </div>
                      <button
                        onClick={browseGoogleDriveLink}
                        disabled={loadingGoogleDriveFiles || !googleDriveLinkInput.trim()}
                        className="px-5 py-2.5 bg-[#5DC3F8] hover:bg-[#4ab3e8] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  {/* Breadcrumb Navigation */}
                  <div className="flex items-center gap-1 text-sm bg-zinc-100/50 dark:bg-zinc-800/30 rounded-xl px-4 py-2.5 overflow-x-auto">
                    {googleDriveBreadcrumbs.map((crumb, index) => (
                      <div key={index} className="flex items-center">
                        {index > 0 && <ChevronRight className="w-4 h-4 text-header-muted mx-1" />}
                        <button
                          onClick={() => navigateToBreadcrumb(index)}
                          className={`px-2 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors truncate max-w-[180px] ${
                            index === googleDriveBreadcrumbs.length - 1
                              ? "text-[#5DC3F8] font-medium bg-[#5DC3F8]/10"
                              : "text-header-muted hover:text-sidebar-foreground"
                          }`}
                        >
                          {crumb.name}
                        </button>
                      </div>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => fetchGoogleDriveContents(currentGoogleDriveFolderId)}
                        disabled={loadingGoogleDriveFiles}
                        className="p-2 bg-zinc-200 dark:bg-zinc-700/50 hover:bg-zinc-300 dark:hover:bg-zinc-600/50 text-header-muted hover:text-sidebar-foreground rounded-lg transition-all"
                        title="Refresh"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingGoogleDriveFiles ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => {
                          setGoogleDriveAccessToken(null);
                          localStorage.removeItem('googleDriveAccessToken');
                          setGoogleDriveFiles([]);
                          setGoogleDriveFolders([]);
                          setGoogleDriveBreadcrumbs([{ id: null, name: 'My Drive' }]);
                          setGoogleDriveLinkInput('');
                          setGoogleDriveError(null);
                        }}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 hover:text-red-400 rounded-lg transition-all"
                        title="Sign out of Google Drive"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {googleDriveError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{googleDriveError.includes("permission") || googleDriveError.includes("access") ? "Access Denied" : "Error"}</p>
                        <p className="text-red-400/80 mt-1">{googleDriveError}</p>
                      </div>
                    </div>
                  )}

                  {/* Content Area */}
                  {loadingGoogleDriveFiles ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-header-muted" />
                    </div>
                  ) : googleDriveFolders.length === 0 && googleDriveFiles.length === 0 && !googleDriveError ? (
                    <div className="text-center py-12 text-header-muted bg-zinc-100/50 dark:bg-zinc-800/30 rounded-xl border border-[#EC67A1]/10">
                      <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-base font-medium">This folder is empty</p>
                      <p className="text-sm mt-1 text-header-muted">
                        {googleDriveBreadcrumbs.length > 1 
                          ? "Go back or paste a different folder link"
                          : "Paste a folder link above to browse its contents"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Folders */}
                      {googleDriveFolders.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-sidebar-foreground mb-3">
                            📁 Folders ({googleDriveFolders.length})
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-2">
                            {googleDriveFolders.map((folder) => (
                              <button
                                key={folder.id}
                                onClick={() => navigateToGoogleDriveFolder(folder)}
                                className="flex items-center gap-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 rounded-xl text-left transition-all border border-[#EC67A1]/10 hover:border-[#5DC3F8]/30 group"
                              >
                                <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                                  <Folder className="w-5 h-5 text-amber-500" />
                                </div>
                                <span className="text-sm text-sidebar-foreground truncate flex-1">{folder.name}</span>
                                {folder.shared && (
                                  <Users className="w-4 h-4 text-header-muted shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-sidebar-foreground">
                            🖼️ Media Files ({googleDriveFiles.length})
                            {selectedGoogleDriveFiles.size > 0 && (
                              <span className="ml-2 px-2 py-0.5 bg-[#5DC3F8]/20 text-[#5DC3F8] rounded-full text-xs">
                                {selectedGoogleDriveFiles.size} selected
                              </span>
                            )}
                          </label>
                          {googleDriveFiles.length > 0 && (
                            <button
                              onClick={selectAllGoogleDriveFiles}
                              className="text-sm text-[#5DC3F8] hover:text-[#4ab3e8] px-3 py-1 rounded-lg hover:bg-[#5DC3F8]/10 transition-colors"
                            >
                              {selectedGoogleDriveFiles.size === googleDriveFiles.length
                                ? "Deselect All"
                                : "Select All"}
                            </button>
                          )}
                        </div>

                        {googleDriveFiles.length === 0 ? (
                          <div className="text-center py-12 text-header-muted bg-zinc-100/50 dark:bg-zinc-800/30 rounded-xl">
                            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-base">No media files found</p>
                            <p className="text-sm mt-1 text-header-muted">
                              Browse into folders to find images, videos, and audio files
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[320px] overflow-y-auto pr-2">
                            {googleDriveFiles.map((file) => (
                              <div
                                key={file.id}
                                onClick={() => toggleGoogleDriveFileSelection(file.id)}
                                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                                  selectedGoogleDriveFiles.has(file.id)
                                    ? "border-[#5DC3F8] ring-2 ring-[#5DC3F8]/30"
                                    : "border-transparent hover:border-[#EC67A1]/30"
                                }`}
                              >
                                {file.mimeType?.startsWith("video/") ? (
                                  file.thumbnailLink ? (
                                    <img
                                      src={file.thumbnailLink}
                                      alt={file.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex flex-col items-center justify-center p-2">
                                      <VideoIcon className="w-8 h-8 text-header-muted mb-1" />
                                      <p className="text-xs text-header-muted text-center truncate w-full px-1">
                                        {file.name}
                                      </p>
                                    </div>
                                  )
                                ) : file.mimeType?.startsWith("audio/") ? (
                                  <div className="w-full h-full bg-gradient-to-br from-[#EC67A1]/20 to-[#F774B9]/20 flex flex-col items-center justify-center p-2">
                                    <Music4 className="w-8 h-8 text-[#EC67A1] mb-1" />
                                    <p className="text-xs text-header-muted text-center truncate w-full px-1">
                                      {file.name}
                                    </p>
                                  </div>
                                ) : file.thumbnailLink ? (
                                  <img
                                    src={file.thumbnailLink}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex flex-col items-center justify-center p-2">
                                    <ImageIcon className="w-8 h-8 text-header-muted mb-1" />
                                    <p className="text-xs text-header-muted text-center truncate w-full px-1">
                                      {file.name}
                                    </p>
                                  </div>
                                )}
                                {selectedGoogleDriveFiles.has(file.id) && (
                                  <div className="absolute inset-0 bg-[#5DC3F8]/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 text-[#5DC3F8]" />
                                  </div>
                                )}
                                {file.mimeType?.startsWith("video/") && (
                                  <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                    <VideoIcon className="w-3 h-3 text-white" />
                                  </div>
                                )}
                                {file.mimeType?.startsWith("audio/") && (
                                  <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                    <Music4 className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!googleDriveImportSuccess && googleDriveAccessToken && (
              <div className="p-6 border-t border-[#EC67A1]/10 flex gap-3 shrink-0">
                <button
                  onClick={() => {
                    setShowGoogleDriveModal(false);
                    setSelectedGoogleDriveFiles(new Set());
                    setGoogleDriveFiles([]);
                    setGoogleDriveError(null);
                  }}
                  disabled={importingFromGoogleDrive}
                  className="flex-1 px-4 py-2.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-header-muted rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={importFromGoogleDrive}
                  disabled={importingFromGoogleDrive || selectedGoogleDriveFiles.size === 0}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5DC3F8] to-[#4ab3e8] hover:from-[#4ab3e8] hover:to-[#3aa3d8] text-white rounded-xl font-medium shadow-lg shadow-[#5DC3F8]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {importingFromGoogleDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4" />
                      Import {selectedGoogleDriveFiles.size} File{selectedGoogleDriveFiles.size !== 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            )}

            {!googleDriveAccessToken && (
              <div className="p-6 border-t border-[#EC67A1]/10 shrink-0">
                <button
                  onClick={() => setShowGoogleDriveModal(false)}
                  className="w-full px-4 py-2.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-header-muted rounded-xl font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Reference Image Popup Modal */}
      {referenceImagePopup && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setReferenceImagePopup(null)}
        >
          <button 
            onClick={() => setReferenceImagePopup(null)} 
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img 
            src={referenceImagePopup} 
            alt="Reference Image"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {/* Compare Mode Modal */}
      {showCompareModal && compareItems.length >= 2 && (
        <CompareModal
          items={compareItems}
          onClose={() => {
            setShowCompareModal(false);
          }}
          formatFileSize={formatFileSize}
        />
      )}

      {/* Platform Export Modal */}
      <PlatformExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        images={(() => {
          // If items are selected, use selected images. Otherwise, use all images.
          const itemsSource = isViewingCreators ? contentCreatorItems : vaultItems;
          const imagesToExport = selectedItems.size > 0
            ? itemsSource.filter(item => selectedItems.has(item.id))
            : itemsSource;
          return imagesToExport
            .filter(item => item.fileType.startsWith('image/'))
            .map(item => ({
              url: item.awsS3Url,
              filename: item.fileName,
            }));
        })()}
        defaultModelName={selectedProfile?.name || ''}
        profileId={selectedProfileId || undefined}
        onExportComplete={(result) => {
          showToast(`Exported ${result.fileCount} files to ${result.filename}`, 'success');
          setShowExportModal(false);
        }}
      />
    </>
  );
}
