"use client";

import { ChevronDown, FolderOpen, Folder, X, Check } from "lucide-react";
import { useRef, useEffect } from "react";

export interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  profileName?: string;
  isDefault?: boolean;
  parentId?: string | null;
  subfolders?: Array<{ id: string }>;
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
 * Shared Vault Folder Dropdown Component
 * 
 * Displays a hierarchical folder selection dropdown with:
 * - Visual indentation based on folder depth
 * - Folder/FolderOpen icons for parent folders
 * - Level badges (L2, L3, etc.) for nested folders
 * - Profile grouping when viewing all profiles
 * - Clear selection option
 * 
 * This component is used across Kling and Seedream tabs for consistent UX.
 */
export default function VaultFolderDropdown({
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

  // Helper: Get folder path as breadcrumb (e.g., "Parent / Child")
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

  // Helper: Get folder depth for indentation
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

  // Helper: Sort folders by hierarchy (parent before children)
  const sortFoldersHierarchically = (folders: VaultFolder[]): VaultFolder[] => {
    const folderMap = new Map(folders.map(f => [f.id, f]));
    const result: VaultFolder[] = [];
    const visited = new Set<string>();
    
    const addFolderAndChildren = (folder: VaultFolder) => {
      if (visited.has(folder.id)) return;
      visited.add(folder.id);
      result.push(folder);
      
      // Add children recursively
      const children = folders.filter(f => f.parentId === folder.id);
      children.forEach(child => addFolderAndChildren(child));
    };
    
    // Start with root folders (no parent)
    folders.filter(f => !f.parentId).forEach(addFolderAndChildren);
    
    return result;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setFolderDropdownOpen]);

  // Color scheme mappings – all use brand pink for consistency and light/dark support
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
    header: 'text-[#EC67A1] bg-[#EC67A1]/10'
  };

  const colors = {
    violet: pinkScheme,
    purple: pinkScheme,
    cyan: pinkScheme,
    emerald: pinkScheme,
    pink: pinkScheme,
  };

  const color = colors[accentColor];

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-sidebar-foreground">{label}</label>
      
      <div ref={folderDropdownRef} className="relative">
        {/* Dropdown Trigger */}
        <button
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

        {/* Dropdown Menu */}
        {folderDropdownOpen && mounted && (
          <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
            {/* Clear Selection Option */}
            <button
              type="button"
              onClick={() => {
                setTargetFolder('');
                setFolderDropdownOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <X className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              </div>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">No folder selected</span>
              {!targetFolder && <Check className={`w-4 h-4 ${color.check} ml-auto`} />}
            </button>

            {vaultFolders.filter(f => !f.isDefault).length > 0 && (
              <div className="my-2 mx-3 h-px bg-zinc-200 dark:bg-zinc-700" />
            )}

            {/* Folder Options - Grouped by profile when viewing all profiles */}
            <div className="max-h-[200px] overflow-y-auto">
              {isAllProfiles ? (
                // Group folders by profile
                Object.entries(
                  vaultFolders.filter(f => !f.isDefault).reduce((acc, folder) => {
                    const profileKey = folder.profileName || 'Unknown Profile';
                    if (!acc[profileKey]) acc[profileKey] = [];
                    acc[profileKey].push(folder);
                    return acc;
                  }, {} as Record<string, VaultFolder[]>)
                ).map(([profileName, folders]) => (
                  <div key={profileName}>
                    <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider sticky top-0 ${color.header}`}>
                      {profileName}
                    </div>
                    {sortFoldersHierarchically(folders).map((folder) => {
                      const depth = getFolderDepth(folder.id);
                      const hasChildren = vaultFolders.some(f => f.parentId === folder.id);
                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => {
                            setTargetFolder(folder.id);
                            setFolderDropdownOpen(false);
                          }}
                          className={`
                            w-full flex items-center gap-3 py-2.5 text-left transition-all duration-150
                            ${targetFolder === folder.id 
                              ? color.selected
                              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }
                          `}
                          style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                        >
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                            ${targetFolder === folder.id 
                              ? color.selectedIcon
                              : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                            }
                          `}>
                            {hasChildren ? (
                              <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-zinc-400 dark:text-zinc-500'}`} />
                            ) : (
                              <Folder className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-zinc-400 dark:text-zinc-500'}`} />
                            )}
                          </div>
                          <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground'}`}>
                            {folder.name}
                          </span>
                          {depth > 0 && (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">L{depth + 1}</span>
                          )}
                          {targetFolder === folder.id && (
                            <Check className={`w-4 h-4 ${color.check} flex-shrink-0`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                // Single profile view - hierarchical list
                sortFoldersHierarchically(vaultFolders.filter(f => !f.isDefault)).map((folder) => {
                  const depth = getFolderDepth(folder.id);
                  const hasChildren = vaultFolders.some(f => f.parentId === folder.id);
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => {
                        setTargetFolder(folder.id);
                        setFolderDropdownOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 py-2.5 text-left transition-all duration-150
                        ${targetFolder === folder.id 
                          ? color.selected
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }
                      `}
                      style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                    >
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                        ${targetFolder === folder.id 
                          ? color.selectedIcon
                          : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                        }
                      `}>
                        {hasChildren ? (
                          <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-zinc-400 dark:text-zinc-500'}`} />
                        ) : (
                          <Folder className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-zinc-400 dark:text-zinc-500'}`} />
                        )}
                      </div>
                      <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground'}`}>
                        {folder.name}
                      </span>
                      {depth > 0 && (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">L{depth + 1}</span>
                      )}
                      {targetFolder === folder.id && (
                        <Check className={`w-4 h-4 ${color.check} flex-shrink-0`} />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {vaultFolders.filter(f => !f.isDefault).length === 0 && (
              <div className="px-4 py-6 text-center">
                <FolderOpen className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No folders available</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Create folders in the Vault tab</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Indicator */}
      {targetFolder && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${color.selected} border-[#EC67A1]/30`}>
          <div className="w-2 h-2 rounded-full animate-pulse bg-[#EC67A1]" />
          <p className="text-xs flex-1 truncate text-[#EC67A1]">
            Videos save to: {getFolderPath(targetFolder)}
          </p>
        </div>
      )}
    </div>
  );
}
