import React from "react";
import { Sequence, Video, getRemotionEnvironment } from "remotion";
import type { BlurOverlay, VideoClip } from "@/lib/gif-maker/types";

interface BlurOverlayRendererProps {
  overlay: BlurOverlay;
  clips: VideoClip[];
}

/**
 * Blur overlay with hybrid rendering:
 * - Preview mode: Uses backdrop-filter for perfect sync with main video
 * - Render mode: Uses video copy approach so blur is captured in export
 *
 * Supports blur modes:
 * - gaussian: Standard CSS blur
 * - heavy: Stronger CSS blur (3x intensity)
 * - pixelate: Simulated mosaic effect using heavy blur + contrast
 * - solid: Solid color fill
 */
export const BlurOverlayRenderer: React.FC<BlurOverlayRendererProps> = ({
  overlay,
  clips,
}) => {
  const {
    x,
    y,
    width,
    height,
    intensity,
    blurMode = "gaussian",
    shape = "rectangle",
    rotation = 0,
    feather = 0,
    borderRadius: br = 0,
    fillColor = "#000000",
  } = overlay;

  // Detect if we're rendering (export) or previewing
  // Check both Remotion's rendering flag AND our custom export flag
  const env = getRemotionEnvironment();
  const isExportMode =
    env.isRendering ||
    (typeof window !== "undefined" &&
      (window as Window & { __GIF_EXPORT_MODE__?: boolean }).__GIF_EXPORT_MODE__);

  // Feather mask (CSS mask-image)
  let maskStyle: React.CSSProperties = {};
  if (feather > 0) {
    const f = Math.min(feather, 48);
    let mask: string;
    if (shape === "ellipse") {
      const inner = Math.max(0, 100 - f * 2);
      mask = `radial-gradient(ellipse at center, black ${inner}%, transparent 100%)`;
    } else {
      mask = [
        `linear-gradient(to right, transparent 0%, black ${f}%, black ${100 - f}%, transparent 100%)`,
        `linear-gradient(to bottom, transparent 0%, black ${f}%, black ${100 - f}%, transparent 100%)`,
      ].join(", ");
    }
    maskStyle = {
      maskImage: mask,
      WebkitMaskImage: mask,
    };
    if (shape !== "ellipse") {
      maskStyle.maskComposite = "intersect";
      (maskStyle as Record<string, string>).WebkitMaskComposite = "source-in";
    }
  }

  // Calculate border-radius for shapes
  let borderRadius: string | undefined;
  if (shape === "ellipse") {
    borderRadius = "50%";
  } else if (shape === "rounded-rect") {
    borderRadius = `${Math.max(0, br)}%`;
  }

  // Base container style
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    width: `${width}%`,
    height: `${height}%`,
    overflow: "hidden",
    borderRadius,
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    transformOrigin: "center center",
    ...maskStyle,
  };

  // ─── Solid fill: just a colored div ───────────────
  if (blurMode === "solid") {
    return <div style={{ ...containerStyle, backgroundColor: fillColor }} />;
  }

  // Calculate blur values
  let filterValue: string;
  if (blurMode === "pixelate") {
    const pixelBlur = Math.max(8, intensity * 1.2);
    filterValue = `blur(${pixelBlur}px) contrast(1.1) saturate(1.05)`;
  } else {
    const blurPx = blurMode === "heavy" ? intensity * 3 : intensity;
    filterValue = `blur(${blurPx}px)`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT MODE: Use video copy approach (captured properly in export)
  // ═══════════════════════════════════════════════════════════════════
  if (isExportMode) {
    // Inner video positioning to show the correct region
    const innerLeft = width > 0 ? -(x / width) * 100 : 0;
    const innerTop = height > 0 ? -(y / height) * 100 : 0;
    const innerWidth = width > 0 ? (100 / width) * 100 : 100;
    const innerHeight = height > 0 ? (100 / height) * 100 : 100;

    const innerStyle: React.CSSProperties = {
      position: "absolute",
      left: `${innerLeft}%`,
      top: `${innerTop}%`,
      width: `${innerWidth}%`,
      height: `${innerHeight}%`,
      filter: filterValue,
    };

    return (
      <div style={containerStyle}>
        <div style={innerStyle}>
          {clips.map((clip) => {
            const clipDuration = clip.trimEndFrame - clip.trimStartFrame;
            const relativeFrom = clip.startFrame - overlay.startFrame;

            return (
              <Sequence
                key={clip.id}
                from={relativeFrom}
                durationInFrames={clipDuration}
                layout="none"
              >
                {clip.src ? (
                  <Video
                    src={clip.src}
                    startFrom={clip.trimStartFrame}
                    volume={0}
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : null}
              </Sequence>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PREVIEW MODE: Use backdrop-filter (always in sync with main video)
  // ═══════════════════════════════════════════════════════════════════

  // Simple approach for all shapes - apply backdrop-filter directly
  const blurStyle: React.CSSProperties = {
    ...containerStyle,
    backdropFilter: filterValue,
    WebkitBackdropFilter: filterValue,
    backgroundColor: "transparent",
  };

  return <div style={blurStyle} />;
};
