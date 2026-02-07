"use client";

import { useMemo } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { DraggableOverlay } from "./DraggableOverlay";

interface CanvasOverlayLayerProps {
  containerWidth: number;
  containerHeight: number;
}

export function CanvasOverlayLayer({
  containerWidth,
  containerHeight,
}: CanvasOverlayLayerProps) {
  const overlays = useVideoEditorStore((s) => s.overlays);
  const currentFrame = useVideoEditorStore((s) => s.currentFrame);
  const clearSelection = useVideoEditorStore((s) => s.clearSelection);

  // Only show overlays that are active at the current frame
  const visibleOverlays = useMemo(
    () =>
      overlays.filter(
        (o) =>
          currentFrame >= o.startFrame &&
          currentFrame < o.startFrame + o.durationInFrames
      ),
    [overlays, currentFrame]
  );

  return (
    <div
      className="absolute inset-0 z-10"
      onClick={() => clearSelection()}
    >
      {visibleOverlays.map((overlay) => (
        <DraggableOverlay
          key={overlay.id}
          overlay={overlay}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      ))}
    </div>
  );
}
