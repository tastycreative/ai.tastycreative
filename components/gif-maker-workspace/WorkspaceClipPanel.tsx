"use client";

import { useCallback, useRef, useState } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import {
  Plus,
  Trash2,
  GripVertical,
  Upload,
  HardDrive,
  Video as VideoIcon,
} from "lucide-react";
import { getClipTrimmedDuration } from "@/lib/gif-maker/timeline-utils";
import { COLLAGE_PRESETS } from "@/lib/gif-maker/types";
import { ModelVaultBrowser } from "./ModelVaultBrowser";

interface WorkspaceClipPanelProps {
  selectedProfileId: string | null;
}

export function WorkspaceClipPanel({ selectedProfileId }: WorkspaceClipPanelProps) {
  const {
    clips,
    selectedClipId,
    addClip,
    removeClip,
    selectClip,
    reorderClips,
    fps,
    activeCollageLayout,
  } = useVideoEditorStore(
    useShallow((s) => ({
      clips: s.clips,
      selectedClipId: s.selectedClipId,
      addClip: s.addClip,
      removeClip: s.removeClip,
      selectClip: s.selectClip,
      reorderClips: s.reorderClips,
      fps: s.settings.fps,
      activeCollageLayout: s.settings.activeCollageLayout,
    }))
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const collagePreset = activeCollageLayout ? COLLAGE_PRESETS[activeCollageLayout] : null;
  const [addToSlot, setAddToSlot] = useState<number>(0);
  const [view, setView] = useState<"clips" | "vault">(selectedProfileId ? "vault" : "clips");

  // Handle file upload
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const clipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        if (file.type.startsWith("image/")) {
          addClip({
            type: "image",
            id: clipId,
            src: url,
            name: file.name,
            displayDurationInFrames: fps * 3,
            objectFit: "contain",
            slotIndex: addToSlot,
          });
          setView("clips");
        } else {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => {
            const durationInFrames = Math.round(video.duration * fps);
            addClip({
              type: "video",
              id: clipId,
              src: url,
              name: file.name,
              durationInFrames,
              trimStartFrame: 0,
              trimEndFrame: durationInFrames,
              volume: 1,
              slotIndex: addToSlot,
            });
            setView("clips");
          };
          video.src = url;
        }
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addClip, fps, addToSlot]
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

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-[#2d3142]">
        <button
          onClick={() => setView("clips")}
          className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            view === "clips"
              ? "text-indigo-400 border-b-2 border-indigo-400"
              : "text-slate-500 hover:text-slate-400"
          }`}
        >
          Clips{clips.length > 0 ? ` (${clips.length})` : ""}
        </button>
        <button
          onClick={() => setView("vault")}
          className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            view === "vault"
              ? "text-indigo-400 border-b-2 border-indigo-400"
              : "text-slate-500 hover:text-slate-400"
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
                <VideoIcon className="h-8 w-8 text-[#2d3142] mx-auto mb-2" />
                <p className="text-xs text-slate-500 mb-3">No clips added yet</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-[#2d3142] rounded-xl flex flex-col items-center gap-1.5 hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all duration-200 cursor-pointer group"
              >
                <Upload className="h-5 w-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                <span className="text-xs text-slate-400 group-hover:text-slate-100 transition-colors">
                  Upload media
                </span>
                <span className="text-[10px] text-slate-500">MP4, WebM, MOV, JPG, PNG, WebP</span>
              </button>
              {selectedProfileId && (
                <button
                  onClick={() => setView("vault")}
                  className="w-full py-3 border-2 border-dashed border-[#2d3142] rounded-xl flex flex-col items-center gap-1 hover:border-violet-500/60 hover:bg-violet-500/5 transition-all duration-200 cursor-pointer group/vault"
                >
                  <HardDrive className="h-4 w-4 text-slate-500 group-hover/vault:text-violet-400 transition-colors" />
                  <span className="text-xs text-slate-400 group-hover/vault:text-slate-100 transition-colors">
                    Browse Model Vault
                  </span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Add Buttons */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#2d3142]/60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    {clips.length} clip{clips.length !== 1 ? "s" : ""}
                  </span>
                  {collagePreset && (
                    <select
                      value={addToSlot}
                      onChange={(e) => setAddToSlot(Number(e.target.value))}
                      className="h-5 px-1.5 bg-slate-800 border border-[#2d3142] rounded text-[10px] text-slate-400 outline-none"
                      title="Add clips to this slot"
                    >
                      {collagePreset.slots.map((_, i) => (
                        <option key={i} value={i}>
                          Slot {i + 1}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {selectedProfileId && (
                    <button
                      onClick={() => setView("vault")}
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors duration-150"
                      title="Add from Vault"
                    >
                      <HardDrive className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors duration-150"
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
                        ? "bg-indigo-500/10 border border-indigo-500/30"
                        : "hover:bg-slate-800 border border-transparent"
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-slate-500 cursor-grab flex-shrink-0" />
                    <div
                      className={`w-10 h-7 rounded flex items-center justify-center overflow-hidden flex-shrink-0 ${
                        clip.type === "image" ? "bg-emerald-500/15" : "bg-[#2d3142]"
                      }`}
                    >
                      <span
                        className={`text-[8px] ${
                          clip.type === "image" ? "text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {clip.type === "image" ? "IMG" : "VID"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-medium text-slate-100">
                        {clip.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {(getClipTrimmedDuration(clip) / fps).toFixed(1)}s
                        {collagePreset && (
                          <span className="text-indigo-400/70 ml-1">
                            S{(clip.slotIndex ?? 0) + 1}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(clip.id);
                      }}
                      className="p-1 rounded hover:bg-red-500/10 hover:text-red-400 text-slate-500 transition-colors duration-150 flex-shrink-0"
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

      {/* Vault View — Model-Scoped */}
      {view === "vault" && (
        <ModelVaultBrowser
          profileId={selectedProfileId}
          onAddClip={() => setView("clips")}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
