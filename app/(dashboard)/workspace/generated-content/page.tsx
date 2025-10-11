// app/(dashboard)/workspace/generated-content/page.tsx - Gallery Page
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useApiClient } from "@/lib/apiClient";
import { getBestMediaUrl, getBandwidthStats, getDownloadUrl } from "@/lib/directUrlUtils";
import BandwidthStats from "@/components/BandwidthStats";
import { useInView } from "react-intersection-observer";
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
  ExternalLink,
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
  createdAt: Date | string;
  jobId: string;
}

interface ContentItem extends GeneratedImage {
  itemType: "image" | "video";
  duration?: number; // For videos
  fps?: number; // For videos
  googleDriveFileId?: string | null; // Google Drive sync status
  googleDriveFolderName?: string | null; // Folder where uploaded
  googleDriveUploadedAt?: Date | null; // Upload timestamp
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
type DriveFolderName = "All Generations" | "IG Posts" | "IG Reels" | "Misc";
type DriveFolder = DriveFolderName | { id: string; name: string };
type AspectRatio = "all" | "portrait" | "landscape" | "square";
type LinkedStatus = "all" | "linked" | "unlinked";

// Helper function to get folder name
const getFolderName = (folder: DriveFolder): string => {
  return typeof folder === 'string' ? folder : folder.name;
};

// Helper function to get folder ID
const getFolderId = (folder: DriveFolder): string => {
  return typeof folder === 'string' ? folder : folder.id;
};

interface UploadState {
  [itemId: string]: {
    uploading: boolean;
    progress: number;
    folder?: DriveFolder;
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
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: '50px',
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
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
            <Video className="w-12 h-12 text-gray-400" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="w-full h-full">
      {inView ? (
        <img
          src={mediaUrl}
          alt={item.filename}
          className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-110"
          onClick={onClick}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <ImageIcon className="w-12 h-12 text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default function GeneratedContentPage() {
  const apiClient = useApiClient();

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [imageStats, setImageStats] = useState<ImageStats | null>(null);
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(true);
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
  
  // Google Drive Upload State
  const [uploadStates, setUploadStates] = useState<UploadState>({});
  const [showUploadModal, setShowUploadModal] = useState<ContentItem | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Google Drive Integration Enhancement State
  const [uploadQueue, setUploadQueue] = useState<Array<{
    id: string;
    item: ContentItem;
    folder: DriveFolder;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
    error?: string;
  }>>([]);
  const [driveFileIds, setDriveFileIds] = useState<Record<string, string>>({}); // itemId -> driveFileId
  const [recentFolders, setRecentFolders] = useState<DriveFolder[]>([]);
  const [showFolderCreate, setShowFolderCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
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

  // Infinite Scroll State (replacing pagination)
  const [displayCount, setDisplayCount] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;
  
  // Intersection Observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  // Fetch images and stats
  useEffect(() => {
    if (apiClient) {
      // First auto-process any completed serverless jobs
      autoProcessServerlessJobs().then(() => {
        // Then fetch the content
        fetchContent();
        fetchStats();
      });
    }
  }, [apiClient]);

  // Fetch linked content when allContent changes
  useEffect(() => {
    if (apiClient && allContent.length > 0) {
      fetchLinkedContent();
    }
  }, [apiClient, allContent.length]);

  // Check for OAuth callback tokens in URL
  useEffect(() => {
    // First check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    
    if (accessToken) {
      setGoogleAccessToken(accessToken);
      localStorage.setItem('google_drive_access_token', accessToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('✅ Google Drive access token received and stored');
    } else {
      // Check localStorage for existing token
      const storedToken = localStorage.getItem('google_drive_access_token');
      if (storedToken) {
        setGoogleAccessToken(storedToken);
        console.log('✅ Google Drive access token loaded from storage');
      }
    }

    // Handle OAuth errors
    const error = urlParams.get('error');
    if (error) {
      console.error('❌ OAuth error:', error);
      alert(`Google Drive authentication failed: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
  }, []);

  const fetchContent = async () => {
    if (!apiClient) {
      console.error("❌ API client not available");
      setError("Authentication not ready");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("🖼️ === FETCHING CONTENT FOR GALLERY ===");
      console.log("🌍 Environment:", process.env.NODE_ENV);
      console.log("🔗 Origin:", window.location.origin);
      console.log("⏰ Timestamp:", new Date().toISOString());

      // Fetch images with more detailed parameters
      console.log("📡 Fetching images from /api/images...");
      const imagesResponse = await apiClient.get(
        "/api/images?includeData=false&limit=100"
      );
      console.log("📡 Images response status:", imagesResponse.status);
      console.log(
        "📡 Images response headers:",
        Object.fromEntries(imagesResponse.headers.entries())
      );

      // Fetch videos
      console.log("📡 Fetching videos from /api/videos...");
      const videosResponse = await apiClient.get(
        "/api/videos?includeData=false&limit=100"
      );
      console.log("📡 Videos response status:", videosResponse.status);
      console.log(
        "📡 Videos response headers:",
        Object.fromEntries(videosResponse.headers.entries())
      );

      // Enhanced error logging
      if (!imagesResponse.ok) {
        console.error(
          "❌ Images fetch failed:",
          imagesResponse.status,
          imagesResponse.statusText
        );
        const errorText = await imagesResponse.text();
        console.error("❌ Images error details:", errorText);

        // Try to parse as JSON for structured error
        try {
          const errorJson = JSON.parse(errorText);
          console.error("❌ Images structured error:", errorJson);
        } catch {
          // Not JSON, just log as text
        }
      }

      if (!videosResponse.ok) {
        console.error(
          "❌ Videos fetch failed:",
          videosResponse.status,
          videosResponse.statusText
        );
        const errorText = await videosResponse.text();
        console.error("❌ Videos error details:", errorText);

        // Try to parse as JSON for structured error
        try {
          const errorJson = JSON.parse(errorText);
          console.error("❌ Videos structured error:", errorJson);
        } catch {
          // Not JSON, just log as text
        }
      }

      if (!imagesResponse.ok || !videosResponse.ok) {
        const errorMessage = `Failed to fetch content: Images(${imagesResponse.status}) Videos(${videosResponse.status})`;
        console.error("❌ Combined fetch error:", errorMessage);
        throw new Error(errorMessage);
      }

      const imagesData = await imagesResponse.json();
      const videosData = await videosResponse.json();

      console.log("📊 Gallery images data:", imagesData);
      console.log("📊 Gallery videos data:", videosData);
      console.log("📊 Raw images count:", imagesData.images?.length || 0);
      console.log("📊 Raw videos count:", videosData.videos?.length || 0);

      // NEW: More detailed debugging
      if (imagesData.success === false) {
        console.error("❌ Images API returned error:", imagesData.error);
      }
      if (videosData.success === false) {
        console.error("❌ Videos API returned error:", videosData.error);
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
        }));

        setImages(processedImages);
        console.log("✅ Loaded", processedImages.length, "images");
      } else {
        console.warn("⚠️ Images data invalid or empty:", imagesData);
        setImages([]);
      }

      if (videosData.success && videosData.videos) {
        // Convert string dates to Date objects
        const processedVideos = videosData.videos.map((video: any) => ({
          ...video,
          createdAt: new Date(video.createdAt),
          itemType: "video" as const,
        }));

        setVideos(processedVideos);
        console.log("✅ Loaded", processedVideos.length, "videos");
      } else {
        console.warn("⚠️ Videos data invalid or empty:", videosData);
        setVideos([]);
      }

      // Combine all content
      const allItems: ContentItem[] = [
        ...(imagesData.success && imagesData.images
          ? imagesData.images.map((img: any) => ({
              ...img,
              createdAt: new Date(img.createdAt),
              itemType: "image" as const,
            }))
          : []),
        ...(videosData.success && videosData.videos
          ? videosData.videos.map((video: any) => ({
              ...video,
              createdAt: new Date(video.createdAt),
              itemType: "video" as const,
            }))
          : []),
      ];

      setAllContent(allItems);
      console.log("✅ Combined", allItems.length, "content items");

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

      // Set empty arrays on error
      setImages([]);
      setVideos([]);
      setAllContent([]);
    } finally {
      setLoading(false);
      console.log("🏁 Fetch content finished");
    }
  };

  const fetchStats = async () => {
    if (!apiClient) {
      console.error("❌ API client not available for stats");
      return;
    }

    try {
      const [imagesStatsResponse, videosStatsResponse] = await Promise.all([
        apiClient.get("/api/images?stats=true"),
        apiClient.get("/api/videos?stats=true"),
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

  // Filter and sort content - optimized with useMemo
  const filteredAndSortedContent = useMemo(() => {
    let filtered = [...allContent];

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
  }, [allContent, filterBy, debouncedSearchQuery, sortBy, advancedFilters, linkedContentMap]);

  // Infinite scroll content - only show items up to displayCount
  const displayedContent = useMemo(() => {
    return filteredAndSortedContent.slice(0, displayCount);
  }, [filteredAndSortedContent, displayCount]);

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
    setDisplayCount(ITEMS_PER_PAGE);
    setHasMore(filteredAndSortedContent.length > ITEMS_PER_PAGE);
  }, [debouncedSearchQuery, filterBy, sortBy, advancedFilters, filteredAndSortedContent.length]);

  // Load more items when scrolling
  useEffect(() => {
    if (inView && hasMore && !loading) {
      const newDisplayCount = displayCount + ITEMS_PER_PAGE;
      setDisplayCount(newDisplayCount);
      setHasMore(filteredAndSortedContent.length > newDisplayCount);
    }
  }, [inView, hasMore, loading, displayCount, filteredAndSortedContent.length]);

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

  // Google Drive Authentication
  const authenticateGoogleDrive = async () => {
    try {
      setIsAuthenticating(true);
      // Pass current page as redirect parameter
      const currentPage = '/workspace/generated-content';
      const response = await fetch(`/api/auth/google?redirect=${encodeURIComponent(currentPage)}`);
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      showToast('error', 'Failed to start Google Drive authentication');
      setIsAuthenticating(false);
    }
  };

  // Upload to Google Drive
  const uploadToGoogleDrive = async (item: ContentItem, folder: DriveFolder) => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    if (!googleAccessToken) {
      alert("Please authenticate with Google Drive first");
      return;
    }

    try {
      console.log(`📤 Uploading ${item.filename} to Google Drive folder: ${folder}`);
      
      // Set uploading state
      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          uploading: true,
          progress: 0,
          folder,
        }
      }));

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
        type: item.itemType === "video" ? 'video' : 'image'
      });

      if (!mediaUrl) {
        throw new Error("No media URL available for upload");
      }

      console.log(`📥 Fetching media from: ${mediaUrl}`);

      // Update progress
      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          progress: 25,
        }
      }));

      // Create form data for upload
      const formData = new FormData();
      
      // Fetch the media file with proper headers and error handling
      let mediaBlob: Blob;
      try {
        // Try direct fetch first
        const mediaResponse = await fetch(mediaUrl, {
          method: 'GET',
          mode: 'cors', // Enable CORS
          headers: {
            'Accept': item.itemType === 'video' ? 'video/*' : 'image/*',
          },
        });
        
        if (!mediaResponse.ok) {
          throw new Error(`Direct fetch failed: ${mediaResponse.status} ${mediaResponse.statusText}`);
        }
        
        mediaBlob = await mediaResponse.blob();
        console.log(`✅ Direct media fetch successful, size: ${mediaBlob.size} bytes, type: ${mediaBlob.type}`);
      } catch (fetchError) {
        console.error('❌ Direct fetch failed, trying proxy approach:', fetchError);
        
        try {
          // Use our proxy endpoint to fetch the media
          console.log('🔄 Trying proxy route...');
          const proxyUrl = `/api/proxy/media?url=${encodeURIComponent(mediaUrl)}`;
          const proxyResponse = await fetch(proxyUrl);
          
          if (!proxyResponse.ok) {
            throw new Error(`Proxy fetch failed: ${proxyResponse.status} ${proxyResponse.statusText}`);
          }
          
          mediaBlob = await proxyResponse.blob();
          console.log(`✅ Proxy media fetch successful, size: ${mediaBlob.size} bytes, type: ${mediaBlob.type}`);
        } catch (proxyError) {
          console.error('❌ Proxy fetch also failed:', proxyError);
          
          // Final fallback: try the dataUrl if available
          if (item.dataUrl && item.dataUrl.startsWith('/api/')) {
            console.log('🔄 Final attempt: trying dataUrl API route...');
            const dataResponse = await fetch(item.dataUrl);
            if (!dataResponse.ok) {
              throw new Error(`DataUrl fetch failed: ${dataResponse.status} ${dataResponse.statusText}`);
            }
            mediaBlob = await dataResponse.blob();
            console.log(`✅ DataUrl fetch successful, size: ${mediaBlob.size} bytes`);
          } else {
            throw new Error('Unable to fetch media file from any source. Please try again or contact support.');
          }
        }
      }
      
      formData.append('file', mediaBlob, item.filename);
      formData.append('folder', getFolderName(folder));
      formData.append('filename', item.filename);
      formData.append('itemType', item.itemType);
      formData.append('accessToken', googleAccessToken);

      // Update progress
      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          progress: 50,
        }
      }));

      console.log(`📤 Uploading to Google Drive API...`);

      // Upload to Google Drive via API with enhanced error handling
      const uploadResponse = await fetch('/api/google-drive/upload', {
        method: 'POST',
        body: formData,
        // Add timeout and headers for better reliability
        signal: AbortSignal.timeout(120000), // 2 minute timeout
        headers: {
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
      }).catch(fetchError => {
        console.error('❌ Fetch error details:', fetchError);
        
        // Handle specific network errors
        if (fetchError.name === 'TimeoutError') {
          throw new Error('Upload timeout - file may be too large or connection is slow');
        }
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          throw new Error('Network error - please check your internet connection and try again');
        }
        
        throw fetchError;
      });

      console.log(`📡 Upload response status: ${uploadResponse.status}`);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload response error:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw new Error(errorData.error || `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const result = await uploadResponse.json();
      console.log('✅ Upload response:', result);
      
      // Set success state
      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          uploading: false,
          progress: 100,
          folder,
          success: true,
        }
      }));

      console.log(`✅ Successfully uploaded ${item.filename} to ${folder}`);
      
      // Clear success state after 3 seconds
      setTimeout(() => {
        setUploadStates(prev => {
          const newState = { ...prev };
          delete newState[item.id];
          return newState;
        });
      }, 3000);

    } catch (error) {
      console.error('💥 Google Drive upload error:', error);
      
      setUploadStates(prev => ({
        ...prev,
        [item.id]: {
          uploading: false,
          progress: 0,
          folder,
          error: error instanceof Error ? error.message : 'Upload failed'
        }
      }));

      // Show user-friendly error message
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Clear error state after 5 seconds
      setTimeout(() => {
        setUploadStates(prev => {
          const newState = { ...prev };
          delete newState[item.id];
          return newState;
        });
      }, 5000);
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

  if (!apiClient) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900 rounded-2xl">
        <div className="text-center space-y-8 p-8">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto shadow-lg"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-3xl font-bold dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Loading Your Gallery
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md text-lg">
              Setting up authentication to view your generated content...
            </p>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce shadow-md"></div>
            <div
              className="w-3 h-3 bg-purple-500 rounded-full animate-bounce shadow-md"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce shadow-md"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
          <div className="mt-8 p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-blue-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              🔐 Securely connecting to your account...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl">
        <div className="text-center space-y-6 p-8">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500 drop-shadow-lg" />
            <div className="absolute inset-0 w-12 h-12 border-2 border-blue-200 dark:border-blue-800 rounded-full animate-pulse mx-auto"></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Loading Content
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Fetching your generated images and videos...
            </p>
          </div>
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>
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
              onClick={fetchContent}
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

  const deleteItem = async (item: ContentItem) => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${item.filename}?\n\nThis will permanently delete:\n• The file from AWS S3 storage\n• The database record\n\nThis action cannot be undone.`)) {
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
        
        alert(`✅ ${item.filename} deleted successfully!`);
        
        // Refresh stats
        await fetchStats();
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
      
      // For now, download individually
      // TODO: Implement ZIP download on backend
      for (const item of items) {
        await downloadItem(item);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between downloads
      }
      
      alert(`✅ Downloaded ${items.length} items successfully!`);
      clearSelection();
    } catch (error) {
      console.error("Bulk download error:", error);
      alert("Failed to download some items. Please try again.");
    } finally {
      setBulkActionLoading(false);
      setShowBulkMenu(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    const items = allContent.filter(item => selectedItems.has(item.id));
    
    if (!confirm(`Are you sure you want to delete ${items.length} items?\n\nThis will permanently delete all selected files and cannot be undone.`)) {
      return;
    }
    
    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const item of items) {
        try {
          await deleteItem(item);
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to delete ${item.filename}:`, error);
        }
      }
      
      alert(`Bulk delete complete!\n\n✅ Deleted: ${successCount}\n❌ Failed: ${failCount}`);
      clearSelection();
    } finally {
      setBulkActionLoading(false);
      setShowBulkMenu(false);
    }
  };

  const bulkUploadToDrive = () => {
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

  const contextMenuUploadToDrive = () => {
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
      description: 'Start creating amazing AI-generated content or upload existing files!',
      showFilters: false,
      showUpload: true
    };
  };

  // === Google Drive Integration Enhancement Functions ===

  // Quick upload to Google Drive (from grid card)
  const quickUploadToDrive = async (item: ContentItem, folder: DriveFolder) => {
    if (!googleAccessToken) {
      showToast('error', 'Please authenticate with Google Drive first');
      authenticateGoogleDrive();
      return;
    }

    // Add to upload queue
    const queueId = Math.random().toString(36).substring(7);
    const newQueueItem = {
      id: queueId,
      item,
      folder,
      progress: 0,
      status: 'pending' as const
    };

    setUploadQueue(prev => [...prev, newQueueItem]);
    setShowQueuePanel(true);

    // Add folder to recent folders
    addToRecentFolders(folder);

    // Start upload
    await processUploadQueue(queueId, item, folder);
  };

  // Process upload queue item
  const processUploadQueue = async (queueId: string, item: ContentItem, folder: DriveFolder) => {
    try {
      // Update status to uploading
      setUploadQueue(prev =>
        prev.map(q => q.id === queueId ? { ...q, status: 'uploading' as const } : q)
      );

      // Simulate progress (replace with actual upload)
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploadQueue(prev =>
          prev.map(q => q.id === queueId ? { ...q, progress: i } : q)
        );
      }

      // Mark as completed
      setUploadQueue(prev =>
        prev.map(q => q.id === queueId ? { ...q, status: 'completed' as const, progress: 100 } : q)
      );

      // Store Drive file ID (simulated)
      const driveFileId = `drive_${Math.random().toString(36).substring(7)}`;

      // Persist to database
      try {
        const response = await fetch('/api/generated-content/update-drive-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemId: item.id,
            itemType: item.itemType,
            driveFileId: driveFileId,
            folderName: getFolderName(folder)
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('❌ API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          throw new Error(errorData.error || 'Failed to update database');
        }

        const result = await response.json();
        console.log('✅ API Success Response:', result);

        // Update local state to show the sync indicator immediately
        setDriveFileIds(prev => ({ ...prev, [item.id]: driveFileId }));
        
        // Refresh content from database to get the updated sync status
        await fetchContent();
        
        console.log('✅ Google Drive sync status saved to database');
      } catch (error) {
        console.error('❌ Failed to save Google Drive sync status:', error);
        showToast('warning', 'Upload succeeded but failed to save sync status');
      }

      showToast('success', `${item.filename} uploaded to ${getFolderName(folder)}`);

      // Auto-remove from queue after 3 seconds
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(q => q.id !== queueId));
      }, 3000);

    } catch (error) {
      console.error('Upload queue error:', error);
      setUploadQueue(prev =>
        prev.map(q => 
          q.id === queueId 
            ? { ...q, status: 'failed' as const, error: error instanceof Error ? error.message : 'Upload failed' }
            : q
        )
      );
      showToast('error', `Failed to upload ${item.filename}`);
    }
  };

  // Add folder to recent folders
  const addToRecentFolders = (folder: DriveFolder) => {
    setRecentFolders(prev => {
      // Remove if already exists
      const filtered = prev.filter(f => getFolderId(f) !== getFolderId(folder));
      // Add to beginning
      const updated = [folder, ...filtered];
      // Keep only last 5
      return updated.slice(0, 5);
    });
  };

  // Create new Google Drive folder
  const createDriveFolder = async () => {
    if (!newFolderName.trim()) {
      showToast('warning', 'Please enter a folder name');
      return;
    }

    if (!googleAccessToken) {
      showToast('error', 'Please authenticate with Google Drive first');
      return;
    }

    setCreatingFolder(true);

    try {
      // Simulate folder creation (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newFolder: DriveFolder = {
        id: `folder_${Math.random().toString(36).substring(7)}`,
        name: newFolderName.trim()
      };

      // Add to recent folders
      addToRecentFolders(newFolder);

      showToast('success', `Folder "${getFolderName(newFolder)}" created`);
      setNewFolderName('');
      setShowFolderCreate(false);

      // If quick upload is active, upload to new folder
      if (quickUploadItem) {
        const item = allContent.find((i: ContentItem) => i.id === quickUploadItem);
        if (item) {
          quickUploadToDrive(item, newFolder);
        }
        setQuickUploadItem(null);
      }

    } catch (error) {
      console.error('Folder creation error:', error);
      showToast('error', 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  // Check if item is synced to Drive
  const isItemSyncedToDrive = (itemId: string): boolean => {
    // Check if item has googleDriveFileId in database
    const item = allContent.find(i => i.id === itemId);
    return !!item?.googleDriveFileId;
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
    <div className="space-y-6">
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
              {/* Bulk Actions */}
              <button
                onClick={bulkDownload}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              <button
                onClick={bulkUploadToDrive}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all duration-200"
              >
                <Cloud className="w-4 h-4" />
                <span>Upload to Drive</span>
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
                            <span>Uploaded to {uploadStates[item.id].folder ? getFolderName(uploadStates[item.id].folder!) : 'Drive'}</span>
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

                    {/* Action Buttons - Moved from hover overlay */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          className={`p-2 ${isMobile ? 'min-h-[44px] min-w-[44px]' : ''} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200`}
                          title="View full size"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadItem(item);
                          }}
                          className={`p-2 ${isMobile ? 'min-h-[44px] min-w-[44px]' : ''} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200`}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        
                        {/* Quick Upload to Drive with Folder Dropdown */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickUploadItem(quickUploadItem === item.id ? null : item.id);
                            }}
                            className={`p-2 ${isMobile ? 'min-h-[44px] min-w-[44px]' : ''} ${isItemSyncedToDrive(item.id) ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400' : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400'} rounded-lg transition-all duration-200`}
                            title={isItemSyncedToDrive(item.id) ? "Already in Google Drive - Upload again" : "Upload to Google Drive"}
                          >
                            {isItemSyncedToDrive(item.id) ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Cloud className="w-4 h-4" />
                            )}
                          </button>

                          {/* Folder Dropdown Menu */}
                          {quickUploadItem === item.id && (
                            <div 
                              className="absolute bottom-full mb-2 right-0 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-2">
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                                  Upload to folder:
                                </div>
                                
                                {/* Predefined Folders */}
                                {(["All Generations", "IG Posts", "IG Reels", "Misc"] as DriveFolderName[]).map((folder) => (
                                  <button
                                    key={folder}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      quickUploadToDrive(item, folder);
                                      setQuickUploadItem(null);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-150"
                                  >
                                    <Folder className="w-4 h-4 text-blue-500" />
                                    <span>{folder}</span>
                                  </button>
                                ))}

                                {/* Recent Folders */}
                                {recentFolders.length > 0 && (
                                  <>
                                    <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-1">
                                      Recent:
                                    </div>
                                    {recentFolders.map((folder) => (
                                      <button
                                        key={typeof folder === 'string' ? folder : folder.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          quickUploadToDrive(item, folder);
                                          setQuickUploadItem(null);
                                        }}
                                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-150"
                                      >
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>{getFolderName(folder)}</span>
                                      </button>
                                    ))}
                                  </>
                                )}

                                {/* Create New Folder */}
                                <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFolderCreate(true);
                                    setQuickUploadItem(null);
                                  }}
                                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-150 font-medium"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Create New Folder</span>
                                </button>

                                {/* Full Upload Modal Option */}
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
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareItem(item);
                          }}
                          className={`p-2 ${isMobile ? 'min-h-[44px] min-w-[44px]' : ''} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200`}
                          title="Share"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(item);
                          }}
                          className={`p-2 ${isMobile ? 'min-h-[44px] min-w-[44px]' : ''} bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-all duration-200`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Status Indicators Below Buttons */}
                    {(isLinked || isItemSyncedToDrive(item.id)) && (
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

                        {/* Google Drive Sync Indicator */}
                        {isItemSyncedToDrive(item.id) && (
                          <div 
                            className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2.5 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs font-medium"
                            title="Synced to Google Drive"
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
            
            {/* Infinite Scroll Loading Trigger */}
            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center py-8"
              >
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading more...</span>
              </div>
            )}
            
            {/* Show when all items are loaded */}
            {!hasMore && displayedContent.length > 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>✓ All {displayedContent.length} items loaded</p>
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
              
              {/* Infinite Scroll Loading Trigger for List View */}
              {hasMore && (
                <div
                  ref={loadMoreRef}
                  className="flex items-center justify-center py-6 border-t border-gray-200 dark:border-gray-700"
                >
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading more...</span>
                </div>
              )}
              
              {/* Show when all items are loaded */}
              {!hasMore && displayedContent.length > 0 && (
                <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                  <p>✓ All {displayedContent.length} items loaded</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

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
            onClick={contextMenuUploadToDrive}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
          >
            <Cloud className="w-4 h-4" />
            <span>Upload to Drive</span>
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

              {/* Action Buttons */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <button
                  onClick={() => downloadItem(selectedItem)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                >
                  <Download className="w-5 h-5" />
                  <span>Download</span>
                </button>

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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Upload Modal */}
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

            {/* Google Drive Authentication Status */}
            {!googleAccessToken ? (
              <div className="mb-6">
                <div className="flex items-center space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Google Drive Authentication Required
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      Please authenticate with Google Drive to upload files.
                    </p>
                  </div>
                </div>
                <button
                  onClick={authenticateGoogleDrive}
                  disabled={isAuthenticating}
                  className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      <span>Authenticate with Google Drive</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Google Drive Connected
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Select Google Drive folder:
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(["All Generations", "IG Posts", "IG Reels", "Misc"] as DriveFolderName[]).map((folder) => (
                      <button
                        key={folder}
                        onClick={() => {
                          uploadToGoogleDrive(showUploadModal, folder);
                          setShowUploadModal(null);
                        }}
                        className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group"
                      >
                        <div className="flex items-center space-x-3">
                          <FolderOpen className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                          <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {folder}
                          </span>
                        </div>
                        <div className="text-gray-400 group-hover:text-blue-500">
                          <Upload className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

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

      {/* Create Folder Modal */}
      {showFolderCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowFolderCreate(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Folder className="w-5 h-5 text-blue-500" />
                <span>Create New Folder</span>
              </h3>
              <button
                onClick={() => setShowFolderCreate(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    createDriveFolder();
                  }
                }}
                placeholder="Enter folder name..."
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowFolderCreate(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createDriveFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {creatingFolder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Folder</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
