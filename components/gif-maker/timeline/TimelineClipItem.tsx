"use client";

import { useRef, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { framesToPixels, pixelsToFrames } from "@/lib/gif-maker/timeline-utils";
import type { VideoClip } from "@/lib/gif-maker/types";

interface TimelineClipItemProps {
  clip: VideoClip;
  zoom: number;
}

export function TimelineClipItem({ clip, zoom }: TimelineClipItemProps) {
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId);
  const selectClip = useVideoEditorStore((s) => s.selectClip);
  const updateClip = useVideoEditorStore((s) => s.updateClip);

  const isSelected = selectedClipId === clip.id;
  const trimmedDuration = clip.trimEndFrame - clip.trimStartFrame;
  const left = framesToPixels(clip.startFrame, zoom);
  const width = framesToPixels(trimmedDuration, zoom);

  const dragRef = useRef<{
    type: "move" | "resize-left" | "resize-right";
    startX: number;
    startTrimStart: number;
    startTrimEnd: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "move" | "resize-left" | "resize-right") => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        type,
        startX: e.clientX,
        startTrimStart: clip.trimStartFrame,
        startTrimEnd: clip.trimEndFrame,
      };
    },
    [clip.trimStartFrame, clip.trimEndFrame]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dFrames = pixelsToFrames(dx, zoom);

      if (dragRef.current.type === "resize-left") {
        const newStart = Math.max(
          0,
          Math.min(
            dragRef.current.startTrimStart + dFrames,
            clip.trimEndFrame - 1
          )
        );
        updateClip(clip.id, { trimStartFrame: newStart });
      } else if (dragRef.current.type === "resize-right") {
        const newEnd = Math.min(
          clip.durationInFrames,
          Math.max(
            dragRef.current.startTrimEnd + dFrames,
            clip.trimStartFrame + 1
          )
        );
        updateClip(clip.id, { trimEndFrame: newEnd });
      }
    },
    [clip, zoom, updateClip]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      className={`absolute top-1 bottom-1 rounded-md flex items-center overflow-hidden cursor-pointer select-none border transition-[box-shadow,border-color] duration-150 ${
        isSelected
          ? "bg-gradient-to-b from-blue-500/45 to-blue-600/35 border-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.25)] ring-1 ring-blue-400/40"
          : "bg-gradient-to-b from-blue-500/30 to-blue-600/20 border-blue-500/30 hover:from-blue-500/40 hover:to-blue-600/30 hover:border-blue-400/50"
      }`}
      style={{ left, width: Math.max(width, 4) }}
      onClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id);
      }}
    >
      {/* Waveform decoration */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, rgba(59,130,246,0.3) 0px, rgba(59,130,246,0.3) 1px, transparent 1px, transparent 3px)`,
        }}
      />

      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group/handle rounded-l-md"
        onPointerDown={(e) => handlePointerDown(e, "resize-left")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute inset-y-1 left-0.5 w-0.5 bg-white/50 rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity duration-100" />
      </div>

      {/* Clip label */}
      <span className="text-[10px] text-white/80 px-2.5 truncate pointer-events-none z-10 relative">
        {clip.name}
      </span>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group/handle rounded-r-md"
        onPointerDown={(e) => handlePointerDown(e, "resize-right")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute inset-y-1 right-0.5 w-0.5 bg-white/50 rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity duration-100" />
      </div>
    </div>
  );
}
