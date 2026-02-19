"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import { DraggableOverlay } from "./DraggableOverlay";

interface CanvasOverlayLayerProps {
  containerWidth: number;
  containerHeight: number;
}

export function CanvasOverlayLayer({
  containerWidth,
  containerHeight,
}: CanvasOverlayLayerProps) {
  // useShallow bails out when the filtered array contains the same overlay
  // objects in the same order — prevents re-renders on every frame tick
  // during playback when no overlays are appearing/disappearing
  const visibleOverlays = useVideoEditorStore(
    useShallow((s) =>
      s.overlays.filter(
        (o) =>
          s.currentFrame >= o.startFrame &&
          s.currentFrame < o.startFrame + o.durationInFrames
      )
    )
  );
  const clearSelection = useVideoEditorStore((s) => s.clearSelection);

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
