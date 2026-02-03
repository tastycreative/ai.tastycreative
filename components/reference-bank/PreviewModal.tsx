"use client";

import { memo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Heart,
  Edit2,
  Trash2,
  Calendar,
  BarChart3,
  Image as ImageIcon,
  Video as VideoIcon,
  Folder,
  Tag,
  Info,
  ExternalLink,
} from "lucide-react";
import { ReferenceItem } from "@/lib/reference-bank/api";

interface PreviewModalProps {
  item: ReferenceItem;
  totalItems: number;
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
  onToggleFavorite: () => void;
}

export const PreviewModal = memo(function PreviewModal({
  item,
  totalItems,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onEdit,
  onDelete,
  onDownload,
  onCopyUrl,
  onToggleFavorite,
}: PreviewModalProps) {
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          onPrev();
          break;
        case "ArrowRight":
          onNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  // Format helpers
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-full transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Navigation arrows */}
      {totalItems > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-full transition-colors z-10"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-full transition-colors z-10"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Main content */}
      <div
        className="flex flex-col lg:flex-row w-full max-w-7xl h-full lg:h-auto max-h-[90vh] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media preview */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0">
          {item.fileType === "video" ? (
            <video
              src={item.awsS3Url}
              className="max-w-full max-h-full rounded-xl shadow-2xl"
              controls
              autoPlay
              loop
            />
          ) : (
            <img
              src={item.awsS3Url}
              alt={item.name}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          )}
        </div>

        {/* Sidebar with details */}
        <div className="lg:w-80 bg-gray-900/90 backdrop-blur-sm rounded-xl p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Title and actions */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-2 break-words">
              {item.name}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  item.fileType === "video"
                    ? "bg-purple-500/20 text-purple-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {item.fileType === "video" ? (
                  <span className="flex items-center gap-1">
                    <VideoIcon className="w-3 h-3" /> Video
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Image
                  </span>
                )}
              </span>
              {item.folder && (
                <span
                  className="px-2 py-1 text-xs rounded-full flex items-center gap-1"
                  style={{
                    backgroundColor: `${item.folder.color}20`,
                    color: item.folder.color,
                  }}
                >
                  <Folder className="w-3 h-3" />
                  {item.folder.name}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Description
              </h3>
              <p className="text-sm text-gray-300">{item.description}</p>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Tags
              </h3>
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" /> Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Size</span>
                <span className="text-white">{formatFileSize(item.fileSize)}</span>
              </div>
              {item.width && item.height && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Dimensions</span>
                  <span className="text-white">
                    {item.width} × {item.height}
                  </span>
                </div>
              )}
              {item.duration && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Duration</span>
                  <span className="text-white">{formatDuration(item.duration)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Format</span>
                <span className="text-white">{item.mimeType.split("/")[1].toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Usage stats */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> Usage
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Times used</span>
                <span className="text-white">{item.usageCount}</span>
              </div>
              {item.lastUsedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Last used</span>
                  <span className="text-white text-xs">
                    {formatDate(item.lastUsedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Timeline
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Uploaded</span>
                <span className="text-white text-xs">{formatDate(item.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Modified</span>
                <span className="text-white text-xs">{formatDate(item.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto pt-4 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onToggleFavorite}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  item.isFavorite
                    ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                <Heart className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`} />
                {item.isFavorite ? "Unfavorite" : "Favorite"}
              </button>
              <button
                onClick={onDownload}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={onCopyUrl}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy URL
              </button>
              <button
                onClick={() => window.open(item.awsS3Url, "_blank")}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </button>
              <button
                onClick={onEdit}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={onDelete}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          {/* Navigation indicator */}
          {totalItems > 1 && (
            <div className="text-center text-sm text-gray-500">
              {currentIndex + 1} of {totalItems}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
});
