"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { ShapeOverlay, ShapeType } from "@/lib/gif-maker/types";

const SHAPE_OPTIONS: { value: ShapeType; label: string }[] = [
  { value: "rect", label: "Rectangle" },
  { value: "circle", label: "Circle" },
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
];

const inputClass =
  "w-full h-7 px-2 bg-[#1a1b2e] border border-[#252640] rounded text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] outline-none transition-all duration-150";

interface ShapeOverlayPropertiesProps {
  overlay: ShapeOverlay;
}

export function ShapeOverlayProperties({ overlay }: ShapeOverlayPropertiesProps) {
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);

  const update = (updates: Partial<ShapeOverlay>) => {
    updateOverlay(overlay.id, updates);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[#e6e8f0]">Shape</h4>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Type</label>
        <select
          value={overlay.shapeType}
          onChange={(e) => update({ shapeType: e.target.value as ShapeType })}
          className={inputClass}
        >
          {SHAPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-[#8490b0]">Fill</label>
          <input
            type="color"
            value={overlay.fill.startsWith("rgba") ? "#ff0000" : overlay.fill}
            onChange={(e) => update({ fill: e.target.value })}
            className="w-full h-7 rounded cursor-pointer bg-[#1a1b2e] border border-[#252640]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[#8490b0]">Stroke</label>
          <input
            type="color"
            value={overlay.stroke}
            onChange={(e) => update({ stroke: e.target.value })}
            className="w-full h-7 rounded cursor-pointer bg-[#1a1b2e] border border-[#252640]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Stroke Width: {overlay.strokeWidth}</label>
        <input type="range" min={0} max={10} value={overlay.strokeWidth} onChange={(e) => update({ strokeWidth: Number(e.target.value) })} className="w-full h-1.5 accent-[#3b82f6]" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Rotation: {overlay.rotation}°</label>
        <input type="range" min={-180} max={180} value={overlay.rotation} onChange={(e) => update({ rotation: Number(e.target.value) })} className="w-full h-1.5 accent-[#3b82f6]" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Opacity: {Math.round(overlay.opacity * 100)}%</label>
        <input type="range" min={0} max={1} step={0.05} value={overlay.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} className="w-full h-1.5 accent-[#3b82f6]" />
      </div>

      <div className="space-y-2.5 pt-3 border-t border-[#252640]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">Timing</h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-[#4d5578]">Start Frame</label>
            <input type="number" min={0} value={overlay.startFrame} onChange={(e) => update({ startFrame: Math.max(0, Number(e.target.value)) })} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#4d5578]">Duration</label>
            <input type="number" min={1} value={overlay.durationInFrames} onChange={(e) => update({ durationInFrames: Math.max(1, Number(e.target.value)) })} className={inputClass} />
          </div>
        </div>
      </div>
    </div>
  );
}
