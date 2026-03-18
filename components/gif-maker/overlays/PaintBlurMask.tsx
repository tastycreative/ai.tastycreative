"use client";

import { useMemo } from "react";
import type { BlurOverlay } from "@/lib/gif-maker/types";

interface PaintBlurMaskProps {
  overlay: BlurOverlay;
}

/**
 * Read-only blur mask for paint-shape blur overlays.
 * Always visible when the overlay is in the current frame range.
 * The drawing interaction is handled separately by PaintBlurCanvas (only when selected).
 */
export function PaintBlurMask({ overlay }: PaintBlurMaskProps) {
  const path = overlay.paintPath ?? [];
  const brushSize = overlay.brushSize ?? 3;

  const filterValue = useMemo(() => {
    const { intensity, blurMode = "gaussian" } = overlay;
    if (blurMode === "solid" && overlay.fillColor) return null;
    if (blurMode === "pixelate") {
      const pixelBlur = Math.max(8, intensity * 1.2);
      return `blur(${pixelBlur}px) contrast(1.1) saturate(1.05)`;
    }
    const blurPx = blurMode === "heavy" ? intensity * 3 : intensity;
    return `blur(${blurPx}px)`;
  }, [overlay.intensity, overlay.blurMode, overlay.fillColor]);

  const maskSvg = useMemo(() => {
    if (path.length === 0) return null;
    const circles = path
      .map((pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="${brushSize}" fill="white"/>`)
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${circles}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [path, brushSize]);

  if (!maskSvg) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 5,
        WebkitMaskImage: maskSvg,
        maskImage: maskSvg,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        backdropFilter: filterValue ?? undefined,
        WebkitBackdropFilter: filterValue ?? undefined,
        backgroundColor: overlay.blurMode === "solid" ? overlay.fillColor : undefined,
      }}
    />
  );
}
