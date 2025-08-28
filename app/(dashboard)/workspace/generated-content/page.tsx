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
  RefreshCw,
  SortAsc,
  SortDesc,
  MoreVertical,
  Video,
  Play,
  Pause,
  HardDrive,
  BarChart3,
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

  // Auto-refresh content every 30 seconds to catch new generations
  useEffect(() => {
    if (!apiClient) return;

    const interval = setInterval(() => {
      console.log("🔄 Auto-refreshing generated content...");
      fetchContent();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
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
      <div className="flex items-center justify-center min-h-[600px] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900 rounded-2xl">
        <div className="text-center space-y-8 p-8">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto shadow-lg"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
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
              {paginatedContent().map((item, index) => (
                <div
                  key={item.id}
                  className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-2xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 hover:scale-[1.02] transform"
                  style={{
                    animationDelay: `${index * 0.05}s`,
                  }}
                >
                  <div className="relative aspect-square overflow-hidden">
                    {item.itemType === "video" ? (
                      <video
                        src={item.dataUrl || item.url}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-110"
                        onClick={() => setSelectedItem(item)}
                        preload="metadata"
                        muted
                        onError={(e) => {
                          console.error("Video load error for:", item.filename);
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
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-110"
                        onClick={() => setSelectedItem(item)}
                        onError={(e) => {
                          console.error("Image load error for:", item.filename);
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
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm border border-white/30">
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
                      let endPage = Math.min(
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
                  src={selectedItem.dataUrl || selectedItem.url}
                  className="max-w-full max-h-[80vh] object-contain"
                  controls
                  autoPlay
                  onError={(e) => {
                    console.error(
                      "Modal video load error for:",
                      selectedItem.filename
                    );
                    const currentSrc = (e.target as HTMLVideoElement).src;
                    if (
                      currentSrc === selectedItem.dataUrl &&
                      selectedItem.url
                    ) {
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
                  className="max-w-full max-h-[80vh] object-contain"
                  onError={(e) => {
                    console.error(
                      "Modal image load error for:",
                      selectedItem.filename
                    );
                    const currentSrc = (e.target as HTMLImageElement).src;
                    if (
                      currentSrc === selectedItem.dataUrl &&
                      selectedItem.url
                    ) {
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
            </div>

            {/* Modal Footer */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                {/* Details */}
                <div className="text-white space-y-2 flex-1">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-300" />
                      <span className="text-gray-300">Created:</span>
                      <span className="font-medium">
                        {formatDate(selectedItem.createdAt)}
                      </span>
                    </div>

                    {selectedItem.width && selectedItem.height && (
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-300">📐</span>
                        <span className="text-gray-300">Size:</span>
                        <span className="font-medium">
                          {selectedItem.width} × {selectedItem.height}
                        </span>
                      </div>
                    )}

                    {selectedItem.itemType === "video" &&
                      selectedItem.duration && (
                        <div className="flex items-center space-x-2">
                          <Video className="w-4 h-4 text-gray-300" />
                          <span className="text-gray-300">Duration:</span>
                          <span className="font-medium">
                            {selectedItem.duration.toFixed(1)}s
                          </span>
                        </div>
                      )}

                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-4 h-4 text-gray-300" />
                      <span className="text-gray-300">File size:</span>
                      <span className="font-medium">
                        {formatFileSize(selectedItem.fileSize)}
                      </span>
                    </div>

                    {selectedItem.format && (
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-300">Format:</span>
                        <span className="font-medium uppercase bg-gray-700/50 px-2 py-1 rounded text-xs">
                          {selectedItem.format}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => downloadItem(selectedItem)}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => shareItem(selectedItem)}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={() => {
                      deleteItem(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
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
