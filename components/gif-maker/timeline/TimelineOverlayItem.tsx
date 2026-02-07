"use client";

import { memo, useRef, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { framesToPixels, pixelsToFrames } from "@/lib/gif-maker/timeline-utils";
import type { Overlay } from "@/lib/gif-maker/types";

const OVERLAY_STYLES: Record<
  Overlay["type"],
  { gradient: string; border: string; selectedGradient: string; selectedBorder: string }
> = {
  text: {
    gradient: "from-amber-500/30 to-amber-600/20",
    border: "border-amber-500/30",
    selectedGradient: "from-amber-500/45 to-amber-600/35",
    selectedBorder: "border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40",
  },
  blur: {
    gradient: "from-purple-500/30 to-purple-600/20",
    border: "border-purple-500/30",
    selectedGradient: "from-purple-500/45 to-purple-600/35",
    selectedBorder: "border-purple-400/60 shadow-[0_0_8px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/40",
  },
  sticker: {
    gradient: "from-green-500/30 to-green-600/20",
    border: "border-green-500/30",
    selectedGradient: "from-green-500/45 to-green-600/35",
    selectedBorder: "border-green-400/60 shadow-[0_0_8px_rgba(34,197,94,0.25)] ring-1 ring-green-400/40",
  },
  shape: {
    gradient: "from-rose-500/30 to-rose-600/20",
    border: "border-rose-500/30",
    selectedGradient: "from-rose-500/45 to-rose-600/35",
    selectedBorder: "border-rose-400/60 shadow-[0_0_8px_rgba(244,63,94,0.25)] ring-1 ring-rose-400/40",
  },
};

interface TimelineOverlayItemProps {
  overlay: Overlay;
  zoom: number;
}

export const TimelineOverlayItem = memo(function TimelineOverlayItem({ overlay, zoom }: TimelineOverlayItemProps) {
  const selectedOverlayId = useVideoEditorStore((s) => s.selectedOverlayId);
  const selectOverlay = useVideoEditorStore((s) => s.selectOverlay);
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);

  const isSelected = selectedOverlayId === overlay.id;
  const left = framesToPixels(overlay.startFrame, zoom);
  const width = framesToPixels(overlay.durationInFrames, zoom);

  const style = OVERLAY_STYLES[overlay.type];

  const dragRef = useRef<{
    type: "move" | "resize-left" | "resize-right";
    startX: number;
    startFrame: number;
    startDuration: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "move" | "resize-left" | "resize-right") => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        type,
        startX: e.clientX,
        startFrame: overlay.startFrame,
        startDuration: overlay.durationInFrames,
      };
    },
    [overlay.startFrame, overlay.durationInFrames]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dFrames = pixelsToFrames(dx, zoom);

      if (dragRef.current.type === "move") {
        const newStart = Math.max(0, dragRef.current.startFrame + dFrames);
        updateOverlay(overlay.id, { startFrame: newStart });
      } else if (dragRef.current.type === "resize-left") {
        const newStart = Math.max(0, dragRef.current.startFrame + dFrames);
        const endFrame = dragRef.current.startFrame + dragRef.current.startDuration;
        const newDuration = Math.max(1, endFrame - newStart);
        updateOverlay(overlay.id, {
          startFrame: newStart,
          durationInFrames: newDuration,
        });
      } else if (dragRef.current.type === "resize-right") {
        const newDuration = Math.max(1, dragRef.current.startDuration + dFrames);
        updateOverlay(overlay.id, { durationInFrames: newDuration });
      }
    },
    [overlay.id, zoom, updateOverlay]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      className={`absolute top-1 bottom-1 rounded-md flex items-center overflow-hidden cursor-pointer select-none border bg-gradient-to-b transition-[box-shadow,border-color] duration-150 ${
        isSelected
          ? `${style.selectedGradient} ${style.selectedBorder}`
          : `${style.gradient} ${style.border} hover:brightness-125`
      }`}
      style={{ left, width: Math.max(width, 4) }}
      onClick={(e) => {
        e.stopPropagation();
        selectOverlay(overlay.id);
      }}
      onPointerDown={(e) => handlePointerDown(e, "move")}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group/handle"
        onPointerDown={(e) => handlePointerDown(e, "resize-left")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute inset-y-1 left-0.5 w-0.5 bg-white/50 rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity duration-100" />
      </div>

      <span className="text-[10px] text-white/70 px-2 truncate pointer-events-none z-10 relative">
        {overlay.type}
      </span>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group/handle"
        onPointerDown={(e) => handlePointerDown(e, "resize-right")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute inset-y-1 right-0.5 w-0.5 bg-white/50 rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity duration-100" />
      </div>
    </div>
  );
});
