"use client";

import { memo, useState } from "react";
import {
  X,
  Download,
  Trash2,
  Move,
  Heart,
  Tag,
  Check,
  Loader2,
} from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  isDownloading: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onMove: () => void;
  onFavorite: (isFavorite: boolean) => void;
  onAddTags: (tags: string[]) => void;
}

export const BulkActionsBar = memo(function BulkActionsBar({
  selectedCount,
  totalCount,
  isDownloading,
  onSelectAll,
  onClearSelection,
  onDownload,
  onDelete,
  onMove,
  onFavorite,
  onAddTags,
}: BulkActionsBarProps) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const handleAddTags = () => {
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) {
      onAddTags(tags);
      setTagInput("");
      setShowTagInput(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 px-4 py-3 -mx-4 sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Selection info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 bg-violet-500 rounded-md">
            <Check className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-white">
            {selectedCount} selected
          </span>
          <button
            onClick={selectedCount === totalCount ? onClearSelection : onSelectAll}
            className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            {selectedCount === totalCount ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="flex-1" />

        {/* Tag input */}
        {showTagInput ? (
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700">
            <Tag className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTags();
                if (e.key === "Escape") setShowTagInput(false);
              }}
              placeholder="tag1, tag2, ..."
              className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-32"
              autoFocus
            />
            <button
              onClick={handleAddTags}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <Check className="w-4 h-4 text-green-400" />
            </button>
            <button
              onClick={() => setShowTagInput(false)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg text-sm transition-colors"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {isDownloading ? "Creating ZIP..." : "Download"}
              </span>
            </button>

            <button
              onClick={() => onFavorite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-pink-900/30 text-gray-300 hover:text-pink-400 rounded-lg text-sm transition-colors"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Favorite</span>
            </button>

            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">Add Tags</span>
            </button>

            <button
              onClick={onMove}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              <Move className="w-4 h-4" />
              <span className="hidden sm:inline">Move</span>
            </button>

            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </>
        )}

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
});
