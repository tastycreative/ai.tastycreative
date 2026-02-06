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
  accentColor?: "violet" | "purple" | "cyan" | "emerald";
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

  // Color scheme mappings
  const colors = {
    violet: {
      button: targetFolder 
        ? 'bg-gradient-to-br from-violet-500/30 to-purple-500/30 border border-violet-400/30'
        : 'bg-slate-700/50 border border-white/5',
      icon: targetFolder ? 'text-violet-300' : 'text-slate-400',
      text: targetFolder ? 'text-white' : 'text-slate-400',
      subtitle: 'text-violet-300/70',
      selected: 'bg-violet-500/15',
      selectedIcon: 'bg-gradient-to-br from-violet-500/40 to-purple-500/40 border border-violet-400/40',
      selectedText: 'text-violet-300',
      check: 'text-violet-400',
      header: 'text-violet-300 bg-violet-500/10'
    },
    purple: {
      button: targetFolder 
        ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/30'
        : 'bg-slate-700/50 border border-white/5',
      icon: targetFolder ? 'text-purple-300' : 'text-slate-400',
      text: targetFolder ? 'text-white' : 'text-slate-400',
      subtitle: 'text-purple-300/70',
      selected: 'bg-purple-500/15',
      selectedIcon: 'bg-gradient-to-br from-purple-500/40 to-indigo-500/40 border border-purple-400/40',
      selectedText: 'text-purple-300',
      check: 'text-purple-400',
      header: 'text-purple-300 bg-purple-500/10'
    },
    cyan: {
      button: targetFolder 
        ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-400/30'
        : 'bg-slate-700/50 border border-white/5',
      icon: targetFolder ? 'text-cyan-300' : 'text-slate-400',
      text: targetFolder ? 'text-white' : 'text-slate-400',
      subtitle: 'text-cyan-300/70',
      selected: 'bg-cyan-500/15',
      selectedIcon: 'bg-gradient-to-br from-cyan-500/40 to-blue-500/40 border border-cyan-400/40',
      selectedText: 'text-cyan-300',
      check: 'text-cyan-400',
      header: 'text-cyan-300 bg-cyan-500/10'
    },
    emerald: {
      button: targetFolder 
        ? 'bg-gradient-to-br from-emerald-500/30 to-green-500/30 border border-emerald-400/30'
        : 'bg-slate-700/50 border border-white/5',
      icon: targetFolder ? 'text-emerald-300' : 'text-slate-400',
      text: targetFolder ? 'text-white' : 'text-slate-400',
      subtitle: 'text-emerald-300/70',
      selected: 'bg-emerald-500/15',
      selectedIcon: 'bg-gradient-to-br from-emerald-500/40 to-green-500/40 border border-emerald-400/40',
      selectedText: 'text-emerald-300',
      check: 'text-emerald-400',
      header: 'text-emerald-300 bg-emerald-500/10'
    }
  };

  const color = colors[accentColor];

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-white">{label}</label>
      
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
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {folderDropdownOpen && mounted && (
          <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Clear Selection Option */}
            <button
              type="button"
              onClick={() => {
                setTargetFolder('');
                setFolderDropdownOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-sm text-slate-400">No folder selected</span>
              {!targetFolder && <Check className={`w-4 h-4 ${color.check} ml-auto`} />}
            </button>

            {vaultFolders.filter(f => !f.isDefault).length > 0 && (
              <div className="my-2 mx-3 h-px bg-white/5" />
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
                              : 'hover:bg-white/5'
                            }
                          `}
                          style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                        >
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                            ${targetFolder === folder.id 
                              ? color.selectedIcon
                              : 'bg-slate-700/50 border border-white/5'
                            }
                          `}>
                            {hasChildren ? (
                              <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-slate-400'}`} />
                            ) : (
                              <Folder className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-slate-400'}`} />
                            )}
                          </div>
                          <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                            {folder.name}
                          </span>
                          {depth > 0 && (
                            <span className="text-xs text-slate-500 flex-shrink-0">L{depth + 1}</span>
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
                          : 'hover:bg-white/5'
                        }
                      `}
                      style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                    >
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                        ${targetFolder === folder.id 
                          ? color.selectedIcon
                          : 'bg-slate-700/50 border border-white/5'
                        }
                      `}>
                        {hasChildren ? (
                          <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-slate-400'}`} />
                        ) : (
                          <Folder className={`w-4 h-4 ${targetFolder === folder.id ? color.selectedText : 'text-slate-400'}`} />
                        )}
                      </div>
                      <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                        {folder.name}
                      </span>
                      {depth > 0 && (
                        <span className="text-xs text-slate-500 flex-shrink-0">L{depth + 1}</span>
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
                <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No folders available</p>
                <p className="text-xs text-slate-500 mt-1">Create folders in the Vault tab</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Indicator */}
      {targetFolder && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${color.selected} ${color.selectedIcon.replace('bg-gradient-to-br', 'border')}`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${color.selectedText.replace('text-', 'bg-')}`} />
          <p className={`text-xs flex-1 truncate ${color.selectedText}`}>
            Videos save to: {getFolderPath(targetFolder)}
          </p>
        </div>
      )}
    </div>
  );
}
