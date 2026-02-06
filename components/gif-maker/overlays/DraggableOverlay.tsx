"use client";

import { useRef, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { Overlay } from "@/lib/gif-maker/types";

interface DraggableOverlayProps {
  overlay: Overlay;
  containerWidth: number;
  containerHeight: number;
}

export function DraggableOverlay({
  overlay,
  containerWidth,
  containerHeight,
}: DraggableOverlayProps) {
  const selectedOverlayId = useVideoEditorStore((s) => s.selectedOverlayId);
  const selectOverlay = useVideoEditorStore((s) => s.selectOverlay);
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);

  const isSelected = selectedOverlayId === overlay.id;

  const dragRef = useRef<{
    type: "move" | "resize";
    startX: number;
    startY: number;
    startOx: number;
    startOy: number;
    startOw: number;
    startOh: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "move" | "resize") => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startOx: overlay.x,
        startOy: overlay.y,
        startOw: overlay.width,
        startOh: overlay.height,
      };
    },
    [overlay.x, overlay.y, overlay.width, overlay.height]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      // Convert pixel deltas to percentage
      const dxPct = (dx / containerWidth) * 100;
      const dyPct = (dy / containerHeight) * 100;

      if (dragRef.current.type === "move") {
        updateOverlay(overlay.id, {
          x: Math.max(0, Math.min(100 - overlay.width, dragRef.current.startOx + dxPct)),
          y: Math.max(0, Math.min(100 - overlay.height, dragRef.current.startOy + dyPct)),
        });
      } else if (dragRef.current.type === "resize") {
        updateOverlay(overlay.id, {
          width: Math.max(2, Math.min(100, dragRef.current.startOw + dxPct)),
          height: Math.max(2, Math.min(100, dragRef.current.startOh + dyPct)),
        });
      }
    },
    [overlay.id, overlay.width, overlay.height, containerWidth, containerHeight, updateOverlay]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Compute border-radius to match the overlay's visual shape
  let borderRadius: string | undefined;
  if (overlay.type === "blur") {
    if (overlay.shape === "ellipse") borderRadius = "50%";
    else if (overlay.shape === "rounded-rect")
      borderRadius = `${Math.max(1, overlay.borderRadius)}%`;
  } else if (overlay.type === "shape" && overlay.shapeType === "circle") {
    borderRadius = "50%";
  }

  return (
    <div
      className={`absolute cursor-move transition-shadow duration-150 ${
        isSelected
          ? "ring-2 ring-blue-400 shadow-[0_0_16px_rgba(99,102,241,0.4)]"
          : "hover:ring-1 hover:ring-white/50"
      }`}
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        width: `${overlay.width}%`,
        height: `${overlay.height}%`,
        borderRadius,
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectOverlay(overlay.id);
      }}
      onPointerDown={(e) => handlePointerDown(e, "move")}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Resize handle (bottom-right corner) */}
      {isSelected && (
        <div
          className="absolute -right-1 -bottom-1 w-3 h-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-sm cursor-nwse-resize z-10 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
          onPointerDown={(e) => handlePointerDown(e, "resize")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
    </div>
  );
}
