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
];

const inputClass =
  "w-full h-7 px-2 bg-[#1a1b2e] border border-[#252640] rounded text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] outline-none transition-all duration-150";

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
      <h4 className="text-sm font-medium text-[#e6e8f0]">Blur / Censor</h4>

      {/* Blur Mode */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Mode</label>
        <div className="grid grid-cols-2 gap-1">
          {BLUR_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ blurMode: opt.value })}
              className={`px-2 py-2 rounded text-xs transition-colors duration-150 text-left ${
                overlay.blurMode === opt.value
                  ? "bg-[rgba(59,130,246,0.15)] ring-1 ring-[#3b82f6] text-[#e6e8f0]"
                  : "bg-[#1a1b2e] text-[#8490b0] hover:bg-[#1e2038] hover:text-[#e6e8f0] border border-[#252640]"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-[10px] text-[#4d5578] mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Shape */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Shape</label>
        <div className="grid grid-cols-3 gap-1">
          {BLUR_SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ shape: opt.value })}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors duration-150 ${
                overlay.shape === opt.value
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#1a1b2e] text-[#8490b0] hover:bg-[#1e2038] hover:text-[#e6e8f0] border border-[#252640]"
              }`}
            >
              <ShapeIcon shape={opt.value} active={overlay.shape === opt.value} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Intensity (not for solid) */}
      {overlay.blurMode !== "solid" && (
        <div className="space-y-1.5">
          <label className="text-xs text-[#8490b0]">{intensityLabel}</label>
          <input
            type="range"
            min={1}
            max={intensityMax}
            value={overlay.intensity}
            onChange={(e) => update({ intensity: Number(e.target.value) })}
            className="w-full h-1.5 accent-[#3b82f6]"
          />
        </div>
      )}

      {/* Fill Color (solid only) */}
      {overlay.blurMode === "solid" && (
        <div className="space-y-1.5">
          <label className="text-xs text-[#8490b0]">Fill Color</label>
          <input
            type="color"
            value={overlay.fillColor}
            onChange={(e) => update({ fillColor: e.target.value })}
            className="w-full h-7 rounded cursor-pointer bg-[#1a1b2e] border border-[#252640]"
          />
        </div>
      )}

      {/* Rotation */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Rotation: {overlay.rotation}°</label>
        <input
          type="range"
          min={-180}
          max={180}
          value={overlay.rotation}
          onChange={(e) => update({ rotation: Number(e.target.value) })}
          className="w-full h-1.5 accent-[#3b82f6]"
        />
      </div>

      {/* Feather */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Feather (soft edge): {overlay.feather}%</label>
        <input
          type="range"
          min={0}
          max={50}
          value={overlay.feather}
          onChange={(e) => update({ feather: Number(e.target.value) })}
          className="w-full h-1.5 accent-[#3b82f6]"
        />
      </div>

      {/* Border Radius (rounded-rect only) */}
      {overlay.shape === "rounded-rect" && (
        <div className="space-y-1.5">
          <label className="text-xs text-[#8490b0]">
            Corner Radius: {overlay.borderRadius}%
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={overlay.borderRadius}
            onChange={(e) => update({ borderRadius: Number(e.target.value) })}
            className="w-full h-1.5 accent-[#3b82f6]"
          />
        </div>
      )}

      {/* Position & Size */}
      <div className="space-y-2.5 pt-3 border-t border-[#252640]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">
          Position & Size
        </h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-[#4d5578]">X (%)</label>
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
            <label className="text-[10px] text-[#4d5578]">Y (%)</label>
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
            <label className="text-[10px] text-[#4d5578]">Width (%)</label>
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
            <label className="text-[10px] text-[#4d5578]">Height (%)</label>
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

      {/* Timing */}
      <div className="space-y-2.5 pt-3 border-t border-[#252640]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">
          Timing
        </h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-[#4d5578]">Start Frame</label>
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
            <label className="text-[10px] text-[#4d5578]">Duration</label>
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
  }
}
