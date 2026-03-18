"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { PaintPoint, BlurOverlay } from "@/lib/gif-maker/types";

interface PaintBlurCanvasProps {
  overlay: BlurOverlay;
}

export function PaintBlurCanvas({ overlay }: PaintBlurCanvasProps) {
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isActive, setIsActive] = useState(false);
  const pointsRef = useRef<PaintPoint[]>(overlay.paintPath ?? []);
  const moveStartRef = useRef<PaintPoint | null>(null);
  const brushSize = overlay.brushSize ?? 3;
  const mode = overlay.paintMode ?? "draw";

  useEffect(() => {
    if (!isActive) {
      pointsRef.current = overlay.paintPath ?? [];
    }
  }, [overlay.paintPath, isActive]);

  const getPercentCoords = useCallback((e: React.MouseEvent): PaintPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  // ─── Draw Mode Handlers ─────────────────────────
  const handleDrawDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as SVGSVGElement).setPointerCapture(e.pointerId);
    setIsActive(true);
    const pt = getPercentCoords(e);
    pointsRef.current = [...pointsRef.current, pt];
  }, [getPercentCoords]);

  const handleDrawMove = useCallback((e: React.PointerEvent) => {
    if (!isActive) return;
    const pt = getPercentCoords(e);
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (last) {
      const dist = Math.sqrt((pt.x - last.x) ** 2 + (pt.y - last.y) ** 2);
      if (dist < 0.5) return;
    }
    pointsRef.current.push(pt);
    updateOverlay(overlay.id, { paintPath: [...pointsRef.current] });
  }, [isActive, getPercentCoords, overlay.id, updateOverlay]);

  const handleDrawUp = useCallback(() => {
    setIsActive(false);
    updateOverlay(overlay.id, { paintPath: [...pointsRef.current] });
  }, [overlay.id, updateOverlay]);

  // ─── Move Mode Handlers ─────────────────────────
  const handleMoveDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as SVGSVGElement).setPointerCapture(e.pointerId);
    setIsActive(true);
    moveStartRef.current = getPercentCoords(e);
  }, [getPercentCoords]);

  const handleMoveMove = useCallback((e: React.PointerEvent) => {
    if (!isActive || !moveStartRef.current) return;
    const current = getPercentCoords(e);
    const dx = current.x - moveStartRef.current.x;
    const dy = current.y - moveStartRef.current.y;

    // Offset all points
    const moved = pointsRef.current.map((pt) => ({
      x: pt.x + dx,
      y: pt.y + dy,
    }));
    pointsRef.current = moved;
    moveStartRef.current = current;
    updateOverlay(overlay.id, { paintPath: [...moved] });
  }, [isActive, getPercentCoords, overlay.id, updateOverlay]);

  const handleMoveUp = useCallback(() => {
    setIsActive(false);
    moveStartRef.current = null;
    updateOverlay(overlay.id, { paintPath: [...pointsRef.current] });
  }, [overlay.id, updateOverlay]);

  // Pick handlers based on mode
  const onDown = mode === "move" ? handleMoveDown : handleDrawDown;
  const onMove = mode === "move" ? handleMoveMove : handleDrawMove;
  const onUp = mode === "move" ? handleMoveUp : handleDrawUp;

  const path = overlay.paintPath ?? [];
  const cursor = mode === "move" ? "grab" : "crosshair";

  return (
    <svg
      ref={svgRef}
      className="absolute top-0 left-0 z-30"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ cursor, width: "100%", height: "100%", touchAction: "none" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <rect x="0" y="0" width="100" height="100" fill="transparent" />
      {path.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={brushSize}
          fill={mode === "move" ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.3)"}
          stroke={mode === "move" ? "rgba(99, 102, 241, 0.4)" : "rgba(99, 102, 241, 0.6)"}
          strokeWidth={0.15}
        />
      ))}
    </svg>
  );
}
