"use client";

import { memo, useRef, useCallback, useState, useMemo } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { framesToPixels, pixelsToFrames } from "@/lib/gif-maker/timeline-utils";
import { getClipTrimmedDuration } from "@/lib/gif-maker/timeline-utils";
import type { Clip } from "@/lib/gif-maker/types";

const SLOT_COLOR_DEFS = [
  { r: 99, g: 102, b: 241 },   // indigo (slot 0)
  { r: 6, g: 182, b: 212 },    // cyan (slot 1)
  { r: 16, g: 185, b: 129 },   // emerald (slot 2)
  { r: 245, g: 158, b: 11 },   // amber (slot 3)
  { r: 244, g: 63, b: 94 },    // rose (slot 4)
  { r: 168, g: 85, b: 247 },   // purple (slot 5)
] as const;

interface TimelineClipItemProps {
  clip: Clip;
  zoom: number;
}

export const TimelineClipItem = memo(function TimelineClipItem({ clip, zoom }: TimelineClipItemProps) {
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

  // Always holds latest clip — callbacks read from this at event time so they
  // don't need clip fields in their dependency arrays (same pattern as DraggableOverlay)
  const clipRef = useRef(clip);
  clipRef.current = clip;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "move" | "resize-left" | "resize-right") => {
      e.stopPropagation();
      e.preventDefault(); // prevent HTML5 drag from starting
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsResizing(true);
      const c = clipRef.current;
      const isImg = c.type === "image";
      dragRef.current = {
        type,
        startX: e.clientX,
        startValue: isImg
          ? c.displayDurationInFrames
          : type === "resize-left"
          ? c.trimStartFrame
          : c.trimEndFrame,
      };
    },
    [] // stable forever
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dFrames = pixelsToFrames(dx, zoom);
      const c = clipRef.current;

      if (c.type === "image") {
        // Image clips: only right resize adjusts displayDurationInFrames
        if (dragRef.current.type === "resize-right") {
          const newDuration = Math.max(
            15, // minimum ~0.5s at 30fps
            dragRef.current.startValue + dFrames
          );
          updateClip(c.id, { displayDurationInFrames: newDuration });
        }
      } else if (c.type === "video") {
        if (dragRef.current.type === "resize-left") {
          const newStart = Math.max(
            0,
            Math.min(
              dragRef.current.startValue + dFrames,
              c.trimEndFrame - 1
            )
          );
          updateClip(c.id, { trimStartFrame: newStart });
        } else if (dragRef.current.type === "resize-right") {
          const newEnd = Math.min(
            c.durationInFrames,
            Math.max(
              dragRef.current.startValue + dFrames,
              c.trimStartFrame + 1
            )
          );
          updateClip(c.id, { trimEndFrame: newEnd });
        }
      }
    },
    [zoom, updateClip] // no clip fields in deps
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsResizing(false);
  }, []);

  // Color by slot index — memoized to avoid recalculating styles every render
  const slotIdx = clip.slotIndex ?? 0;
  const clipStyles = useMemo(() => {
    const sc = SLOT_COLOR_DEFS[slotIdx % SLOT_COLOR_DEFS.length];
    const rgba = (a: number) => `rgba(${sc.r},${sc.g},${sc.b},${a})`;
    return {
      borderSelected: rgba(0.6),
      borderDefault: rgba(0.3),
      bgFromSelected: rgba(0.45),
      bgFromDefault: rgba(0.3),
      bgToSelected: rgba(0.35),
      bgToDefault: rgba(0.2),
      ringColor: rgba(0.4),
      shadowColor: rgba(0.25),
      decorationImage: isImage
        ? `repeating-linear-gradient(90deg, ${rgba(0.25)} 0px, ${rgba(0.25)} 2px, transparent 2px, transparent 6px)`
        : `repeating-linear-gradient(90deg, ${rgba(0.3)} 0px, ${rgba(0.3)} 1px, transparent 1px, transparent 3px)`,
    };
  }, [slotIdx, isImage]);

  const colorClasses = isSelected
    ? "border ring-1"
    : "border hover:border-opacity-50";

  const borderColor = isSelected ? clipStyles.borderSelected : clipStyles.borderDefault;
  const bgFrom = isSelected ? clipStyles.bgFromSelected : clipStyles.bgFromDefault;
  const bgTo = isSelected ? clipStyles.bgToSelected : clipStyles.bgToDefault;
  const ringColor = isSelected ? clipStyles.ringColor : "transparent";

  const decorationBg = clipStyles.decorationImage;

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
        boxShadow: isSelected ? `0 0 8px ${clipStyles.shadowColor}` : undefined,
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
});
