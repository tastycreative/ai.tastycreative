"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { TextOverlay, TextAnimation } from "@/lib/gif-maker/types";

const TEXT_ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Slide Up" },
  { value: "typewriter", label: "Typewriter" },
  { value: "scale-in", label: "Scale In" },
];

const inputClass =
  "w-full h-7 px-2 bg-[#1a1b2e] border border-[#252640] rounded text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] outline-none transition-all duration-150";

interface TextOverlayPropertiesProps {
  overlay: TextOverlay;
}

export function TextOverlayProperties({ overlay }: TextOverlayPropertiesProps) {
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);

  const update = (updates: Partial<TextOverlay>) => {
    updateOverlay(overlay.id, updates);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[#e6e8f0]">Text Overlay</h4>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Text</label>
        <textarea
          value={overlay.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={2}
          className={`${inputClass} h-auto py-1.5 resize-none`}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Font Size: {overlay.fontSize}px</label>
        <input
          type="range"
          min={12}
          max={120}
          value={overlay.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          className="w-full h-1.5 accent-[#3b82f6]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Weight: {overlay.fontWeight}</label>
        <input
          type="range"
          min={100}
          max={900}
          step={100}
          value={overlay.fontWeight}
          onChange={(e) => update({ fontWeight: Number(e.target.value) })}
          className="w-full h-1.5 accent-[#3b82f6]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-[#8490b0]">Color</label>
          <input
            type="color"
            value={overlay.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-full h-7 rounded cursor-pointer bg-[#1a1b2e] border border-[#252640]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[#8490b0]">Background</label>
          <input
            type="color"
            value={overlay.backgroundColor.startsWith("rgba") ? "#000000" : overlay.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="w-full h-7 rounded cursor-pointer bg-[#1a1b2e] border border-[#252640]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Align</label>
        <div className="grid grid-cols-3 gap-1">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              onClick={() => update({ textAlign: align })}
              className={`px-2 py-1.5 text-xs rounded transition-colors duration-150 ${
                overlay.textAlign === align
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#1a1b2e] text-[#8490b0] hover:bg-[#1e2038] hover:text-[#e6e8f0] border border-[#252640]"
              }`}
            >
              {align.charAt(0).toUpperCase() + align.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Animation</label>
        <select
          value={overlay.animation}
          onChange={(e) => update({ animation: e.target.value as TextAnimation })}
          className={inputClass}
        >
          {TEXT_ANIMATIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {overlay.animation !== "none" && (
        <div className="space-y-1.5">
          <label className="text-xs text-[#8490b0]">
            Animation Duration: {overlay.animationDurationFrames}f
          </label>
          <input
            type="range"
            min={5}
            max={60}
            value={overlay.animationDurationFrames}
            onChange={(e) => update({ animationDurationFrames: Number(e.target.value) })}
            className="w-full h-1.5 accent-[#3b82f6]"
          />
        </div>
      )}

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
              onChange={(e) => update({ startFrame: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#4d5578]">Duration</label>
            <input
              type="number"
              min={1}
              value={overlay.durationInFrames}
              onChange={(e) => update({ durationInFrames: Math.max(1, Number(e.target.value)) })}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
