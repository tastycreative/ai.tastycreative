"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { BlurOverlay, BlurMode, BlurShape } from "@/lib/gif-maker/types";

const BLUR_MODE_OPTIONS: { value: BlurMode; label: string; desc: string }[] = [
  { value: "gaussian", label: "Gaussian", desc: "Smooth blur" },
  { value: "heavy", label: "Heavy", desc: "Extra strong blur" },
  { value: "pixelate", label: "Pixelate", desc: "Mosaic censoring" },
  { value: "solid", label: "Solid Fill", desc: "Solid color bar" },
];

const BLUR_SHAPE_OPTIONS: { value: BlurShape; label: string }[] = [
  { value: "rectangle", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "rounded-rect", label: "Rounded Rect" },
  { value: "paint", label: "Paint" },
];

const inputClass =
  "w-full h-7 px-2 bg-slate-900 border border-[#2d3142] rounded-md text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150";

interface BlurOverlayPropertiesProps {
  overlay: BlurOverlay;
}

export function BlurOverlayProperties({ overlay }: BlurOverlayPropertiesProps) {
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);

  const update = (updates: Partial<BlurOverlay>) => {
    updateOverlay(overlay.id, updates);
  };

  const intensityLabel =
    overlay.blurMode === "pixelate"
      ? `Pixel Size: ${overlay.intensity}px`
      : `Intensity: ${overlay.intensity}px`;

  const intensityMax = overlay.blurMode === "pixelate" ? 60 : 80;

  return (
    <div className="space-y-4">
      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Blur / Censor</h4>

      {/* Blur Mode */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Mode</label>
        <div className="grid grid-cols-2 gap-1.5">
          {BLUR_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ blurMode: opt.value })}
              className={`px-2.5 py-2.5 rounded-lg text-xs transition-all duration-150 text-left ${
                overlay.blurMode === opt.value
                  ? "border-2 border-indigo-500 bg-indigo-500/5 text-slate-100"
                  : "border-2 border-[#2d3142] text-slate-400 hover:border-slate-700 hover:text-slate-100"
              }`}
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Shape */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Shape</label>
        <div className="grid grid-cols-2 gap-1">
          {BLUR_SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ shape: opt.value, ...(opt.value === "paint" ? { x: 0, y: 0, width: 100, height: 100, paintPath: overlay.paintPath ?? [] } : {}) })}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-all duration-150 ${
                overlay.shape === opt.value
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100 border border-[#2d3142]"
              }`}
            >
              <ShapeIcon shape={opt.value} active={overlay.shape === opt.value} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brush Size (paint only) */}
      {overlay.shape === "paint" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Brush Size: {overlay.brushSize ?? 3}%</label>
          <input
            type="range"
            min={1}
            max={15}
            step={0.5}
            value={overlay.brushSize ?? 3}
            onChange={(e) => update({ brushSize: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      )}

      {/* Draw / Move toggle (paint only) */}
      {overlay.shape === "paint" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Tool</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => update({ paintMode: "draw" })}
              className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                (overlay.paintMode ?? "draw") === "draw"
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-100"
              }`}
            >
              ✏️ Draw
            </button>
            <button
              onClick={() => update({ paintMode: "move" })}
              className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                overlay.paintMode === "move"
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-100"
              }`}
            >
              ✋ Move
            </button>
          </div>
        </div>
      )}

      {/* Clear Paint */}
      {overlay.shape === "paint" && overlay.paintPath && overlay.paintPath.length > 0 && (
        <button
          onClick={() => update({ paintPath: [] })}
          className="w-full h-8 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Clear Paint ({overlay.paintPath.length} points)
        </button>
      )}

      {/* Intensity (not for solid) */}
      {overlay.blurMode !== "solid" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">{intensityLabel}</label>
          <input
            type="range"
            min={1}
            max={intensityMax}
            value={overlay.intensity}
            onChange={(e) => update({ intensity: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      )}

      {/* Fill Color (solid only) */}
      {overlay.blurMode === "solid" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Fill Color</label>
          <input
            type="color"
            value={overlay.fillColor}
            onChange={(e) => update({ fillColor: e.target.value })}
            className="w-full h-7 rounded cursor-pointer bg-slate-800 border border-[#2d3142]"
          />
        </div>
      )}

      {/* Rotation (not for paint) */}
      {overlay.shape !== "paint" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Rotation: {overlay.rotation}°</label>
          <input
            type="range"
            min={-180}
            max={180}
            value={overlay.rotation}
            onChange={(e) => update({ rotation: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      )}

      {/* Feather (not for paint) */}
      {overlay.shape !== "paint" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Feather (soft edge): {overlay.feather}%</label>
          <input
            type="range"
            min={0}
            max={50}
            value={overlay.feather}
            onChange={(e) => update({ feather: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      )}

      {/* Border Radius (rounded-rect only) */}
      {overlay.shape === "rounded-rect" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">
            Corner Radius: {overlay.borderRadius}%
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={overlay.borderRadius}
            onChange={(e) => update({ borderRadius: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      )}

      {/* Position & Size (not for paint — paint uses full canvas) */}
      {overlay.shape !== "paint" && (
        <div className="space-y-2.5 pt-3 border-t border-[#2d3142]">
          <h5 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Position & Size
          </h5>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">X (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={overlay.x}
                onChange={(e) => update({ x: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Y (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={overlay.y}
                onChange={(e) => update({ y: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Width (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={overlay.width}
                onChange={(e) => update({ width: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Height (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={overlay.height}
                onChange={(e) => update({ height: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {/* Timing */}
      <div className="space-y-2.5 pt-3 border-t border-[#2d3142]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Timing
        </h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Start Frame</label>
            <input
              type="number"
              min={0}
              value={overlay.startFrame}
              onChange={(e) =>
                update({ startFrame: Math.max(0, Number(e.target.value)) })
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Duration</label>
            <input
              type="number"
              min={1}
              value={overlay.durationInFrames}
              onChange={(e) =>
                update({
                  durationInFrames: Math.max(1, Number(e.target.value)),
                })
              }
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shape preview icons ─────────────────────────────

function ShapeIcon({ shape, active }: { shape: BlurShape; active: boolean }) {
  const color = active ? "#fff" : "#8490b0";
  const size = 14;
  switch (shape) {
    case "rectangle":
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="10" rx="1" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "ellipse":
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <ellipse cx="7" cy="7" rx="6" ry="5" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "rounded-rect":
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="10" rx="4" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "paint":
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <path d="M3 11 L6 4 L8 6 L11 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="3" cy="11" r="1.5" fill={color} />
        </svg>
      );
  }
}
