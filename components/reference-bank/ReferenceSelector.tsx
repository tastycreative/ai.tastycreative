"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Library,
  Search,
  X,
  Check,
  Image as ImageIcon,
  Video as VideoIcon,
  Clock,
  BarChart3,
  ChevronDown,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { useReferenceBank, ReferenceItem } from "@/hooks/useReferenceBank";

interface ReferenceSelectorProps {
  profileId?: string;
  onSelect: (item: ReferenceItem) => void;
  onClose?: () => void;
  filterType?: "all" | "image" | "video";
  selectedItemId?: string | null;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  /** When true, the modal opens immediately without a trigger button */
  isOpen?: boolean;
}

export function ReferenceSelector({
  profileId,
  onSelect,
  onClose,
  filterType = "all",
  selectedItemId = null,
  className = "",
  buttonClassName = "",
  disabled = false,
  placeholder = "Select from Reference Bank",
  isOpen: controlledIsOpen,
}: ReferenceSelectorProps) {
  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledIsOpen !== undefined;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  
  const setIsOpen = (value: boolean) => {
    if (isControlled) {
      if (!value && onClose) {
        onClose();
      }
    } else {
      setInternalIsOpen(value);
    }
  };
  
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "usage" | "name">("recent");

  const { items, isLoading, trackUsage, hasItems } = useReferenceBank({
    filterType,
    autoFetch: true,
    profileId,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedItem = selectedItemId
    ? items.find((i) => i.id === selectedItemId)
    : null;

  const filteredItems = items
    .filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "usage":
          return b.usageCount - a.usageCount;
        case "recent":
        default:
          if (a.lastUsedAt && b.lastUsedAt) {
            return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const handleSelect = (item: ReferenceItem) => {
    trackUsage(item.id);
    onSelect(item);
    setIsOpen(false);
    setSearchQuery("");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // When controlled externally, don't render the trigger button
  if (isControlled) {
    if (!isOpen) return null;
    
    return mounted && createPortal(
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                  <Library className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Reference Bank
                  </h3>
                  <p className="text-sm text-gray-400">
                    Select a reference {filterType !== "all" ? filterType : "file"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Search and Sort */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search references..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="recent">Recently Used</option>
                <option value="usage">Most Used</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : !hasItems ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Library className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-gray-400">No references saved yet</p>
                <p className="text-sm text-gray-500">
                  Upload images and they will be automatically saved here
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Search className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-gray-400">No matches found</p>
                <p className="text-sm text-gray-500">
                  Try a different search term
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`group relative bg-gray-800 rounded-xl border ${
                      selectedItemId === item.id
                        ? "border-violet-500 ring-2 ring-violet-500/30"
                        : "border-gray-700 hover:border-gray-600"
                    } overflow-hidden transition-all text-left`}
                  >
                    {/* Selection indicator */}
                    {selectedItemId === item.id && (
                      <div className="absolute top-2 right-2 z-10 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* Type badge */}
                    <div className="absolute top-2 left-2 z-10">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          item.fileType === "video"
                            ? "bg-purple-500/80 text-white"
                            : "bg-blue-500/80 text-white"
                        }`}
                      >
                        {item.fileType === "video" ? (
                          <VideoIcon className="w-3 h-3 inline" />
                        ) : (
                          <ImageIcon className="w-3 h-3 inline" />
                        )}
                      </span>
                    </div>

                    {/* Preview */}
                    <div className="aspect-square relative bg-gray-900">
                      {item.fileType === "video" ? (
                        <div className="relative w-full h-full">
                          <video
                            src={item.awsS3Url}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <PlayCircle className="w-8 h-8 text-white/80" />
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

                    {/* Info */}
                    <div className="p-2">
                      <h4 className="text-xs font-medium text-white truncate">
                        {item.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                        <span>{formatFileSize(item.fileSize)}</span>
                        <span className="flex items-center gap-0.5">
                          <BarChart3 className="w-2.5 h-2.5" />
                          {item.usageCount}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 flex justify-end">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <>
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm transition-colors hover:bg-gray-700 hover:border-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName} ${className}`}
      >
        <Library className="w-4 h-4 text-violet-400" />
        <span className="text-gray-300 truncate flex-1 text-left">
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                      <Library className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Reference Bank
                      </h3>
                      <p className="text-sm text-gray-400">
                        Select a reference {filterType !== "all" ? filterType : "file"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Search and Sort */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search references..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    <option value="recent">Recently Used</option>
                    <option value="usage">Most Used</option>
                    <option value="name">Name A-Z</option>
                  </select>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  </div>
                ) : !hasItems ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <Library className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-gray-400">No references saved yet</p>
                    <p className="text-sm text-gray-500">
                      Add references from the Reference Bank page
                    </p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <Search className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-gray-400">No matches found</p>
                    <p className="text-sm text-gray-500">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className={`group relative bg-gray-800 rounded-xl border ${
                          selectedItemId === item.id
                            ? "border-violet-500 ring-2 ring-violet-500/30"
                            : "border-gray-700 hover:border-gray-600"
                        } overflow-hidden transition-all text-left`}
                      >
                        {/* Selection indicator */}
                        {selectedItemId === item.id && (
                          <div className="absolute top-2 right-2 z-10 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}

                        {/* Type badge */}
                        <div className="absolute top-2 left-2 z-10">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                              item.fileType === "video"
                                ? "bg-purple-500/80 text-white"
                                : "bg-blue-500/80 text-white"
                            }`}
                          >
                            {item.fileType === "video" ? (
                              <VideoIcon className="w-3 h-3 inline" />
                            ) : (
                              <ImageIcon className="w-3 h-3 inline" />
                            )}
                          </span>
                        </div>

                        {/* Preview */}
                        <div className="aspect-square relative bg-gray-900">
                          {item.fileType === "video" ? (
                            <div className="relative w-full h-full">
                              <video
                                src={item.awsS3Url}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <PlayCircle className="w-8 h-8 text-white/80" />
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

                        {/* Info */}
                        <div className="p-2">
                          <h4 className="text-xs font-medium text-white truncate">
                            {item.name}
                          </h4>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                            <span>{formatFileSize(item.fileSize)}</span>
                            <span className="flex items-center gap-0.5">
                              <BarChart3 className="w-2.5 h-2.5" />
                              {item.usageCount}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-700 flex justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
