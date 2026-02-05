/**
 * Vault Enhancements - New Features Add-On
 * 
 * This file contains the new UI components and controls for the enhanced vault features:
 * - Sorting controls
 * - Duplicate detection
 * - Compare mode
 * - Settings menu (thumbnail size, search options)
 * - Recently viewed
 * - Favorites
 * 
 * To integrate: Add this component to the VaultContent header section after the filters row
 */

import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Calendar,
  HardDrive,
  File as FileIcon,
  SlidersHorizontal,
  Fingerprint,
  Loader2,
  Columns2,
  Settings,
  Star,
} from 'lucide-react';

interface VaultEnhancementsProps {
  // Sorting
  sortBy: 'date' | 'size' | 'name' | 'type';
  sortOrder: 'asc' | 'desc';
  onSortByChange: (sortBy: 'date' | 'size' | 'name' | 'type') => void;
  onSortOrderToggle: () => void;
  showSortMenu: boolean;
  setShowSortMenu: (show: boolean) => void;

  // Duplicates
  showDuplicates: boolean;
  detectingDuplicates: boolean;
  duplicatesCount: number;
  onDetectDuplicates: () => void;
  onToggleDuplicates: () => void;

  // Compare Mode
  selectedCount: number;
  onCompareClick: () => void;
  compareMode?: boolean;
  onExitCompare?: () => void;

  // Settings
  thumbnailSize: 'small' | 'medium' | 'large';
  onThumbnailSizeChange: (size: 'small' | 'medium' | 'large') => void;
  searchInMetadata: boolean;
  onSearchInMetadataToggle: () => void;
  disableVideoThumbnails: boolean;
  onDisableVideoThumbnailsToggle: () => void;
  showSettingsMenu: boolean;
  setShowSettingsMenu: (show: boolean) => void;

  // Stats
  filteredCount: number;
}

export function VaultEnhancements({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderToggle,
  showSortMenu,
  setShowSortMenu,
  showDuplicates,
  detectingDuplicates,
  duplicatesCount,
  onDetectDuplicates,
  onToggleDuplicates,
  selectedCount,
  onCompareClick,
  compareMode,
  onExitCompare,
  thumbnailSize,
  onThumbnailSizeChange,
  searchInMetadata,
  onSearchInMetadataToggle,
  disableVideoThumbnails,
  onDisableVideoThumbnailsToggle,
  showSettingsMenu,
  setShowSettingsMenu,
  filteredCount,
}: VaultEnhancementsProps) {
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });
  const [settingsMenuPosition, setSettingsMenuPosition] = useState({ top: 0, left: 0 });

  // Calculate sort menu position
  useEffect(() => {
    if (showSortMenu && sortButtonRef.current) {
      const rect = sortButtonRef.current.getBoundingClientRect();
      setSortMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showSortMenu]);

  // Calculate settings menu position
  useEffect(() => {
    if (showSettingsMenu && settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect();
      setSettingsMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 256, // 256px = w-64
      });
    }
  }, [showSettingsMenu]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSortMenu && sortButtonRef.current && !sortButtonRef.current.contains(e.target as Node)) {
        const sortMenu = document.getElementById('sort-menu-portal');
        if (sortMenu && !sortMenu.contains(e.target as Node)) {
          setShowSortMenu(false);
        }
      }
      if (showSettingsMenu && settingsButtonRef.current && !settingsButtonRef.current.contains(e.target as Node)) {
        const settingsMenu = document.getElementById('settings-menu-portal');
        if (settingsMenu && !settingsMenu.contains(e.target as Node)) {
          setShowSettingsMenu(false);
        }
      }
    };

    if (showSortMenu || showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortMenu, showSettingsMenu, setShowSortMenu, setShowSettingsMenu]);

  return (
    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.06]">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Sort Menu */}
        <div className="relative">
          <button
            ref={sortButtonRef}
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/10"
            title="Sort options"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sort: {sortBy}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
          </button>
          {showSortMenu && createPortal(
            <div 
              id="sort-menu-portal"
              className="fixed w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden"
              style={{
                top: `${sortMenuPosition.top}px`,
                left: `${sortMenuPosition.left}px`,
              }}
            >
              <div className="p-2 space-y-1">
                {[
                  { value: 'date' as const, label: 'Date', icon: Calendar },
                  { value: 'size' as const, label: 'File Size', icon: HardDrive },
                  { value: 'name' as const, label: 'Name', icon: FileIcon },
                  { value: 'type' as const, label: 'Type', icon: SlidersHorizontal },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      if (sortBy === value) {
                        onSortOrderToggle();
                      } else {
                        onSortByChange(value);
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortBy === value
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{label}</span>
                    {sortBy === value && (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Duplicate Detection */}
        <button
          onClick={() => {
            if (!showDuplicates && duplicatesCount === 0) {
              // Trigger detection first time
              onDetectDuplicates();
            } else {
              // Toggle view
              onToggleDuplicates();
            }
          }}
          disabled={detectingDuplicates}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
            showDuplicates
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
          } disabled:opacity-50`}
          title={duplicatesCount > 0 ? "Toggle duplicate view" : "Find duplicates"}
        >
          {detectingDuplicates ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Fingerprint className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {showDuplicates && duplicatesCount > 0 ? `${duplicatesCount} groups` : 'Duplicates'}
          </span>
        </button>

        {/* Compare Mode Toggle */}
        {!compareMode && (
          <button
            onClick={onCompareClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/10"
            title="Enable compare mode"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare</span>
          </button>
        )}

        {/* Compare Mode - Show button when in compare mode with items selected */}
        {compareMode && selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onCompareClick}
              disabled={selectedCount < 2}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                selectedCount >= 2
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30 animate-pulse'
                  : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
              }`}
              title={selectedCount >= 2 ? "View comparison" : "Select at least 2 items"}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {selectedCount >= 2 ? `View Compare (${selectedCount})` : `Select more (${selectedCount}/2)`}
              </span>
            </button>
            <button
              onClick={onExitCompare}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all"
              title="Exit compare mode"
            >
              <span className="hidden sm:inline">Exit Compare</span>
              <span className="sm:hidden">✕</span>
            </button>
          </div>
        )}

        {/* Compare Mode Active Indicator */}
        {compareMode && selectedCount === 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Click items to compare (0/4)</span>
            <button
              onClick={onExitCompare}
              className="ml-2 text-cyan-300 hover:text-cyan-200"
              title="Exit compare mode"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Settings Menu */}
        <div className="relative">
          <button
            ref={settingsButtonRef}
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/10"
            title="View settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {showSettingsMenu && createPortal(
            <div 
              id="settings-menu-portal"
              className="fixed w-64 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[9999] p-3 space-y-3"
              style={{
                top: `${settingsMenuPosition.top}px`,
                left: `${settingsMenuPosition.left}px`,
              }}
            >
              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Thumbnail Size</label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => onThumbnailSizeChange(size)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
                        thumbnailSize === size
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Search metadata</span>
                <button
                  onClick={onSearchInMetadataToggle}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    searchInMetadata ? 'bg-violet-500' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    searchInMetadata ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Disable video thumbnails</span>
                <button
                  onClick={onDisableVideoThumbnailsToggle}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    disableVideoThumbnails ? 'bg-violet-500' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    disableVideoThumbnails ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Results count */}
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {filteredCount} {filteredCount === 1 ? 'item' : 'items'}
        </span>
      </div>
    </div>
  );
}

// Favorite Star Button Component (for grid/list items)
interface FavoriteStarProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent) => void;
  className?: string;
}

export function FavoriteStar({ isFavorite, onToggle, className = '' }: FavoriteStarProps) {
  return (
    <button
      onClick={onToggle}
      className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
        isFavorite
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-gray-900/90 text-gray-400 hover:text-amber-400'
      } ${className}`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
    </button>
  );
}
