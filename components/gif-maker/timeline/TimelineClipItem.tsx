"use client";

import { useRef, useCallback, useState } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { framesToPixels, pixelsToFrames } from "@/lib/gif-maker/timeline-utils";
import { getClipTrimmedDuration } from "@/lib/gif-maker/timeline-utils";
import type { Clip } from "@/lib/gif-maker/types";

interface TimelineClipItemProps {
  clip: Clip;
  zoom: number;
}

export function TimelineClipItem({ clip, zoom }: TimelineClipItemProps) {
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId);
  const selectClip = useVideoEditorStore((s) => s.selectClip);
  const updateClip = useVideoEditorStore((s) => s.updateClip);

  const isSelected = selectedClipId === clip.id;
  const isImage = clip.type === "image";
  const trimmedDuration = getClipTrimmedDuration(clip);
  const left = framesToPixels(clip.startFrame, zoom);
  const width = framesToPixels(trimmedDuration, zoom);

  // Disable HTML5 drag while resizing so handles work properly
  const [isResizing, setIsResizing] = useState(false);

  const dragRef = useRef<{
    type: "move" | "resize-left" | "resize-right";
    startX: number;
    startValue: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "move" | "resize-left" | "resize-right") => {
      e.stopPropagation();
      e.preventDefault(); // prevent HTML5 drag from starting
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsResizing(true);
      dragRef.current = {
        type,
        startX: e.clientX,
        startValue: isImage
          ? clip.displayDurationInFrames
          : type === "resize-left"
          ? clip.trimStartFrame
          : clip.trimEndFrame,
      };
    },
    [clip, isImage]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dFrames = pixelsToFrames(dx, zoom);

      if (isImage) {
        // Image clips: only right resize adjusts displayDurationInFrames
        if (dragRef.current.type === "resize-right") {
          const newDuration = Math.max(
            15, // minimum ~0.5s at 30fps
            dragRef.current.startValue + dFrames
          );
          updateClip(clip.id, { displayDurationInFrames: newDuration });
        }
      } else if (clip.type === "video") {
        if (dragRef.current.type === "resize-left") {
          const newStart = Math.max(
            0,
            Math.min(
              dragRef.current.startValue + dFrames,
              clip.trimEndFrame - 1
            )
          );
          updateClip(clip.id, { trimStartFrame: newStart });
        } else if (dragRef.current.type === "resize-right") {
          const newEnd = Math.min(
            clip.durationInFrames,
            Math.max(
              dragRef.current.startValue + dFrames,
              clip.trimStartFrame + 1
            )
          );
          updateClip(clip.id, { trimEndFrame: newEnd });
        }
      }
    },
    [clip, zoom, updateClip, isImage]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsResizing(false);
  }, []);

  // Color by slot index
  const slotIdx = clip.slotIndex ?? 0;
  const SLOT_COLOR_DEFS = [
    { r: 59, g: 130, b: 246 },   // blue (slot 0)
    { r: 6, g: 182, b: 212 },    // cyan (slot 1)
    { r: 16, g: 185, b: 129 },   // emerald (slot 2)
    { r: 245, g: 158, b: 11 },   // amber (slot 3)
    { r: 244, g: 63, b: 94 },    // rose (slot 4)
    { r: 168, g: 85, b: 247 },   // purple (slot 5)
  ];
  const sc = SLOT_COLOR_DEFS[slotIdx % SLOT_COLOR_DEFS.length];
  const rgba = (a: number) => `rgba(${sc.r},${sc.g},${sc.b},${a})`;

  // Image clips get a hatched decoration pattern
  const colorClasses = isSelected
    ? `border shadow-[0_0_8px_${rgba(0.25)}] ring-1`
    : "border hover:border-opacity-50";

  const borderColor = isSelected ? rgba(0.6) : rgba(0.3);
  const bgFrom = isSelected ? rgba(0.45) : rgba(0.3);
  const bgTo = isSelected ? rgba(0.35) : rgba(0.2);
  const ringColor = isSelected ? rgba(0.4) : "transparent";

  const decorationBg = isImage
    ? `repeating-linear-gradient(90deg, ${rgba(0.25)} 0px, ${rgba(0.25)} 2px, transparent 2px, transparent 6px)`
    : `repeating-linear-gradient(90deg, ${rgba(0.3)} 0px, ${rgba(0.3)} 1px, transparent 1px, transparent 3px)`;

  // HTML5 drag for cross-track movement
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("application/x-clip-id", clip.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [clip.id]
  );

  return (
    <div
      draggable={!isResizing}
      onDragStart={handleDragStart}
      className={`absolute top-1 bottom-1 rounded-md flex items-center overflow-hidden select-none transition-[box-shadow,border-color] duration-150 ${isResizing ? "cursor-col-resize" : "cursor-grab"} ${colorClasses}`}
      style={{
        left,
        width: Math.max(width, 4),
        background: `linear-gradient(to bottom, ${bgFrom}, ${bgTo})`,
        borderColor,
        boxShadow: isSelected ? `0 0 8px ${rgba(0.25)}` : undefined,
        ringColor,
      } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id);
      }}
    >
      {/* Decoration */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: decorationBg }}
      />

      {/* Left resize handle — disabled for image clips */}
      {!isImage && (
        <div
          draggable={false}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group/handle rounded-l-md"
          onPointerDown={(e) => handlePointerDown(e, "resize-left")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="absolute inset-y-1 left-0.5 w-0.5 bg-white/50 rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity duration-100" />
        </div>
      )}

      {/* Clip label */}
      <span className="text-[10px] text-white/80 px-2.5 truncate pointer-events-none z-10 relative">
        {clip.name}
      </span>

      {/* Right resize handle */}
      <div
        draggable={false}
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
