"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import { DraggableOverlay } from "./DraggableOverlay";
import { PaintBlurCanvas } from "./PaintBlurCanvas";
import { PaintBlurMask } from "./PaintBlurMask";
import type { BlurOverlay } from "@/lib/gif-maker/types";

interface CanvasOverlayLayerProps {
  containerWidth: number;
  containerHeight: number;
}

export function CanvasOverlayLayer({
  containerWidth,
  containerHeight,
}: CanvasOverlayLayerProps) {
  const visibleOverlays = useVideoEditorStore(
    useShallow((s) =>
      s.overlays.filter(
        (o) =>
          s.currentFrame >= o.startFrame &&
          s.currentFrame < o.startFrame + o.durationInFrames
      )
    )
  );
  const selectedOverlayId = useVideoEditorStore((s) => s.selectedOverlayId);
  const clearSelection = useVideoEditorStore((s) => s.clearSelection);

  const hasPaintSelected = visibleOverlays.some(
    (o) => o.id === selectedOverlayId && o.type === "blur" && (o as BlurOverlay).shape === "paint"
  );

  // Separate paint blur overlays from regular overlays
  const paintOverlays = visibleOverlays.filter(
    (o): o is BlurOverlay => o.type === "blur" && (o as BlurOverlay).shape === "paint"
  );
  const regularOverlays = visibleOverlays.filter(
    (o) => !(o.type === "blur" && (o as BlurOverlay).shape === "paint")
  );

  return (
    <div
      className="absolute inset-0 z-10"
      onClick={() => { if (!hasPaintSelected) clearSelection(); }}
    >
      {/* Regular overlays (draggable rectangles/ellipses/text/etc) */}
      {regularOverlays.map((overlay) => (
        <DraggableOverlay
          key={overlay.id}
          overlay={overlay}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      ))}

      {/* Paint blur masks — ALWAYS visible for all paint overlays */}
      {paintOverlays.map((o) => (
        <PaintBlurMask key={`mask-${o.id}`} overlay={o} />
      ))}

      {/* Paint drawing canvas — only for the SELECTED paint overlay */}
      {paintOverlays
        .filter((o) => o.id === selectedOverlayId)
        .map((o) => (
          <PaintBlurCanvas key={o.id} overlay={o} />
        ))}
    </div>
  );
}
