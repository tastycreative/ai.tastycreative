"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Image as ImageIcon,
  Menu,
  PanelLeftClose,
  Video as VideoIcon,
  Upload,
  Download,
  Copy,
  Grid3X3,
  List,
  Library,
  Clock,
  PlayCircle,
  Info,
  Calendar,
  BarChart3,
  Heart,
  Folder,
  FolderPlus,
  FolderOpen,
  Move,
  HardDrive,
  Link,
  ExternalLink,
  RefreshCw,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Users,
  Music4,
  FileText,
} from "lucide-react";

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

interface ReferenceFolder {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

interface ReferenceItem {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  fileType: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  awsS3Key: string;
  awsS3Url: string;
  thumbnailUrl: string | null;
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
  isFavorite: boolean;
  folderId: string | null;
  folder?: {
    id: string;
    name: string;
    color: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  favorites: number;
  unfiled: number;
  images: number;
  videos: number;
}

// Memoized Reference Item Card component
const ReferenceItemCard = memo(function ReferenceItemCard({
  item,
  viewMode,
  isSelected,
  onSelect,
  onDelete,
  onEdit,
  onCopyUrl,
  onDownload,
  onToggleFavorite,
  onMove,
}: {
  item: ReferenceItem;
  viewMode: "grid" | "list";
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onCopyUrl: () => void;
  onDownload: () => void;
  onToggleFavorite: () => void;
  onMove: () => void;
}) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (viewMode === "grid") {
    return (
      <div
        className={`group relative bg-gray-900 rounded-xl border ${
          isSelected ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-800"
        } overflow-hidden transition-all duration-300 hover:border-gray-700 hover:shadow-lg hover:shadow-purple-900/20`}
      >
        {/* Selection checkbox */}
        <div
          className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <div
            className={`w-5 h-5 rounded-md border-2 ${
              isSelected
                ? "bg-blue-600 border-blue-600"
                : "bg-gray-900/80 border-gray-500"
            } flex items-center justify-center`}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        </div>

        {/* Type badge */}
        <div className="absolute top-2 right-2 z-10">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              item.fileType === "video"
                ? "bg-purple-500/80 text-white"
                : "bg-blue-500/80 text-white"
            }`}
          >
            {item.fileType === "video" ? "Video" : "Image"}
          </span>
        </div>

        {/* Preview */}
        <div className="aspect-square relative bg-gray-800 overflow-hidden">
          {item.fileType === "video" ? (
            <div className="relative w-full h-full">
              <video
                src={item.awsS3Url}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <PlayCircle className="w-10 h-10 text-white/80" />
              </div>
              {item.duration && (
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-xs bg-black/70 text-white rounded">
                  {Math.round(item.duration)}s
                </span>
              )}
            </div>
          ) : (
            <img
              src={item.thumbnailUrl || item.awsS3Url}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          )}
          {/* Favorite button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`absolute bottom-2 left-2 z-10 p-1.5 rounded-full transition-all ${
              item.isFavorite
                ? "bg-pink-500 text-white opacity-100"
                : "bg-gray-900/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-pink-500 hover:text-white"
            }`}
          >
            <Heart className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Info */}
        <div className="p-3">
          {item.folder && (
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-4 h-4 rounded flex items-center justify-center"
                style={{ backgroundColor: `${item.folder.color}30` }}
              >
                <Folder className="w-2.5 h-2.5" style={{ color: item.folder.color }} />
              </div>
              <span className="text-[10px] truncate" style={{ color: item.folder.color }}>
                {item.folder.name}
              </span>
            </div>
          )}
          <h4 className="text-sm font-medium text-white truncate" title={item.name}>
            {item.name}
          </h4>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">{formatFileSize(item.fileSize)}</span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {item.usageCount}
            </span>
          </div>
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded"
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 2 && (
                <span className="text-[10px] text-gray-500">+{item.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyUrl();
              }}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Copy URL"
            >
              <Copy className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove();
              }}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Move to folder"
            >
              <Move className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 bg-gray-800 hover:bg-red-900/50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div
      className={`group flex items-center gap-4 p-3 bg-gray-900 rounded-xl border ${
        isSelected ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-800"
      } transition-all duration-300 hover:border-gray-700`}
    >
      {/* Selection checkbox */}
      <div
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <div
          className={`w-5 h-5 rounded-md border-2 ${
            isSelected
              ? "bg-blue-600 border-blue-600"
              : "bg-gray-800 border-gray-600"
          } flex items-center justify-center`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>

      {/* Thumbnail */}
      <div className="w-16 h-16 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden relative">
        {item.isFavorite && (
          <div className="absolute top-1 right-1 z-10">
            <Heart className="w-3 h-3 text-pink-500 fill-current" />
          </div>
        )}
        {item.fileType === "video" ? (
          <div className="relative w-full h-full">
            <video
              src={item.awsS3Url}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <PlayCircle className="w-6 h-6 text-white/80" />
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

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-white truncate">{item.name}</h4>
          {item.folder && (
            <span
              className="px-1.5 py-0.5 text-[10px] rounded flex items-center gap-1"
              style={{ backgroundColor: `${item.folder.color}20`, color: item.folder.color }}
            >
              <Folder className="w-2.5 h-2.5" />
              {item.folder.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            {item.fileType === "video" ? (
              <VideoIcon className="w-3 h-3" />
            ) : (
              <ImageIcon className="w-3 h-3" />
            )}
            {item.fileType}
          </span>
          <span>{formatFileSize(item.fileSize)}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(item.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            {item.usageCount} uses
          </span>
        </div>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-2 rounded-lg transition-colors ${
            item.isFavorite
              ? "bg-pink-500/20 text-pink-400"
              : "hover:bg-gray-800 text-gray-400"
          }`}
          title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Download"
        >
          <Download className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyUrl();
          }}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Copy URL"
        >
          <Copy className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Move to folder"
        >
          <Move className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
});

// Color options for folders
const FOLDER_COLORS = [
  "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#14B8A6", "#3B82F6", "#6366F1", "#A855F7",
];

export function ReferenceBankContent() {
  // State
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [folders, setFolders] = useState<ReferenceFolder[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "usage">("recent");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Filter state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ReferenceItem | null>(null);
  const [editingFolder, setEditingFolder] = useState<ReferenceFolder | null>(null);
  const [movingItems, setMovingItems] = useState<string[]>([]);
  
  // Form state
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  
  // Folder form state
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderColor, setFolderColor] = useState("#8B5CF6");
  
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch reference items and folders
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
        setReferenceItems(data.items || []);
        setFolders(data.folders || []);
        setStats(data.stats || { total: 0, favorites: 0, unfiled: 0, images: 0, videos: 0 });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFolderId, showFavoritesOnly, filterType, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (selectedGoogleDriveFiles.size === 0 || !googleDriveAccessToken) return;

    try {
      setImportingFromGoogleDrive(true);
      setGoogleDriveError(null);
      const response = await fetch("/api/reference-bank/import-from-google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolderId === "root" ? null : selectedFolderId,
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

      // Reload reference items
      fetchData();

      setGoogleDriveImportSuccess({ itemCount: data.itemCount });

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

  // Sort items
  const sortedItems = [...referenceItems].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "usage":
        return b.usageCount - a.usageCount;
      case "recent":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, ""));
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
      setUploadFolderId(selectedFolderId === "root" ? null : selectedFolderId);
      setShowUploadModal(true);
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      setUploadFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, ""));
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
      setUploadFolderId(selectedFolderId === "root" ? null : selectedFolderId);
      setShowUploadModal(true);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const presignResponse = await fetch("/api/reference-bank/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadFile.name,
          fileType: uploadFile.type,
          folderId: uploadFolderId,
        }),
      });
      
      if (!presignResponse.ok) {
        const errorData = await presignResponse.json();
        throw new Error(errorData.error || "Failed to get upload URL");
      }
      
      const { uploadUrl, key } = await presignResponse.json();
      setUploadProgress(30);
      
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: uploadFile,
        headers: { "Content-Type": uploadFile.type },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload to S3: ${uploadResponse.status}`);
      }
      
      setUploadProgress(70);
      
      const createResponse = await fetch("/api/reference-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName,
          description: uploadDescription,
          tags: uploadTags.split(",").map((t) => t.trim()).filter(Boolean),
          fileType: uploadFile.type.startsWith("video/") ? "video" : "image",
          mimeType: uploadFile.type,
          fileSize: uploadFile.size,
          awsS3Key: key,
          folderId: uploadFolderId,
        }),
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create record");
      }
      
      setUploadProgress(100);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadName("");
      setUploadDescription("");
      setUploadTags("");
      setUploadFolderId(null);
      fetchData();
    } catch (error) {
      console.error("Upload error:", error);
      alert(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete item
  const handleDelete = async (item: ReferenceItem) => {
    try {
      const response = await fetch(`/api/reference-bank/${item.id}`, { method: "DELETE" });
      if (response.ok) {
        setReferenceItems((prev) => prev.filter((i) => i.id !== item.id));
        setShowDeleteModal(false);
        setDeletingItem(null);
        fetchData();
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete item.");
    }
  };

  // Update item
  const handleUpdate = async () => {
    if (!editingItem) return;
    try {
      const response = await fetch(`/api/reference-bank/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName,
          description: uploadDescription,
          tags: uploadTags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      
      if (response.ok) {
        const updatedItem = await response.json();
        setReferenceItems((prev) => prev.map((i) => (i.id === editingItem.id ? updatedItem : i)));
        setShowEditModal(false);
        setEditingItem(null);
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update item.");
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (item: ReferenceItem) => {
    try {
      const response = await fetch(`/api/reference-bank/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !item.isFavorite }),
      });
      
      if (response.ok) {
        const updatedItem = await response.json();
        setReferenceItems((prev) => prev.map((i) => (i.id === item.id ? updatedItem : i)));
        setStats((prev) => ({
          ...prev,
          favorites: item.isFavorite ? prev.favorites - 1 : prev.favorites + 1,
        }));
      }
    } catch (error) {
      console.error("Toggle favorite error:", error);
    }
  };

  // Download file
  const handleDownload = async (item: ReferenceItem) => {
    try {
      const fileName = `${item.name}.${item.mimeType.split("/")[1]}`;
      const proxyUrl = `/api/reference-bank/download?url=${encodeURIComponent(item.awsS3Url)}&fileName=${encodeURIComponent(fileName)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      saveAs(blob, fileName);
    } catch (error) {
      console.error("Download error:", error);
      // Fallback to opening in new tab
      window.open(item.awsS3Url, "_blank");
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  // Move items to folder
  const handleMoveItems = async (targetFolderId: string | null) => {
    try {
      const response = await fetch("/api/reference-bank/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: movingItems, folderId: targetFolderId }),
      });
      
      if (response.ok) {
        setShowMoveModal(false);
        setMovingItems([]);
        setSelectedItems(new Set());
        fetchData();
      }
    } catch (error) {
      console.error("Move error:", error);
      alert("Failed to move items.");
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    try {
      const response = await fetch("/api/reference-bank/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, description: folderDescription, color: folderColor }),
      });
      
      if (response.ok) {
        const newFolder = await response.json();
        setFolders((prev) => [...prev, newFolder]);
        setShowFolderModal(false);
        setFolderName("");
        setFolderDescription("");
        setFolderColor("#8B5CF6");
        setEditingFolder(null);
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to create folder");
      }
    } catch (error) {
      console.error("Create folder error:", error);
      alert("Failed to create folder.");
    }
  };

  // Update folder
  const handleUpdateFolder = async () => {
    if (!editingFolder) return;
    try {
      const response = await fetch(`/api/reference-bank/folders/${editingFolder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, description: folderDescription, color: folderColor }),
      });
      
      if (response.ok) {
        const updatedFolder = await response.json();
        setFolders((prev) => prev.map((f) => (f.id === editingFolder.id ? updatedFolder : f)));
        setShowFolderModal(false);
        setFolderName("");
        setFolderDescription("");
        setFolderColor("#8B5CF6");
        setEditingFolder(null);
      }
    } catch (error) {
      console.error("Update folder error:", error);
      alert("Failed to update folder.");
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folder: ReferenceFolder) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${folder.name}"? Items in this folder will be moved to unfiled.`);
    if (confirmed) {
      try {
        const response = await fetch(`/api/reference-bank/folders/${folder.id}`, { method: "DELETE" });
        if (response.ok) {
          setFolders((prev) => prev.filter((f) => f.id !== folder.id));
          if (selectedFolderId === folder.id) setSelectedFolderId(null);
          fetchData();
        }
      } catch (error) {
        console.error("Delete folder error:", error);
        alert("Failed to delete folder.");
      }
    }
  };

  // Toggle item selection
  const toggleSelection = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Select all
  const toggleSelectAll = () => {
    if (selectedItems.size === sortedItems.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(sortedItems.map((i) => i.id)));
  };

  // Delete selected
  const deleteSelected = async () => {
    if (selectedItems.size === 0) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedItems.size} items?`);
    if (confirmed) {
      try {
        await Promise.all(Array.from(selectedItems).map((id) => fetch(`/api/reference-bank/${id}`, { method: "DELETE" })));
        setReferenceItems((prev) => prev.filter((i) => !selectedItems.has(i.id)));
        setSelectedItems(new Set());
        fetchData();
      } catch (error) {
        console.error("Bulk delete error:", error);
        alert("Failed to delete some items.");
      }
    }
  };

  // Download selected (batch download as zip)
  const [isDownloading, setIsDownloading] = useState(false);
  
  const downloadSelected = async () => {
    if (selectedItems.size === 0) return;
    setIsDownloading(true);
    
    const itemsToDownload = sortedItems.filter((item) => selectedItems.has(item.id));
    const zip = new JSZip();
    
    try {
      // Download files and add to zip
      for (const item of itemsToDownload) {
        try {
          const fileName = `${item.name}.${item.mimeType.split("/")[1]}`;
          const proxyUrl = `/api/reference-bank/download?url=${encodeURIComponent(item.awsS3Url)}&fileName=${encodeURIComponent(fileName)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(fileName, blob);
          }
        } catch (error) {
          console.error(`Failed to add ${item.name} to zip:`, error);
        }
      }
      
      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().slice(0, 10);
      saveAs(zipBlob, `reference-bank-${timestamp}.zip`);
    } catch (error) {
      console.error("Batch download error:", error);
      alert("Failed to create zip file.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="h-[calc(100vh-120px)] sm:h-[calc(100vh-120px)] flex items-center justify-center bg-gray-950 rounded-xl border border-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .reference-scroll::-webkit-scrollbar { width: 8px; }
        .reference-scroll::-webkit-scrollbar-track { background: transparent; }
        .reference-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        .reference-scroll::-webkit-scrollbar-thumb:hover { background: #4B5563; }
      `}</style>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      <div className="h-[calc(100vh-120px)] sm:h-[calc(100vh-120px)] flex bg-gray-950 rounded-xl border border-gray-800 overflow-hidden relative">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative z-50 lg:z-auto w-72 lg:w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col rounded-l-xl overflow-hidden transition-transform duration-300 ease-in-out`}>
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Library className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-white">Reference Bank</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <PanelLeftClose className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Statistics</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Total Items</span>
                <span className="text-white font-medium">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Images</span>
                <span className="text-white font-medium">{stats.images}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1"><VideoIcon className="w-3 h-3" /> Videos</span>
                <span className="text-white font-medium">{stats.videos}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1"><Heart className="w-3 h-3" /> Favorites</span>
                <span className="text-white font-medium">{stats.favorites}</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="p-4 flex-1 overflow-y-auto reference-scroll">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Browse</h3>
            <div className="space-y-1">
              <button
                onClick={() => { setSelectedFolderId(null); setShowFavoritesOnly(false); }}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${!selectedFolderId && !showFavoritesOnly ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}
              >
                <Library className="w-4 h-4" />All Files
              </button>
              <button
                onClick={() => { setSelectedFolderId(null); setShowFavoritesOnly(true); }}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${showFavoritesOnly ? "bg-pink-600/20 text-pink-300" : "text-gray-400 hover:bg-gray-800"}`}
              >
                <Heart className="w-4 h-4" />Favorites
                {stats.favorites > 0 && <span className="ml-auto text-xs bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded">{stats.favorites}</span>}
              </button>
              <button
                onClick={() => { setSelectedFolderId("root"); setShowFavoritesOnly(false); }}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${selectedFolderId === "root" ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}
              >
                <FolderOpen className="w-4 h-4" />Unfiled
                {stats.unfiled > 0 && <span className="ml-auto text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">{stats.unfiled}</span>}
              </button>
            </div>

            {/* Folders */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Folders</h3>
                <button onClick={() => { setEditingFolder(null); setFolderName(""); setFolderDescription(""); setFolderColor("#8B5CF6"); setShowFolderModal(true); }} className="p-1 hover:bg-gray-800 rounded transition-colors" title="Create folder">
                  <FolderPlus className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-1">
                {folders.map((folder) => (
                  <div key={folder.id} className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${selectedFolderId === folder.id ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`} onClick={() => { setSelectedFolderId(folder.id); setShowFavoritesOnly(false); }}>
                    <Folder className="w-4 h-4" style={{ color: folder.color }} />
                    <span className="flex-1 truncate">{folder.name}</span>
                    {folder._count && folder._count.items > 0 && <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">{folder._count.items}</span>}
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); setFolderName(folder.name); setFolderDescription(folder.description || ""); setFolderColor(folder.color); setShowFolderModal(true); }} className="p-1 hover:bg-gray-700 rounded transition-colors"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} className="p-1 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-3 h-3 text-red-400" /></button>
                    </div>
                  </div>
                ))}
                {folders.length === 0 && <p className="text-xs text-gray-500 px-3 py-2">No folders yet. Create one to organize your files.</p>}
              </div>
            </div>

            {/* Quick Filters */}
            <div className="mt-6">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">File Type</h3>
              <div className="space-y-1">
                <button onClick={() => setFilterType("all")} className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${filterType === "all" ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}>All Files</button>
                <button onClick={() => setFilterType("image")} className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${filterType === "image" ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}><ImageIcon className="w-4 h-4" />Images Only</button>
                <button onClick={() => setFilterType("video")} className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${filterType === "video" ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}><VideoIcon className="w-4 h-4" />Videos Only</button>
              </div>
            </div>

            {/* Sort */}
            <div className="mt-6">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Sort By</h3>
              <div className="space-y-1">
                <button onClick={() => setSortBy("recent")} className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${sortBy === "recent" ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}><Clock className="w-4 h-4" />Most Recent</button>
                <button onClick={() => setSortBy("name")} className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${sortBy === "name" ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}><span className="w-4 h-4 flex items-center justify-center text-xs">A-Z</span>Name</button>
                <button onClick={() => setSortBy("usage")} className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${sortBy === "usage" ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:bg-gray-800"}`}><BarChart3 className="w-4 h-4" />Most Used</button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800 bg-gray-800/30">
            <div className="flex items-start gap-2 text-xs text-gray-400">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Store reference images and videos here to quickly reuse them in SeeDream, Kling, and other generation tools.</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden w-full relative">
          <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-3 lg:hidden mb-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <Menu className="w-5 h-5 text-gray-300" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Search references..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors" />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-800 rounded-lg p-1">
                  <button onClick={() => setViewMode("grid")} className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-gray-700 text-violet-400" : "text-gray-500 hover:text-gray-300"}`}><Grid3X3 className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode("list")} className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-gray-700 text-violet-400" : "text-gray-500 hover:text-gray-300"}`}><List className="w-4 h-4" /></button>
                </div>

                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all shadow-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-violet-900/30">
                  <Upload className="w-4 h-4" /><span className="hidden sm:inline">Upload</span>
                </button>
                <button onClick={openGoogleDriveModal} className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-blue-900/30">
                  <HardDrive className="w-4 h-4" /><span className="hidden sm:inline">Google Drive</span>
                </button>
              </div>
            </div>

            {selectedItems.size > 0 && (
              <div className="flex items-center gap-3 mt-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
                <span className="text-sm text-gray-300">{selectedItems.size} selected</span>
                <button onClick={toggleSelectAll} className="text-sm text-violet-400 hover:text-violet-300">{selectedItems.size === sortedItems.length ? "Deselect All" : "Select All"}</button>
                <div className="flex-1" />
                <button onClick={downloadSelected} disabled={isDownloading} className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg text-sm transition-colors">{isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{isDownloading ? "Creating ZIP..." : "Download ZIP"}</button>
                <button onClick={() => { setMovingItems(Array.from(selectedItems)); setShowMoveModal(true); }} className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"><Move className="w-4 h-4" />Move</button>
                <button onClick={deleteSelected} className="flex items-center gap-1 px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"><Trash2 className="w-4 h-4" />Delete</button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 reference-scroll">
            {isLoading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
            ) : sortedItems.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full text-center px-4 border-2 border-dashed border-gray-700 rounded-2xl transition-colors ${isDragging ? "border-violet-500 bg-violet-500/10" : ""}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">{showFavoritesOnly ? <Heart className="w-8 h-8 text-gray-600" /> : <Upload className="w-8 h-8 text-gray-600" />}</div>
                <h3 className="text-lg font-medium text-white mb-1">{searchQuery ? "No matches found" : showFavoritesOnly ? "No favorites yet" : selectedFolderId ? "This folder is empty" : "No references yet"}</h3>
                <p className="text-sm text-gray-500 mb-4">{searchQuery ? "Try a different search term" : showFavoritesOnly ? "Mark items as favorites to see them here" : "Upload images or videos to use as references in your generations"}</p>
                {!searchQuery && !showFavoritesOnly && <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"><Upload className="w-4 h-4" />Upload Reference</button>}
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4" : "space-y-2"} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                {sortedItems.map((item) => (
                  <ReferenceItemCard key={item.id} item={item} viewMode={viewMode} isSelected={selectedItems.has(item.id)} onSelect={() => toggleSelection(item.id)} onDelete={() => { setDeletingItem(item); setShowDeleteModal(true); }} onEdit={() => { setEditingItem(item); setUploadName(item.name); setUploadDescription(item.description || ""); setUploadTags(item.tags.join(", ")); setShowEditModal(true); }} onCopyUrl={() => handleCopyUrl(item.awsS3Url)} onDownload={() => handleDownload(item)} onToggleFavorite={() => handleToggleFavorite(item)} onMove={() => { setMovingItems([item.id]); setShowMoveModal(true); }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {mounted && showUploadModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl"><Upload className="w-5 h-5 text-white" /></div>
                <div><h3 className="text-lg font-semibold text-white">Add Reference</h3><p className="text-sm text-gray-400">Upload a new reference file</p></div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {uploadPreview && <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden">{uploadFile?.type.startsWith("video/") ? <video src={uploadPreview} className="w-full h-full object-contain" controls /> : <img src={uploadPreview} alt="Preview" className="w-full h-full object-contain" />}</div>}
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Folder</label><select value={uploadFolderId || ""} onChange={(e) => setUploadFolderId(e.target.value || null)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"><option value="">No folder (unfiled)</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Name</label><input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent" placeholder="Reference name" /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label><textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" rows={2} placeholder="Add a description..." /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Tags (optional)</label><input type="text" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent" placeholder="portrait, outdoor, etc. (comma-separated)" /></div>
              {isUploading && <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-gray-400">Uploading...</span><span className="text-violet-400">{uploadProgress}%</span></div><div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div></div>}
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadPreview(null); setUploadName(""); setUploadDescription(""); setUploadTags(""); setUploadFolderId(null); }} disabled={isUploading} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleUpload} disabled={!uploadFile || !uploadName || isUploading} className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">{isUploading ? "Uploading..." : "Upload"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {mounted && showEditModal && editingItem && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl"><Edit2 className="w-5 h-5 text-white" /></div>
                <div><h3 className="text-lg font-semibold text-white">Edit Reference</h3><p className="text-sm text-gray-400">Update reference details</p></div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden">{editingItem.fileType === "video" ? <video src={editingItem.awsS3Url} className="w-full h-full object-contain" controls /> : <img src={editingItem.awsS3Url} alt={editingItem.name} className="w-full h-full object-contain" />}</div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Name</label><input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent" placeholder="Reference name" /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Description</label><textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" rows={2} placeholder="Add a description..." /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Tags</label><input type="text" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent" placeholder="portrait, outdoor, etc. (comma-separated)" /></div>
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
              <button onClick={handleUpdate} disabled={!uploadName} className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">Save Changes</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Modal */}
      {mounted && showDeleteModal && deletingItem && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-xl"><Trash2 className="w-5 h-5 text-red-400" /></div>
                <div><h3 className="text-lg font-semibold text-white">Delete Reference</h3><p className="text-sm text-gray-400">This action cannot be undone</p></div>
              </div>
            </div>
            <div className="p-6"><p className="text-gray-300">Are you sure you want to delete &quot;{deletingItem.name}&quot;?</p></div>
            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletingItem(null); }} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deletingItem)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Folder Modal */}
      {mounted && showFolderModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">{editingFolder ? <Edit2 className="w-5 h-5 text-white" /> : <FolderPlus className="w-5 h-5 text-white" />}</div>
                <div><h3 className="text-lg font-semibold text-white">{editingFolder ? "Edit Folder" : "Create Folder"}</h3><p className="text-sm text-gray-400">{editingFolder ? "Update folder details" : "Create a new folder to organize your references"}</p></div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Folder Name</label><input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent" placeholder="My Folder" /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label><textarea value={folderDescription} onChange={(e) => setFolderDescription(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" rows={2} placeholder="Add a description..." /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Color</label><div className="flex flex-wrap gap-2">{FOLDER_COLORS.map((color) => <button key={color} onClick={() => setFolderColor(color)} className={`w-8 h-8 rounded-lg transition-all ${folderColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900" : "hover:scale-110"}`} style={{ backgroundColor: color }} />)}</div></div>
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button onClick={() => { setShowFolderModal(false); setFolderName(""); setFolderDescription(""); setFolderColor("#8B5CF6"); setEditingFolder(null); }} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
              <button onClick={editingFolder ? handleUpdateFolder : handleCreateFolder} disabled={!folderName.trim()} className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">{editingFolder ? "Save Changes" : "Create Folder"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move Modal */}
      {mounted && showMoveModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl"><Move className="w-5 h-5 text-white" /></div>
                <div><h3 className="text-lg font-semibold text-white">Move {movingItems.length} Item{movingItems.length > 1 ? "s" : ""}</h3><p className="text-sm text-gray-400">Select a destination folder</p></div>
              </div>
            </div>
            <div className="p-6 space-y-2 max-h-64 overflow-y-auto">
              <button onClick={() => handleMoveItems(null)} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"><FolderOpen className="w-5 h-5 text-gray-400" /><span className="text-white">Unfiled (No folder)</span></button>
              {folders.map((folder) => <button key={folder.id} onClick={() => handleMoveItems(folder.id)} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"><Folder className="w-5 h-5" style={{ color: folder.color }} /><span className="text-white">{folder.name}</span>{folder._count && folder._count.items > 0 && <span className="ml-auto text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">{folder._count.items}</span>}</button>)}
            </div>
            <div className="p-6 border-t border-gray-700">
              <button onClick={() => { setShowMoveModal(false); setMovingItems([]); }} className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Google Drive Import Modal */}
      {mounted && showGoogleDriveModal && createPortal(
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
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                  <HardDrive className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Import from Google Drive
                  </h3>
                  <p className="text-sm text-gray-400">
                    Add files to your reference bank
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {googleDriveImportSuccess ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">
                    Import Successful!
                  </h4>
                  <p className="text-gray-400">
                    {googleDriveImportSuccess.itemCount} file
                    {googleDriveImportSuccess.itemCount !== 1 ? "s" : ""} imported to your reference bank
                  </p>
                </div>
              ) : !googleDriveAccessToken ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HardDrive className="w-10 h-10 text-violet-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">
                    Connect to Google Drive
                  </h4>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto">
                    To import files from Google Drive, you need to connect your account first.
                  </p>
                  <button
                    onClick={connectToGoogleDrive}
                    className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 transition-all duration-200 flex items-center gap-2 mx-auto"
                  >
                    <HardDrive className="w-5 h-5" />
                    Connect Google Drive
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Link Input Section */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Link className="w-5 h-5 text-violet-400" />
                      <span className="font-medium">Paste a Google Drive folder link to browse</span>
                    </div>
                    <div className="flex gap-2 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
                      <div className="flex-1 relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
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
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
                        />
                      </div>
                      <button
                        onClick={browseGoogleDriveLink}
                        disabled={loadingGoogleDriveFiles || !googleDriveLinkInput.trim()}
                        className="px-5 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  {/* Breadcrumb Navigation */}
                  <div className="flex items-center gap-1 text-sm bg-gray-800/30 rounded-xl px-4 py-2.5 overflow-x-auto">
                    {googleDriveBreadcrumbs.map((crumb, index) => (
                      <div key={index} className="flex items-center">
                        {index > 0 && <ChevronRight className="w-4 h-4 text-gray-500 mx-1" />}
                        <button
                          onClick={() => navigateToBreadcrumb(index)}
                          className={`px-2 py-1 rounded-lg hover:bg-gray-700/50 transition-colors truncate max-w-[180px] ${
                            index === googleDriveBreadcrumbs.length - 1
                              ? "text-violet-400 font-medium bg-violet-500/10"
                              : "text-gray-400 hover:text-gray-300"
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
                        className="p-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-gray-300 rounded-lg transition-all"
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
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all"
                        title="Sign out of Google Drive"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {googleDriveError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3">
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
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : googleDriveFolders.length === 0 && googleDriveFiles.length === 0 && !googleDriveError ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-800/30 rounded-xl border border-gray-700/30">
                      <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-base font-medium">This folder is empty</p>
                      <p className="text-sm mt-1 text-gray-600">
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
                          <label className="block text-sm font-medium text-gray-300 mb-3">
                            📁 Folders ({googleDriveFolders.length})
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-2">
                            {googleDriveFolders.map((folder) => (
                              <button
                                key={folder.id}
                                onClick={() => navigateToGoogleDriveFolder(folder)}
                                className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-left transition-all border border-gray-700/50 hover:border-violet-500/30 group"
                              >
                                <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                  <Folder className="w-5 h-5 text-yellow-400" />
                                </div>
                                <span className="text-sm text-gray-300 truncate flex-1">{folder.name}</span>
                                {folder.shared && (
                                  <Users className="w-4 h-4 text-gray-500 shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-300">
                            🖼️ Media Files ({googleDriveFiles.length})
                            {selectedGoogleDriveFiles.size > 0 && (
                              <span className="ml-2 px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full text-xs">
                                {selectedGoogleDriveFiles.size} selected
                              </span>
                            )}
                          </label>
                          {googleDriveFiles.length > 0 && (
                            <button
                              onClick={selectAllGoogleDriveFiles}
                              className="text-sm text-violet-400 hover:text-violet-300 px-3 py-1 rounded-lg hover:bg-violet-500/10 transition-colors"
                            >
                              {selectedGoogleDriveFiles.size === googleDriveFiles.length
                                ? "Deselect All"
                                : "Select All"}
                            </button>
                          )}
                        </div>

                        {googleDriveFiles.length === 0 ? (
                          <div className="text-center py-12 text-gray-500 bg-gray-800/30 rounded-xl">
                            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-base">No media files found</p>
                            <p className="text-sm mt-1 text-gray-600">
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
                                    ? "border-violet-500 ring-2 ring-violet-500/30"
                                    : "border-transparent hover:border-gray-600"
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
                                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center p-2">
                                      <VideoIcon className="w-8 h-8 text-gray-400 mb-1" />
                                      <p className="text-xs text-gray-400 text-center truncate w-full px-1">
                                        {file.name}
                                      </p>
                                    </div>
                                  )
                                ) : file.mimeType?.startsWith("audio/") ? (
                                  <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex flex-col items-center justify-center p-2">
                                    <Music4 className="w-8 h-8 text-violet-400 mb-1" />
                                    <p className="text-xs text-gray-400 text-center truncate w-full px-1">
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
                                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center p-2">
                                    <ImageIcon className="w-8 h-8 text-gray-400 mb-1" />
                                    <p className="text-xs text-gray-400 text-center truncate w-full px-1">
                                      {file.name}
                                    </p>
                                  </div>
                                )}
                                {selectedGoogleDriveFiles.has(file.id) && (
                                  <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 text-violet-400" />
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
              <div className="p-6 border-t border-gray-700 flex gap-3 shrink-0">
                <button
                  onClick={() => {
                    setShowGoogleDriveModal(false);
                    setSelectedGoogleDriveFiles(new Set());
                    setGoogleDriveFiles([]);
                    setGoogleDriveError(null);
                  }}
                  disabled={importingFromGoogleDrive}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={importFromGoogleDrive}
                  disabled={importingFromGoogleDrive || selectedGoogleDriveFiles.size === 0}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <div className="p-6 border-t border-gray-700 shrink-0">
                <button
                  onClick={() => setShowGoogleDriveModal(false)}
                  className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
