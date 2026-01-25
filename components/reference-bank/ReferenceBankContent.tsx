"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
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
  AlertCircle,
  Upload,
  Download,
  Copy,
  Grid3X3,
  List,
  Library,
  Tag,
  Clock,
  ChevronDown,
  PlayCircle,
  Info,
  Sparkles,
  Filter,
  Calendar,
  BarChart3,
  Heart,
} from "lucide-react";

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername?: string | null;
  isDefault?: boolean;
}

interface ReferenceItem {
  id: string;
  clerkId: string;
  profileId: string;
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
  createdAt: string;
  updatedAt: string;
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
}: {
  item: ReferenceItem;
  viewMode: "grid" | "list";
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onCopyUrl: () => void;
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
        </div>

        {/* Info */}
        <div className="p-3">
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
      <div className="w-16 h-16 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden">
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
        <h4 className="text-sm font-medium text-white truncate">{item.name}</h4>
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

export function ReferenceBankContent() {
  const { profileId: selectedProfileId, selectedProfile, profiles } = useInstagramProfile();
  
  // State
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "usage">("recent");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ReferenceItem | null>(null);
  
  // Form state
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch reference items
  const fetchReferenceItems = useCallback(async () => {
    if (!selectedProfileId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reference-bank?profileId=${selectedProfileId}`);
      if (response.ok) {
        const data = await response.json();
        setReferenceItems(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching reference items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    fetchReferenceItems();
  }, [fetchReferenceItems]);

  // Filter and sort items
  const filteredItems = referenceItems
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === "all" || item.fileType === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
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
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
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
      reader.onload = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      setShowUploadModal(true);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!uploadFile || !selectedProfileId) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // First, get presigned URL
      const presignResponse = await fetch("/api/reference-bank/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          fileName: uploadFile.name,
          fileType: uploadFile.type,
        }),
      });
      
      if (!presignResponse.ok) throw new Error("Failed to get upload URL");
      
      const { uploadUrl, key } = await presignResponse.json();
      
      // Upload to S3
      setUploadProgress(30);
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: uploadFile,
        headers: {
          "Content-Type": uploadFile.type,
        },
      });
      
      if (!uploadResponse.ok) throw new Error("Failed to upload file");
      
      setUploadProgress(70);
      
      // Create database record
      const createResponse = await fetch("/api/reference-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          name: uploadName,
          description: uploadDescription,
          tags: uploadTags.split(",").map((t) => t.trim()).filter(Boolean),
          fileType: uploadFile.type.startsWith("video/") ? "video" : "image",
          mimeType: uploadFile.type,
          fileSize: uploadFile.size,
          awsS3Key: key,
        }),
      });
      
      if (!createResponse.ok) throw new Error("Failed to create record");
      
      setUploadProgress(100);
      
      // Reset and refresh
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadName("");
      setUploadDescription("");
      setUploadTags("");
      fetchReferenceItems();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete item
  const handleDelete = async (item: ReferenceItem) => {
    try {
      const response = await fetch(`/api/reference-bank/${item.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setReferenceItems((prev) => prev.filter((i) => i.id !== item.id));
        setShowDeleteModal(false);
        setDeletingItem(null);
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
        setReferenceItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? updatedItem : i))
        );
        setShowEditModal(false);
        setEditingItem(null);
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update item.");
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  // Toggle item selection
  const toggleSelection = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select all
  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Delete selected
  const deleteSelected = async () => {
    if (selectedItems.size === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedItems.size} items?`
    );
    
    if (confirmed) {
      try {
        await Promise.all(
          Array.from(selectedItems).map((id) =>
            fetch(`/api/reference-bank/${id}`, { method: "DELETE" })
          )
        );
        
        setReferenceItems((prev) =>
          prev.filter((i) => !selectedItems.has(i.id))
        );
        setSelectedItems(new Set());
      } catch (error) {
        console.error("Bulk delete error:", error);
        alert("Failed to delete some items.");
      }
    }
  };

  // Stats
  const totalItems = referenceItems.length;
  const imageCount = referenceItems.filter((i) => i.fileType === "image").length;
  const videoCount = referenceItems.filter((i) => i.fileType === "video").length;
  const totalUsage = referenceItems.reduce((sum, i) => sum + i.usageCount, 0);

  // Prevent hydration mismatch by showing loading state until mounted
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

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* Main Layout */}
      <div className="h-[calc(100vh-120px)] sm:h-[calc(100vh-120px)] flex bg-gray-950 rounded-xl border border-gray-800 overflow-hidden relative">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:relative z-50 lg:z-auto w-72 lg:w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col rounded-l-xl overflow-hidden transition-transform duration-300 ease-in-out`}
        >
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Library className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-white">Reference Bank</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <PanelLeftClose className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Profile Display */}
          {selectedProfile && (
            <div className="px-3 py-2 border-b border-gray-800">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg">
                <div className="w-6 h-6 bg-violet-600/30 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-medium text-violet-300">
                    {selectedProfile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-gray-300 truncate">
                  {selectedProfile.name}
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Statistics
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Total Items</span>
                <span className="text-white font-medium">{totalItems}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Images
                </span>
                <span className="text-white font-medium">{imageCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1">
                  <VideoIcon className="w-3 h-3" /> Videos
                </span>
                <span className="text-white font-medium">{videoCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Total Usage
                </span>
                <span className="text-white font-medium">{totalUsage}</span>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="p-4 flex-1 overflow-y-auto reference-scroll">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Quick Filters
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setFilterType("all")}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                  filterType === "all"
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                All Files
              </button>
              <button
                onClick={() => setFilterType("image")}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  filterType === "image"
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Images Only
              </button>
              <button
                onClick={() => setFilterType("video")}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  filterType === "video"
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <VideoIcon className="w-4 h-4" />
                Videos Only
              </button>
            </div>

            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-6 mb-3">
              Sort By
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setSortBy("recent")}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  sortBy === "recent"
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <Clock className="w-4 h-4" />
                Most Recent
              </button>
              <button
                onClick={() => setSortBy("name")}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  sortBy === "name"
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center text-xs">A-Z</span>
                Name
              </button>
              <button
                onClick={() => setSortBy("usage")}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  sortBy === "usage"
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Most Used
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="p-4 border-t border-gray-800 bg-gray-800/30">
            <div className="flex items-start gap-2 text-xs text-gray-400">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Store reference images and videos here to quickly reuse them in
                SeeDream, Kling, and other generation tools.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden w-full relative">
          {/* Header */}
          <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
            {/* Mobile header */}
            <div className="flex items-center gap-3 lg:hidden mb-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5 text-gray-300" />
              </button>
            </div>

            {/* Search and controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search references..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === "grid"
                        ? "bg-gray-700 text-violet-400"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === "list"
                        ? "bg-gray-700 text-violet-400"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-violet-900/30"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload</span>
                </button>
              </div>
            </div>

            {/* Selection bar */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-3 mt-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
                <span className="text-sm text-gray-300">
                  {selectedItems.size} selected
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-violet-400 hover:text-violet-300"
                >
                  {selectedItems.size === filteredItems.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <div className="flex-1" />
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1 px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 reference-scroll">
            {!selectedProfileId ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                  <Library className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-1">
                  Select a profile
                </h3>
                <p className="text-sm text-gray-500">
                  Choose a profile from the global selector to manage references
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center h-full text-center px-4 border-2 border-dashed border-gray-700 rounded-2xl transition-colors ${
                  isDragging ? "border-violet-500 bg-violet-500/10" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-1">
                  {searchQuery ? "No matches found" : "No references yet"}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {searchQuery
                    ? "Try a different search term"
                    : "Upload images or videos to use as references in your generations"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Reference
                  </button>
                )}
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
                    : "space-y-2"
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                {filteredItems.map((item) => (
                  <ReferenceItemCard
                    key={item.id}
                    item={item}
                    viewMode={viewMode}
                    isSelected={selectedItems.has(item.id)}
                    onSelect={() => toggleSelection(item.id)}
                    onDelete={() => {
                      setDeletingItem(item);
                      setShowDeleteModal(true);
                    }}
                    onEdit={() => {
                      setEditingItem(item);
                      setUploadName(item.name);
                      setUploadDescription(item.description || "");
                      setUploadTags(item.tags.join(", "));
                      setShowEditModal(true);
                    }}
                    onCopyUrl={() => handleCopyUrl(item.awsS3Url)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {mounted &&
        showUploadModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Add Reference
                    </h3>
                    <p className="text-sm text-gray-400">
                      Upload a new reference file
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Preview */}
                {uploadPreview && (
                  <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden">
                    {uploadFile?.type.startsWith("video/") ? (
                      <video
                        src={uploadPreview}
                        className="w-full h-full object-contain"
                        controls
                      />
                    ) : (
                      <img
                        src={uploadPreview}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="Reference name"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Add a description..."
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Tags (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="portrait, outdoor, etc. (comma-separated)"
                  />
                </div>

                {/* Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Uploading...</span>
                      <span className="text-violet-400">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadPreview(null);
                    setUploadName("");
                    setUploadDescription("");
                    setUploadTags("");
                  }}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || !uploadName || isUploading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Modal */}
      {mounted &&
        showEditModal &&
        editingItem &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                    <Edit2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Edit Reference
                    </h3>
                    <p className="text-sm text-gray-400">
                      Update reference details
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Preview */}
                <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden">
                  {editingItem.fileType === "video" ? (
                    <video
                      src={editingItem.awsS3Url}
                      className="w-full h-full object-contain"
                      controls
                    />
                  ) : (
                    <img
                      src={editingItem.awsS3Url}
                      alt={editingItem.name}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="Reference name"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Add a description..."
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="portrait, outdoor, etc. (comma-separated)"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!uploadName}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {mounted &&
        showDeleteModal &&
        deletingItem &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-xl">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Delete Reference
                    </h3>
                    <p className="text-sm text-gray-400">
                      This action cannot be undone
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-300">
                  Are you sure you want to delete &quot;{deletingItem.name}&quot;?
                </p>
              </div>

              <div className="p-6 border-t border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingItem(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingItem)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
