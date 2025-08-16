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
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Initializing...
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Setting up authentication
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading your images...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchContent}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2 mx-auto"
          >
            <span>Retry</span>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg">
              <ImageIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Generated Content
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                View and manage your AI-generated images
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {(imageStats || videoStats) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {imageStats && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <FileImage className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Images
                    </p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {imageStats.totalImages}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Download className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Images Size
                    </p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {Math.round((imageStats.totalSize / 1024 / 1024) * 100) /
                        100}{" "}
                      MB
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {videoStats && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Video className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Videos
                    </p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {videoStats.totalVideos}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Download className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Videos Size
                    </p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {Math.round((videoStats.totalSize / 1024 / 1024) * 100) /
                        100}{" "}
                      MB
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* Filter */}
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterBy)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Content</option>
              <option value="images">Images Only</option>
              <option value="videos">Videos Only</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="largest">Largest First</option>
              <option value="smallest">Smallest First</option>
              <option value="name">Name</option>
            </select>

            {/* View Mode */}
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${
                  viewMode === "grid"
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${
                  viewMode === "list"
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredAndSortedContent().length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No content found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery || filterBy !== "all"
              ? "Try adjusting your filters or search query"
              : "Start generating content to see it here"}
          </p>
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
