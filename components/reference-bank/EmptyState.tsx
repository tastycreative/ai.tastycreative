"use client";

import { memo } from "react";
import {
  Upload,
  Heart,
  Search,
  Folder,
  Clock,
  HardDrive,
  Sparkles,
} from "lucide-react";

interface EmptyStateProps {
  type: "all" | "favorites" | "search" | "folder" | "recent";
  searchQuery?: string;
  isDragging?: boolean;
  onUpload: () => void;
  onGoogleDrive: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const EmptyState = memo(function EmptyState({
  type,
  searchQuery,
  isDragging,
  onUpload,
  onGoogleDrive,
  onDragOver,
  onDragLeave,
  onDrop,
}: EmptyStateProps) {
  const getContent = () => {
    switch (type) {
      case "favorites":
        return {
          icon: Heart,
          title: "No favorites yet",
          description: "Mark items as favorites to quickly access them here",
          showActions: false,
          iconColor: "text-pink-400",
          iconBg: "bg-pink-500/20",
        };
      case "search":
        return {
          icon: Search,
          title: "No matches found",
          description: `No references match "${searchQuery}"`,
          showActions: false,
          iconColor: "text-blue-400",
          iconBg: "bg-blue-500/20",
        };
      case "folder":
        return {
          icon: Folder,
          title: "This folder is empty",
          description: "Drag files here or upload new ones",
          showActions: true,
          iconColor: "text-yellow-400",
          iconBg: "bg-yellow-500/20",
        };
      case "recent":
        return {
          icon: Clock,
          title: "No recently used items",
          description: "Items you use in generation tools will appear here",
          showActions: false,
          iconColor: "text-blue-400",
          iconBg: "bg-blue-500/20",
        };
      case "all":
      default:
        return {
          icon: Upload,
          title: "No references yet",
          description: "Upload images or videos to use as references in your generations",
          showActions: true,
          iconColor: "text-violet-400",
          iconBg: "bg-violet-500/20",
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <div
      className={`flex flex-col items-center justify-center h-full text-center px-4 border-2 border-dashed rounded-2xl transition-all duration-300 ${
        isDragging
          ? "border-violet-500 bg-violet-500/10 scale-[1.02]"
          : "border-gray-700 hover:border-gray-600"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Animated icon */}
      <div
        className={`relative w-20 h-20 ${content.iconBg} rounded-2xl flex items-center justify-center mb-6 group`}
      >
        <Icon className={`w-10 h-10 ${content.iconColor} transition-transform duration-300 group-hover:scale-110`} />
        
        {/* Floating particles animation for upload state */}
        {type === "all" && !isDragging && (
          <>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full animate-ping opacity-75" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-purple-500 rounded-full animate-ping opacity-75 animation-delay-500" />
          </>
        )}
        
        {/* Drag indicator */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-violet-500/20 rounded-2xl animate-pulse" />
            <Sparkles className="w-6 h-6 text-violet-400 animate-bounce" />
          </div>
        )}
      </div>

      <h3 className="text-xl font-semibold text-white mb-2">{content.title}</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-6">{content.description}</p>

      {content.showActions && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onUpload}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-900/30 hover:shadow-violet-900/50 hover:scale-105"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
          <span className="text-gray-500 text-sm">or</span>
          <button
            onClick={onGoogleDrive}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-all border border-gray-700 hover:border-gray-600"
          >
            <HardDrive className="w-4 h-4 text-blue-400" />
            Import from Google Drive
          </button>
        </div>
      )}

      {/* Drag hint */}
      {content.showActions && (
        <p className="mt-4 text-xs text-gray-500">
          Or drag and drop files anywhere on this page
        </p>
      )}

      {/* Tips for search */}
      {type === "search" && (
        <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Search tips:</h4>
          <ul className="text-xs text-gray-400 space-y-1 text-left">
            <li>• Use <code className="px-1 py-0.5 bg-gray-700 rounded">tag:name</code> to search by tag</li>
            <li>• Use <code className="px-1 py-0.5 bg-gray-700 rounded">type:image</code> or <code className="px-1 py-0.5 bg-gray-700 rounded">type:video</code> to filter by type</li>
            <li>• Try using fewer or different keywords</li>
          </ul>
        </div>
      )}
    </div>
  );
});
