"use client";

import { ChevronDown, FolderOpen, Folder, X, Check, Search, Star, ChevronRight } from "lucide-react";
import { useRef, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

export interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  profileName?: string;
  isDefault?: boolean;
  parentId?: string | null;
  subfolders?: Array<{ id: string }>;
  itemCount?: number; // Optional: for showing folder statistics
}

interface VaultFolderDropdownProps {
  targetFolder: string;
  setTargetFolder: (folderId: string) => void;
  folderDropdownOpen: boolean;
  setFolderDropdownOpen: (open: boolean) => void;
  vaultFolders: VaultFolder[];
  isAllProfiles: boolean;
  selectedProfile?: {
    instagramUsername?: string | null;
    name?: string;
  } | null;
  mounted: boolean;
  accentColor?: "violet" | "purple" | "cyan" | "emerald" | "pink";
  label?: string;
}

/**
 * Enhanced Vault Folder Dropdown Component
 * 
 * NEW FEATURES:
 * ✅ Search/Filter folders by name
 * ✅ Favorites/Pinned folders
 * ✅ Larger dropdown (400px max-height)
 * ✅ Keyboard navigation (Arrow keys, Enter, Escape)
 * ✅ Folder item count display
 * ✅ Collapsible nested folders
 * ✅ Better scrolling with visual feedback
 */
export default function VaultFolderDropdownEnhanced({
  targetFolder,
  setTargetFolder,
  folderDropdownOpen,
  setFolderDropdownOpen,
  vaultFolders,
  isAllProfiles,
  selectedProfile,
  mounted,
  accentColor = "violet",
  label = "Save to Vault Folder"
}: VaultFolderDropdownProps) {
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownContentRef = useRef<HTMLDivElement>(null);
  
  // Dropdown position state
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Favorites state (stored in localStorage per profile) - Initialize immediately from localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const profileKey = selectedProfile?.instagramUsername || 'default';
    const savedFavorites = localStorage.getItem(`vault-favorites-${profileKey}`);
    return savedFavorites ? new Set(JSON.parse(savedFavorites)) : new Set();
  });
  
  // Collapsed folders state (for nested hierarchy)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  
  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Update favorites when profile changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const profileKey = selectedProfile?.instagramUsername || 'default';
    const savedFavorites = localStorage.getItem(`vault-favorites-${profileKey}`);
    setFavorites(savedFavorites ? new Set(JSON.parse(savedFavorites)) : new Set());
  }, [selectedProfile]);

  // Toggle favorite
  const toggleFavorite = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const profileKey = selectedProfile?.instagramUsername || 'default';
    const newFavorites = new Set(favorites);
    
    if (newFavorites.has(folderId)) {
      newFavorites.delete(folderId);
    } else {
      newFavorites.add(folderId);
    }
    
    setFavorites(newFavorites);
    localStorage.setItem(`vault-favorites-${profileKey}`, JSON.stringify([...newFavorites]));
  };

  // Toggle folder collapse/expand
  const toggleCollapse = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newCollapsed = new Set(collapsedFolders);
    
    if (newCollapsed.has(folderId)) {
      newCollapsed.delete(folderId);
    } else {
      newCollapsed.add(folderId);
    }
    
    setCollapsedFolders(newCollapsed);
  };

  // Helper: Get folder path as breadcrumb
  const getFolderPath = (folderId: string): string => {
    const parts: string[] = [];
    let currentId: string | null = folderId;
    
    while (currentId) {
      const folder = vaultFolders.find(f => f.id === currentId);
      if (!folder) break;
      parts.unshift(folder.name);
      currentId = folder.parentId || null;
    }
    
    return parts.join(' / ');
  };

  // Helper: Get folder depth
  const getFolderDepth = (folderId: string): number => {
    let depth = 0;
    let currentId: string | null = folderId;
    
    while (currentId) {
      const folder = vaultFolders.find(f => f.id === currentId);
      if (!folder || !folder.parentId) break;
      depth++;
      currentId = folder.parentId;
    }
    
    return depth;
  };

  // Helper: Sort folders by hierarchy
  const sortFoldersHierarchically = (folders: VaultFolder[]): VaultFolder[] => {
    const folderMap = new Map(folders.map(f => [f.id, f]));
    const result: VaultFolder[] = [];
    const visited = new Set<string>();
    
    const addFolderAndChildren = (folder: VaultFolder) => {
      if (visited.has(folder.id)) return;
      visited.add(folder.id);
      result.push(folder);
      
      // Skip children if folder is collapsed
      if (!collapsedFolders.has(folder.id)) {
        const children = folders.filter(f => f.parentId === folder.id);
        children.forEach(child => addFolderAndChildren(child));
      }
    };
    
    folders.filter(f => !f.parentId).forEach(addFolderAndChildren);
    
    return result;
  };

  // Filter folders based on search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return vaultFolders.filter(f => !f.isDefault);
    
    const query = searchQuery.toLowerCase();
    return vaultFolders.filter(f => 
      !f.isDefault && 
      (f.name.toLowerCase().includes(query) || 
       f.profileName?.toLowerCase().includes(query))
    );
  }, [vaultFolders, searchQuery]);

  // Get favorite folders
  const favoriteFolders = useMemo(() => {
    return vaultFolders.filter(f => favorites.has(f.id));
  }, [vaultFolders, favorites]);

  // Calculate dropdown position and focus search input when dropdown opens
  useEffect(() => {
    if (folderDropdownOpen && triggerButtonRef.current) {
      const updatePosition = () => {
        if (triggerButtonRef.current) {
          const rect = triggerButtonRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom + 8, // 8px margin (mt-2)
            left: rect.left,
            width: rect.width
          });
        }
      };
      
      updatePosition();
      setTimeout(() => searchInputRef.current?.focus(), 100);
      
      // Update position on scroll
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setSearchQuery("");
      setFocusedIndex(0);
      setDropdownPosition(null);
    }
  }, [folderDropdownOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!folderDropdownOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const folderList = searchQuery ? filteredFolders : sortFoldersHierarchically(filteredFolders);
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, folderList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (folderList[focusedIndex]) {
            setTargetFolder(folderList[focusedIndex].id);
            setFolderDropdownOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setFolderDropdownOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [folderDropdownOpen, focusedIndex, searchQuery, filteredFolders]);

  // Close dropdown when clicking outside (works with portal)
  useEffect(() => {
    if (!folderDropdownOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the trigger button and dropdown content
      if (
        folderDropdownRef.current && !folderDropdownRef.current.contains(target) &&
        dropdownContentRef.current && !dropdownContentRef.current.contains(target)
      ) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [folderDropdownOpen, setFolderDropdownOpen]);

  // Color scheme
  const pinkScheme = {
    button: targetFolder 
      ? 'bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 border border-[#EC67A1]/30 dark:border-[#EC67A1]/40'
      : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
    icon: targetFolder ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-zinc-500',
    text: targetFolder ? 'text-sidebar-foreground' : 'text-zinc-400 dark:text-zinc-500',
    subtitle: 'text-[#EC67A1]/70',
    selected: 'bg-[#EC67A1]/10 dark:bg-[#EC67A1]/15',
    selectedIcon: 'bg-[#EC67A1]/20 dark:bg-[#EC67A1]/30 border border-[#EC67A1]/40',
    selectedText: 'text-[#EC67A1]',
    check: 'text-[#EC67A1]',
    header: 'text-[#EC67A1] bg-[#EC67A1]/10',
    searchBorder: 'border-[#EC67A1]/30 focus:border-[#EC67A1]',
  };

  const colors = {
    violet: pinkScheme,
    purple: pinkScheme,
    cyan: pinkScheme,
    emerald: pinkScheme,
    pink: pinkScheme,
  };

  const color = colors[accentColor];

  // Render a folder button
  const renderFolderButton = (folder: VaultFolder, depth: number = 0, index: number) => {
    const hasChildren = vaultFolders.some(f => f.parentId === folder.id);
    const isCollapsed = collapsedFolders.has(folder.id);
    const isFavorite = favorites.has(folder.id);
    const isFocused = focusedIndex === index;

    return (
      <button
        key={folder.id}
        type="button"
        onClick={() => {
          setTargetFolder(folder.id);
          setFolderDropdownOpen(false);
        }}
        className={`
          w-full flex items-center gap-2 py-2.5 text-left transition-all duration-150
          ${targetFolder === folder.id 
            ? color.selected
            : isFocused
            ? 'bg-zinc-100 dark:bg-zinc-800'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
          }
        `}
        style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: '12px' }}
      >
        {/* Collapse/Expand icon for folders with children */}
        {hasChildren && (
          <div
            onClick={(e) => toggleCollapse(folder.id, e)}
            className="flex-shrink-0 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
          >
            <ChevronRight 
              className={`w-3 h-3 text-zinc-400 transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} 
            />
          </div>
        )}
        {!hasChildren && <div className="w-4" />}

        {/* Folder icon */}
        <div className={`
          w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
          ${targetFolder === folder.id 
            ? color.selectedIcon
            : 'bg-zinc-100 dark:bg-zinc-800'
          }
        `}>
          {hasChildren ? (
            <FolderOpen className={`w-3.5 h-3.5 ${targetFolder === folder.id ? color.selectedText : 'text-zinc-400 dark:text-zinc-500'}`} />
          ) : (
            <Folder className={`w-3.5 h-3.5 ${targetFolder === folder.id ? color.selectedText : 'text-zinc-400 dark:text-zinc-500'}`} />
          )}
        </div>

        {/* Folder name */}
        <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground'}`}>
          {folder.name}
        </span>

        {/* Item count */}
        {folder.itemCount !== undefined && folder.itemCount > 0 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
            {folder.itemCount}
          </span>
        )}

        {/* Depth indicator */}
        {depth > 0 && !folder.itemCount && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
            L{depth + 1}
          </span>
        )}

        {/* Favorite star */}
        <div
          onClick={(e) => toggleFavorite(folder.id, e)}
          className="flex-shrink-0 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
        >
          <Star 
            className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#EC67A1] text-[#EC67A1]' : 'text-zinc-300 dark:text-zinc-600'}`}
          />
        </div>

        {/* Selected check */}
        {targetFolder === folder.id && (
          <Check className={`w-4 h-4 ${color.check} flex-shrink-0`} />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-sidebar-foreground">{label}</label>
      
      <div ref={folderDropdownRef} className="relative">
        {/* Dropdown Trigger */}
        <button
          ref={triggerButtonRef}
          type="button"
          onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200
            hover:shadow-lg hover:-translate-y-0.5
            ${color.button}
          `}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0
              ${color.button}
            `}>
              <FolderOpen className={`w-4 h-4 ${color.icon}`} />
            </div>
            <div className="text-left min-w-0">
              <p className={`text-sm font-medium truncate ${color.text}`}>
                {targetFolder 
                  ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                  : 'Select a folder...'
                }
              </p>
              {targetFolder && (
                <p className={`text-[11px] truncate ${color.subtitle}`}>
                  {isAllProfiles 
                    ? vaultFolders.find(f => f.id === targetFolder)?.profileName || ''
                    : selectedProfile?.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile?.name || ''
                  }
                </p>
              )}
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu - Rendered as Portal */}
        {folderDropdownOpen && mounted && dropdownPosition && typeof window !== 'undefined' && createPortal(
          <div
            ref={dropdownContentRef}
            className="fixed z-[9999] py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              maxHeight: '450px'
            }}
          >
            
            {/* Search Bar */}
            <div className="px-3 mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`
                    w-full pl-9 pr-3 py-2 rounded-xl text-sm
                    bg-zinc-50 dark:bg-zinc-800/50
                    border ${color.searchBorder}
                    text-sidebar-foreground placeholder-zinc-400
                    focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20
                    transition-all
                  `}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-zinc-400" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 px-1">
                {filteredFolders.length} folder{filteredFolders.length !== 1 ? 's' : ''} • Use ↑↓ to navigate, Enter to select
              </p>
            </div>

            {/* Clear Selection Option */}
            <button
              type="button"
              onClick={() => {
                setTargetFolder('');
                setFolderDropdownOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              </div>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">No folder selected</span>
              {!targetFolder && <Check className={`w-4 h-4 ${color.check} ml-auto`} />}
            </button>

            {/* Favorite Folders */}
            {!searchQuery && favoriteFolders.length > 0 && (
              <>
                <div className="my-2 mx-3 h-px bg-zinc-200 dark:bg-zinc-700" />
                <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${color.header}`}>
                  <Star className="w-3 h-3" />
                  Favorites
                </div>
                <div className="mb-2">
                  {favoriteFolders.map((folder, idx) => renderFolderButton(folder, 0, idx))}
                </div>
              </>
            )}

            {favoriteFolders.length > 0 && !searchQuery && (
              <div className="my-2 mx-3 h-px bg-zinc-200 dark:bg-zinc-700" />
            )}

            {/* All Folders */}
            {!searchQuery && (
              <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${color.header}`}>
                All Folders
              </div>
            )}

            {/* Folder List - Scrollable */}
            <div className="max-h-[450px] overflow-y-auto overscroll-contain pb-4">
              {filteredFolders.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <FolderOpen className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {searchQuery ? 'No folders found' : 'No folders available'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      Create folders in the Vault tab
                    </p>
                  )}
                </div>
              ) : searchQuery ? (
                // Flat list when searching
                filteredFolders.map((folder, idx) => renderFolderButton(folder, 0, idx))
              ) : isAllProfiles ? (
                // Group by profile
                Object.entries(
                  filteredFolders.reduce((acc, folder) => {
                    const profileKey = folder.profileName || 'Unknown Profile';
                    if (!acc[profileKey]) acc[profileKey] = [];
                    acc[profileKey].push(folder);
                    return acc;
                  }, {} as Record<string, VaultFolder[]>)
                ).map(([profileName, folders]) => (
                  <div key={profileName} className="mb-2">
                    <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider sticky top-0 ${color.header}`}>
                      {profileName}
                    </div>
                    {sortFoldersHierarchically(folders).map((folder, idx) => 
                      renderFolderButton(folder, getFolderDepth(folder.id), idx)
                    )}
                  </div>
                ))
              ) : (
                // Hierarchical list for single profile
                sortFoldersHierarchically(filteredFolders).map((folder, idx) => 
                  renderFolderButton(folder, getFolderDepth(folder.id), idx)
                )
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Status Indicator */}
      {targetFolder && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${color.selected} border-[#EC67A1]/30`}>
          <div className="w-2 h-2 rounded-full animate-pulse bg-[#EC67A1]" />
          <p className="text-xs flex-1 truncate text-[#EC67A1]">
            Saving to: {getFolderPath(targetFolder)}
          </p>
        </div>
      )}
    </div>
  );
}
