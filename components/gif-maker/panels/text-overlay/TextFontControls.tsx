"use client";

import { memo } from "react";
import type { TextOverlay } from "@/lib/gif-maker/types";

const FONT_FAMILIES = [
  { value: "system-ui", label: "System" },
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times" },
  { value: "Courier New", label: "Courier" },
  { value: "Impact", label: "Impact" },
  { value: "Comic Sans MS", label: "Comic Sans" },
  { value: "Trebuchet MS", label: "Trebuchet" },
  { value: "Verdana", label: "Verdana" },
  { value: "Palatino", label: "Palatino" },
  { value: "Futura", label: "Futura" },
];

const inputClass =
  "w-full h-7 px-2 bg-slate-900 border border-[#2d3142] rounded-md text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150";

interface TextFontControlsProps {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textTransform: "none" | "uppercase" | "lowercase";
  onUpdate: (updates: Partial<TextOverlay>) => void;
}

export const TextFontControls = memo(function TextFontControls({
  fontFamily,
  fontSize,
  fontWeight,
  textTransform,
  onUpdate,
}: TextFontControlsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Family</label>
        <select
          value={fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className={inputClass}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Size: {fontSize}px</label>
        <input
          type="range"
          min={12}
          max={120}
          value={fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          className="w-full h-1.5 pro-slider"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Weight: {fontWeight}</label>
        <input
          type="range"
          min={100}
          max={900}
          step={100}
          value={fontWeight}
          onChange={(e) => onUpdate({ fontWeight: Number(e.target.value) })}
          className="w-full h-1.5 pro-slider"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Transform</label>
        <div className="grid grid-cols-3 gap-1">
          {([
            { value: "none", label: "Aa" },
            { value: "uppercase", label: "AA" },
            { value: "lowercase", label: "aa" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ textTransform: opt.value })}
              className={`px-2 py-1.5 text-xs rounded transition-colors duration-150 ${
                textTransform === opt.value
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100 border border-[#2d3142]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
});
