// app/(dashboard)/workspace/generated-content/page.tsx - Gallery Page
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useApiClient } from "@/lib/apiClient";
import { getBestMediaUrl, getBandwidthStats, getDownloadUrl } from "@/lib/directUrlUtils";
import BandwidthStats from "@/components/BandwidthStats";
import { useInView } from "react-intersection-observer";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { uploadToS3, S3_FOLDERS, S3_UPLOAD_FOLDERS, type S3File } from "@/lib/s3-helpers";
import { FolderList } from "@/components/generated-content";
import { Users } from "lucide-react";
import JSZip from "jszip";
import {
  ImageIcon,
  Download,
  Share2,
  Trash2,
  Search,
  Filter,
  Grid3X3,
  List,
  Calendar,
  FileImage,
  Eye,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  SortAsc,
  SortDesc,
  MoreVertical,
  Video,
  Play,
  Pause,
  HardDrive,
  BarChart3,
  Upload,
  FolderOpen,
  CheckCircle,
  Share,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Info,
  CheckSquare,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Settings,
  Save,
  Plus,
  Zap,
  Archive,
  Cloud,
  MousePointer2,
  Keyboard,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Folder,
  FolderInput,
} from "lucide-react";

// Types
interface GeneratedImage {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string; // Dynamically constructed ComfyUI URL
  dataUrl?: string; // Database-served image URL
  s3Key?: string; // S3 key for network volume storage (RunPod)
  networkVolumePath?: string; // Path on network volume (RunPod)
  awsS3Key?: string; // AWS S3 key for primary storage
  awsS3Url?: string; // AWS S3 public URL for direct access
  googleDriveFileId?: string | null;
  googleDriveFolderName?: string | null;
  googleDriveUploadedAt?: Date | string | null;
  createdAt: Date | string;
  jobId: string;
}

interface GeneratedVideo {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number; // Video duration in seconds
  fps?: number; // Frames per second
  format?: string;
  url?: string; // Dynamically constructed ComfyUI URL
  dataUrl?: string; // Database-served video URL
  s3Key?: string; // S3 key for network volume storage (RunPod)
  networkVolumePath?: string; // Path on network volume (RunPod)
  awsS3Key?: string; // AWS S3 key for primary storage
  awsS3Url?: string; // AWS S3 public URL for direct access
  googleDriveFileId?: string | null;
  googleDriveFolderName?: string | null;
  googleDriveUploadedAt?: Date | string | null;
  createdAt: Date | string;
  jobId: string;
}

interface ContentItem extends GeneratedImage {
  itemType: "image" | "video";
  duration?: number; // For videos
  fps?: number; // For videos
  stagingStorageKey?: string | null; // S3 staging key (legacy drive field)
  stagingStorageFolder?: string | null; // S3 staging folder name
  stagingStorageUploadedAt?: Date | null; // Timestamp for latest staging upload
}

interface ImageStats {
  totalImages: number;
  totalSize: number;
  formatBreakdown: Record<string, number>;
  imagesWithData: number;
  imagesWithoutData: number;
}

interface VideoStats {
  totalVideos: number;
  totalSize: number;
  formatBreakdown: Record<string, number>;
  videosWithData: number;
  videosWithoutData: number;
}

type ViewMode = "grid" | "list";
type SortBy = "newest" | "oldest" | "largest" | "smallest" | "name";
type FilterBy = "all" | "images" | "videos";
type S3FolderName = (typeof S3_FOLDERS)[number]["name"];
type S3Folder = {
  name: S3FolderName;
  prefix: string;
};
type AspectRatio = "all" | "portrait" | "landscape" | "square";
type LinkedStatus = "all" | "linked" | "unlinked";

// Helper function to get folder name
const getFolderName = (folder: S3FolderName): string => folder;

const getS3FolderByName = (folderName: S3FolderName): S3Folder => {
  const match = S3_FOLDERS.find((folder) => folder.name === folderName);
  return match ?? { name: "All Generations", prefix: "outputs/" };
};

const getS3FolderPrefix = (folderName: S3FolderName): string => {
  const folder = getS3FolderByName(folderName);
  return folder.prefix.replace(/\/$/, "");
};

interface UploadState {
  [itemId: string]: {
    uploading: boolean;
    progress: number;
    folder?: S3FolderName;
    success?: boolean;
    error?: string;
  };
}

interface AdvancedFilters {
  dateRange: {
    start: string;
    end: string;
  };
  fileSize: {
    min: number;
    max: number;
  };
  aspectRatio: AspectRatio;
  formats: string[];
  linkedStatus: LinkedStatus;
  panelOpen: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: AdvancedFilters;
  filterBy: FilterBy;
  searchQuery: string;
}

interface UserInfo {
  id: string;
  clerkId: string;
  email: string | null;
  name: string;
  role: string;
  imageCount: number;
  videoCount: number;
  totalContent: number;
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Lazy-loaded Image Component
interface LazyMediaProps {
  item: ContentItem;
  onClick: () => void;
}

const LazyMedia: React.FC<LazyMediaProps> = ({ item, onClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.01, // Reduced from 0.1 for earlier loading
    rootMargin: '200px', // Increased from 50px to preload earlier
  });

  const mediaUrl = useMemo(() => getBestMediaUrl({
    awsS3Key: item.awsS3Key,
    awsS3Url: item.awsS3Url,
    s3Key: item.s3Key,
    networkVolumePath: item.networkVolumePath,
    dataUrl: item.dataUrl,
    url: item.url,
    id: item.id,
    filename: item.filename,
    type: item.itemType === "video" ? 'video' : 'image'
  }), [item]);

  // Preload image when in view
  useEffect(() => {
    if (inView && item.itemType === "image" && mediaUrl) {
      const img = new Image();
      img.src = mediaUrl;
      img.onload = () => setImageLoaded(true);
      img.onerror = () => setImageError(true);
    }
  }, [inView, mediaUrl, item.itemType]);

  if (item.itemType === "video") {
    return (
      <div ref={ref} className="w-full h-full">
        {inView ? (
          <video
            src={mediaUrl}
            className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-110"
            onClick={onClick}
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse flex items-center justify-center">
            <Video className="w-12 h-12 text-gray-400 animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="w-full h-full relative">
      {inView ? (
        <>
          {/* Show blur placeholder while loading */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse flex items-center justify-center backdrop-blur-xl">
              <ImageIcon className="w-12 h-12 text-gray-400 animate-pulse" />
            </div>
          )}
          
          {/* Show error state */}
          {imageError && (
            <div className="absolute inset-0 bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>
          )}
          
          {/* Actual image with fade-in */}
          <img
            src={mediaUrl}
            alt={item.filename}
            className={`w-full h-full object-cover cursor-pointer transition-all duration-500 group-hover:scale-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClick}
            loading="eager" // Changed from lazy to eager for faster loading
            decoding="async" // Async decoding for better performance
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse flex items-center justify-center">
          <ImageIcon className="w-12 h-12 text-gray-400 animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default function GeneratedContentPage() {
  const apiClient = useApiClient();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  // Admin User Filter State
  const [availableUsers, setAvailableUsers] = useState<UserInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Folder Management State
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFolderInfo, setSelectedFolderInfo] = useState<{
    name: string;
    isShared: boolean;
    sharedBy?: string;
    permission?: 'VIEW' | 'EDIT';
  } | null>(null);

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [imageStats, setImageStats] = useState<ImageStats | null>(null);
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChangingPage, setIsChangingPage] = useState(false); // Separate state for page changes
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Debounced search for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    dateRange: { start: '', end: '' },
    fileSize: { min: 0, max: Infinity },
    aspectRatio: 'all',
    formats: [],
    linkedStatus: 'all',
    panelOpen: false
  });
  
  // Filter Presets
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  
  // Bulk Actions
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Stats Collapse State
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  
  // Hover Preview State
  const [hoveredItem, setHoveredItem] = useState<ContentItem | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const previewTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // S3 Upload State
  const [uploadStates, setUploadStates] = useState<UploadState>({});
  const [showUploadModal, setShowUploadModal] = useState<ContentItem | null>(null);
  const [availableFoldersForUpload, setAvailableFoldersForUpload] = useState<Array<{name: string, prefix: string}>>([]);
  
  // Move to Folder State
  const [showMoveModal, setShowMoveModal] = useState<ContentItem | null>(null);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [availableFoldersForMove, setAvailableFoldersForMove] = useState<Array<{name: string, prefix: string, fileCount?: number}>>([]);

  // S3 Upload Queue State
  const [uploadQueue, setUploadQueue] = useState<Array<{
    id: string;
    item: ContentItem;
    folder: S3FolderName;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
    error?: string;
  }>>([]);
  const [quickUploadItem, setQuickUploadItem] = useState<string | null>(null); // Store item ID for quick upload dropdown
  const [showQueuePanel, setShowQueuePanel] = useState(false);

  // Production Task Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [productionTasks, setProductionTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [linkingContent, setLinkingContent] = useState(false);
  const [linkedContentMap, setLinkedContentMap] = useState<Record<string, any[]>>({});
  const [loadingLinkedContent, setLoadingLinkedContent] = useState(false);

  // Interaction Improvements State
  const [selectionMode, setSelectionMode] = useState(false); // Show all checkboxes
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: ContentItem | null;
  } | null>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1);
  const [dragSelecting, setDragSelecting] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number>(-1);

  // Modal/Lightbox Enhancement State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Empty States & Feedback State
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
  }>>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: { progress: number; filename: string };
  }>({});
  const [downloadProgress, setDownloadProgress] = useState<{
    [key: string]: { progress: number; filename: string };
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile Responsiveness Enhancement State
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false);
  const [mobileBottomSheetContent, setMobileBottomSheetContent] = useState<'actions' | 'filters' | null>(null);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const [swipeItemId, setSwipeItemId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Detect mobile and tablet devices
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // < md breakpoint
      setIsTablet(width >= 768 && width < 1024); // md to lg
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreImages, setHasMoreImages] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const [totalImages, setTotalImages] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20); // User-configurable items per page
  const isFetchingRef = useRef(false); // Prevent duplicate fetch calls
  const lastFetchTimeRef = useRef(0); // Track last fetch time for cooldown
  const [useInfiniteScroll, setUseInfiniteScroll] = useState(false); // Toggle between infinite scroll and pagination (default to pagination)
  
  // Infinite Scroll State (for display control)
  const [displayCount, setDisplayCount] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  
  // Intersection Observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  // Fetch images and stats
  useEffect(() => {
    if (apiClient && !adminLoading) {
      // Reset pagination when user changes or items per page changes
      setCurrentPage(1);
      setHasMoreImages(false);
      setHasMoreVideos(false);
      setTotalImages(0);
      setTotalVideos(0);
      isFetchingRef.current = false; // Reset fetch ref
      lastFetchTimeRef.current = 0; // Reset cooldown timer
      
      // First auto-process any completed serverless jobs
      autoProcessServerlessJobs().then(() => {
        // Then fetch the content
        fetchContent(false); // false = not appending, fresh fetch
        fetchStats();
      });
    }
  }, [apiClient, adminLoading, selectedUserId, itemsPerPage, filterBy, sortBy, selectedFolder]);

  // Fetch available users when admin status is confirmed
  useEffect(() => {
    if (apiClient && isAdmin && !adminLoading) {
      fetchAvailableUsers();
    }
  }, [apiClient, isAdmin, adminLoading]);

  // Fetch linked content when allContent changes
  useEffect(() => {
    if (apiClient && allContent.length > 0) {
      fetchLinkedContent();
    }
  }, [apiClient, allContent.length]);

  // Load presets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('filterPresets');
    if (saved) {
      try {
        setFilterPresets(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to load filter presets:", error);
      }
    }

    // Load saved items per page preference
    const savedItemsPerPage = localStorage.getItem('itemsPerPage');
    if (savedItemsPerPage) {
      try {
        const value = parseInt(savedItemsPerPage);
        if ([20, 50, 100, 200].includes(value)) {
          setItemsPerPage(value);
        }
      } catch (error) {
        console.error("Failed to load items per page preference:", error);
      }
    }
  }, []);

  const fetchFolderInfo = async (folderPrefix: string) => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient.get("/api/s3/folders/list-custom");
      if (response.ok) {
        const data = await response.json();
        const folder = data.folders?.find((f: any) => f.prefix === folderPrefix);
        if (folder) {
          setSelectedFolderInfo({
            name: folder.name,
            isShared: folder.isShared || false,
            sharedBy: folder.sharedBy,
            permission: folder.permission,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching folder info:", error);
    }
  };

  const fetchContent = async (append: boolean = false, pageOverride?: number) => {
    if (!apiClient) {
      console.error("❌ API client not available");
      setError("Authentication not ready");
      setLoading(false);
      return;
    }

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        // Use isChangingPage for pagination, loading for initial load
        if (pageOverride !== undefined) {
          setIsChangingPage(true);
        } else {
          setLoading(true);
        }
      }
      setError(null);

      console.log("🖼️ === FETCHING CONTENT FOR GALLERY ===");
      console.log("🌍 Environment:", process.env.NODE_ENV);
      console.log("🔗 Origin:", window.location.origin);
      console.log("⏰ Timestamp:", new Date().toISOString());
      console.log("👤 Selected User ID:", selectedUserId || "current user");
      
      // Use pageOverride if provided, otherwise use currentPage
      const effectivePage = pageOverride !== undefined ? pageOverride : currentPage;
      console.log("📄 Page:", append ? effectivePage + 1 : effectivePage, "Append:", append);

      // When filtering by content type, fetch only that type with proper pagination
      // When showing all, fetch from both APIs and merge by date
      const isFilteredByType = filterBy === "images" || filterBy === "videos";
      
      let fetchLimit: number;
      let fetchOffset: number;
      
      if (isFilteredByType) {
        // Direct pagination for single content type
        fetchLimit = itemsPerPage;
        fetchOffset = append ? effectivePage * itemsPerPage : (effectivePage - 1) * itemsPerPage;
        console.log("📡 Filtered mode:", filterBy, "- limit:", fetchLimit, "offset:", fetchOffset);
      } else {
        // Merged pagination - fetch from beginning to current page for proper date sorting
        fetchLimit = itemsPerPage * effectivePage;
        fetchOffset = 0;
        console.log("📡 Merged mode - limit:", fetchLimit, "offset:", fetchOffset);
      }

      // Build query params
      const queryParams = new URLSearchParams({
        includeData: 'false',
        limit: fetchLimit.toString(),
        offset: fetchOffset.toString(),
        sortBy: sortBy // Pass sort parameter to API
      });
      
      // Add folder parameter if a folder is selected
      if (selectedFolder && selectedFolder !== 'all') {
        queryParams.append('folder', selectedFolder);
      }
      
      // Add userId param if admin has selected a user
      if (selectedUserId) {
        queryParams.append('userId', selectedUserId);
      }

      console.log("📡 Fetching for page", effectivePage, "with sortBy:", sortBy);

      // Conditionally fetch based on filter
      let imagesResponse, videosResponse;
      let imagesData = { success: true, images: [], total: 0, hasMore: false };
      let videosData = { success: true, videos: [], total: 0, hasMore: false };

      // Fetch images (skip if filtering for videos only)
      if (filterBy !== "videos") {
        console.log("📡 Fetching images from /api/images...");
        imagesResponse = await apiClient.get(
          `/api/images?${queryParams.toString()}`
        );
        console.log("📡 Images response status:", imagesResponse.status);

        if (!imagesResponse.ok) {
          console.error("❌ Images fetch failed:", imagesResponse.status, imagesResponse.statusText);
          const errorText = await imagesResponse.text();
          console.error("❌ Images error details:", errorText);
          throw new Error(`Failed to fetch images: ${imagesResponse.status}`);
        }

        imagesData = await imagesResponse.json();
        console.log("📊 Gallery images data:", imagesData);
        console.log("📊 Raw images count:", imagesData.images?.length || 0);
      } else {
        console.log("⏭️ Skipping images fetch (videos only filter)");
      }

      // Fetch videos (skip if filtering for images only)
      if (filterBy !== "images") {
        console.log("📡 Fetching videos from /api/videos...");
        videosResponse = await apiClient.get(
          `/api/videos?${queryParams.toString()}`
        );
        console.log("📡 Videos response status:", videosResponse.status);

        if (!videosResponse.ok) {
          console.error("❌ Videos fetch failed:", videosResponse.status, videosResponse.statusText);
          const errorText = await videosResponse.text();
          console.error("❌ Videos error details:", errorText);
          throw new Error(`Failed to fetch videos: ${videosResponse.status}`);
        }

        videosData = await videosResponse.json();
        console.log("📊 Gallery videos data:", videosData);
        console.log("📊 Raw videos count:", videosData.videos?.length || 0);
      } else {
        console.log("⏭️ Skipping videos fetch (images only filter)");
      }

      console.log("📊 Gallery images data:", imagesData);
      console.log("📊 Gallery videos data:", videosData);
      console.log("📊 Raw images count:", imagesData.images?.length || 0);
      console.log("📊 Raw videos count:", videosData.videos?.length || 0);

      // NEW: More detailed debugging
      if (imagesData.success === false) {
        console.error("❌ Images API returned error:", (imagesData as any).error);
      }
      if (videosData.success === false) {
        console.error("❌ Videos API returned error:", (videosData as any).error);
      }

      // Debug individual images
      if (
        imagesData.success &&
        imagesData.images &&
        imagesData.images.length > 0
      ) {
        console.log("🖼️ Sample image data:", imagesData.images[0]);
        imagesData.images.forEach((img: any, index: number) => {
          console.log(`🖼️ Image ${index + 1}:`, {
            id: img.id,
            filename: img.filename,
            jobId: img.jobId,
            hasDataUrl: !!img.dataUrl,
            hasUrl: !!img.url,
            dataUrl: img.dataUrl,
            url: img.url,
            createdAt: img.createdAt,
            fileSize: img.fileSize,
          });
        });
      }
      if (imagesData.success && imagesData.images) {
        // Convert string dates to Date objects
        const processedImages = imagesData.images.map((img: any) => ({
          ...img,
          createdAt: new Date(img.createdAt),
          itemType: "image" as const,
          stagingStorageKey: img.googleDriveFileId || null,
          stagingStorageFolder: img.googleDriveFolderName || null,
          stagingStorageUploadedAt: img.googleDriveUploadedAt
            ? new Date(img.googleDriveUploadedAt)
            : null,
        }));

        // Append or replace images based on mode
        if (append) {
          setImages(prev => [...prev, ...processedImages]);
          console.log("✅ Appended", processedImages.length, "images (total:", images.length + processedImages.length, ")");
        } else {
          setImages(processedImages);
          console.log("✅ Loaded", processedImages.length, "images");
        }

        // Update pagination info from API response
        if (imagesData.total !== undefined) {
          setTotalImages(imagesData.total);
          setHasMoreImages(imagesData.hasMore || false);
          console.log("📊 Images pagination: total=", imagesData.total, "hasMore=", imagesData.hasMore, "currentCount=", (append ? images.length + processedImages.length : processedImages.length));
        }
      } else {
        console.warn("⚠️ Images data invalid or empty:", imagesData);
        if (!append) setImages([]);
      }

      if (videosData.success && videosData.videos) {
        // Convert string dates to Date objects
        const processedVideos = videosData.videos.map((video: any) => ({
          ...video,
          createdAt: new Date(video.createdAt),
          itemType: "video" as const,
          stagingStorageKey: video.googleDriveFileId || null,
          stagingStorageFolder: video.googleDriveFolderName || null,
          stagingStorageUploadedAt: video.googleDriveUploadedAt
            ? new Date(video.googleDriveUploadedAt)
            : null,
        }));

        // Append or replace videos based on mode
        if (append) {
          setVideos(prev => [...prev, ...processedVideos]);
          console.log("✅ Appended", processedVideos.length, "videos (total:", videos.length + processedVideos.length, ")");
        } else {
          setVideos(processedVideos);
          console.log("✅ Loaded", processedVideos.length, "videos");
        }

        // Update pagination info from API response
        if (videosData.total !== undefined) {
          setTotalVideos(videosData.total);
          setHasMoreVideos(videosData.hasMore || false);
          console.log("📊 Videos pagination: total=", videosData.total, "hasMore=", videosData.hasMore, "currentCount=", (append ? videos.length + processedVideos.length : processedVideos.length));
        }
      } else {
        console.warn("⚠️ Videos data invalid or empty:", videosData);
        if (!append) setVideos([]);
      }

      // Combine all content (either from state or fresh data)
      const currentImages = append ? [...images, ...(imagesData.success && imagesData.images ? imagesData.images.map((img: any) => ({
        ...img,
        createdAt: new Date(img.createdAt),
        itemType: "image" as const,
        stagingStorageKey: img.googleDriveFileId || null,
        stagingStorageFolder: img.googleDriveFolderName || null,
        stagingStorageUploadedAt: img.googleDriveUploadedAt ? new Date(img.googleDriveUploadedAt) : null,
      })) : [])] : (imagesData.success && imagesData.images ? imagesData.images.map((img: any) => ({
        ...img,
        createdAt: new Date(img.createdAt),
        itemType: "image" as const,
        stagingStorageKey: img.googleDriveFileId || null,
        stagingStorageFolder: img.googleDriveFolderName || null,
        stagingStorageUploadedAt: img.googleDriveUploadedAt ? new Date(img.googleDriveUploadedAt) : null,
      })) : []);

      const currentVideos = append ? [...videos, ...(videosData.success && videosData.videos ? videosData.videos.map((video: any) => ({
        ...video,
        createdAt: new Date(video.createdAt),
        itemType: "video" as const,
        stagingStorageKey: video.googleDriveFileId || null,
        stagingStorageFolder: video.googleDriveFolderName || null,
        stagingStorageUploadedAt: video.googleDriveUploadedAt ? new Date(video.googleDriveUploadedAt) : null,
      })) : [])] : (videosData.success && videosData.videos ? videosData.videos.map((video: any) => ({
        ...video,
        createdAt: new Date(video.createdAt),
        itemType: "video" as const,
        stagingStorageKey: video.googleDriveFileId || null,
        stagingStorageFolder: video.googleDriveFolderName || null,
        stagingStorageUploadedAt: video.googleDriveUploadedAt ? new Date(video.googleDriveUploadedAt) : null,
      })) : []);

      // Combine and sort by creation date (most recent first)
      let allItems: ContentItem[] = [...currentImages, ...currentVideos];
      allItems.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      // When using traditional pagination, slice to get only the current page's items
      if (!useInfiniteScroll && !append) {
        if (isFilteredByType) {
          // Already fetched the exact page from API, no need to slice
          console.log("✅ Page", effectivePage, "- direct fetch (", allItems.length, "items)");
        } else {
          // Merged content - slice to get current page
          const startIndex = (effectivePage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          allItems = allItems.slice(startIndex, endIndex);
          console.log("✅ Page", effectivePage, "- showing items", startIndex, "to", endIndex, "(", allItems.length, "items)");
        }
      }

      setAllContent(allItems);
      console.log("✅ Combined", allItems.length, "content items");

      // Update page counter if appending
      if (append) {
        setCurrentPage(prev => prev + 1);
      }

      if (allItems.length === 0) {
        console.warn("⚠️ No content items found after processing");
        console.log("🔍 Debug info:", {
          imagesSuccess: imagesData.success,
          imagesLength: imagesData.images?.length || 0,
          videosSuccess: videosData.success,
          videosLength: videosData.videos?.length || 0,
        });
      } else {
        console.log("📋 Content breakdown:", {
          images: allItems.filter((item) => item.itemType === "image").length,
          videos: allItems.filter((item) => item.itemType === "video").length,
          total: allItems.length,
          mostRecent: allItems[0]
            ? new Date(allItems[0].createdAt).toLocaleString()
            : "none",
        });
      }
    } catch (error) {
      console.error("💥 Error fetching content:", error);
      console.error(
        "💥 Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );
      setError(
        error instanceof Error ? error.message : "Failed to load content"
      );

      // Set empty arrays on error (only if not appending)
      if (!append) {
        setImages([]);
        setVideos([]);
        setAllContent([]);
      }
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        // Clear both loading states
        setLoading(false);
        setIsChangingPage(false);
      }
      console.log("🏁 Fetch content finished");
    }
  };

  const fetchStats = async () => {
    if (!apiClient) {
      console.error("❌ API client not available for stats");
      return;
    }

    try {
      // Build query params
      const queryParams = new URLSearchParams({ stats: 'true' });
      
      // Add userId param if admin has selected a user
      if (selectedUserId) {
        queryParams.append('userId', selectedUserId);
      }

      const [imagesStatsResponse, videosStatsResponse] = await Promise.all([
        apiClient.get(`/api/images?${queryParams.toString()}`),
        apiClient.get(`/api/videos?${queryParams.toString()}`),
      ]);

      if (imagesStatsResponse.ok) {
        const data = await imagesStatsResponse.json();
        if (data.success) {
          setImageStats(data.stats);
        }
      }

      if (videosStatsResponse.ok) {
        const data = await videosStatsResponse.json();
        if (data.success) {
          setVideoStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Handle page change for traditional pagination
  const goToPage = async (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages || pageNumber === currentPage) {
      console.log("🚫 goToPage blocked:", { pageNumber, currentPage, totalPages, reason: pageNumber === currentPage ? "already on page" : "out of bounds" });
      return;
    }
    
    console.log(`📄 goToPage: Navigating from page ${currentPage} to page ${pageNumber}`);
    setCurrentPage(pageNumber);
    
    // Pass the page number directly to fetchContent to avoid state update race condition
    await fetchContent(false, pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auto-process serverless jobs
  const autoProcessServerlessJobs = async () => {
    if (!apiClient) {
      console.error("❌ API client not available for auto-processing");
      return;
    }

    try {
      console.log("🔄 Auto-processing serverless jobs...");
      const response = await apiClient.post(
        "/api/jobs/auto-process-serverless",
        {}
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.jobsProcessed > 0) {
          console.log(
            `✅ Auto-processed ${result.jobsProcessed} jobs with ${result.imagesProcessed} images`
          );
        }
      }
    } catch (error) {
      console.error("❌ Auto-processing error:", error);
    }
  };

  // Fetch available users for admin user filter
  const fetchAvailableUsers = async () => {
    if (!apiClient || !isAdmin) {
      return;
    }

    try {
      setLoadingUsers(true);
      console.log("👥 Fetching available users...");
      
      const response = await apiClient.get("/api/admin/users");

      if (response.ok) {
        const users = await response.json();
        
        // Transform to UserInfo format
        const formattedUsers: UserInfo[] = users.map((user: any) => ({
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.email || 'Unknown User',
          role: user.role,
          imageCount: user._count?.images || 0,
          videoCount: user._count?.videos || 0,
          totalContent: (user._count?.images || 0) + (user._count?.videos || 0)
        }));

        setAvailableUsers(formattedUsers);
        console.log(`✅ Loaded ${formattedUsers.length} users`);
      } else {
        console.error("Failed to fetch users:", response.status);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Filter and sort content - optimized with useMemo
  const filteredAndSortedContent = useMemo(() => {
    let filtered = [...allContent];

    // Apply folder filter first (if selected)
    if (selectedFolder && selectedFolder !== 'outputs/') {
      filtered = filtered.filter((item) => {
        if (item.awsS3Key) {
          // For new structure: outputs/{userId}/{folderName}/ 
          // Extract folder prefix from S3 key: "outputs/user123/my-folder/file.jpg" -> "outputs/user123/my-folder/"
          const parts = item.awsS3Key.split('/');
          if (parts.length >= 3) {
            const itemFolder = parts.slice(0, 3).join('/') + '/';
            return itemFolder === selectedFolder;
          }
        }
        return false;
      });
    }

    // Apply content type filter
    if (filterBy === "images") {
      filtered = filtered.filter((item) => item.itemType === "image");
    } else if (filterBy === "videos") {
      filtered = filtered.filter((item) => item.itemType === "video");
    }

    // Apply search filter with debounced query
    if (debouncedSearchQuery) {
      filtered = filtered.filter((item) =>
        item.filename.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }

    // Apply advanced filters
    // Date range filter
    if (advancedFilters.dateRange.start) {
      const fromDate = new Date(advancedFilters.dateRange.start);
      filtered = filtered.filter((item) => new Date(item.createdAt) >= fromDate);
    }
    if (advancedFilters.dateRange.end) {
      const toDate = new Date(advancedFilters.dateRange.end);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter((item) => new Date(item.createdAt) <= toDate);
    }

    // File size filter (convert to bytes)
    filtered = filtered.filter((item) => {
      const sizeInMB = (item.fileSize || 0) / 1024 / 1024;
      return sizeInMB >= advancedFilters.fileSize.min && sizeInMB <= advancedFilters.fileSize.max;
    });

    // Aspect ratio filter
    if (advancedFilters.aspectRatio !== 'all' && filtered.length > 0) {
      filtered = filtered.filter((item) => {
        if (!item.width || !item.height) return false;
        const ratio = item.width / item.height;
        
        if (advancedFilters.aspectRatio === 'portrait') {
          return ratio < 0.95; // Width < Height
        } else if (advancedFilters.aspectRatio === 'landscape') {
          return ratio > 1.05; // Width > Height
        } else if (advancedFilters.aspectRatio === 'square') {
          return ratio >= 0.95 && ratio <= 1.05; // Roughly square
        }
        return true;
      });
    }

    // Format filter
    if (advancedFilters.formats.length > 0) {
      filtered = filtered.filter((item) => {
        const format = item.format?.toLowerCase() || item.filename.split('.').pop()?.toLowerCase();
        return format && advancedFilters.formats.some(f => f.toLowerCase() === format);
      });
    }

    // Linked status filter
    if (advancedFilters.linkedStatus !== 'all') {
      filtered = filtered.filter((item) => {
        const isLinked = !!linkedContentMap[item.id];
        return advancedFilters.linkedStatus === 'linked' ? isLinked : !isLinked;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "largest":
          return (b.fileSize || 0) - (a.fileSize || 0);
        case "smallest":
          return (a.fileSize || 0) - (b.fileSize || 0);
        case "name":
          return a.filename.localeCompare(b.filename);
        default:
          return 0;
      }
    });

    return filtered;
  }, [allContent, filterBy, debouncedSearchQuery, sortBy, advancedFilters, linkedContentMap, selectedFolder]);

  // Calculate total pages based on filtered content (not raw API counts)
  // This ensures pagination adjusts when filters like "Images only" or "Videos only" are applied
  const totalPages = useMemo(() => {
    // Check if ANY filter is active
    const hasActiveFilters = 
      (selectedFolder && selectedFolder !== 'outputs/') ||  // Folder filter
      filterBy !== 'all' ||                                  // Content type filter (images/videos)
      debouncedSearchQuery ||                                // Search filter
      advancedFilters.dateRange.start ||                     // Date range start
      advancedFilters.dateRange.end ||                       // Date range end
      advancedFilters.formats.length > 0 ||                  // Format filter
      advancedFilters.linkedStatus !== 'all' ||              // Linked status filter
      advancedFilters.aspectRatio !== 'all' ||               // Aspect ratio filter
      advancedFilters.fileSize.min !== 0 ||                  // File size min
      advancedFilters.fileSize.max !== Infinity;             // File size max
    
    if (hasActiveFilters) {
      // When ANY filter is active, use the actual filtered content length
      // This ensures pagination matches what's actually displayed
      return Math.ceil(filteredAndSortedContent.length / itemsPerPage);
    } else {
      // No filters active - use API totals for efficiency
      return Math.ceil((totalImages + totalVideos) / itemsPerPage);
    }
  }, [filterBy, totalImages, totalVideos, itemsPerPage, filteredAndSortedContent.length, 
      debouncedSearchQuery, advancedFilters, selectedFolder]);

  // Auto-reset to page 1 if current page exceeds total pages (handles folder switching with fewer items)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      console.log(`📄 Auto-resetting page: currentPage ${currentPage} > totalPages ${totalPages}`);
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Infinite scroll content - only show items up to displayCount
  const displayedContent = useMemo(() => {
    // When using traditional pagination, show all content (it's already paginated from API)
    // When using infinite scroll, slice by displayCount
    if (!useInfiniteScroll) {
      return filteredAndSortedContent;
    }
    return filteredAndSortedContent.slice(0, displayCount);
  }, [filteredAndSortedContent, displayCount, useInfiniteScroll]);

  // Preload images for better performance
  useEffect(() => {
    if (allContent.length > 0 && !loading && !isChangingPage) {
      // Preload first 10 images for instant display
      const imagesToPreload = allContent
        .filter(item => item.itemType === 'image')
        .slice(0, 10);
      
      imagesToPreload.forEach(item => {
        const url = getBestMediaUrl({
          awsS3Key: item.awsS3Key,
          awsS3Url: item.awsS3Url,
          s3Key: item.s3Key,
          networkVolumePath: item.networkVolumePath,
          dataUrl: item.dataUrl,
          url: item.url,
          id: item.id,
          filename: item.filename,
          type: 'image'
        });
        
        if (url) {
          const img = new Image();
          img.src = url;
        }
      });
    }
  }, [allContent, loading, isChangingPage]);

  // Keyboard Navigation Handler (must be after displayedContent, before useEffects)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Modal-specific shortcuts (when modal is open)
    if (selectedItem) {
      // Left arrow: Previous image
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousContent();
        return;
      }
      
      // Right arrow: Next image
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextContent();
        return;
      }
      
      // Z key: Toggle zoom
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (zoomLevel === 1) {
          handleZoomIn();
        } else {
          resetZoom();
        }
        return;
      }
      
      // F key: Toggle fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      
      // Escape: Close modal
      if (e.key === 'Escape') {
        setSelectedItem(null);
        setZoomLevel(1);
        setIsFullscreen(false);
        return;
      }
      
      return; // Don't process other shortcuts when modal is open
    }
    
    // Gallery shortcuts (when modal is closed)
    // Ctrl+A or Cmd+A: Select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      selectAll();
      return;
    }
    
    // Delete key: Delete selected items
    if (e.key === 'Delete' && selectedItems.size > 0) {
      e.preventDefault();
      bulkDelete();
      return;
    }
    
    // Escape: Clear selection or close context menu
    if (e.key === 'Escape') {
      if (selectedItems.size > 0) {
        clearSelection();
      } else if (contextMenu) {
        setContextMenu(null);
      }
      return;
    }
    
    // Space: Toggle selection of focused item
    if (e.key === ' ' && focusedItemIndex >= 0 && focusedItemIndex < displayedContent.length) {
      e.preventDefault();
      const item = displayedContent[focusedItemIndex];
      toggleItemSelection(item.id);
      return;
    }
    
    // Arrow keys: Navigate focused item
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      handleArrowNavigation(e.key);
      return;
    }
  }, [selectedItems, selectedItem, contextMenu, focusedItemIndex, displayedContent, zoomLevel]);

  // Click outside to close context menu
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => setContextMenu(null);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Keyboard shortcuts listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Mouse up listener for drag selection
  useEffect(() => {
    const handleMouseUp = () => {
      setDragSelecting(false);
      setDragStartIndex(-1);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(20); // Initial display count
    // hasMore is now determined by API pagination, not local filtering
    setHasMore(hasMoreImages || hasMoreVideos);
  }, [debouncedSearchQuery, filterBy, sortBy, advancedFilters, hasMoreImages, hasMoreVideos]);

  // Reset to page 1 when filters change (for traditional pagination)
  useEffect(() => {
    if (!useInfiniteScroll && currentPage > 1) {
      console.log("🔄 Filter changed, resetting to page 1");
      setCurrentPage(1);
    }
  }, [filterBy, debouncedSearchQuery, sortBy, advancedFilters.dateRange.start, 
      advancedFilters.dateRange.end, advancedFilters.formats, advancedFilters.linkedStatus, 
      advancedFilters.aspectRatio, selectedFolder, useInfiniteScroll]);

  // Load more items when scrolling (only in infinite scroll mode)
  useEffect(() => {
    if (!useInfiniteScroll) return; // Skip if using traditional pagination
    
    // Only trigger if:
    // 1. Element is in view
    // 2. Not currently loading initial content
    // 3. Not currently loading more content
    // 4. Not changing pages
    // 5. There's more content available (either images or videos)
    // 6. Not already fetching (prevents duplicate calls)
    // 7. Cooldown period has passed (at least 1 second since last fetch)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const cooldownPeriod = 1000; // 1 second cooldown
    
    const shouldLoadMore = 
      inView && 
      !loading && 
      !isLoadingMore && 
      !isChangingPage &&
      (hasMoreImages || hasMoreVideos) && 
      !isFetchingRef.current &&
      timeSinceLastFetch > cooldownPeriod;
    
    if (shouldLoadMore) {
      console.log("🔄 Loading more content... (hasMoreImages:", hasMoreImages, "hasMoreVideos:", hasMoreVideos, ")");
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
      
      fetchContent(true).finally(() => {
        // Reset the ref after a small delay to allow the intersection observer to update
        setTimeout(() => {
          isFetchingRef.current = false;
        }, 500);
      });
    }
  }, [inView, loading, isLoadingMore, isChangingPage, hasMoreImages, hasMoreVideos, useInfiniteScroll]);

  // Modal enhancement: Auto-hide controls when modal opens
  useEffect(() => {
    if (selectedItem) {
      resetControlsTimeout();
      return () => {
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      };
    }
  }, [selectedItem]);

  // Modal enhancement: Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Modal enhancement: Show controls on mouse movement
  useEffect(() => {
    if (!selectedItem) return;
    
    const handleMouseMove = () => {
      resetControlsTimeout();
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [selectedItem]);


  // Download image with dynamic URL support
  const downloadImage = async (image: GeneratedImage) => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    try {
      console.log("📥 Downloading image:", image.filename);

      // Priority 1: Download from AWS S3
      if (image.awsS3Key || image.awsS3Url) {
        const s3Url = getBestMediaUrl({
          awsS3Key: image.awsS3Key,
          awsS3Url: image.awsS3Url,
          s3Key: image.s3Key,
          networkVolumePath: image.networkVolumePath,
          dataUrl: image.dataUrl,
          url: image.url,
          id: image.id,
          filename: image.filename,
          type: 'image'
        });
        console.log("🚀 Downloading from S3:", s3Url);
        
        try {
          const response = await fetch(s3Url);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = image.filename;
            link.click();
            URL.revokeObjectURL(url);
            console.log("✅ S3 image downloaded");
            return;
          }
        } catch (s3Error) {
          console.warn("⚠️ S3 download failed, trying fallback:", s3Error);
        }
      }

      // Priority 2: Download from database
      if (image.dataUrl) {
        const response = await apiClient.get(image.dataUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = image.filename;
          link.click();
          URL.revokeObjectURL(url);
          console.log("✅ Database image downloaded");
          return;
        }
      }

      // Priority 3: Download from ComfyUI (dynamic URL)
      if (image.url) {
        const link = document.createElement("a");
        link.href = image.url;
        link.download = image.filename;
        link.click();
        console.log("✅ ComfyUI image downloaded");
        return;
      }

      throw new Error("No download URL available");
    } catch (error) {
      console.error("Download error:", error);
      alert(
        "Failed to download image: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Share image with dynamic URL support
  const shareImage = (image: GeneratedImage) => {
    let urlToShare = "";

    // Priority 1: Share AWS S3 URL (fastest and most reliable)
    if (image.awsS3Key || image.awsS3Url) {
      urlToShare = getBestMediaUrl({
        awsS3Key: image.awsS3Key,
        awsS3Url: image.awsS3Url,
        s3Key: image.s3Key,
        networkVolumePath: image.networkVolumePath,
        dataUrl: image.dataUrl,
        url: image.url,
        id: image.id,
        filename: image.filename,
        type: 'image'
      });
    } else if (image.dataUrl) {
      // Priority 2: Share database URL (more reliable)
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
      // Priority 3: Share ComfyUI URL (dynamic)
      urlToShare = image.url;
    } else {
      alert("No shareable URL available for this image");
      return;
    }

    navigator.clipboard.writeText(urlToShare);
    showToast('success', 'Image URL copied to clipboard!');
  };

  // Upload generated content to S3 staging bucket
  const uploadGeneratedItemToS3 = async (
    item: ContentItem,
    folder: S3FolderName,
    options: { onProgress?: (progress: number) => void; silent?: boolean } = {}
  ) => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    const folderDetails = getS3FolderByName(folder);
    const folderLabel = folderDetails.name;
    const folderPrefix = getS3FolderPrefix(folder);

    const updateProgress = (progress: number) => {
      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          progress,
        },
      }));
      options.onProgress?.(progress);
    };

    try {
      console.log(`📤 Uploading ${item.filename} to S3 folder: ${folderLabel} (${folderPrefix})`);

      // Set uploading state
      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          uploading: true,
          progress: 0,
          folder,
        },
      }));

      let uploadedFile: S3File | null = null;

      // Attempt to copy directly within S3 when the asset already lives there
      if (item.awsS3Key) {
        try {
          console.log("📤 Attempting server-side S3 copy", {
            sourceKey: item.awsS3Key,
            destinationFolder: folderPrefix,
          });
          updateProgress(15);

          const copyResponse = await fetch("/api/s3/copy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              itemId: item.id,
              itemType: item.itemType,
              destinationFolder: folderPrefix,
            }),
          });

          if (!copyResponse.ok) {
            const errorData = await copyResponse.json().catch(() => ({ error: copyResponse.statusText }));
            throw new Error(errorData.error || `Copy failed with status ${copyResponse.status}`);
          }

          const copyData = await copyResponse.json();
          uploadedFile = copyData.file as S3File;
          console.log("✅ Server-side copy completed", uploadedFile);
          updateProgress(70);
        } catch (copyError) {
          console.warn("⚠️ S3 copy optimisation failed, falling back to re-upload:", copyError);
          uploadedFile = null;
        }
      }

      if (!uploadedFile) {
        // Get the best URL for the item
        const mediaUrl = getBestMediaUrl({
          awsS3Key: item.awsS3Key,
          awsS3Url: item.awsS3Url,
          s3Key: item.s3Key,
          networkVolumePath: item.networkVolumePath,
          dataUrl: item.dataUrl,
          url: item.url,
          id: item.id,
          filename: item.filename,
          type: item.itemType === "video" ? "video" : "image",
        });

        if (!mediaUrl) {
          throw new Error("No media URL available for upload");
        }

        console.log(`📥 Fetching media from: ${mediaUrl}`);
        updateProgress(25);

        // Fetch the media file with proper headers and error handling
        let mediaBlob: Blob;
        try {
          // Try direct fetch first
          const mediaResponse = await fetch(mediaUrl, {
            method: "GET",
            mode: "cors",
            headers: {
              Accept: item.itemType === "video" ? "video/*" : "image/*",
            },
          });

          if (!mediaResponse.ok) {
            throw new Error(`Direct fetch failed: ${mediaResponse.status} ${mediaResponse.statusText}`);
          }

          mediaBlob = await mediaResponse.blob();
          console.log(
            `✅ Direct media fetch successful, size: ${mediaBlob.size} bytes, type: ${mediaBlob.type}`
          );
        } catch (fetchError) {
          console.error("❌ Direct fetch failed, trying proxy approach:", fetchError);

          try {
            // Use proxy endpoint to fetch the media
            console.log("🔄 Trying proxy route...");
            const proxyUrl = `/api/proxy/media?url=${encodeURIComponent(mediaUrl)}`;
            const proxyResponse = await fetch(proxyUrl);

            if (!proxyResponse.ok) {
              throw new Error(`Proxy fetch failed: ${proxyResponse.status} ${proxyResponse.statusText}`);
            }

            mediaBlob = await proxyResponse.blob();
            console.log(
              `✅ Proxy media fetch successful, size: ${mediaBlob.size} bytes, type: ${mediaBlob.type}`
            );
          } catch (proxyError) {
            console.error("❌ Proxy fetch also failed:", proxyError);

            // Final fallback: try the dataUrl if available
            if (item.dataUrl && item.dataUrl.startsWith("/api/")) {
              console.log("🔄 Final attempt: trying dataUrl API route...");
              const dataResponse = await fetch(item.dataUrl);
              if (!dataResponse.ok) {
                throw new Error(`DataUrl fetch failed: ${dataResponse.status} ${dataResponse.statusText}`);
              }
              mediaBlob = await dataResponse.blob();
              console.log(`✅ DataUrl fetch successful, size: ${mediaBlob.size} bytes`);
            } else {
              throw new Error(
                "Unable to fetch media file from any source. Please try again or contact support."
              );
            }
          }
        }

        updateProgress(50);

        const fallbackMime = item.itemType === "video" ? "video/mp4" : "image/png";
        const uploadFile = new File([mediaBlob], item.filename, {
          type: mediaBlob.type || fallbackMime,
          lastModified: Date.now(),
        });

        console.log("🚀 Uploading file to S3 via /api/s3/upload", {
          name: uploadFile.name,
          size: uploadFile.size,
          type: uploadFile.type,
        });

        updateProgress(70);
        uploadedFile = await uploadToS3(uploadFile, folderPrefix);
        updateProgress(85);
      }

      if (!uploadedFile) {
        throw new Error("Failed to stage item on S3");
      }

      updateProgress(90);

      // Persist S3 metadata to database for quick discovery later
      try {
        const response = await fetch("/api/generated-content/update-drive-sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            itemId: item.id,
            itemType: item.itemType,
            folderName: folderLabel,
            driveFileId: uploadedFile.key,
            s3Key: uploadedFile.key,
            s3Url: uploadedFile.url,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("❌ Failed to persist S3 metadata:", errorData);
          throw new Error(errorData.error || "Failed to save S3 metadata");
        }

        console.log("✅ S3 metadata saved to database");
        await fetchContent();
      } catch (metadataError) {
        console.error("⚠️ S3 metadata save warning:", metadataError);
        if (!options.silent) {
          showToast(
            "warning",
            "Upload succeeded but failed to store metadata. Please refresh and verify manually."
          );
        }
      }

      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          uploading: false,
          progress: 100,
          folder,
          success: true,
        },
      }));

      updateProgress(100);

      console.log(`✅ Successfully uploaded ${item.filename} to S3 folder ${folderLabel}`);

      if (!options.silent) {
        showToast("success", `${item.filename} uploaded to ${folderLabel}`);
      }

      // Clear success state after 3 seconds
      setTimeout(() => {
        setUploadStates(prev => {
          const newState = { ...prev };
          delete newState[item.id];
          return newState;
        });
      }, 3000);

      return uploadedFile;
    } catch (error) {
      console.error("💥 S3 upload error:", error);

      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          uploading: false,
          progress: 0,
          folder,
          error: error instanceof Error ? error.message : "Upload failed",
        },
      }));

      if (!options.silent) {
        alert(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      // Clear error state after 5 seconds
      setTimeout(() => {
        setUploadStates(prev => {
          const newState = { ...prev };
          delete newState[item.id];
          return newState;
        });
      }, 5000);

      throw error;
    }
  };

  const handleModalUpload = async (folder: S3FolderName) => {
    if (!showUploadModal) return;
    try {
      await uploadGeneratedItemToS3(showUploadModal, folder);
    } catch (error) {
      console.error('Modal upload error:', error);
    } finally {
      setShowUploadModal(null);
    }
  };

  // Load available folders for upload
  const loadFoldersForUpload = async () => {
    if (!apiClient) return;
    try {
      const response = await apiClient.get("/api/s3/folders/list-custom");
      if (response.ok) {
        const data = await response.json();
        setAvailableFoldersForUpload(data.folders || []);
      }
    } catch (error) {
      console.error("Error loading folders for upload:", error);
    }
  };

  // Load folders when upload modal opens
  useEffect(() => {
    if (showUploadModal && apiClient) {
      loadFoldersForUpload();
    }
  }, [showUploadModal, apiClient]);

  // Load available folders for moving
  const loadFoldersForMove = async () => {
    if (!apiClient) return;
    try {
      const response = await apiClient.get("/api/s3/folders/list-custom");
      if (response.ok) {
        const data = await response.json();
        setAvailableFoldersForMove(data.folders || []);
      }
    } catch (error) {
      console.error("Error loading folders for move:", error);
    }
  };

  // Load folders when move modal opens
  useEffect(() => {
    if (showMoveModal && apiClient) {
      loadFoldersForMove();
    }
  }, [showMoveModal, apiClient]);

  // Load folders when bulk move modal opens
  useEffect(() => {
    if (showBulkMoveModal && apiClient) {
      loadFoldersForMove();
    }
  }, [showBulkMoveModal, apiClient]);

  // Move item to folder
  const moveItemToFolder = async (item: ContentItem, targetFolderPrefix: string, skipConfirm: boolean = false) => {
    if (!apiClient) return { success: false, error: "API client not available" };

    try {
      if (!skipConfirm) {
        showToast("info", `Moving ${item.filename} to folder...`);
      }

      // Extract folder name from prefix for display
      const folderName = targetFolderPrefix.split('/')[2]?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'folder';

      const response = await apiClient.post("/api/s3/move-to-folder", {
        itemId: item.id,
        itemType: item.itemType,
        currentS3Key: item.awsS3Key || item.s3Key,
        targetFolderPrefix,
        filename: item.filename,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to move item" }));
        throw new Error(errorData.error || "Failed to move item");
      }

      const result = await response.json();
      
      if (!skipConfirm) {
        showToast("success", `Successfully moved to ${folderName}!`);
        await fetchContent();
        setShowMoveModal(null);
      }

      return { success: true };
    } catch (error) {
      console.error("Error moving item:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to move item";
      
      if (!skipConfirm) {
        showToast("error", errorMessage);
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Delete image
  const deleteImage = async (image: GeneratedImage) => {
    if (!confirm(`Delete "${image.filename}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setImages((prev) => prev.filter((img) => img.id !== image.id));
        setSelectedItem(null);
        await fetchStats(); // Refresh stats
        alert("Image deleted successfully");
      } else {
        throw new Error("Failed to delete image");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete image");
    }
  };

  // Production Task Functions
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    // Select all displayed items
    const selectableIds = displayedContent.map((item) => item.id);
    setSelectedItems(new Set(selectableIds));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const fetchLinkedContent = async () => {
    if (!apiClient || allContent.length === 0) return;

    try {
      setLoadingLinkedContent(true);
      
      const imageIds = allContent
        .filter((item) => item.itemType === "image")
        .map((item) => item.id);
      const videoIds = allContent
        .filter((item) => item.itemType === "video")
        .map((item) => item.id);

      const response = await apiClient.post("/api/production/check-linked-content", {
        imageIds,
        videoIds,
      });

      if (response.ok) {
        const data = await response.json();
        // Merge both image and video maps
        const combined = { ...data.linkedImages, ...data.linkedVideos };
        setLinkedContentMap(combined);
      }
    } catch (error) {
      console.error("Error fetching linked content:", error);
    } finally {
      setLoadingLinkedContent(false);
    }
  };

  const fetchProductionTasks = async () => {
    if (!apiClient) return;

    try {
      setLoadingTasks(true);
      const response = await apiClient.get("/api/production/my-tasks");

      if (response.ok) {
        const tasks = await response.json();
        setProductionTasks(tasks);
      } else {
        console.error("Failed to fetch production tasks");
        alert("Failed to load production tasks");
      }
    } catch (error) {
      console.error("Error fetching production tasks:", error);
      alert("Error loading production tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  const linkContentToTask = async (taskId: string) => {
    if (!apiClient || selectedItems.size === 0) return;

    try {
      setLinkingContent(true);

      // Separate selected items into images and videos
      const selectedContent = allContent.filter((item) =>
        selectedItems.has(item.id)
      );
      const imageIds = selectedContent
        .filter((item) => item.itemType === "image")
        .map((item) => item.id);
      const videoIds = selectedContent
        .filter((item) => item.itemType === "video")
        .map((item) => item.id);

      const response = await apiClient.post("/api/production/link-content", {
        productionEntryId: taskId,
        imageIds,
        videoIds,
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `✅ ${result.message}\n\n` +
            `Already linked: ${result.alreadyLinked.images} image(s), ${result.alreadyLinked.videos} video(s)`
        );
        clearSelection();
        setShowTaskModal(false);
        // Refresh linked content to update UI
        fetchLinkedContent();
      } else {
        const error = await response.json();
        alert(`Failed to link content: ${error.error}`);
      }
    } catch (error) {
      console.error("Error linking content:", error);
      alert("Error linking content to task");
    } finally {
      setLinkingContent(false);
    }
  };

  const openTaskModal = () => {
    fetchProductionTasks();
    setShowTaskModal(true);
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${kb.toFixed(1)} KB`;
  };

  // Format date
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  };

  // Show skeleton loading on initial load with blur/shimmer effect
  if (loading && !isChangingPage) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
          <div className="flex items-center space-x-6 animate-pulse">
            <div className="p-4 bg-gray-300 dark:bg-gray-700 rounded-2xl w-20 h-20"></div>
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded-lg w-64"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-96"></div>
            </div>
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
          </div>
        </div>

        {/* Toolbar Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex-1"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded-lg w-32"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded-lg w-32"></div>
          </div>
        </div>

        {/* Grid Skeleton with Blur Effect */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="relative group overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-700 aspect-square"
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent"></div>
                
                {/* Blur placeholder */}
                <div className="absolute inset-0 backdrop-blur-xl bg-gradient-to-br from-blue-100/50 to-purple-100/50 dark:from-blue-900/30 dark:to-purple-900/30"></div>
                
                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          
          {/* Loading text */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center space-x-3 text-gray-600 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Loading your generated content...</span>
            </div>
          </div>
        </div>

        {/* Add shimmer animation styles */}
        <style jsx>{`
          @keyframes shimmer {
            100% {
              transform: translateX(100%);
            }
          }
          .animate-shimmer {
            animation: shimmer 2s infinite;
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-6 max-w-md mx-auto p-8">
          <div className="relative">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Something went wrong
            </h3>
            <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Don't worry, this is usually temporary. Try refreshing the page or
              check your internet connection.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => fetchContent(false)}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>

            <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Need help?</span>
              <a
                href="mailto:support@tastycreative.ai"
                className="text-blue-500 hover:text-blue-600 underline"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Unified action functions
  const downloadItem = async (item: ContentItem) => {
    try {
      // Use the same URL logic as the display elements
      const url = getBestMediaUrl({
        awsS3Key: item.awsS3Key,
        awsS3Url: item.awsS3Url,
        s3Key: item.s3Key,
        networkVolumePath: item.networkVolumePath,
        dataUrl: item.dataUrl,
        url: item.url,
        id: item.id,
        filename: item.filename,
        type: item.itemType === "video" ? 'video' : 'image'
      });

      if (!url) {
        console.error("No URL available for download");
        alert("No download URL available for this item");
        return;
      }

      console.log(`📥 Downloading ${item.itemType} from:`, url);

      // Fetch as blob and create download link
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = item.filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      console.log(`✅ ${item.itemType} downloaded successfully`);
    } catch (error) {
      console.error("Download error:", error);
      alert(`Failed to download ${item.itemType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const shareItem = async (item: ContentItem) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.filename,
          url: item.dataUrl || item.url,
        });
        console.log("Shared successfully");
      } else {
        await navigator.clipboard.writeText(item.dataUrl || item.url || "");
        console.log("Link copied to clipboard");
      }
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const deleteItem = async (item: ContentItem, skipConfirm = false) => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    if (!skipConfirm && !window.confirm(`Are you sure you want to delete ${item.filename}?\n\nThis will permanently delete:\n• The file from AWS S3 storage\n• The database record\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      console.log(`🗑️ Deleting ${item.itemType}:`, item.filename, `(ID: ${item.id})`);
      
      const endpoint =
        item.itemType === "video"
          ? `/api/videos/${item.id}`
          : `/api/images/${item.id}`;
      
      const response = await apiClient.delete(endpoint);

      if (response.ok) {
        // Remove from local state
        if (item.itemType === "video") {
          setVideos((prev) => prev.filter((v) => v.id !== item.id));
        } else {
          setImages((prev) => prev.filter((img) => img.id !== item.id));
        }
        setAllContent((prev) =>
          prev.filter((content) => content.id !== item.id)
        );

        if (selectedItem?.id === item.id) {
          setSelectedItem(null);
        }

        console.log(
          `✅ ${
            item.itemType === "video" ? "Video" : "Image"
          } deleted successfully from database and AWS S3`
        );
        
        if (!skipConfirm) {
          alert(`✅ ${item.filename} deleted successfully!`);
        }
        
        // Refresh stats only if not in bulk mode
        if (!skipConfirm) {
          await fetchStats();
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        console.error("Delete failed:", response.status, errorData);
        throw new Error(errorData.error || `Failed to delete: ${response.status}`);
      }
    } catch (error) {
      console.error("💥 Delete error:", error);
      alert(
        `Failed to delete ${item.filename}:\n\n${
          error instanceof Error ? error.message : "Unknown error"
        }\n\nPlease try again or contact support if the problem persists.`
      );
    }
  };

  // Bulk Actions
  const bulkDownload = async () => {
    if (selectedItems.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      const items = allContent.filter(item => selectedItems.has(item.id));
      
      // If only one item, download directly
      if (items.length === 1) {
        await downloadItem(items[0]);
        alert(`✅ Downloaded ${items[0].filename} successfully!`);
      } else {
        // Multiple items - create ZIP
        const zip = new JSZip();
        let successCount = 0;
        let failCount = 0;
        
        // Show progress
        console.log(`📦 Creating ZIP with ${items.length} items...`);
        
        for (const item of items) {
          try {
            // Get the best URL for the item
            const url = getBestMediaUrl(item);
            
            if (!url) {
              console.warn(`No URL available for ${item.filename}`);
              failCount++;
              continue;
            }
            
            // Fetch the file as blob
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch: ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // Add to ZIP with original filename
            zip.file(item.filename, blob);
            successCount++;
            
            console.log(`✅ Added ${item.filename} to ZIP (${successCount}/${items.length})`);
          } catch (error) {
            console.error(`Failed to add ${item.filename} to ZIP:`, error);
            failCount++;
          }
        }
        
        if (successCount === 0) {
          throw new Error("Failed to add any files to ZIP");
        }
        
        // Generate ZIP file
        console.log("🔄 Generating ZIP file...");
        const zipBlob = await zip.generateAsync({ 
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        });
        
        // Create download link
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const folderName = selectedFolder && selectedFolder !== 'all' 
          ? selectedFolder.split('/').filter(Boolean).pop() 
          : 'content';
        const zipFilename = `${folderName}_${timestamp}_${successCount}files.zip`;
        
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log(`✅ ZIP download started: ${zipFilename}`);
        
        // Show result
        let message = `✅ Downloaded ${successCount} item${successCount !== 1 ? 's' : ''} as ZIP file!`;
        if (failCount > 0) {
          message += `\n\n⚠️ ${failCount} item${failCount !== 1 ? 's' : ''} failed to download`;
        }
        alert(message);
      }
      
      clearSelection();
    } catch (error) {
      console.error("Bulk download error:", error);
      alert("Failed to download items. Please try again.");
    } finally {
      setBulkActionLoading(false);
      setShowBulkMenu(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    const items = allContent.filter(item => selectedItems.has(item.id));
    
    if (!confirm(`Are you sure you want to delete ${items.length} item${items.length > 1 ? 's' : ''}?\n\nThis will permanently delete:\n• ${items.length} file${items.length > 1 ? 's' : ''} from AWS S3 storage\n• ${items.length} database record${items.length > 1 ? 's' : ''}\n\nThis action cannot be undone.`)) {
      return;
    }
    
    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    const failedItems: string[] = [];
    
    try {
      for (const item of items) {
        try {
          await deleteItem(item, true); // Skip individual confirmations and alerts
          successCount++;
        } catch (error) {
          failCount++;
          failedItems.push(item.filename);
          console.error(`Failed to delete ${item.filename}:`, error);
        }
      }
      
      // Refresh stats once at the end
      await fetchStats();
      
      // Show comprehensive result
      let message = `Bulk delete complete!\n\n✅ Successfully deleted: ${successCount} item${successCount !== 1 ? 's' : ''}`;
      
      if (failCount > 0) {
        message += `\n\n❌ Failed to delete: ${failCount} item${failCount !== 1 ? 's' : ''}`;
        if (failedItems.length > 0) {
          message += `\n\nFailed items:\n${failedItems.slice(0, 5).join('\n')}`;
          if (failedItems.length > 5) {
            message += `\n... and ${failedItems.length - 5} more`;
          }
        }
      }
      
      alert(message);
      clearSelection();
    } finally {
      setBulkActionLoading(false);
      setShowBulkMenu(false);
    }
  };

  const bulkMoveToFolder = async (targetFolderPrefix: string) => {
    if (selectedItems.size === 0) return;
    
    const items = allContent.filter(item => selectedItems.has(item.id));
    const folderName = targetFolderPrefix.split('/')[2]?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'folder';
    
    if (!confirm(`Move ${items.length} item${items.length > 1 ? 's' : ''} to "${folderName}"?\n\n${items.map(i => `• ${i.filename}`).slice(0, 5).join('\n')}${items.length > 5 ? `\n... and ${items.length - 5} more` : ''}`)) {
      return;
    }
    
    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    const failedItems: string[] = [];
    
    showToast("info", `Moving ${items.length} item${items.length > 1 ? 's' : ''} to ${folderName}...`);
    
    try {
      for (const item of items) {
        try {
          const result = await moveItemToFolder(item, targetFolderPrefix, true);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            failedItems.push(item.filename);
          }
        } catch (error) {
          failCount++;
          failedItems.push(item.filename);
          console.error(`Failed to move ${item.filename}:`, error);
        }
      }
      
      // Refresh content once at the end
      await fetchContent();
      
      // Show comprehensive result
      let message = `Bulk move complete!\n\n✅ Successfully moved: ${successCount} item${successCount !== 1 ? 's' : ''} to ${folderName}`;
      
      if (failCount > 0) {
        message += `\n\n❌ Failed to move: ${failCount} item${failCount !== 1 ? 's' : ''}`;
        if (failedItems.length > 0) {
          message += `\n\nFailed items:\n${failedItems.slice(0, 5).join('\n')}`;
          if (failedItems.length > 5) {
            message += `\n... and ${failedItems.length - 5} more`;
          }
        }
      }
      
      showToast("success", message);
      clearSelection();
      setShowBulkMoveModal(false);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const bulkUploadToS3 = () => {
    setShowBulkMenu(false);
    // Open the upload modal for the first selected item (or handle multiple)
    const firstItem = allContent.find(item => selectedItems.has(item.id));
    if (firstItem) {
      setShowUploadModal(firstItem);
    }
  };

  // Filter Presets
  const saveFilterPreset = () => {
    if (!presetName.trim()) {
      alert("Please enter a name for this preset");
      return;
    }
    
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName,
      filters: { ...advancedFilters },
      filterBy,
      searchQuery
    };
    
    const updatedPresets = [...filterPresets, newPreset];
    setFilterPresets(updatedPresets);
    localStorage.setItem('filterPresets', JSON.stringify(updatedPresets));
    
    setPresetName('');
    setShowPresetModal(false);
    alert(`✅ Preset "${newPreset.name}" saved!`);
  };

  const loadFilterPreset = (preset: FilterPreset) => {
    setAdvancedFilters(preset.filters);
    setFilterBy(preset.filterBy);
    setSearchQuery(preset.searchQuery);
    alert(`✅ Loaded preset "${preset.name}"`);
  };

  const deleteFilterPreset = (presetId: string) => {
    const updatedPresets = filterPresets.filter(p => p.id !== presetId);
    setFilterPresets(updatedPresets);
    localStorage.setItem('filterPresets', JSON.stringify(updatedPresets));
  };

  // Interaction Improvements Functions
  
  const handleArrowNavigation = (key: string) => {
    if (displayedContent.length === 0) return;
    
    const gridCols = getGridColumns();
    let newIndex = focusedItemIndex;
    
    switch (key) {
      case 'ArrowRight':
        newIndex = Math.min(focusedItemIndex + 1, displayedContent.length - 1);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(focusedItemIndex - 1, 0);
        break;
      case 'ArrowDown':
        newIndex = Math.min(focusedItemIndex + gridCols, displayedContent.length - 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(focusedItemIndex - gridCols, 0);
        break;
    }
    
    if (newIndex !== focusedItemIndex) {
      setFocusedItemIndex(newIndex);
      // Scroll item into view
      const element = document.querySelector(`[data-item-index="${newIndex}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const getGridColumns = () => {
    const width = window.innerWidth;
    if (width >= 1536) return 5; // 2xl
    if (width >= 1280) return 4; // xl
    if (width >= 1024) return 3; // lg
    if (width >= 768) return 2;  // md
    return 1; // sm
  };

  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent, item: ContentItem) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Context menu actions
  const contextMenuDownload = () => {
    if (contextMenu?.item) {
      downloadItem(contextMenu.item);
    }
    closeContextMenu();
  };

  const contextMenuDelete = () => {
    if (contextMenu?.item) {
      deleteItem(contextMenu.item);
    }
    closeContextMenu();
  };

  const contextMenuUploadToS3 = () => {
    if (contextMenu?.item) {
      setShowUploadModal(contextMenu.item);
    }
    closeContextMenu();
  };

  const contextMenuAddToTask = () => {
    if (contextMenu?.item) {
      const newSelected = new Set(selectedItems);
      newSelected.add(contextMenu.item.id);
      setSelectedItems(newSelected);
      openTaskModal();
    }
    closeContextMenu();
  };

  const contextMenuToggleSelect = () => {
    if (contextMenu?.item) {
      toggleItemSelection(contextMenu.item.id);
    }
    closeContextMenu();
  };

  // Drag to select
  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey) { // Left click without modifier
      setDragSelecting(true);
      setDragStartIndex(index);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (dragSelecting && dragStartIndex !== -1) {
      // Select all items between dragStartIndex and current index
      const start = Math.min(dragStartIndex, index);
      const end = Math.max(dragStartIndex, index);
      const newSelected = new Set(selectedItems);
      
      for (let i = start; i <= end; i++) {
        if (i < displayedContent.length) {
          newSelected.add(displayedContent[i].id);
        }
      }
      
      setSelectedItems(newSelected);
    }
  };

  const handleMouseUp = () => {
    setDragSelecting(false);
    setDragStartIndex(-1);
  };

  // === Modal/Lightbox Enhancement Functions ===
  
  // Get current modal content index
  const getCurrentModalIndex = () => {
    if (!selectedItem) return -1;
    return filteredAndSortedContent.findIndex(item => item.id === selectedItem.id);
  };

  // Navigate to next item in modal
  const goToNextContent = () => {
    const currentIndex = getCurrentModalIndex();
    if (currentIndex === -1 || currentIndex >= filteredAndSortedContent.length - 1) return;
    setSelectedItem(filteredAndSortedContent[currentIndex + 1]);
    setZoomLevel(1); // Reset zoom on navigation
  };

  // Navigate to previous item in modal
  const goToPreviousContent = () => {
    const currentIndex = getCurrentModalIndex();
    if (currentIndex <= 0) return;
    setSelectedItem(filteredAndSortedContent[currentIndex - 1]);
    setZoomLevel(1); // Reset zoom on navigation
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3)); // Max 3x zoom
    resetControlsTimeout();
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5)); // Min 0.5x zoom
    resetControlsTimeout();
  };

  const resetZoom = () => {
    setZoomLevel(1);
    resetControlsTimeout();
  };

  // Fullscreen controls
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
    resetControlsTimeout();
  };

  // Auto-hide controls
  const resetControlsTimeout = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000); // Hide after 2 seconds
  };

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    resetControlsTimeout();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touchEnd = e.touches[0].clientX;
    const diff = touchStart - touchEnd;
    
    // If swipe distance is significant, navigate
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNextContent();
      } else {
        goToPreviousContent();
      }
      setTouchStart(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  // === Empty States & Feedback Functions ===
  
  // Toast notification system
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, duration: number = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { id, type, message, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remove toast after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  // Remove specific toast
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (validFiles.length === 0) {
      showToast('error', 'Please drop only image or video files');
      return;
    }

    if (validFiles.length !== files.length) {
      showToast('warning', `${files.length - validFiles.length} invalid file(s) ignored`);
    }

    handleFileUpload(validFiles);
  };

  // File upload handler
  const handleFileUpload = async (files: File[]) => {
    if (!apiClient) {
      showToast('error', 'API client not available');
      return;
    }

    showToast('info', `Uploading ${files.length} file(s)...`);

    for (const file of files) {
      const uploadId = Math.random().toString(36).substring(7);
      
      try {
        // Initialize progress
        setUploadProgress(prev => ({
          ...prev,
          [uploadId]: { progress: 0, filename: file.name }
        }));

        // Simulate upload progress (replace with actual API call)
        // In production, use XMLHttpRequest or fetch with progress tracking
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setUploadProgress(prev => ({
            ...prev,
            [uploadId]: { progress: i, filename: file.name }
          }));
        }

        // Remove from progress after completion
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[uploadId];
          return newProgress;
        });

        showToast('success', `${file.name} uploaded successfully`);
        
        // Refresh content list
        fetchContent();
      } catch (error) {
        console.error('Upload error:', error);
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[uploadId];
          return newProgress;
        });
        showToast('error', `Failed to upload ${file.name}`);
      }
    }
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get contextual empty state message
  const getEmptyStateMessage = () => {
    if (searchQuery) {
      return {
        title: 'No matching content found',
        description: `No results for "${searchQuery}". Try different keywords or clear the search.`,
        showFilters: true
      };
    }
    
    if (filterBy !== 'all') {
      return {
        title: `No ${filterBy} found`,
        description: `You haven't generated any ${filterBy} yet. Start creating now!`,
        showFilters: true
      };
    }
    
    const activeFilterCount = Object.values(advancedFilters).filter(v => {
      if (typeof v === 'object' && 'start' in v) return v.start || v.end;
      if (typeof v === 'object' && 'min' in v) return v.min !== 0 || v.max !== Infinity;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v !== 'all';
      return false;
    }).length;

    if (activeFilterCount > 0) {
      return {
        title: 'No content matches your filters',
        description: 'Try adjusting your filter settings or clear all filters to see more content.',
        showFilters: true
      };
    }

    return {
      title: 'Your gallery is empty',
      description: 'Start creating amazing AI-generated content!',
      showFilters: false,
      showUpload: false
    };
  };

  // === S3 Staging Upload Helpers ===

  // Quick upload to S3 (triggered from grid card shortcut)
  const quickUploadToS3 = async (item: ContentItem, folder: S3FolderName) => {
    const queueId = Math.random().toString(36).substring(7);
    const newQueueItem = {
      id: queueId,
      item,
      folder,
      progress: 0,
      status: 'pending' as const,
    };

    setUploadQueue(prev => [...prev, newQueueItem]);
    setShowQueuePanel(true);

    await processUploadQueue(queueId, item, folder);
  };

  // Process upload queue item
  const processUploadQueue = async (queueId: string, item: ContentItem, folder: S3FolderName) => {
    try {
      const folderLabel = getS3FolderByName(folder).name;

      setUploadQueue(prev =>
        prev.map(q => (q.id === queueId ? { ...q, status: 'uploading' as const, progress: 5 } : q))
      );

      await uploadGeneratedItemToS3(item, folder, {
        silent: true,
        onProgress: progress => {
          setUploadQueue(prev =>
            prev.map(q => (q.id === queueId ? { ...q, progress } : q))
          );
        },
      });

      setUploadQueue(prev =>
        prev.map(q =>
          q.id === queueId
            ? { ...q, status: 'completed' as const, progress: 100 }
            : q
        )
      );

      showToast('success', `${item.filename} uploaded to ${folderLabel}`);

      setTimeout(() => {
        setUploadQueue(prev => prev.filter(q => q.id !== queueId));
      }, 3000);
    } catch (error) {
      console.error('Upload queue error:', error);
      setUploadQueue(prev =>
        prev.map(q =>
          q.id === queueId
            ? {
                ...q,
                status: 'failed' as const,
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : q
        )
      );
      showToast('error', `Failed to upload ${item.filename}`);
    }
  };

  // Check if item is already staged to S3
  const isItemStagedToS3 = (itemId: string): boolean => {
    const item = allContent.find(i => i.id === itemId);
    return Boolean(
      item?.stagingStorageKey ||
      item?.googleDriveFileId
    );
  };

  // Retry failed upload
  const retryUpload = (queueId: string) => {
    const queueItem = uploadQueue.find(q => q.id === queueId);
    if (!queueItem) return;

    processUploadQueue(queueId, queueItem.item, queueItem.folder);
  };

  // Remove from upload queue
  const removeFromQueue = (queueId: string) => {
    setUploadQueue(prev => prev.filter(q => q.id !== queueId));
  };

  // Clear completed uploads from queue
  const clearCompletedUploads = () => {
    setUploadQueue(prev => prev.filter(q => q.status !== 'completed'));
  };

  // Toggle upload queue panel
  const toggleQueuePanel = () => {
    setShowQueuePanel(prev => !prev);
  };

  // ==================== Mobile Responsiveness Enhancement Functions ====================
  
  // Pull to refresh handler
  const handlePullStart = (e: React.TouchEvent) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || scrollContainer.scrollTop > 0) return;
    
    setSwipeStartY(e.touches[0].clientY);
    setIsPulling(true);
  };

  const handlePullMove = (e: React.TouchEvent) => {
    if (!isPulling || swipeStartY === null) return;
    
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer && scrollContainer.scrollTop > 0) {
      setIsPulling(false);
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - swipeStartY);
    
    // Max pull distance is 120px
    const maxPull = 120;
    const dampedDistance = Math.min(distance * 0.5, maxPull);
    
    setPullDistance(dampedDistance);
  };

  const handlePullEnd = async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    // Trigger refresh if pulled more than 80px
    if (pullDistance > 80) {
      setIsRefreshing(true);
      setPullDistance(60); // Keep indicator visible during refresh
      
      try {
        await fetchContent();
        showToast('success', 'Content refreshed');
      } catch (error) {
        showToast('error', 'Failed to refresh content');
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setSwipeStartY(null);
      }
    } else {
      setPullDistance(0);
      setSwipeStartY(null);
    }
  };

  // Swipe to delete/select handler for grid items
  const handleCardSwipeStart = (e: React.TouchEvent, itemId: string) => {
    setSwipeStartX(e.touches[0].clientX);
    setSwipeItemId(itemId);
  };

  const handleCardSwipeMove = (e: React.TouchEvent) => {
    if (swipeStartX === null || !swipeItemId) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - swipeStartX;
    
    // Only allow left swipe (negative diff)
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, -120)); // Max swipe is 120px left
    }
  };

  const handleCardSwipeEnd = () => {
    if (!swipeItemId) return;

    // If swiped more than 60px, trigger action
    if (swipeOffset < -60) {
      // Show delete confirmation or toggle selection
      if (selectedItems.has(swipeItemId)) {
        toggleItemSelection(swipeItemId);
        showToast('info', 'Item deselected');
      } else {
        toggleItemSelection(swipeItemId);
        showToast('info', 'Item selected');
      }
    }

    // Reset swipe
    setSwipeOffset(0);
    setSwipeStartX(null);
    setSwipeItemId(null);
  };

  // Mobile bottom sheet handlers
  const openMobileBottomSheet = (content: 'actions' | 'filters') => {
    setMobileBottomSheetContent(content);
    setShowMobileBottomSheet(true);
  };

  const closeMobileBottomSheet = () => {
    setShowMobileBottomSheet(false);
    setTimeout(() => setMobileBottomSheetContent(null), 300);
  };

  // Touch-optimized selection toggle
  const handleMobileItemLongPress = (itemId: string) => {
    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    toggleItemSelection(itemId);
    showToast('info', selectedItems.has(itemId) ? 'Item deselected' : 'Item selected');
  };

  // Clear advanced filters
  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      dateRange: { start: '', end: '' },
      fileSize: { min: 0, max: Infinity },
      aspectRatio: 'all',
      formats: [],
      linkedStatus: 'all',
      panelOpen: advancedFilters.panelOpen
    });
  };

  // Check if advanced filters are active
  const hasActiveAdvancedFilters = 
    advancedFilters.dateRange.start !== '' ||
    advancedFilters.dateRange.end !== '' ||
    advancedFilters.fileSize.min !== 0 ||
    advancedFilters.fileSize.max !== Infinity ||
    advancedFilters.aspectRatio !== 'all' ||
    advancedFilters.formats.length > 0 ||
    advancedFilters.linkedStatus !== 'all';

  return (
    <div className="space-y-6 relative">
      {/* Lightweight Page Change Loading Banner */}
      {isChangingPage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-semibold">Loading page {currentPage}...</span>
          </div>
        </div>
      )}

      {/* Add animation for the banner */}
      <style jsx>{`
        @keyframes slide-down {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
      
      {/* Enhanced Header with Softer Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10">
          <div className="absolute inset-0 bg-grid-pattern"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-md">
              <ImageIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
                Generated Content
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">
                Manage your AI-generated images and videos
              </p>
              <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
                  <span>Live updates</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>
                  <span>Cloud synchronized</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                fetchContent();
                fetchStats();
              }}
              disabled={loading}
              className="flex items-center space-x-3 px-6 py-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 text-gray-700 dark:text-gray-200 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-slate-700 group"
              title="Refresh content"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-gray-700 dark:text-gray-200" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 text-gray-700 dark:text-gray-200 group-hover:rotate-180 transition-transform duration-500" />
                  <span>Refresh</span>
                </>
              )}
            </button>

            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 backdrop-blur-sm rounded-2xl p-5 shadow-md">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {allContent.length}
                </div>
                <div className="text-sm text-blue-100 font-medium mt-1">
                  Total Items
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin User Selection Banner */}
      {isAdmin && selectedUserId && (
        <div className="bg-gradient-to-r from-purple-100 via-blue-100 to-indigo-100 dark:from-purple-900/30 dark:via-blue-900/30 dark:to-indigo-900/30 border-2 border-purple-300 dark:border-purple-600 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500 rounded-xl shadow-md">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Viewing User Content
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {availableUsers.find(u => u.clerkId === selectedUserId)?.name || 'Unknown User'}
                  {availableUsers.find(u => u.clerkId === selectedUserId)?.email && (
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      ({availableUsers.find(u => u.clerkId === selectedUserId)?.email})
                    </span>
                  )}
                  <span className="ml-3 px-2 py-1 bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs rounded-full font-semibold">
                    {availableUsers.find(u => u.clerkId === selectedUserId)?.role}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedUserId(null)}
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-300 dark:border-gray-600 transition-all duration-200 font-medium"
            >
              <X className="w-4 h-4" />
              <span>View All Users</span>
            </button>
          </div>
        </div>
      )}

      {/* Shared Folder Banner */}
      {selectedFolderInfo?.isShared && (
        <div className="bg-gradient-to-r from-purple-100 via-indigo-100 to-blue-100 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-blue-900/30 border-2 border-purple-300 dark:border-purple-600 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500 rounded-xl shadow-md">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Shared Folder
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>{selectedFolderInfo.name}</strong> shared by {selectedFolderInfo.sharedBy}
                  <span className="ml-3 px-2 py-1 bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs rounded-full font-semibold">
                    {selectedFolderInfo.permission === 'VIEW' ? 'View Only' : 'Can Edit'}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedFolder(null);
                setSelectedFolderInfo(null);
                setCurrentPage(1);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-300 dark:border-gray-600 transition-all duration-200 font-medium"
            >
              <X className="w-4 h-4" />
              <span>Clear Filter</span>
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Enhanced Stats */}
      {(imageStats || videoStats) && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setStatsCollapsed(!statsCollapsed)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Statistics
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({allContent.length} items)
              </span>
            </div>
            {statsCollapsed ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          {!statsCollapsed && (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {imageStats && (
            <>
              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-600">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <FileImage className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Images
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {imageStats.totalImages.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Generated files
                    </p>
                  </div>
                  <div className="text-blue-500 opacity-20 group-hover:opacity-40 transition-opacity">
                    <FileImage className="w-12 h-12" />
                  </div>
                </div>
              </div>

              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-green-300 dark:hover:border-green-600">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                        <HardDrive className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Storage
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {(imageStats.totalSize / 1024 / 1024).toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      MB used
                    </p>
                  </div>
                  <div className="text-green-500 opacity-20 group-hover:opacity-40 transition-opacity">
                    <HardDrive className="w-12 h-12" />
                  </div>
                </div>
              </div>
            </>
          )}

          {videoStats && (
            <>
              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-purple-300 dark:hover:border-purple-600">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Videos
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {videoStats.totalVideos.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Generated files
                    </p>
                  </div>
                  <div className="text-purple-500 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Video className="w-12 h-12" />
                  </div>
                </div>
              </div>

              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-orange-300 dark:hover:border-orange-600">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                        <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Storage
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {(videoStats.totalSize / 1024 / 1024).toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      MB used
                    </p>
                  </div>
                  <div className="text-orange-500 opacity-20 group-hover:opacity-40 transition-opacity">
                    <BarChart3 className="w-12 h-12" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
          )}
        </div>
      )}

      {/* Selection Toolbar */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4 flex-wrap">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <CheckSquare className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""} selected
                </span>
              </div>
              <button
                onClick={clearSelection}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                Clear selection
              </button>
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                Select all on page
              </button>
            </div>
            <div className="flex items-center space-x-3 flex-wrap">
              {/* Bulk Actions - Hidden for shared folders */}
              {!selectedFolderInfo?.isShared && (
                <>
                  <button
                    onClick={bulkDownload}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={bulkUploadToS3}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>Upload to S3</span>
                  </button>
                  <button
                    onClick={async () => {
                      // Load available folders
                      await loadFoldersForMove();
                      setShowBulkMoveModal(true);
                    }}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200"
                  >
                    <FolderInput className="w-4 h-4" />
                    <span>Move to Folder</span>
                  </button>
                  <button
                    onClick={bulkDelete}
                    className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={openTaskModal}
                    disabled={linkingContent}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>{linkingContent ? "Linking..." : "Add to Task"}</span>
                  </button>
                </>
              )}
              
              {/* Download only for shared folders */}
              {selectedFolderInfo?.isShared && (
                <button
                  onClick={bulkDownload}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Selected</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          {/* Search Section */}
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search your content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filter and Sort Controls */}
          <div className="flex items-center space-x-3">
            {/* Content Type Filter */}
            <div className="relative">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <option value="all">All Content</option>
                <option value="images">🖼️ Images Only</option>
                <option value="videos">🎥 Videos Only</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {/* Sort Options */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <option value="newest">⏰ Newest First</option>
                <option value="oldest">🕐 Oldest First</option>
                <option value="largest">📊 Largest First</option>
                <option value="smallest">📉 Smallest First</option>
                <option value="name">🔤 Name A-Z</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {/* Items Per Page Selector */}
            <div className="relative">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  setItemsPerPage(newValue);
                  // Save preference to localStorage
                  localStorage.setItem('itemsPerPage', newValue.toString());
                  // Reset to page 1
                  setCurrentPage(1);
                  setHasMoreImages(false);
                  setHasMoreVideos(false);
                  // The useEffect that watches itemsPerPage will trigger refetch
                }}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
                title="Items per page"
              >
                <option value="20">📄 20 per page</option>
                <option value="50">📄 50 per page</option>
                <option value="100">📄 100 per page</option>
                <option value="200">📄 200 per page</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {/* Admin User Filter */}
            {isAdmin && !adminLoading && (
              <div className="relative">
                <select
                  value={selectedUserId || ""}
                  onChange={(e) => setSelectedUserId(e.target.value || null)}
                  disabled={loadingUsers}
                  className="appearance-none bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border-2 border-purple-300 dark:border-purple-600 text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 font-medium cursor-pointer hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/50 dark:hover:to-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed [&>option]:bg-white [&>option]:dark:bg-gray-800 [&>option]:text-gray-900 [&>option]:dark:text-white [&>option]:py-2"
                  title="Admin: View any user's content"
                >
                  <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">👤 All Users</option>
                  {availableUsers.map((user) => (
                    <option key={user.clerkId} value={user.clerkId} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      {user.role === 'ADMIN' ? '⭐ ' : user.role === 'MANAGER' ? '👔 ' : '👤 '}
                      {user.name} {user.email ? `(${user.email})` : ''} - {user.totalContent} items
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-purple-600 dark:text-purple-400">
                  {loadingUsers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </div>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 border border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-md"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-md"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Selection Mode Toggle */}
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border transition-all duration-200 font-medium text-sm ${
                selectionMode
                  ? "bg-blue-600 text-white border-blue-600 shadow-md"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
              title={selectionMode ? "Exit selection mode" : "Enter selection mode - Show all checkboxes"}
            >
              <MousePointer2 className="w-4 h-4" />
              <span>{selectionMode ? "Exit Select" : "Select Mode"}</span>
            </button>

            {/* Keyboard Shortcuts Help */}
            <div className="relative group">
              <button
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-all"
                title="Keyboard shortcuts"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              
              {/* Shortcuts Tooltip */}
              <div className="absolute right-0 top-12 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center">
                  <Keyboard className="w-4 h-4 mr-2" />
                  Keyboard Shortcuts
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Select All</span>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono">Ctrl+A</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Delete Selected</span>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono">Delete</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Navigate</span>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono">Arrow Keys</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Toggle Select</span>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono">Space</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Close/Cancel</span>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono">Esc</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Right-click Menu</span>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono">Right Click</kbd>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                      <Move className="w-3 h-3 mr-1" />
                      <span>Drag to select multiple items</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setAdvancedFilters({...advancedFilters, panelOpen: !advancedFilters.panelOpen})}
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Advanced Filters</span>
            {advancedFilters.panelOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {(advancedFilters.dateRange.start || advancedFilters.dateRange.end || 
              advancedFilters.fileSize.min > 0 || advancedFilters.fileSize.max < Infinity ||
              advancedFilters.aspectRatio !== 'all' || advancedFilters.formats.length > 0 ||
              advancedFilters.linkedStatus !== 'all') && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-semibold">
                Active
              </span>
            )}
          </button>

          {advancedFilters.panelOpen && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date Range
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={advancedFilters.dateRange.start || ''}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      dateRange: {...advancedFilters.dateRange, start: e.target.value}
                    })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={advancedFilters.dateRange.end || ''}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      dateRange: {...advancedFilters.dateRange, end: e.target.value}
                    })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* File Size Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  File Size (MB)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Min"
                    value={advancedFilters.fileSize.min === 0 ? '' : advancedFilters.fileSize.min}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      fileSize: {...advancedFilters.fileSize, min: parseFloat(e.target.value) || 0}
                    })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Max"
                    value={advancedFilters.fileSize.max === Infinity ? '' : advancedFilters.fileSize.max}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      fileSize: {...advancedFilters.fileSize, max: parseFloat(e.target.value) || Infinity}
                    })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Aspect Ratio Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Aspect Ratio
                </label>
                <select
                  value={advancedFilters.aspectRatio}
                  onChange={(e) => setAdvancedFilters({
                    ...advancedFilters,
                    aspectRatio: e.target.value as AspectRatio
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Ratios</option>
                  <option value="portrait">📱 Portrait</option>
                  <option value="landscape">🖥️ Landscape</option>
                  <option value="square">⬛ Square</option>
                </select>
              </div>

              {/* Format Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Formats
                </label>
                <div className="flex flex-wrap gap-2">
                  {['PNG', 'JPEG', 'WEBP', 'MP4', 'MOV'].map((format) => (
                    <button
                      key={format}
                      onClick={() => {
                        const formats = advancedFilters.formats.includes(format)
                          ? advancedFilters.formats.filter(f => f !== format)
                          : [...advancedFilters.formats, format];
                        setAdvancedFilters({...advancedFilters, formats});
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                        advancedFilters.formats.includes(format)
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Linked Status Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Task Status
                </label>
                <select
                  value={advancedFilters.linkedStatus}
                  onChange={(e) => setAdvancedFilters({
                    ...advancedFilters,
                    linkedStatus: e.target.value as LinkedStatus
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Items</option>
                  <option value="linked">✅ Linked to Tasks</option>
                  <option value="unlinked">⭕ Not Linked</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={() => setAdvancedFilters({
                    dateRange: { start: '', end: '' },
                    fileSize: { min: 0, max: Infinity },
                    aspectRatio: 'all',
                    formats: [],
                    linkedStatus: 'all',
                    panelOpen: advancedFilters.panelOpen
                  })}
                  className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {(searchQuery || filterBy !== "all") && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {filteredAndSortedContent.length === 1
                  ? "1 item found"
                  : `${filteredAndSortedContent.length} items found`}
                {searchQuery && (
                  <span className="ml-1">
                    for "
                    <span className="font-medium text-gray-900 dark:text-white">
                      {searchQuery}
                    </span>
                    "
                  </span>
                )}
              </span>

              {(searchQuery || filterBy !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterBy("all");
                  }}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Layout with Folder Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folder Management Sidebar */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <FolderList 
              onFolderSelect={(folderPrefix) => {
                console.log('📁 Selected folder:', folderPrefix);
                setSelectedFolder(folderPrefix);
                fetchFolderInfo(folderPrefix);
                // Reset to page 1 when folder changes
                setCurrentPage(1);
              }}
              selectedFolder={selectedFolder || undefined}
            />
            
            {/* Clear Folder Filter Button */}
            {selectedFolder && selectedFolder !== 'outputs/' && (
              <button
                onClick={() => {
                  setSelectedFolder(null);
                  setSelectedFolderInfo(null);
                  setCurrentPage(1);
                }}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 py-2 px-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="flex items-center justify-center gap-2">
                  <X className="w-4 h-4" />
                  Clear folder filter
                </span>
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-3">
          {/* Active Folder Filter Badge */}
          {selectedFolder && selectedFolder !== 'outputs/' && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Showing content from: <strong>{selectedFolder.split('/').slice(0, 3).join('/').split('/')[2]?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</strong>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFolder(null);
                    setSelectedFolderInfo(null);
                    setCurrentPage(1);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

      {/* Enhanced Empty State with Drag & Drop */}
      {filteredAndSortedContent.length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-2xl mx-auto">
            {/* Drag & Drop Zone */}
            {getEmptyStateMessage().showUpload && (
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`mb-12 p-12 border-3 border-dashed rounded-3xl transition-all duration-300 cursor-pointer ${
                  isDraggingOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-4">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isDraggingOver
                      ? 'bg-blue-500 scale-110'
                      : 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-900'
                  }`}>
                    <UploadCloud className={`w-10 h-10 ${
                      isDraggingOver ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                    }`} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {isDraggingOver ? 'Drop files here' : 'Drag & drop files here'}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      or <span className="text-blue-600 dark:text-blue-400 font-semibold">click to browse</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                      Supports images (PNG, JPG, WebP) and videos (MP4, WebM)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State Icon & Message */}
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Search className="w-4 h-4 text-white" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {getEmptyStateMessage().title}
            </h3>

            <div className="space-y-2 mb-8">
              <p className="text-gray-600 dark:text-gray-400">
                {getEmptyStateMessage().description}
              </p>
              
              {/* Active Filters Display */}
              {getEmptyStateMessage().showFilters && (searchQuery || filterBy !== "all") && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  {searchQuery && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      Search: "{searchQuery}"
                      <button
                        onClick={() => setSearchQuery("")}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterBy !== "all" && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                      Filter:{" "}
                      {filterBy === "images" ? "🖼️ Images" : "🎥 Videos"}
                      <button
                        onClick={() => setFilterBy("all")}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {getEmptyStateMessage().showFilters ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterBy("all");
                    clearAdvancedFilters();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                >
                  Clear all filters
                </button>
              ) : (
                <>
                  <a
                    href="/workspace/generate-content/text-to-image"
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 inline-flex items-center space-x-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Generate Images</span>
                  </a>

                  <a
                    href="/workspace/generate-content/image-to-video"
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 inline-flex items-center space-x-2"
                  >
                    <Video className="w-4 h-4" />
                    <span>Generate Videos</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Enhanced Grid View with Lazy Loading */}
          {viewMode === "grid" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {displayedContent.map((item, index) => {
                  const isLinked = linkedContentMap[item.id];
                  const linkedTasks = isLinked || [];
                  const isFocused = focusedItemIndex === index;
                  
                  return (
                  <div
                    key={item.id}
                    data-item-index={index}
                    className={`group bg-white dark:bg-gray-800 rounded-2xl border overflow-visible transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer ${
                      selectedItems.has(item.id)
                        ? 'border-blue-500 dark:border-blue-400 ring-4 ring-blue-400/50 dark:ring-blue-500/50 shadow-xl shadow-blue-500/20'
                        : isFocused
                        ? 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-300 dark:ring-purple-600'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm'
                    }`}
                    style={{
                      animationDelay: `${index * 0.05}s`,
                    }}
                    onClick={(e) => {
                      // Only handle clicks on the card itself, not on buttons
                      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('label')) {
                        return; // Let button/checkbox/label handle its own click
                      }
                      setSelectedItem(item);
                      setFocusedItemIndex(index);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    onMouseDown={(e) => handleMouseDown(e, index)}
                    onMouseEnter={() => handleMouseEnter(index)}
                    tabIndex={0}
                    onFocus={() => setFocusedItemIndex(index)}
                  >
                    {/* Aspect Ratio Container - Prevents layout shift */}
                    <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-900">
                      {/* Hover Overlay with Blur Effect */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 pointer-events-none" />
                      
                      {/* Selection Checkbox - Always visible in selection mode or on hover */}
                      <div className={`absolute top-3 left-3 z-20 transition-opacity duration-200 ${
                        selectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        <label
                          className="flex items-center justify-center w-9 h-9 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:scale-110 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </div>

                      {/* Keyboard Focus Indicator */}
                      {isFocused && (
                        <div className="absolute top-3 right-3 z-20">
                          <div className="bg-purple-500 text-white p-2 rounded-lg shadow-lg animate-pulse">
                            <Keyboard className="w-4 h-4" />
                          </div>
                        </div>
                      )}

                      {/* Lazy Loaded Media */}
                      <LazyMedia 
                        item={item} 
                        onClick={() => setSelectedItem(item)} 
                      />

                    {/* Content Type Badge - Better positioning */}
                    <div className="absolute bottom-3 left-3 z-10">
                      <div
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-md border transition-all duration-300 ${
                          item.itemType === "video"
                            ? "bg-purple-500/90 text-white border-purple-400"
                            : "bg-blue-500/90 text-white border-blue-400"
                        }`}
                      >
                        {item.itemType === "video" ? (
                          <>
                            <Video className="w-3 h-3" />
                            <span>VIDEO</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-3 h-3" />
                            <span>IMAGE</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Upload Status Badge */}
                    {uploadStates[item.id] && (
                      <div className="absolute top-16 left-3">
                        {uploadStates[item.id].uploading ? (
                          <div className="bg-blue-500/90 text-white px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-sm border border-blue-400/50 flex items-center space-x-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Uploading {uploadStates[item.id].progress}%</span>
                          </div>
                        ) : uploadStates[item.id].success ? (
                          <div className="bg-green-500/90 text-white px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-sm border border-green-400/50 flex items-center space-x-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>Uploaded to {uploadStates[item.id].folder ? getFolderName(uploadStates[item.id].folder!) : 'S3'}</span>
                          </div>
                        ) : uploadStates[item.id].error ? (
                          <div className="bg-red-500/90 text-white px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-sm border border-red-400/50 flex items-center space-x-1">
                            <X className="w-3 h-3" />
                            <span>Upload failed</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Duration Badge for Videos */}
                    {item.itemType === "video" && item.duration && (
                      <div className="absolute top-3 right-3">
                        <div className="bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-sm">
                          {item.duration.toFixed(1)}s
                        </div>
                      </div>
                    )}



                    {/* Play Button for Videos */}
                    {item.itemType === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                        <div className="p-5 bg-white/25 rounded-full backdrop-blur-md border-2 border-white/40 shadow-2xl pointer-events-auto">
                          <Play className="w-10 h-10 text-white drop-shadow-2xl" />
                        </div>
                      </div>
                    )}
                    </div>
                    {/* End of aspect-square container */}

                  {/* Enhanced Card Footer with better typography */}
                  <div className="p-5">
                    <h3
                      className="text-base font-semibold text-gray-900 dark:text-white truncate mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200"
                      title={item.filename}
                    >
                      {item.filename}
                    </h3>

                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center space-x-1.5">
                          <HardDrive className="w-4 h-4" />
                          <span className="font-medium">{formatFileSize(item.fileSize)}</span>
                        </span>

                        {item.width && item.height && (
                          <span className="flex items-center space-x-1.5">
                            <span className="text-base">📐</span>
                            <span className="font-medium">
                              {item.width}×{item.height}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {formatDate(item.createdAt).split(" ")[0]}
                      </div>
                    </div>

                    {/* Progress bar for file size visualization */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden mb-4">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          item.itemType === "video"
                            ? "bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700"
                            : "bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700"
                        }`}
                        style={{
                          width: `${Math.min(
                            ((item.fileSize || 0) / (10 * 1024 * 1024)) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>

                    {/* Action Buttons - Conditional based on folder ownership */}
                    {selectedFolderInfo?.isShared ? (
                      // Shared folder - Download only
                      <div className="flex justify-center p-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadItem(item);
                          }}
                          className={`flex-1 p-3 ${isMobile ? 'min-h-[44px]' : ''} bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg`}
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                          <span>Download</span>
                        </button>
                      </div>
                    ) : (
                      // Own folder - All actions
                      <div className="grid grid-cols-2 gap-2">
                        {/* Download Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadItem(item);
                          }}
                          className={`p-2.5 ${isMobile ? 'min-h-[44px]' : ''} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200 flex items-center justify-center`}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        
                        {/* Quick Upload to S3 with Folder Dropdown */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickUploadItem(quickUploadItem === item.id ? null : item.id);
                            }}
                            className={`w-full p-2.5 ${isMobile ? 'min-h-[44px]' : ''} ${isItemStagedToS3(item.id) ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400' : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400'} rounded-lg transition-all duration-200 flex items-center justify-center`}
                            title={isItemStagedToS3(item.id) ? "Already staged on S3 - Upload again" : "Upload to S3 staging"}
                          >
                            {isItemStagedToS3(item.id) ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Cloud className="w-4 h-4" />
                            )}
                          </button>

                          {/* Folder Dropdown Menu */}
                          {quickUploadItem === item.id && (
                            <div 
                              className="absolute bottom-full mb-2 right-0 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-2">
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                                  Upload to folder:
                                </div>
                                
                                {/* Predefined Folders */}
                                {S3_UPLOAD_FOLDERS.map((folder) => (
                                  <button
                                    key={folder.prefix}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      quickUploadToS3(item, folder.name);
                                      setQuickUploadItem(null);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-150"
                                  >
                                    <Folder className="w-4 h-4 text-blue-500" />
                                    <span>{folder.name}</span>
                                  </button>
                                ))}

                                {/* Full Upload Modal Option */}
                                <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowUploadModal(item);
                                    setQuickUploadItem(null);
                                  }}
                                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-150"
                                >
                                  <Upload className="w-4 h-4" />
                                  <span>More Options...</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Move to Folder Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMoveModal(item);
                          }}
                          className={`p-2.5 ${isMobile ? 'min-h-[44px]' : ''} bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-lg transition-all duration-200 flex items-center justify-center`}
                          title="Move to folder"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(item);
                          }}
                          className={`p-2.5 ${isMobile ? 'min-h-[44px]' : ''} bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-all duration-200 flex items-center justify-center`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Status Indicators Below Buttons */}
                    {(isLinked || isItemStagedToS3(item.id)) && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {/* Linked Indicator */}
                        {isLinked && (
                          <div 
                            className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2.5 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-help text-xs font-medium"
                            title={`Linked to: ${linkedTasks.map((t: any) => t.influencer).join(', ')}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Linked</span>
                          </div>
                        )}

                        {/* S3 Staging Indicator */}
                        {isItemStagedToS3(item.id) && (
                          <div 
                            className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2.5 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs font-medium"
                            title="Synced to S3 staging"
                          >
                            <Cloud className="w-3.5 h-3.5" />
                            <CheckCircle className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
            
            {/* Infinite Scroll Loading Trigger - Only show in infinite scroll mode */}
            {useInfiniteScroll && (hasMoreImages || hasMoreVideos) && !isLoadingMore && !loading && (
              <div
                ref={loadMoreRef}
                className="flex flex-col items-center justify-center py-8 space-y-2"
              >
                <div className="text-gray-400 dark:text-gray-500">
                  <Loader2 className="w-6 h-6 animate-pulse mx-auto" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Scroll to load more...
                </p>
              </div>
            )}

            {/* Show loading indicator when fetching more data */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Fetching more content...</span>
              </div>
            )}
            
            {/* Show when all items are loaded - Only in infinite scroll mode */}
            {useInfiniteScroll && !hasMoreImages && !hasMoreVideos && displayedContent.length > 0 && !loading && !isLoadingMore && (
              <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
                <div className="inline-flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-full">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">All {displayedContent.length} items loaded</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {totalImages} images • {totalVideos} videos
                </p>
              </div>
            )}

            {/* Enhanced Animated Pagination Controls - Grid View */}
            {!useInfiniteScroll && totalPages > 1 && !loading && (
              <div className="flex flex-wrap items-center justify-center gap-3 py-8 px-4 border-t border-gray-200 dark:border-gray-700">
                {/* First Page Button */}
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="group relative px-3 py-2 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
                  title="First Page"
                >
                  <span className="text-sm font-medium">⏮</span>
                </button>

                {/* Previous Button */}
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="group relative px-4 py-2 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  <span className="text-sm font-medium">← Previous</span>
                </button>

                {/* Page Numbers with Animation */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`relative w-11 h-11 rounded-xl font-semibold transition-all duration-300 transform hover:scale-110 ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/50 dark:shadow-blue-500/30 scale-110 ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                            : 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg'
                        }`}
                      >
                        <span className="relative z-10">{pageNum}</span>
                        {currentPage === pageNum && (
                          <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300"></span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="group relative px-4 py-2 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  <span className="text-sm font-medium">Next →</span>
                </button>

                {/* Last Page Button */}
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="group relative px-3 py-2 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
                  title="Last Page"
                >
                  <span className="text-sm font-medium">⏭</span>
                </button>

                {/* Quick Page Jump Dropdown */}
                <div className="relative ml-2">
                  <select
                    value={currentPage}
                    onChange={(e) => goToPage(parseInt(e.target.value))}
                    className="appearance-none px-4 py-2 pr-10 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-blue-300 dark:border-blue-600 text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <option key={page} value={page}>
                        Page {page}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Enhanced Page Info */}
                <div className="ml-2 px-4 py-2 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700">
                  <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {currentPage} / {totalPages}
                  </span>
                </div>
              </div>
            )}
            </>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:border-gray-700">
                {displayedContent.map((item) => {
                  const isLinked = linkedContentMap[item.id];
                  const linkedTasks = isLinked || [];
                  
                  return (
                  <div
                    key={item.id}
                    className={`p-4 transition-colors ${
                      isLinked
                        ? 'bg-green-50 dark:bg-green-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Checkbox or Linked indicator */}
                      <div className="flex-shrink-0">
                        {isLinked ? (
                          <div className="w-6 h-6 flex items-center justify-center bg-green-500 rounded text-white">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-6 h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        )}
                      </div>

                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {item.itemType === "video" ? (
                          <>
                            <video
                              src={getBestMediaUrl({
                                awsS3Key: item.awsS3Key,
                                awsS3Url: item.awsS3Url,
                                s3Key: item.s3Key,
                                networkVolumePath: item.networkVolumePath,
                                dataUrl: item.dataUrl,
                                url: item.url,
                                id: item.id,
                                filename: item.filename,
                                type: 'video'
                              })}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setSelectedItem(item)}
                              preload="metadata"
                              muted
                              onError={(e) => {
                                console.error(
                                  "List view video load error for:",
                                  item.filename
                                );

                                // Try fallback URLs in priority order
                                const fallbackUrls = [
                                  item.awsS3Url,
                                  item.awsS3Key ? `https://tastycreative.s3.amazonaws.com/${item.awsS3Key}` : null,
                                  item.dataUrl,
                                  item.url
                                ].filter(Boolean);

                                const currentIndex = fallbackUrls.indexOf((e.target as HTMLVideoElement).src);
                                const nextIndex = currentIndex + 1;
                                
                                if (nextIndex < fallbackUrls.length) {
                                  (e.target as HTMLVideoElement).src = fallbackUrls[nextIndex]!;
                                } else {
                                  console.error(
                                    "All URLs failed for:",
                                    item.filename
                                  );
                                  (e.target as HTMLVideoElement).style.display = "none";
                                }
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="p-2 bg-black bg-opacity-50 rounded-full">
                                <Play className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={getBestMediaUrl(item)}
                            alt={item.filename}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setSelectedItem(item)}
                            onError={(e) => {
                              console.warn(
                                "⚠️ List view image load error for:",
                                item.filename
                              );

                              const currentSrc = (e.target as HTMLImageElement).src;
                              
                              // Try fallback URLs in order: AWS S3 -> Database -> ComfyUI -> Placeholder
                              if (item.awsS3Key && !currentSrc.includes(item.awsS3Key)) {
                                console.log("List view trying AWS S3 URL for:", item.filename);
                                (e.target as HTMLImageElement).src = `https://tastycreative.s3.amazonaws.com/${item.awsS3Key}`;
                              } else if (item.awsS3Url && currentSrc !== item.awsS3Url) {
                                console.log("List view trying direct AWS S3 URL for:", item.filename);
                                (e.target as HTMLImageElement).src = item.awsS3Url;
                              } else if (item.dataUrl && !currentSrc.includes('/api/images/')) {
                                console.log("Falling back to database URL for:", item.filename);
                                (e.target as HTMLImageElement).src = item.dataUrl;
                              } else if (item.url && currentSrc !== item.url) {
                                console.log("Falling back to ComfyUI URL for:", item.filename);
                                (e.target as HTMLImageElement).src = item.url;
                              } else {
                                console.error("All URLs failed for:", item.filename);
                                (e.target as HTMLImageElement).src = "/api/placeholder-image";
                              }
                            }}
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.filename}
                          </p>
                          {item.itemType === "video" ? (
                            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              <Video className="w-3 h-3 mr-1" />
                              Video
                            </div>
                          ) : (
                            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              Image
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatDate(item.createdAt)}</span>
                          {item.width && item.height && (
                            <span>
                              {item.width}×{item.height}
                            </span>
                          )}
                          {item.itemType === "video" && item.duration && (
                            <span>{item.duration.toFixed(1)}s</span>
                          )}
                          <span>{formatFileSize(item.fileSize)}</span>
                          {item.format && (
                            <span>{item.format.toUpperCase()}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="View item"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadItem(item)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Download item"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => shareItem(item)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Share item"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              
              {/* Infinite Scroll Loading Trigger for List View - Only in infinite scroll mode */}
              {useInfiniteScroll && (hasMoreImages || hasMoreVideos) && !isLoadingMore && !loading && (
                <div
                  ref={loadMoreRef}
                  className="flex flex-col items-center justify-center py-6 border-t border-gray-200 dark:border-gray-700 space-y-2"
                >
                  <div className="text-gray-400 dark:text-gray-500">
                    <Loader2 className="w-5 h-5 animate-pulse" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Scroll to load more...
                  </p>
                </div>
              )}

              {/* Show loading indicator when fetching more data */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-6 border-t border-gray-200 dark:border-gray-700">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Fetching more content...</span>
                </div>
              )}
              
              {/* Show when all items are loaded - Only in infinite scroll mode */}
              {useInfiniteScroll && !hasMoreImages && !hasMoreVideos && displayedContent.length > 0 && !loading && !isLoadingMore && (
                <div className="text-center py-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="inline-flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">All {displayedContent.length} items loaded</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {totalImages} images • {totalVideos} videos
                  </p>
                </div>
              )}

              {/* Enhanced Animated Pagination Controls - List View */}
              {!useInfiniteScroll && totalPages > 1 && !loading && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 py-6 px-4 border-t border-gray-200 dark:border-gray-700">
                  {/* First Page Button */}
                  <button
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="group relative px-2.5 py-1.5 text-sm rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-md disabled:hover:scale-100 disabled:hover:shadow-none"
                    title="First Page"
                  >
                    <span className="text-xs font-medium">⏮</span>
                  </button>

                  {/* Previous Button */}
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="group relative px-3 py-1.5 text-sm rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-md disabled:hover:scale-100 disabled:hover:shadow-none"
                  >
                    <span className="text-xs font-medium">← Prev</span>
                  </button>

                  {/* Page Numbers with Animation */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`relative w-9 h-9 rounded-lg font-semibold text-sm transition-all duration-300 transform hover:scale-110 ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50 dark:shadow-blue-500/30 scale-110 ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-1 dark:ring-offset-gray-900'
                              : 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md'
                          }`}
                        >
                          <span className="relative z-10">{pageNum}</span>
                          {currentPage === pageNum && (
                            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-300"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="group relative px-3 py-1.5 text-sm rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-md disabled:hover:scale-100 disabled:hover:shadow-none"
                  >
                    <span className="text-xs font-medium">Next →</span>
                  </button>

                  {/* Last Page Button */}
                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="group relative px-2.5 py-1.5 text-sm rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-md disabled:hover:scale-100 disabled:hover:shadow-none"
                    title="Last Page"
                  >
                    <span className="text-xs font-medium">⏭</span>
                  </button>

                  {/* Quick Page Jump Dropdown */}
                  <div className="relative ml-1.5">
                    <select
                      value={currentPage}
                      onChange={(e) => goToPage(parseInt(e.target.value))}
                      className="appearance-none px-3 py-1.5 pr-8 text-sm rounded-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-blue-300 dark:border-blue-600 text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-md hover:shadow-lg transform hover:scale-105"
                    >
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <option key={page} value={page}>
                          Page {page}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Enhanced Page Info */}
                  <div className="ml-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700">
                    <span className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {currentPage} / {totalPages}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Close Main Content Area */}
      </main>
      </div>
      {/* End of Grid Layout with Folder Sidebar */}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 min-w-[200px]"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">
              {contextMenu.item?.filename}
            </p>
          </div>
          
          <button
            onClick={contextMenuToggleSelect}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
          >
            <CheckSquare className="w-4 h-4" />
            <span>{selectedItems.has(contextMenu.item?.id || '') ? 'Deselect' : 'Select'}</span>
          </button>
          
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          
          <button
            onClick={contextMenuDownload}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
          
          <button
            onClick={contextMenuUploadToS3}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
          >
            <Cloud className="w-4 h-4" />
            <span>Upload to S3</span>
          </button>
          
          <button
            onClick={contextMenuAddToTask}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Add to Task</span>
          </button>
          
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          
          <button
            onClick={contextMenuDelete}
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center space-x-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Enhanced Modal/Lightbox */}
      {selectedItem && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
          onClick={() => {
            setSelectedItem(null);
            setZoomLevel(1);
            setIsFullscreen(false);
          }}
          onMouseMove={() => resetControlsTimeout()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ 
            pointerEvents: 'auto',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh'
          }}
        >
          <div
            className="relative w-full max-w-7xl h-full max-h-[95vh] flex flex-col md:flex-row overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Side - Media Viewer (Full height on mobile, 75% on desktop) */}
            <div className="relative flex-1 md:w-[75%] bg-black flex items-center justify-center overflow-hidden">
              {/* Close Button - Top Right */}
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setZoomLevel(1);
                  setIsFullscreen(false);
                }}
                className={`absolute top-4 right-4 z-30 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-xl backdrop-blur-sm transition-all duration-200 hover:scale-110 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
                title="Close (Esc)"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Navigation Controls */}
              <div className={`absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-6 pointer-events-none transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                {/* Previous Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPreviousContent();
                  }}
                  disabled={getCurrentModalIndex() <= 0}
                  className={`pointer-events-auto p-4 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-xl backdrop-blur-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                    getCurrentModalIndex() <= 0 ? '' : 'hover:scale-110'
                  }`}
                  title="Previous (Left Arrow)"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>

                {/* Next Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNextContent();
                  }}
                  disabled={getCurrentModalIndex() >= filteredAndSortedContent.length - 1}
                  className={`pointer-events-auto p-4 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-xl backdrop-blur-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                    getCurrentModalIndex() >= filteredAndSortedContent.length - 1 ? '' : 'hover:scale-110'
                  }`}
                  title="Next (Right Arrow)"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>

              {/* Top Center Controls - Counter Only */}
              <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                {/* Type Badge and Counter */}
                <div className="flex items-center space-x-2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full shadow-xl">
                  <div
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      selectedItem.itemType === "video"
                        ? "bg-purple-500/90 text-white"
                        : "bg-blue-500/90 text-white"
                    }`}
                  >
                    {selectedItem.itemType === "video" ? (
                      <>
                        <Video className="w-3.5 h-3.5" />
                        <span>VIDEO</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>IMAGE</span>
                      </>
                    )}
                  </div>
                  <span className="text-white/90 text-sm font-medium">
                    {getCurrentModalIndex() + 1} / {filteredAndSortedContent.length}
                  </span>
                </div>
              </div>

              {/* Fullscreen Toggle - Top Left */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className={`absolute top-4 left-4 z-30 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-xl backdrop-blur-sm transition-all duration-200 hover:scale-110 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
                title="Toggle Fullscreen (F)"
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>

              {/* Media Content */}
              <div className="w-full h-full flex items-center justify-center p-4">
              {selectedItem.itemType === "video" ? (
                <video
                  src={(() => {
                    const videoUrl = getBestMediaUrl({
                      awsS3Key: selectedItem.awsS3Key,
                      awsS3Url: selectedItem.awsS3Url,
                      s3Key: selectedItem.s3Key,
                      networkVolumePath: selectedItem.networkVolumePath,
                      dataUrl: selectedItem.dataUrl,
                      url: selectedItem.url,
                      id: selectedItem.id,
                      filename: selectedItem.filename,
                      type: 'video'
                    });
                    console.log(`🎬 Modal video URL for ${selectedItem.filename}:`, videoUrl);
                    console.log(`🎬 Video data:`, {
                      awsS3Key: selectedItem.awsS3Key,
                      awsS3Url: selectedItem.awsS3Url,
                      s3Key: selectedItem.s3Key,
                      networkVolumePath: selectedItem.networkVolumePath,
                      dataUrl: selectedItem.dataUrl,
                      url: selectedItem.url
                    });
                    return videoUrl;
                  })()}
                  className="object-contain"
                  style={{ maxWidth: '85%', maxHeight: '85%' }}
                  controls
                  preload="metadata"
                  playsInline
                  onLoadStart={() => {
                    console.log(`🎬 Video load started for: ${selectedItem.filename}`);
                  }}
                  onCanPlay={() => {
                    console.log(`✅ Video can play: ${selectedItem.filename}`);
                  }}
                  onError={(e) => {
                    console.error(
                      "❌ Modal video load error for:",
                      selectedItem.filename
                    );
                    console.error("❌ Current src:", (e.target as HTMLVideoElement).src);
                    console.error("❌ Error details:", e);
                    
                    // Try fallback URLs in priority order
                    const fallbackUrls = [
                      selectedItem.awsS3Url,
                      selectedItem.awsS3Key ? `https://tastycreative.s3.amazonaws.com/${selectedItem.awsS3Key}` : null,
                      selectedItem.dataUrl,
                      selectedItem.url
                    ].filter(Boolean);

                    console.log("🔄 Available fallback URLs:", fallbackUrls);

                    const currentSrc = (e.target as HTMLVideoElement).src;
                    const currentIndex = fallbackUrls.indexOf(currentSrc);
                    const nextIndex = currentIndex + 1;
                    
                    if (nextIndex < fallbackUrls.length) {
                      console.log("🔄 Modal trying next fallback URL:", fallbackUrls[nextIndex]);
                      (e.target as HTMLVideoElement).src = fallbackUrls[nextIndex]!;
                    } else {
                      console.error("💥 All modal URLs failed for:", selectedItem.filename);
                      alert(`Video failed to load: ${selectedItem.filename}\n\nTried URLs:\n${fallbackUrls.join('\n')}`);
                    }
                  }}
                />
              ) : (
                <img
                  src={getBestMediaUrl({
                    awsS3Key: selectedItem.awsS3Key,
                    awsS3Url: selectedItem.awsS3Url,
                    s3Key: selectedItem.s3Key,
                    networkVolumePath: selectedItem.networkVolumePath,
                    dataUrl: selectedItem.dataUrl,
                    url: selectedItem.url,
                    id: selectedItem.id,
                    filename: selectedItem.filename,
                    type: 'image'
                  })}
                  alt={selectedItem.filename}
                  className="object-contain"
                  style={{ maxWidth: '85%', maxHeight: '85%' }}
                  onError={(e) => {
                    console.warn(
                      "⚠️ Modal image load error for:",
                      selectedItem.filename
                    );
                    const currentSrc = (e.target as HTMLImageElement).src;

                    // Try fallback URLs in order: AWS S3 -> Database -> ComfyUI -> Placeholder
                    if (selectedItem.awsS3Key && !currentSrc.includes(selectedItem.awsS3Key)) {
                      console.log("Modal trying AWS S3 URL for:", selectedItem.filename);
                      (e.target as HTMLImageElement).src = `https://tastycreative.s3.amazonaws.com/${selectedItem.awsS3Key}`;
                    } else if (selectedItem.awsS3Url && currentSrc !== selectedItem.awsS3Url) {
                      console.log("Modal trying direct AWS S3 URL for:", selectedItem.filename);
                      (e.target as HTMLImageElement).src = selectedItem.awsS3Url;
                    } else if (selectedItem.dataUrl && !currentSrc.includes('/api/images/')) {
                      console.log("Modal falling back to database URL");
                      (e.target as HTMLImageElement).src = selectedItem.dataUrl;
                    } else if (selectedItem.url && currentSrc !== selectedItem.url) {
                      console.log("Modal falling back to ComfyUI URL");
                      (e.target as HTMLImageElement).src = selectedItem.url;
                    } else {
                      console.error("All modal URLs failed for:", selectedItem.filename);
                      (e.target as HTMLImageElement).src = "/api/placeholder-image";
                    }
                  }}
                />
              )}
            </div>
            </div>

            {/* Right Side - Information Sidebar (25% on desktop, full width below on mobile) */}
            <div className="w-full md:w-[25%] bg-white dark:bg-gray-900 flex flex-col overflow-y-auto max-h-[40vh] md:max-h-full">
              {/* Keyboard Shortcuts - At the very top */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Keyboard className="w-3 h-3" />
                    <span className="font-medium">Shortcuts:</span>
                  </span>
                  <span>← →</span>
                  <span>•</span>
                  <span>F</span>
                  <span>•</span>
                  <span>Esc</span>
                </div>
              </div>

              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 break-words">
                  {selectedItem.filename}
                </h3>
                <div className="flex items-center space-x-2">
                  <div
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      selectedItem.itemType === "video"
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {selectedItem.itemType === "video" ? (
                      <>
                        <Video className="w-3.5 h-3.5" />
                        <span>VIDEO</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>IMAGE</span>
                      </>
                    )}
                  </div>
                  {selectedItem.format && (
                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold uppercase">
                      {selectedItem.format}
                    </span>
                  )}
                </div>
              </div>

              {/* Information Grid */}
              <div className="p-6 space-y-4 flex-1">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Created</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatDate(selectedItem.createdAt)}
                      </p>
                    </div>
                  </div>

                  {selectedItem.width && selectedItem.height && (
                    <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-xl mt-0.5 flex-shrink-0">📐</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Dimensions</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedItem.width} × {selectedItem.height} px
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {(selectedItem.width * selectedItem.height / 1000000).toFixed(2)} MP
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedItem.itemType === "video" && selectedItem.duration && (
                    <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Video className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Duration</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedItem.duration.toFixed(1)} seconds
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <HardDrive className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">File Size</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatFileSize(selectedItem.fileSize)}
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                        <div
                          className={`h-1.5 rounded-full ${
                            selectedItem.itemType === "video"
                              ? "bg-gradient-to-r from-purple-500 to-purple-600"
                              : "bg-gradient-to-r from-blue-500 to-blue-600"
                          }`}
                          style={{
                            width: `${Math.min(
                              ((selectedItem.fileSize || 0) / (10 * 1024 * 1024)) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Conditional based on folder ownership */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <button
                  onClick={() => downloadItem(selectedItem)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                >
                  <Download className="w-5 h-5" />
                  <span>Download</span>
                </button>

                {!selectedFolderInfo?.isShared && (
                  <>
                    <button
                      onClick={() => shareItem(selectedItem)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                    >
                      <Share2 className="w-5 h-5" />
                      <span>Share</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${selectedItem.filename}"? This action cannot be undone.`)) {
                          deleteItem(selectedItem);
                          setSelectedItem(null);
                        }
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
                
                {selectedFolderInfo?.isShared && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                    View-only access • You can download files only
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

  {/* S3 Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowUploadModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-blue-500" />
                <span>Upload to Google Drive</span>
              </h3>
              <button
                onClick={() => setShowUploadModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                {showUploadModal.itemType === "video" ? (
                  <Video className="w-8 h-8 text-purple-500" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-blue-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {showUploadModal.filename}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(showUploadModal.fileSize)} • {showUploadModal.itemType}
                  </p>
                </div>
              </div>
            </div>

            {/* S3 Upload Options */}
            <div className="mb-4">
              <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Cloud className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Upload to AWS S3 staging
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                    Pick a staging folder. We will upload the original file and store metadata automatically.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Choose an S3 folder:
              </label>
              {availableFoldersForUpload.length === 0 ? (
                <div className="text-center py-8 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No folders available. Create a folder first to upload content.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableFoldersForUpload.map((folder) => (
                    <button
                      key={folder.prefix}
                      onClick={() => handleModalUpload(folder.name as S3FolderName)}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group"
                    >
                      <div className="flex items-center space-x-3">
                        <FolderOpen className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                        <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {folder.name}
                        </span>
                      </div>
                      <div className="text-gray-400 group-hover:text-blue-500">
                        <Upload className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUploadModal(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {showMoveModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowMoveModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-purple-500" />
                <span>Move to Folder</span>
              </h3>
              <button
                onClick={() => setShowMoveModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                {showMoveModal.itemType === "video" ? (
                  <Video className="w-8 h-8 text-purple-500" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-blue-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {showMoveModal.filename}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(showMoveModal.fileSize)} • {showMoveModal.itemType}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <FolderOpen className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                    Move to a different folder
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">
                    This will update the file location in your S3 storage.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Choose destination folder:
              </label>
              {availableFoldersForMove.length === 0 ? (
                <div className="text-center py-8 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No folders available. Create a folder first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableFoldersForMove.map((folder) => (
                    <button
                      key={folder.prefix}
                      onClick={() => moveItemToFolder(showMoveModal, folder.prefix)}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 group"
                    >
                      <div className="flex items-center space-x-3">
                        <Folder className="w-5 h-5 text-gray-400 group-hover:text-purple-500" />
                        <span className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          {folder.name}
                        </span>
                        {folder.fileCount !== undefined && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({folder.fileCount} files)
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 group-hover:text-purple-500">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMoveModal(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move to Folder Modal */}
      {showBulkMoveModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowBulkMoveModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FolderInput className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">Move to Folder</h2>
                    <p className="text-indigo-100 text-sm mt-1">
                      Moving {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBulkMoveModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a destination folder:
              </p>
              
              {availableFoldersForMove.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No Folders Available
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Create a folder first to organize your content.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#a855f7 transparent'
                }}>
                  {availableFoldersForMove.map((folder) => (
                    <button
                      key={folder.prefix}
                      onClick={() => bulkMoveToFolder(folder.prefix)}
                      disabled={bulkActionLoading}
                      className="w-full p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-900/20 dark:hover:to-purple-900/20 border-2 border-transparent hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white text-left group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {folder.name}
                        </span>
                        {folder.fileCount !== undefined && (
                          <span className="text-xs px-2 py-1 bg-white/50 dark:bg-gray-600/50 rounded-full text-gray-600 dark:text-gray-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-800/50 transition-colors">
                            {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 group-hover:text-indigo-500 mt-2">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowBulkMoveModal(false)}
                disabled={bulkActionLoading}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Selection Modal */}
      {showTaskModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowTaskModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ClipboardCheck className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">Select Production Task</h2>
                    <p className="text-blue-100 text-sm mt-1">
                      Choose a task to link {selectedItems.size} selected item{selectedItems.size !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                    <p className="text-gray-600 dark:text-gray-400">Loading production tasks...</p>
                  </div>
                </div>
              ) : productionTasks.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No Production Tasks Found
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Create a production task in the admin panel first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productionTasks.map((task) => {
                    const imagesNeeded = Math.max(0, task.imagesTarget - task.imagesGenerated);
                    const videosNeeded = Math.max(0, task.videosTarget - task.videosGenerated);
                    const isCompleted = task.status === 'COMPLETED';
                    const imageProgress = task.imagesTarget > 0 ? (task.imagesGenerated / task.imagesTarget) * 100 : 0;
                    const videoProgress = task.videosTarget > 0 ? (task.videosGenerated / task.videosTarget) * 100 : 0;

                    return (
                      <button
                        key={task.id}
                        onClick={() => linkContentToTask(task.id)}
                        disabled={linkingContent || isCompleted}
                        className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                              {task.influencer}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                              <span>📸 Instagram: @{task.instagramSource}</span>
                              <span>🎨 LoRA: {task.loraModel}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                task.status === 'PENDING'
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : task.status === 'COMPLETED'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              }`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Due: {new Date(task.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Images Progress */}
                          {task.imagesTarget > 0 && (
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700 dark:text-gray-300">
                                  Images: {task.imagesGenerated}/{task.imagesTarget}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {imagesNeeded > 0 ? `${imagesNeeded} needed` : 'Complete'}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, imageProgress)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Videos Progress */}
                          {task.videosTarget > 0 && (
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700 dark:text-gray-300">
                                  Videos: {task.videosGenerated}/{task.videosTarget}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {videosNeeded > 0 ? `${videosNeeded} needed` : 'Complete'}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, videoProgress)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {task.notes && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                            Note: {task.notes}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select a task to link your content. Progress will be updated automatically.
                </p>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start space-x-3 p-4 rounded-xl shadow-2xl backdrop-blur-sm transform transition-all duration-300 animate-in slide-in-from-right ${
              toast.type === 'success'
                ? 'bg-green-500/95 text-white'
                : toast.type === 'error'
                ? 'bg-red-500/95 text-white'
                : toast.type === 'warning'
                ? 'bg-yellow-500/95 text-white'
                : 'bg-blue-500/95 text-white'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
              {toast.type === 'info' && <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Upload Progress Indicators */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 space-y-2 max-w-sm">
          {Object.entries(uploadProgress).map(([id, { progress, filename }]) => (
            <div
              key={id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Uploading... {progress}%
                  </p>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Download Progress Indicators */}
      {Object.keys(downloadProgress).length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 space-y-2 max-w-sm">
          {Object.entries(downloadProgress).map(([id, { progress, filename }]) => (
            <div
              key={id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Downloading... {progress}%
                  </p>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Queue Panel */}
      {uploadQueue.length > 0 && (
        <div className={`fixed ${showQueuePanel ? 'bottom-0' : 'bottom-[-300px]'} left-0 right-0 z-50 transition-all duration-300`}>
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl">
            {/* Queue Header */}
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleQueuePanel}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {showQueuePanel ? (
                    <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
                <UploadCloud className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Upload Queue
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {uploadQueue.filter(q => q.status === 'uploading').length} uploading, 
                    {' '}{uploadQueue.filter(q => q.status === 'pending').length} pending,
                    {' '}{uploadQueue.filter(q => q.status === 'completed').length} completed
                  </p>
                </div>
              </div>
              <button
                onClick={clearCompletedUploads}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Clear Completed
              </button>
            </div>

            {/* Queue Items */}
            <div className="max-h-80 overflow-y-auto">
              <div className="p-4 space-y-3">
                {uploadQueue.map((queueItem) => (
                  <div
                    key={queueItem.id}
                    className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
                  >
                    {/* Item Preview */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                        {queueItem.item.itemType === 'video' ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-8 h-8 text-gray-400" />
                          </div>
                        ) : (
                          <img
                            src={queueItem.item.dataUrl || queueItem.item.url}
                            alt={queueItem.item.filename}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {queueItem.item.filename}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        To: {getFolderName(queueItem.folder)}
                      </p>

                      {/* Progress Bar */}
                      {queueItem.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <span>Uploading...</span>
                            <span>{queueItem.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${queueItem.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {queueItem.error && (
                        <p className="text-xs text-red-500 mt-1">{queueItem.error}</p>
                      )}
                    </div>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {queueItem.status === 'pending' && (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                      {queueItem.status === 'uploading' && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                      {queueItem.status === 'completed' && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {queueItem.status === 'failed' && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex space-x-1">
                      {queueItem.status === 'failed' && (
                        <button
                          onClick={() => retryUpload(queueItem.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Retry upload"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeFromQueue(queueItem.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove from queue"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
