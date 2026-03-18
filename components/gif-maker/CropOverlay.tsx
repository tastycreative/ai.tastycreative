"use client";

import { useRef, useEffect } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";

type DragHandle = "move" | "nw" | "ne" | "sw" | "se";

export function CropOverlay() {
  const cropRect = useVideoEditorStore((s) => s.cropRect);
  const setCropRect = useVideoEditorStore((s) => s.setCropRect);
  const canvasWidth = useVideoEditorStore((s) => s.settings.width);
  const canvasHeight = useVideoEditorStore((s) => s.settings.height);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, rect: { x: 0, y: 0, width: 0, height: 0 } });
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  if (!cropRect) return null;

  const handleMouseDown = (e: React.MouseEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();
    dragStart.current = { x: e.clientX, y: e.clientY, rect: { ...cropRect } };

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const parentRect = containerRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect || parentRect.width === 0 || parentRect.height === 0) return;

      const dx = ((e.clientX - dragStart.current.x) / parentRect.width) * 100;
      const dy = ((e.clientY - dragStart.current.y) / parentRect.height) * 100;
      const r = dragStart.current.rect;

      if (handle === "move") {
        setCropRect({
          x: Math.max(0, Math.min(100 - r.width, r.x + dx)),
          y: Math.max(0, Math.min(100 - r.height, r.y + dy)),
          width: r.width,
          height: r.height,
        });
      } else if (handle === "se") {
        setCropRect({
          x: r.x,
          y: r.y,
          width: Math.max(10, Math.min(100 - r.x, r.width + dx)),
          height: Math.max(10, Math.min(100 - r.y, r.height + dy)),
        });
      } else if (handle === "nw") {
        const newX = Math.max(0, r.x + dx);
        const newY = Math.max(0, r.y + dy);
        setCropRect({
          x: newX,
          y: newY,
          width: Math.max(10, r.width - (newX - r.x)),
          height: Math.max(10, r.height - (newY - r.y)),
        });
      } else if (handle === "ne") {
        const newY = Math.max(0, r.y + dy);
        setCropRect({
          x: r.x,
          y: newY,
          width: Math.max(10, Math.min(100 - r.x, r.width + dx)),
          height: Math.max(10, r.height - (newY - r.y)),
        });
      } else if (handle === "sw") {
        const newX = Math.max(0, r.x + dx);
        setCropRect({
          x: newX,
          y: r.y,
          width: Math.max(10, r.width - (newX - r.x)),
          height: Math.max(10, Math.min(100 - r.y, r.height + dy)),
        });
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      cleanupRef.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    cleanupRef.current = onMouseUp;
  };

  const handleStyle = "w-3 h-3 bg-white border-2 border-brand-light-pink rounded-full absolute z-10";

  const cropW = Math.round((cropRect.width / 100) * canvasWidth);
  const cropH = Math.round((cropRect.height / 100) * canvasHeight);

  return (
    <div ref={containerRef} className="absolute inset-0 z-20">
      {/* Dimmed areas outside crop */}
      <div
        className="absolute inset-0 bg-black/60"
        style={{
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${cropRect.x}% ${cropRect.y}%,
            ${cropRect.x}% ${cropRect.y + cropRect.height}%,
            ${cropRect.x + cropRect.width}% ${cropRect.y + cropRect.height}%,
            ${cropRect.x + cropRect.width}% ${cropRect.y}%,
            ${cropRect.x}% ${cropRect.y}%
          )`,
        }}
      />

      {/* Crop region */}
      <div
        className="absolute border-2 border-white/80 cursor-move"
        style={{
          left: `${cropRect.x}%`,
          top: `${cropRect.y}%`,
          width: `${cropRect.width}%`,
          height: `${cropRect.height}%`,
        }}
        onMouseDown={(e) => handleMouseDown(e, "move")}
      >
        {/* Rule of thirds grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
        </div>

        {/* Corner handles */}
        <div className={`${handleStyle} -top-1.5 -left-1.5 cursor-nw-resize`} onMouseDown={(e) => handleMouseDown(e, "nw")} />
        <div className={`${handleStyle} -top-1.5 -right-1.5 cursor-ne-resize`} onMouseDown={(e) => handleMouseDown(e, "ne")} />
        <div className={`${handleStyle} -bottom-1.5 -left-1.5 cursor-sw-resize`} onMouseDown={(e) => handleMouseDown(e, "sw")} />
        <div className={`${handleStyle} -bottom-1.5 -right-1.5 cursor-se-resize`} onMouseDown={(e) => handleMouseDown(e, "se")} />

        {/* Dimension display */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-7 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded font-mono pointer-events-none whitespace-nowrap">
          {cropW} x {cropH}
        </div>
      </div>
    </div>
  );
}
