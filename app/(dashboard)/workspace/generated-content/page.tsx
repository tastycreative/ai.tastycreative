// app/(dashboard)/workspace/generated-content/page.tsx - Gallery Page
"use client";

import { useState, useEffect } from "react";
import { useApiClient } from "@/lib/apiClient";
import { getBestMediaUrl, getBandwidthStats, getDownloadUrl } from "@/lib/directUrlUtils";
import BandwidthStats from "@/components/BandwidthStats";
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
type DriveFolder = "All Generations" | "IG Posts" | "IG Reels" | "Misc";

interface UploadState {
  [itemId: string]: {
    uploading: boolean;
    progress: number;
    folder?: DriveFolder;
    success?: boolean;
    error?: string;
  };
}

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
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Google Drive Upload State
  const [uploadStates, setUploadStates] = useState<UploadState>({});
  const [showUploadModal, setShowUploadModal] = useState<ContentItem | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Production Task Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [productionTasks, setProductionTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [linkingContent, setLinkingContent] = useState(false);
  const [linkedContentMap, setLinkedContentMap] = useState<Record<string, any[]>>({});
  const [loadingLinkedContent, setLoadingLinkedContent] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [imagesPerPage] = useState(20);

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
      // Store in localStorage for persistence across tabs/pages
      localStorage.setItem('google_drive_access_token', accessToken);
      // Clean up URL
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

  // Filter and sort content
  const filteredAndSortedContent = () => {
    let filtered = [...allContent];

    // Apply content type filter
    if (filterBy === "images") {
      filtered = filtered.filter((item) => item.itemType === "image");
    } else if (filterBy === "videos") {
      filtered = filtered.filter((item) => item.itemType === "video");
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((item) =>
        item.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
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
  };

  // Pagination
  const paginatedContent = () => {
    const filtered = filteredAndSortedContent();
    const startIndex = (currentPage - 1) * imagesPerPage;
    return filtered.slice(startIndex, startIndex + imagesPerPage);
  };

  const totalPages = Math.ceil(
    filteredAndSortedContent().length / imagesPerPage
  );

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
    alert("Image URL copied to clipboard!");
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
      alert('Failed to start Google Drive authentication');
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
      formData.append('folder', folder);
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
    // Don't allow selection of already linked content
    if (linkedContentMap[itemId]) {
      alert(`This content is already linked to: ${linkedContentMap[itemId].map(t => t.influencer).join(', ')}`);
      return;
    }
    
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
    // Only select items that aren't already linked
    const selectableIds = paginatedContent()
      .filter((item) => !linkedContentMap[item.id])
      .map((item) => item.id);
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

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      console.log(
        `✅ ${
          item.itemType === "video" ? "Video" : "Image"
        } downloaded successfully`
      );
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
    if (!window.confirm(`Are you sure you want to delete ${item.filename}?`)) {
      return;
    }

    try {
      const endpoint =
        item.itemType === "video"
          ? `/api/videos/${item.id}`
          : `/api/images/${item.id}`;
      const response = await fetch(endpoint, {
        method: "DELETE",
      });

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
          `${
            item.itemType === "video" ? "Video" : "Image"
          } deleted successfully`
        );
      } else {
        const error = await response.text();
        console.error("Delete failed:", error);
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-2xl shadow-2xl border border-blue-200 dark:border-indigo-800 p-8 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-lg">
              <ImageIcon className="w-10 h-10 text-white drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 drop-shadow-sm">
                Generated Content
              </h1>
              <p className="text-blue-100 text-lg font-medium opacity-90">
                Manage your AI-generated images and videos
              </p>
              <div className="flex items-center space-x-4 mt-3 text-sm text-blue-100">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Live updates</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
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
              className="flex items-center space-x-3 px-6 py-3 bg-white/20 hover:bg-white/30 disabled:bg-white/10 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-white/30 group"
              title="Refresh content"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                  <span>Refresh</span>
                </>
              )}
            </button>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
              <div className="text-center">
                <div className="text-3xl font-bold text-white drop-shadow-sm">
                  {allContent.length}
                </div>
                <div className="text-sm text-blue-100 font-medium">
                  Total Items
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats */}
      {(imageStats || videoStats) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Bandwidth Optimization Stats */}
      {allContent.length > 0 && (
        <BandwidthStats mediaList={allContent} className="mb-6" />
      )}

      {/* Selection Toolbar */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
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
            <button
              onClick={openTaskModal}
              disabled={linkingContent}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:cursor-not-allowed"
            >
              <ClipboardCheck className="w-5 h-5" />
              <span>{linkingContent ? "Linking..." : "Add to Production Task"}</span>
            </button>
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
          </div>
        </div>

        {/* Results Summary */}
        {(searchQuery || filterBy !== "all") && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {filteredAndSortedContent().length === 1
                  ? "1 item found"
                  : `${filteredAndSortedContent().length} items found`}
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

      {/* Enhanced Empty State */}
      {filteredAndSortedContent().length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Search className="w-4 h-4 text-white" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {searchQuery || filterBy !== "all"
                ? "No matching content found"
                : "Your gallery is empty"}
            </h3>

            <div className="space-y-2 mb-8">
              {searchQuery || filterBy !== "all" ? (
                <>
                  <p className="text-gray-600 dark:text-gray-400">
                    We couldn't find any content matching your search criteria.
                  </p>
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
                </>
              ) : (
                <>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Start creating amazing AI-generated content to see it here!
                  </p>
                  <p className="text-gray-500 dark:text-gray-500 text-sm">
                    Your generated images and videos will appear in this
                    gallery.
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {searchQuery || filterBy !== "all" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterBy("all");
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
          {/* Enhanced Grid View */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
              {paginatedContent().map((item, index) => {
                const isLinked = linkedContentMap[item.id];
                const linkedTasks = isLinked || [];
                
                return (
                <div
                  key={item.id}
                  className={`group bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] transform cursor-pointer ${
                    isLinked
                      ? 'border-green-400 dark:border-green-600 opacity-75'
                      : selectedItems.has(item.id)
                      ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-300 dark:ring-blue-600'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                  style={{
                    animationDelay: `${index * 0.05}s`,
                  }}
                  onClick={(e) => {
                    // Only handle clicks on the card itself, not on buttons
                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('label')) {
                      return; // Let button/checkbox/label handle its own click
                    }
                    console.log(`🎬 Card clicked for: ${item.filename} (${item.itemType})`);
                    setSelectedItem(item);
                  }}
                >
                  <div className="relative aspect-square overflow-hidden">
                    {/* Selection Checkbox - Inside the image container */}
                    {!isLinked && (
                      <div className="absolute top-2 left-2 z-20">
                        <label
                          className="flex items-center justify-center w-8 h-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors hover:scale-110"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}

                    {/* Already Linked Badge - Top right corner, small and unobtrusive */}
                    {isLinked && (
                      <div className="absolute top-2 right-2 z-20">
                        <div 
                          className="bg-green-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform cursor-help"
                          title={`Linked to: ${linkedTasks.map((t: any) => t.influencer).join(', ')}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      </div>
                    )}

                    {item.itemType === "video" ? (
                      <video
                        src={(() => {
                          const videoUrl = getBestMediaUrl({
                            awsS3Key: item.awsS3Key,
                            awsS3Url: item.awsS3Url,
                            s3Key: item.s3Key,
                            networkVolumePath: item.networkVolumePath,
                            dataUrl: item.dataUrl,
                            url: item.url,
                            id: item.id,
                            filename: item.filename,
                            type: 'video'
                          });
                          console.log(`🎬 Grid video URL for ${item.filename}:`, videoUrl);
                          return videoUrl;
                        })()}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-110"
                        onClick={(e) => {
                          console.log(`🎬 Video clicked: ${item.filename}`);
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        preload="metadata"
                        muted
                        onLoadStart={() => {
                          console.log(`🎬 Grid video load started: ${item.filename}`);
                        }}
                        onCanPlay={() => {
                          console.log(`✅ Grid video can play: ${item.filename}`);
                        }}
                        onError={(e) => {
                          console.error("❌ Grid video load error for:", item.filename);
                          console.log(
                            "Current src:",
                            (e.target as HTMLVideoElement).src
                          );
                          console.log("Video data:", {
                            awsS3Url: item.awsS3Url,
                            awsS3Key: item.awsS3Key,
                            dataUrl: item.dataUrl,
                            url: item.url
                          });

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
                            console.log("🔄 Grid trying next fallback URL:", fallbackUrls[nextIndex]);
                            (e.target as HTMLVideoElement).src = fallbackUrls[nextIndex]!;
                          } else {
                            console.error("💥 All grid URLs failed for:", item.filename);
                            // Hide the video element and show a placeholder
                            const videoElement = e.target as HTMLVideoElement;
                            videoElement.style.display = "none";
                            
                            // Create a clickable placeholder
                            const placeholder = document.createElement("div");
                            placeholder.className = "w-full h-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center cursor-pointer transition-transform duration-300 group-hover:scale-110";
                            placeholder.innerHTML = `
                              <div class="text-center">
                                <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                                </svg>
                                <p class="text-xs text-gray-500">Video Preview</p>
                              </div>
                            `;
                            placeholder.onclick = () => {
                              console.log(`🎬 Placeholder clicked: ${item.filename}`);
                              setSelectedItem(item);
                            };
                            videoElement.parentNode?.appendChild(placeholder);
                          }
                        }}
                      />
                    ) : (
                      <img
                        src={getBestMediaUrl({
                          awsS3Key: item.awsS3Key,
                          awsS3Url: item.awsS3Url,
                          s3Key: item.s3Key,
                          networkVolumePath: item.networkVolumePath,
                          dataUrl: item.dataUrl,
                          url: item.url,
                          id: item.id,
                          filename: item.filename,
                          type: 'image'
                        })}
                        alt={item.filename}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-110"
                        onClick={() => setSelectedItem(item)}
                        onError={(e) => {
                          console.warn(
                            "⚠️ Image load error for:",
                            item.filename
                          );

                          const currentSrc = (e.target as HTMLImageElement).src;
                          
                          // Try fallback URLs in order: AWS S3 -> Database -> ComfyUI -> Placeholder
                          if (item.awsS3Key && !currentSrc.includes(item.awsS3Key)) {
                            console.log("Trying AWS S3 URL for:", item.filename);
                            (e.target as HTMLImageElement).src = `https://tastycreative.s3.amazonaws.com/${item.awsS3Key}`;
                          } else if (item.awsS3Url && currentSrc !== item.awsS3Url) {
                            console.log("Trying direct AWS S3 URL for:", item.filename);
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

                    {/* Content Type Badge */}
                    <div className="absolute top-3 left-3">
                      <div
                        className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold shadow-lg backdrop-blur-sm border transition-all duration-300 ${
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
                            <span>Uploaded to {uploadStates[item.id].folder}</span>
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

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                              }}
                              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
                              title="View full size"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadItem(item);
                              }}
                              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowUploadModal(item);
                              }}
                              className="p-2.5 bg-blue-500/80 hover:bg-blue-600/90 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-blue-400/20"
                              title="Upload to Google Drive"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                shareItem(item);
                              }}
                              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
                              title="Share"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteItem(item);
                              }}
                              className="p-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-red-400/20"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Play Button for Videos */}
                    {item.itemType === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm border border-white/30 pointer-events-auto">
                          <Play className="w-8 h-8 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Card Footer */}
                  <div className="p-4">
                    <h3
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200"
                      title={item.filename}
                    >
                      {item.filename}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center space-x-1">
                          <HardDrive className="w-3 h-3" />
                          <span>{formatFileSize(item.fileSize)}</span>
                        </span>

                        {item.width && item.height && (
                          <span className="flex items-center space-x-1">
                            <span>📐</span>
                            <span>
                              {item.width}×{item.height}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(item.createdAt).split(" ")[0]}
                      </div>
                    </div>

                    {/* Progress bar for file size visualization */}
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all duration-300 ${
                          item.itemType === "video"
                            ? "bg-gradient-to-r from-purple-400 to-purple-600"
                            : "bg-gradient-to-r from-blue-400 to-blue-600"
                        }`}
                        style={{
                          width: `${Math.min(
                            ((item.fileSize || 0) / (10 * 1024 * 1024)) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedContent().map((item) => {
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
            </div>
          )}

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">
                    Showing {(currentPage - 1) * imagesPerPage + 1}–
                    {Math.min(
                      currentPage * imagesPerPage,
                      filteredAndSortedContent().length
                    )}
                  </span>
                  <span>of</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {filteredAndSortedContent().length.toLocaleString()}
                  </span>
                  <span>items</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    title="First page"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                  >
                    Previous
                  </button>

                  <div className="flex items-center space-x-1">
                    {/* Page Numbers */}
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      let startPage = Math.max(
                        1,
                        currentPage - Math.floor(maxVisiblePages / 2)
                      );
                      const endPage = Math.min(
                        totalPages,
                        startPage + maxVisiblePages - 1
                      );

                      if (endPage - startPage < maxVisiblePages - 1) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`w-10 h-10 text-sm rounded-lg font-medium transition-all duration-200 ${
                              currentPage === i
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            {i}
                          </button>
                        );
                      }
                      return pages;
                    })()}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                  >
                    Next
                  </button>

                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    title="Last page"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414zm6 0a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L14.586 10l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Enhanced Modal/Lightbox */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="relative max-w-7xl max-h-[95vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      selectedItem.itemType === "video"
                        ? "bg-purple-500/90 text-white"
                        : "bg-blue-500/90 text-white"
                    }`}
                  >
                    {selectedItem.itemType === "video" ? (
                      <>
                        <Video className="w-4 h-4" />
                        <span>VIDEO</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4" />
                        <span>IMAGE</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-lg truncate max-w-md">
                    {selectedItem.filename}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 text-white hover:text-gray-300 rounded-xl bg-black/20 hover:bg-black/40 transition-all duration-200 backdrop-blur-sm"
                  title="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Media Content */}
            <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800">
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
                  className="max-w-full max-h-[80vh] object-contain"
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
                  className="max-w-full max-h-[80vh] object-contain"
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

            {/* Modal Footer - Enhanced Layout */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-8">
              <div className="flex flex-col gap-6">
                {/* Details Section */}
                <div className="text-white space-y-3">
                  <h4 className="text-lg font-semibold text-white mb-3 truncate">
                    {selectedItem.filename}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-gray-300 block text-xs">Created</span>
                        <span className="font-medium text-white block truncate">
                          {formatDate(selectedItem.createdAt).split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {selectedItem.width && selectedItem.height && (
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-300 text-lg flex-shrink-0">📐</span>
                        <div className="min-w-0">
                          <span className="text-gray-300 block text-xs">Dimensions</span>
                          <span className="font-medium text-white block truncate">
                            {selectedItem.width} × {selectedItem.height}
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedItem.itemType === "video" && selectedItem.duration && (
                      <div className="flex items-center space-x-2">
                        <Video className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-gray-300 block text-xs">Duration</span>
                          <span className="font-medium text-white block">
                            {selectedItem.duration.toFixed(1)}s
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-gray-300 block text-xs">File size</span>
                        <span className="font-medium text-white block">
                          {formatFileSize(selectedItem.fileSize)}
                        </span>
                      </div>
                    </div>

                    {selectedItem.format && (
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-300 text-lg flex-shrink-0">📄</span>
                        <div className="min-w-0">
                          <span className="text-gray-300 block text-xs">Format</span>
                          <span className="font-medium uppercase bg-gray-700/70 px-2 py-1 rounded text-xs text-white block">
                            {selectedItem.format}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <span className="text-gray-300 text-lg flex-shrink-0">
                        {selectedItem.itemType === "video" ? "🎥" : "🖼️"}
                      </span>
                      <div className="min-w-0">
                        <span className="text-gray-300 block text-xs">Type</span>
                        <span className="font-medium text-white block capitalize">
                          {selectedItem.itemType}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Enhanced Layout */}
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
                  <button
                    onClick={() => downloadItem(selectedItem)}
                    className="flex items-center justify-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 min-w-[140px]"
                    title="Download this item"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => shareItem(selectedItem)}
                    className="flex items-center justify-center space-x-3 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 min-w-[140px]"
                    title="Share this item"
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
                    className="flex items-center justify-center space-x-3 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 min-w-[140px] border-2 border-red-400/20"
                    title="Delete this item permanently"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Delete</span>
                  </button>
                </div>
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
                    {(["All Generations", "IG Posts", "IG Reels", "Misc"] as DriveFolder[]).map((folder) => (
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
    </div>
  );
}
