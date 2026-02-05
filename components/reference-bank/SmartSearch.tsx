"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  Search,
  X,
  Clock,
  Tag,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
} from "lucide-react";
import { recentSearches, parseSearchQuery } from "@/lib/reference-bank/api";

interface SmartSearchProps {
  value: string;
  onChange: (query: string) => void;
  onFilterChange?: (filters: { type: "all" | "image" | "video"; tags: string[] }) => void;
  placeholder?: string;
  className?: string;
}

export const SmartSearch = memo(function SmartSearch({
  value,
  onChange,
  onFilterChange,
  placeholder = "Search references... (tag:portrait type:image)",
  className = "",
}: SmartSearchProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searches, setSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    setSearches(recentSearches.get());
  }, []);

  // Debounced search
  const debouncedOnChange = useDebouncedCallback((query: string) => {
    if (query.trim()) {
      // Parse search query for filters
      const { text, tags, type } = parseSearchQuery(query);
      
      // Notify parent of filter changes
      if (onFilterChange) {
        onFilterChange({ type, tags });
      }
      
      // Update main search with text portion
      onChange(text);
      
      // Add to recent searches
      recentSearches.add(query);
      setSearches(recentSearches.get());
    } else {
      onChange("");
      if (onFilterChange) {
        onFilterChange({ type: "all", tags: [] });
      }
    }
  }, 300);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      debouncedOnChange(newValue);
    },
    [debouncedOnChange]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setInputValue("");
    onChange("");
    if (onFilterChange) {
      onFilterChange({ type: "all", tags: [] });
    }
    inputRef.current?.focus();
  }, [onChange, onFilterChange]);

  // Handle recent search click
  const handleRecentClick = useCallback(
    (search: string) => {
      setInputValue(search);
      debouncedOnChange(search);
      setShowDropdown(false);
    },
    [debouncedOnChange]
  );

  // Handle remove recent search
  const handleRemoveRecent = useCallback((search: string, e: React.MouseEvent) => {
    e.stopPropagation();
    recentSearches.remove(search);
    setSearches(recentSearches.get());
  }, []);

  // Handle clear all recent searches
  const handleClearAll = useCallback(() => {
    recentSearches.clear();
    setSearches([]);
  }, []);

  // Handle quick filter click
  const handleQuickFilter = useCallback(
    (filter: string) => {
      const newValue = inputValue ? `${inputValue} ${filter}` : filter;
      setInputValue(newValue);
      debouncedOnChange(newValue);
      setShowDropdown(false);
    },
    [inputValue, debouncedOnChange]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    },
    []
  );

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
        />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-30 overflow-hidden"
        >
          {/* Quick filters */}
          <div className="p-3 border-b border-gray-800">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Quick Filters
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickFilter("type:image")}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
              >
                <ImageIcon className="w-3 h-3" />
                Images only
              </button>
              <button
                onClick={() => handleQuickFilter("type:video")}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
              >
                <VideoIcon className="w-3 h-3" />
                Videos only
              </button>
              <button
                onClick={() => handleQuickFilter("tag:portrait")}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
              >
                <Tag className="w-3 h-3" />
                tag:portrait
              </button>
              <button
                onClick={() => handleQuickFilter("tag:landscape")}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
              >
                <Tag className="w-3 h-3" />
                tag:landscape
              </button>
            </div>
          </div>

          {/* Recent searches */}
          {searches.length > 0 && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Recent Searches
                </h4>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-1">
                {searches.slice(0, 5).map((search) => (
                  <div
                    key={search}
                    onClick={() => handleRecentClick(search)}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800 rounded-lg cursor-pointer group transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span className="flex-1 text-sm text-gray-300 truncate">{search}</span>
                    <button
                      onClick={(e) => handleRemoveRecent(search, e)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded transition-all"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search tips */}
          <div className="p-3 bg-gray-800/50 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              <strong className="text-gray-400">Tips:</strong> Use{" "}
              <code className="px-1 py-0.5 bg-gray-700 rounded">tag:name</code> to filter by tag,{" "}
              <code className="px-1 py-0.5 bg-gray-700 rounded">type:image</code> or{" "}
              <code className="px-1 py-0.5 bg-gray-700 rounded">type:video</code> to filter by type
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
