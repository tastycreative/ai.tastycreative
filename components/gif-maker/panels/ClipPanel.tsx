"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import {
  Plus,
  Trash2,
  GripVertical,
  Upload,
  FolderOpen,
  FolderClosed,
  ChevronLeft,
  Loader2,
  Video as VideoIcon,
  HardDrive,
} from "lucide-react";
import { getClipTrimmedDuration } from "@/lib/gif-maker/timeline-utils";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";

interface VaultFolderWithCount {
  id: string;
  name: string;
  profileId: string;
  isDefault?: boolean;
  profileName?: string;
  profileUsername?: string | null;
  isOwnedProfile?: boolean;
  ownerName?: string | null;
  _count?: { items: number };
}

interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Key: string;
  awsS3Url: string;
  createdAt: Date | string;
  folderId: string;
  profileId: string;
}

type PanelView = "clips" | "vault-folders" | "vault-items";

export function ClipPanel() {
  const clips = useVideoEditorStore((s) => s.clips);
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId);
  const addClip = useVideoEditorStore((s) => s.addClip);
  const removeClip = useVideoEditorStore((s) => s.removeClip);
  const selectClip = useVideoEditorStore((s) => s.selectClip);
  const reorderClips = useVideoEditorStore((s) => s.reorderClips);
  const fps = useVideoEditorStore((s) => s.settings.fps);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { profiles, isAllProfiles } = useInstagramProfile();

  // Panel view state
  const [view, setView] = useState<PanelView>("vault-folders");
  const [folders, setFolders] = useState<VaultFolderWithCount[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<VaultFolderWithCount | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // Fetch all folders (grouped by profile)
  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const response = await fetch("/api/vault/folders?profileId=all");
      if (!response.ok) throw new Error("Failed to fetch folders");
      const data = await response.json();
      setFolders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching vault folders:", error);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  // Fetch items for a folder
  const fetchItems = useCallback(async (folder: VaultFolderWithCount) => {
    setLoadingItems(true);
    try {
      const url = `/api/vault/items?profileId=${folder.profileId}&folderId=${folder.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch items");
      const data = await response.json();
      const allItems: VaultItem[] = Array.isArray(data) ? data : data.items || [];
      // Filter to only video items
      setItems(allItems.filter((item) => item.fileType?.startsWith("video/")));
    } catch (error) {
      console.error("Error fetching vault items:", error);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  // Load folders on mount
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Handle file upload
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          const durationInFrames = Math.round(video.duration * fps);
          addClip({
            id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            src: url,
            name: file.name,
            durationInFrames,
            trimStartFrame: 0,
            trimEndFrame: durationInFrames,
            volume: 1,
          });
          setView("clips");
        };
        video.src = url;
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addClip, fps]
  );

  // Add a vault item as a clip
  const handleAddVaultItem = useCallback(
    (item: VaultItem) => {
      setAddingItemId(item.id);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.crossOrigin = "anonymous";
      video.onloadedmetadata = () => {
        const durationInFrames = Math.round(video.duration * fps);
        addClip({
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          src: item.awsS3Url,
          name: item.fileName,
          durationInFrames,
          trimStartFrame: 0,
          trimEndFrame: durationInFrames,
          volume: 1,
        });
        setAddingItemId(null);
      };
      video.onerror = () => {
        addClip({
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          src: item.awsS3Url,
          name: item.fileName,
          durationInFrames: fps * 5,
          trimStartFrame: 0,
          trimEndFrame: fps * 5,
          volume: 1,
        });
        setAddingItemId(null);
      };
      video.src = item.awsS3Url;
    },
    [addClip, fps]
  );

  // Drag and drop for clips
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOver.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOver.current !== null) {
      reorderClips(dragItem.current, dragOver.current);
    }
    dragItem.current = null;
    dragOver.current = null;
  };

  // Open a folder to view its items
  const handleOpenFolder = (folder: VaultFolderWithCount) => {
    setSelectedFolder(folder);
    setView("vault-items");
    fetchItems(folder);
  };

  // Go back to folders view
  const handleBackToFolders = () => {
    setView("vault-folders");
    setSelectedFolder(null);
    setItems([]);
  };

  // Group folders by profile
  const groupedFolders = folders.reduce<
    Record<string, { profile: { id: string; name: string; username: string | null; isOwned: boolean; ownerName: string | null }; folders: VaultFolderWithCount[] }>
  >((acc, folder) => {
    const profileId = folder.profileId;
    if (!acc[profileId]) {
      acc[profileId] = {
        profile: {
          id: profileId,
          name: folder.profileName || profiles.find((p) => p.id === profileId)?.name || "Unknown",
          username: folder.profileUsername || profiles.find((p) => p.id === profileId)?.instagramUsername || null,
          isOwned: folder.isOwnedProfile !== false,
          ownerName: folder.ownerName || null,
        },
        folders: [],
      };
    }
    acc[profileId].folders.push(folder);
    return acc;
  }, {});

  // Sort: owned profiles first
  const sortedProfileGroups = Object.values(groupedFolders).sort((a, b) => {
    if (a.profile.isOwned && !b.profile.isOwned) return -1;
    if (!a.profile.isOwned && b.profile.isOwned) return 1;
    return a.profile.name.localeCompare(b.profile.name);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-[#252640]/60">
        <button
          onClick={() => setView("clips")}
          className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            view === "clips"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-[#4d5578] hover:text-[#8490b0]"
          }`}
        >
          Clips{clips.length > 0 ? ` (${clips.length})` : ""}
        </button>
        <button
          onClick={() => setView(selectedFolder ? "vault-items" : "vault-folders")}
          className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            view === "vault-folders" || view === "vault-items"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-[#4d5578] hover:text-[#8490b0]"
          }`}
        >
          Vault
        </button>
      </div>

      {/* Clips View */}
      {view === "clips" && (
        <>
          {clips.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
              <div className="text-center">
                <VideoIcon className="h-8 w-8 text-[#252640] mx-auto mb-2" />
                <p className="text-xs text-[#4d5578] mb-3">No clips added yet</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-[#252640] rounded-xl flex flex-col items-center gap-1.5 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all duration-200 cursor-pointer group"
              >
                <Upload className="h-5 w-5 text-[#4d5578] group-hover:text-blue-400 transition-colors" />
                <span className="text-xs text-[#8490b0] group-hover:text-[#e6e8f0] transition-colors">
                  Upload video
                </span>
                <span className="text-[10px] text-[#4d5578]">MP4, WebM, MOV</span>
              </button>
              <button
                onClick={() => setView("vault-folders")}
                className="w-full py-3 border-2 border-dashed border-[#252640] rounded-xl flex flex-col items-center gap-1 hover:border-violet-500/60 hover:bg-violet-500/5 transition-all duration-200 cursor-pointer group/vault"
              >
                <HardDrive className="h-4 w-4 text-[#4d5578] group-hover/vault:text-violet-400 transition-colors" />
                <span className="text-xs text-[#8490b0] group-hover/vault:text-[#e6e8f0] transition-colors">
                  Browse Vault
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Add Buttons */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#252640]/60">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">
                  {clips.length} clip{clips.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setView("vault-folders")}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#1e2038] text-[#8490b0] hover:text-[#e6e8f0] transition-colors duration-150"
                    title="Add from Vault"
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#1e2038] text-[#8490b0] hover:text-[#e6e8f0] transition-colors duration-150"
                    title="Upload clip"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Clip List */}
              <div className="flex-1 overflow-y-auto">
                {clips.map((clip, index) => (
                  <div
                    key={clip.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => selectClip(clip.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 mx-1.5 my-0.5 rounded-lg cursor-pointer transition-colors duration-150 ${
                      selectedClipId === clip.id
                        ? "bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)]"
                        : "hover:bg-[#1e2038] border border-transparent"
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-[#4d5578] cursor-grab flex-shrink-0" />
                    <div className="w-10 h-7 rounded bg-[#252640] flex items-center justify-center overflow-hidden flex-shrink-0">
                      <span className="text-[8px] text-[#4d5578]">VID</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-medium text-[#e6e8f0]">
                        {clip.name}
                      </div>
                      <div className="text-[10px] text-[#4d5578]">
                        {(getClipTrimmedDuration(clip) / fps).toFixed(1)}s
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(clip.id);
                      }}
                      className="p-1 rounded hover:bg-red-500/10 hover:text-red-400 text-[#4d5578] transition-colors duration-150 flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Vault Folders View */}
      {view === "vault-folders" && (
        <div className="flex-1 overflow-y-auto">
          {loadingFolders ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          ) : sortedProfileGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <HardDrive className="h-6 w-6 text-[#252640] mb-2" />
              <p className="text-xs text-[#4d5578]">No vault folders found</p>
            </div>
          ) : (
            <div className="py-1">
              {sortedProfileGroups.map(({ profile, folders: profileFolders }) => (
                <div key={profile.id} className="mb-1">
                  {/* Profile Header */}
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        profile.isOwned
                          ? "bg-gradient-to-br from-violet-500/50 to-fuchsia-500/50"
                          : "bg-gradient-to-br from-amber-500/50 to-orange-500/50"
                      }`}
                    >
                      <span className="text-[10px] font-medium text-white">
                        {profile.name?.charAt(0) || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-[#8490b0] truncate">
                          {profile.name}
                        </span>
                        {profile.username && (
                          <span className="text-[10px] text-[#4d5578] flex-shrink-0">
                            @{profile.username}
                          </span>
                        )}
                      </div>
                      {!profile.isOwned && profile.ownerName && (
                        <div className="text-[10px] text-amber-400/80">
                          Shared by {profile.ownerName}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Folders */}
                  <div className="pl-2">
                    {profileFolders.map((folder) => {
                      const itemCount = folder._count?.items ?? 0;
                      return (
                        <button
                          key={folder.id}
                          onClick={() => handleOpenFolder(folder)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-[#8490b0] hover:text-[#e6e8f0] transition-all cursor-pointer group"
                        >
                          <FolderClosed className="w-3.5 h-3.5 text-[#4d5578] group-hover:text-violet-400 transition-colors flex-shrink-0" />
                          <span className="flex-1 text-xs font-medium text-left truncate">
                            {folder.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[#4d5578] min-w-[20px] text-center">
                            {itemCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Upload option at bottom */}
              <div className="px-3 pt-3 pb-2 mt-1 border-t border-[#252640]/60">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border-2 border-dashed border-[#252640] rounded-xl flex flex-col items-center gap-1 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all duration-200 cursor-pointer group"
                >
                  <Upload className="h-4 w-4 text-[#4d5578] group-hover:text-blue-400 transition-colors" />
                  <span className="text-[10px] text-[#4d5578] group-hover:text-[#8490b0] transition-colors">
                    Upload from device
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vault Items View (inside a folder) */}
      {view === "vault-items" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Folder Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#252640]/60">
            <button
              onClick={handleBackToFolders}
              className="p-1 rounded hover:bg-[#1e2038] text-[#8490b0] hover:text-[#e6e8f0] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <FolderOpen className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-xs font-medium text-[#e6e8f0] truncate flex-1">
              {selectedFolder?.name}
            </span>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto">
            {loadingItems ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                <VideoIcon className="h-6 w-6 text-[#252640] mb-2" />
                <p className="text-xs text-[#4d5578]">No videos in this folder</p>
              </div>
            ) : (
              <div className="py-1">
                {items.map((item) => {
                  const isAdding = addingItemId === item.id;
                  const isAlreadyAdded = clips.some((c) => c.src === item.awsS3Url);
                  return (
                    <button
                      key={item.id}
                      onClick={() => !isAdding && !isAlreadyAdded && handleAddVaultItem(item)}
                      disabled={isAdding || isAlreadyAdded}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg transition-all ${
                        isAlreadyAdded
                          ? "opacity-40 cursor-default"
                          : isAdding
                          ? "opacity-70 cursor-wait"
                          : "hover:bg-violet-500/10 cursor-pointer group"
                      }`}
                    >
                      <div className="w-10 h-7 rounded bg-[#252640] flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                        <video
                          src={item.awsS3Url}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          {isAdding ? (
                            <Loader2 className="w-3 h-3 text-white animate-spin" />
                          ) : (
                            <VideoIcon className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs font-medium text-[#e6e8f0]">
                          {item.fileName}
                        </div>
                        <div className="text-[10px] text-[#4d5578]">
                          {isAlreadyAdded ? "Already added" : "Click to add"}
                        </div>
                      </div>
                      {!isAlreadyAdded && !isAdding && (
                        <Plus className="w-3.5 h-3.5 text-[#4d5578] opacity-0 group-hover:opacity-100 group-hover:text-violet-400 transition-all flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
