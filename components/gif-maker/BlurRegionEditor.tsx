"use client";

import { useState, useRef, useCallback } from "react";
import { Crosshair, Trash2 } from "lucide-react";
import type { BlurRegion } from "@/lib/gif-maker/types";

interface BlurRegionEditorProps {
  regions: BlurRegion[];
  onRegionsChange: (regions: BlurRegion[]) => void;
  containerWidth: number;
  containerHeight: number;
}

export function BlurRegionEditor({
  regions,
  onRegionsChange,
  containerWidth,
  containerHeight,
}: BlurRegionEditorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentDraw, setCurrentDraw] = useState<BlurRegion | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getPercentageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      return { x, y };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!drawMode) return;
      e.preventDefault();
      const coords = getPercentageCoords(e.clientX, e.clientY);
      setDrawStart(coords);
      setIsDrawing(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [drawMode, getPercentageCoords]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing || !drawStart) return;
      const coords = getPercentageCoords(e.clientX, e.clientY);
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const width = Math.abs(coords.x - drawStart.x);
      const height = Math.abs(coords.y - drawStart.y);
      setCurrentDraw({ id: "drawing", x, y, width, height });
    },
    [isDrawing, drawStart, getPercentageCoords]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !currentDraw) {
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentDraw(null);
      return;
    }

    // Only add if region is meaningful size (> 1% in both dimensions)
    if (currentDraw.width > 1 && currentDraw.height > 1) {
      const newRegion: BlurRegion = {
        ...currentDraw,
        id: `region-${Date.now()}`,
      };
      onRegionsChange([...regions, newRegion]);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentDraw(null);
  }, [isDrawing, currentDraw, regions, onRegionsChange]);

  const handleDelete = useCallback(
    (id: string) => {
      onRegionsChange(regions.filter((r) => r.id !== id));
    },
    [regions, onRegionsChange]
  );

  return (
    <div className="space-y-3">
      {/* Draw mode toggle */}
      <button
        onClick={() => setDrawMode(!drawMode)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full
          ${
            drawMode
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }
        `}
      >
        <Crosshair className="h-4 w-4" />
        {drawMode ? "Drawing Mode (click & drag on preview)" : "Draw Blur Region"}
      </button>

      {/* Drawing overlay - positioned over the preview via parent */}
      <div
        ref={overlayRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="absolute inset-0 z-20"
        style={{
          cursor: drawMode ? "crosshair" : "default",
          pointerEvents: drawMode ? "auto" : "none",
        }}
      >
        {/* Render existing regions */}
        {regions.map((region) => (
          <div
            key={region.id}
            className="absolute border-2 border-dashed border-red-400/80 bg-red-500/10"
            style={{
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.width}%`,
              height: `${region.height}%`,
            }}
          />
        ))}

        {/* Current drawing region */}
        {currentDraw && (
          <div
            className="absolute border-2 border-dashed border-yellow-400 bg-yellow-500/15"
            style={{
              left: `${currentDraw.x}%`,
              top: `${currentDraw.y}%`,
              width: `${currentDraw.width}%`,
              height: `${currentDraw.height}%`,
            }}
          />
        )}
      </div>

      {/* Region list */}
      {regions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {regions.length} region{regions.length !== 1 ? "s" : ""}
          </p>
          {regions.map((region, index) => (
            <div
              key={region.id}
              className="flex items-center justify-between px-3 py-1.5 bg-muted rounded text-xs"
            >
              <span>
                Region {index + 1} ({Math.round(region.width)}% x{" "}
                {Math.round(region.height)}%)
              </span>
              <button
                onClick={() => handleDelete(region.id)}
                className="p-1 hover:bg-destructive/20 rounded transition-colors"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
