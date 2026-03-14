"use client";

import { useCallback, useEffect, useState } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import {
  Plus,
  FolderOpen,
  FolderClosed,
  ChevronLeft,
  Loader2,
  Video as VideoIcon,
  Image as ImageIcon,
  HardDrive,
  Upload,
} from "lucide-react";

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

interface ModelVaultBrowserProps {
  profileId: string | null;
  onAddClip?: () => void;
}

export function ModelVaultBrowser({ profileId, onAddClip }: ModelVaultBrowserProps) {
  const { clips, addClip, fps, activeCollageLayout } = useVideoEditorStore(
    useShallow((s) => ({
      clips: s.clips,
      addClip: s.addClip,
      fps: s.settings.fps,
      activeCollageLayout: s.settings.activeCollageLayout,
    }))
  );

  const [folders, setFolders] = useState<VaultFolderWithCount[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<VaultFolderWithCount | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // Fetch folders for the selected profile only
  const fetchFolders = useCallback(async () => {
    if (!profileId) return;
    setLoadingFolders(true);
    try {
      const response = await fetch(`/api/vault/folders?profileId=${profileId}`);
      if (!response.ok) {
        setFolders([]);
        return;
      }
      const data = await response.json();
      setFolders(Array.isArray(data) ? data : []);
    } catch {
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, [profileId]);

  // Fetch items for a folder
  const fetchItems = useCallback(async (folder: VaultFolderWithCount) => {
    setLoadingItems(true);
    try {
      const url = `/api/vault/items?profileId=${folder.profileId}&folderId=${folder.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch items");
      const data = await response.json();
      const allItems: VaultItem[] = Array.isArray(data) ? data : data.items || [];
      // Filter to video and image items
      setItems(
        allItems.filter(
          (item) =>
            item.fileType?.startsWith("video/") || item.fileType?.startsWith("image/")
        )
      );
    } catch (error) {
      console.error("Error fetching vault items:", error);
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  // Load folders when profile changes
  useEffect(() => {
    setSelectedFolder(null);
    setItems([]);
    if (profileId) {
      fetchFolders();
    } else {
      setFolders([]);
    }
  }, [profileId, fetchFolders]);

  // Add a vault item as a clip
  const handleAddVaultItem = useCallback(
    (item: VaultItem) => {
      setAddingItemId(item.id);
      const clipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (item.fileType?.startsWith("image/")) {
        addClip({
          type: "image",
          id: clipId,
          src: item.awsS3Url,
          name: item.fileName,
          displayDurationInFrames: fps * 3,
          objectFit: "contain",
          slotIndex: 0,
        });
        setAddingItemId(null);
        onAddClip?.();
        return;
      }

      const video = document.createElement("video");
      video.preload = "metadata";
      video.crossOrigin = "anonymous";
      video.onloadedmetadata = () => {
        const durationInFrames = Math.round(video.duration * fps);
        addClip({
          type: "video",
          id: clipId,
          src: item.awsS3Url,
          name: item.fileName,
          durationInFrames,
          trimStartFrame: 0,
          trimEndFrame: durationInFrames,
          volume: 1,
          slotIndex: 0,
        });
        setAddingItemId(null);
        onAddClip?.();
      };
      video.onerror = () => {
        addClip({
          type: "video",
          id: clipId,
          src: item.awsS3Url,
          name: item.fileName,
          durationInFrames: fps * 5,
          trimStartFrame: 0,
          trimEndFrame: fps * 5,
          volume: 1,
          slotIndex: 0,
        });
        setAddingItemId(null);
        onAddClip?.();
      };
      video.src = item.awsS3Url;
    },
    [addClip, fps, onAddClip]
  );

  const handleOpenFolder = (folder: VaultFolderWithCount) => {
    setSelectedFolder(folder);
    fetchItems(folder);
  };

  const handleBackToFolders = () => {
    setSelectedFolder(null);
    setItems([]);
  };

  // No profile selected state
  if (!profileId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <HardDrive className="h-8 w-8 text-zinc-700 mb-3" />
        <p className="text-xs text-zinc-500 mb-1">Select a model first</p>
        <p className="text-[10px] text-zinc-600">
          Choose a model from the top bar to browse their vault
        </p>
      </div>
    );
  }

  // Folder list view
  if (!selectedFolder) {
    return (
      <div className="flex-1 overflow-y-auto">
        {loadingFolders ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
            <HardDrive className="h-6 w-6 text-[#2d3142] mb-2" />
            <p className="text-xs text-slate-500">No vault folders found for this model</p>
          </div>
        ) : (
          <div className="py-1">
            {folders.map((folder) => {
              const itemCount = folder._count?.items ?? 0;
              return (
                <button
                  key={folder.id}
                  onClick={() => handleOpenFolder(folder)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-100 transition-all cursor-pointer group"
                >
                  <FolderClosed className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                  <span className="flex-1 text-xs font-medium text-left truncate">
                    {folder.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-500 min-w-[20px] text-center">
                    {itemCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Items view (inside a folder)
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Folder Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2d3142]/60">
        <button
          onClick={handleBackToFolders}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <FolderOpen className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
        <span className="text-xs font-medium text-slate-100 truncate flex-1">
          {selectedFolder.name}
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
            <VideoIcon className="h-6 w-6 text-[#2d3142] mb-2" />
            <p className="text-xs text-slate-500">No media in this folder</p>
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
                  <div className="w-10 h-7 rounded bg-[#2d3142] flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {item.fileType?.startsWith("image/") ? (
                      <img
                        src={item.awsS3Url}
                        className="w-full h-full object-cover"
                        alt={item.fileName}
                      />
                    ) : (
                      <video
                        src={item.awsS3Url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      {isAdding ? (
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      ) : item.fileType?.startsWith("image/") ? (
                        <ImageIcon className="w-3 h-3 text-white" />
                      ) : (
                        <VideoIcon className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-xs font-medium text-slate-100">
                      {item.fileName}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isAlreadyAdded ? "Already added" : "Click to add"}
                    </div>
                  </div>
                  {!isAlreadyAdded && !isAdding && (
                    <Plus className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-violet-400 transition-all flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
