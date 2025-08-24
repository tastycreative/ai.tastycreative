// app/(dashboard)/workspace/generated-content/page.tsx - Gallery Page
"use client";

import { useState, useEffect } from "react";
import { useApiClient } from "@/lib/apiClient";
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
  SortAsc,
  SortDesc,
  MoreVertical,
  Video,
  Play,
  Pause,
  RefreshCw,
  Star,
  Heart,
  Clock,
  TrendingUp,
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [imagesPerPage] = useState(20);

  // Fetch images and stats
  useEffect(() => {
    if (apiClient) {
      fetchContent();
      fetchStats();
    }
  }, [apiClient]);

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

      // Fetch images
      console.log("📡 Fetching images from /api/images...");
      const imagesResponse = await apiClient.get("/api/images");
      console.log("📡 Images response status:", imagesResponse.status);
      console.log(
        "📡 Images response headers:",
        Object.fromEntries(imagesResponse.headers.entries())
      );

      // Fetch videos
      console.log("📡 Fetching videos from /api/videos...");
      const videosResponse = await apiClient.get("/api/videos");
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

      if (image.dataUrl) {
        // Priority 1: Download from database
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

      if (image.url) {
        // Priority 2: Download from ComfyUI (dynamic URL)
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

    if (image.dataUrl) {
      // Priority 1: Share database URL (more reliable)
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
      // Priority 2: Share ComfyUI URL (dynamic)
      urlToShare = image.url;
    } else {
      alert("No shareable URL available for this image");
      return;
    }

    navigator.clipboard.writeText(urlToShare);
    alert("Image URL copied to clipboard!");
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
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center p-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full inline-flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Initializing...
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Setting up authentication and connecting to your content
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center p-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full inline-flex items-center justify-center mb-4 animate-pulse">
            <ImageIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Loading Your Gallery
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching your AI-generated images and videos...
          </p>
          <div className="flex justify-center mt-4">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center p-8 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/30 rounded-xl shadow-lg border border-red-200 dark:border-red-700 max-w-md">
          <div className="p-4 bg-red-500 rounded-full inline-flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
            Something went wrong
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
          <button
            onClick={fetchContent}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // Unified action functions
  const downloadItem = async (item: ContentItem) => {
    try {
      const url = item.dataUrl || item.url;
      if (!url) {
        console.error("No URL available for download");
        return;
      }

      const response = await fetch(url);
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
        `${
          item.itemType === "video" ? "Video" : "Image"
        } downloaded successfully`
      );
    } catch (error) {
      console.error("Download error:", error);
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
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-teal-600/10 rounded-full blur-xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <ImageIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                Generated Content
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                View and manage your AI-generated images and videos
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={fetchContent}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {allContent.length > 0 && (
              <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full text-sm font-medium">
                {allContent.length} items
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Stats */}
      {(imageStats || videoStats) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {imageStats && (
            <>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <FileImage className="w-5 h-5 text-white" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-300 mb-1">
                    Total Images
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {imageStats.totalImages.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl p-6 border border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <Heart className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-300 mb-1">
                    Total Size
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {(imageStats.totalSize / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
            </>
          )}
          {videoStats && (
            <>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <Play className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-300 mb-1">
                    Total Videos
                  </p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {videoStats.totalVideos.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-300 mb-1">
                    Video Size
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {(videoStats.totalSize / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Enhanced Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Enhanced Search */}
            <div className="relative flex-1 min-w-0 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content Type Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Content ({allContent.length})</option>
                <option value="images">Images Only ({images.length})</option>
                <option value="videos">Videos Only ({videos.length})</option>
              </select>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between sm:justify-end space-x-3">
            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="newest">⏰ Newest First</option>
              <option value="oldest">🕐 Oldest First</option>
              <option value="largest">📏 Largest First</option>
              <option value="smallest">📐 Smallest First</option>
              <option value="name">🔤 Name A-Z</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2.5 transition-all ${
                  viewMode === "grid"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 transition-all ${
                  viewMode === "list"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
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
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                {filteredAndSortedContent().length} items
                {searchQuery && ` matching "${searchQuery}"`}
                {filterBy !== "all" && ` (${filterBy} only)`}
              </span>
              {(searchQuery || filterBy !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterBy("all");
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-medium"
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
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl transform -translate-x-1/2" />
          <div className="relative flex flex-col items-center space-y-6">
            {/* Dynamic Icon based on state */}
            <div className="p-6 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-full border border-emerald-200 dark:border-emerald-700">
              {searchQuery || filterBy !== "all" ? (
                <Search className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <ImageIcon className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
              )}
            </div>

            {/* Content */}
            <div className="max-w-md">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {searchQuery || filterBy !== "all"
                  ? "No matching content"
                  : "No content generated yet"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-6">
                {searchQuery || filterBy !== "all"
                  ? "Try adjusting your filters or search query to find what you're looking for."
                  : "Start generating AI content to build your personal gallery. Your images and videos will appear here."}
              </p>

              {/* Action Buttons */}
              <div className="space-y-4">
                {searchQuery || filterBy !== "all" ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterBy("all");
                    }}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>Clear filters</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* Quick Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg transform hover:scale-105">
                        <ImageIcon className="w-5 h-5" />
                        <span>Generate Images</span>
                      </button>
                      <button className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg transform hover:scale-105">
                        <Video className="w-5 h-5" />
                        <span>Generate Videos</span>
                      </button>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-emerald-500" />
                        <span>High-quality AI content</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Download className="w-4 h-4 text-blue-500" />
                        <span>Easy download & share</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Eye className="w-4 h-4 text-purple-500" />
                        <span>Preview & organize</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {paginatedContent().map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="relative aspect-square">
                    {item.itemType === "video" ? (
                      <video
                        src={item.dataUrl || item.url}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                        preload="metadata"
                        muted
                        onError={(e) => {
                          console.error("Video load error for:", item.filename);

                          // Smart fallback logic
                          const currentSrc = (e.target as HTMLVideoElement).src;

                          if (currentSrc === item.dataUrl && item.url) {
                            console.log("Falling back to ComfyUI URL");
                            (e.target as HTMLVideoElement).src = item.url;
                          } else if (currentSrc === item.url && item.dataUrl) {
                            console.log("Falling back to database URL");
                            (e.target as HTMLVideoElement).src = item.dataUrl;
                          } else {
                            console.error(
                              "All URLs failed for:",
                              item.filename
                            );
                            (e.target as HTMLVideoElement).style.display =
                              "none";
                          }
                        }}
                      />
                    ) : (
                      <img
                        src={item.dataUrl || item.url}
                        alt={item.filename}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                        onError={(e) => {
                          console.error("Image load error for:", item.filename);

                          // Smart fallback logic
                          const currentSrc = (e.target as HTMLImageElement).src;

                          if (currentSrc === item.dataUrl && item.url) {
                            console.log("Falling back to ComfyUI URL");
                            (e.target as HTMLImageElement).src = item.url;
                          } else if (currentSrc === item.url && item.dataUrl) {
                            console.log("Falling back to database URL");
                            (e.target as HTMLImageElement).src = item.dataUrl;
                          } else {
                            console.error(
                              "All URLs failed for:",
                              item.filename
                            );
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }
                        }}
                      />
                    )}

                    {/* Item type indicator */}
                    <div className="absolute top-2 left-2">
                      {item.itemType === "video" ? (
                        <div className="p-1 bg-purple-500 text-white rounded-full">
                          <Video className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="p-1 bg-blue-500 text-white rounded-full">
                          <ImageIcon className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                          title="View item"
                        >
                          <Eye className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadItem(item);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                          title="Download item"
                        >
                          <Download className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareItem(item);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                          title="Share item"
                        >
                          <Share2 className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <p
                      className="text-sm font-medium text-gray-900 dark:text-white truncate"
                      title={item.filename}
                    >
                      {item.filename}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatFileSize(item.fileSize)}</span>
                      {item.width && item.height && (
                        <span>
                          {item.width}×{item.height}
                        </span>
                      )}
                      {item.itemType === "video" && item.duration && (
                        <span>{item.duration.toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedContent().map((item) => (
                  <div
                    key={item.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {item.itemType === "video" ? (
                          <>
                            <video
                              src={item.dataUrl || item.url}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setSelectedItem(item)}
                              preload="metadata"
                              muted
                              onError={(e) => {
                                console.error(
                                  "List view video load error for:",
                                  item.filename
                                );

                                const currentSrc = (
                                  e.target as HTMLVideoElement
                                ).src;

                                if (currentSrc === item.dataUrl && item.url) {
                                  console.log("Falling back to ComfyUI URL");
                                  (e.target as HTMLVideoElement).src = item.url;
                                } else if (
                                  currentSrc === item.url &&
                                  item.dataUrl
                                ) {
                                  console.log("Falling back to database URL");
                                  (e.target as HTMLVideoElement).src =
                                    item.dataUrl;
                                } else {
                                  console.error(
                                    "All URLs failed for:",
                                    item.filename
                                  );
                                  (e.target as HTMLVideoElement).style.display =
                                    "none";
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
                            src={item.dataUrl || item.url}
                            alt={item.filename}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setSelectedItem(item)}
                            onError={(e) => {
                              console.error(
                                "List view image load error for:",
                                item.filename
                              );

                              const currentSrc = (e.target as HTMLImageElement)
                                .src;

                              if (currentSrc === item.dataUrl && item.url) {
                                console.log("Falling back to ComfyUI URL");
                                (e.target as HTMLImageElement).src = item.url;
                              } else if (
                                currentSrc === item.url &&
                                item.dataUrl
                              ) {
                                console.log("Falling back to database URL");
                                (e.target as HTMLImageElement).src =
                                  item.dataUrl;
                              } else {
                                console.error(
                                  "All URLs failed for:",
                                  item.filename
                                );
                                (e.target as HTMLImageElement).style.display =
                                  "none";
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
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(currentPage - 1) * imagesPerPage + 1} to{" "}
                {Math.min(
                  currentPage * imagesPerPage,
                  filteredAndSortedContent().length
                )}{" "}
                of {filteredAndSortedContent().length} items
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 rounded-full bg-black bg-opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            {selectedItem.itemType === "video" ? (
              <video
                src={selectedItem.dataUrl || selectedItem.url}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                controls
                autoPlay
                onError={(e) => {
                  console.error(
                    "Modal video load error for:",
                    selectedItem.filename
                  );

                  const currentSrc = (e.target as HTMLVideoElement).src;

                  if (currentSrc === selectedItem.dataUrl && selectedItem.url) {
                    console.log("Modal falling back to ComfyUI URL");
                    (e.target as HTMLVideoElement).src = selectedItem.url;
                  } else if (
                    currentSrc === selectedItem.url &&
                    selectedItem.dataUrl
                  ) {
                    console.log("Modal falling back to database URL");
                    (e.target as HTMLVideoElement).src = selectedItem.dataUrl;
                  } else {
                    console.error(
                      "All modal URLs failed for:",
                      selectedItem.filename
                    );
                  }
                }}
              />
            ) : (
              <img
                src={selectedItem.dataUrl || selectedItem.url}
                alt={selectedItem.filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                onError={(e) => {
                  console.error(
                    "Modal image load error for:",
                    selectedItem.filename
                  );

                  const currentSrc = (e.target as HTMLImageElement).src;

                  if (currentSrc === selectedItem.dataUrl && selectedItem.url) {
                    console.log("Modal falling back to ComfyUI URL");
                    (e.target as HTMLImageElement).src = selectedItem.url;
                  } else if (
                    currentSrc === selectedItem.url &&
                    selectedItem.dataUrl
                  ) {
                    console.log("Modal falling back to database URL");
                    (e.target as HTMLImageElement).src = selectedItem.dataUrl;
                  } else {
                    console.error(
                      "All modal URLs failed for:",
                      selectedItem.filename
                    );
                  }
                }}
              />
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b-lg">
              <h3 className="text-lg font-medium mb-2">
                {selectedItem.filename}
              </h3>
              <div className="flex items-center justify-between">
                <div className="text-sm space-y-1">
                  <p>Created: {formatDate(selectedItem.createdAt)}</p>
                  {selectedItem.width && selectedItem.height && (
                    <p>
                      Dimensions: {selectedItem.width} × {selectedItem.height}
                    </p>
                  )}
                  {selectedItem.itemType === "video" &&
                    selectedItem.duration && (
                      <p>Duration: {selectedItem.duration.toFixed(1)}s</p>
                    )}
                  <p>Size: {formatFileSize(selectedItem.fileSize)}</p>
                  {selectedItem.format && (
                    <p>Format: {selectedItem.format.toUpperCase()}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => downloadItem(selectedItem)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => shareItem(selectedItem)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={() => deleteItem(selectedItem)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
