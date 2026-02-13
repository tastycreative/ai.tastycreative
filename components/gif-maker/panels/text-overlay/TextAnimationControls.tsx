"use client";

import { memo } from "react";
import type { TextOverlay, TextAnimation } from "@/lib/gif-maker/types";

const TEXT_ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Slide Up" },
  { value: "slide-down", label: "Slide Down" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "typewriter", label: "Typewriter" },
  { value: "scale-in", label: "Scale In" },
  { value: "bounce", label: "Bounce" },
  { value: "blur-in", label: "Blur In" },
  { value: "glow", label: "Glow" },
  { value: "pop", label: "Pop" },
];

const inputClass =
  "w-full h-7 px-2 bg-slate-900 border border-[#2d3142] rounded-md text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150";

interface TextAnimationControlsProps {
  animation: TextAnimation;
  animationDurationFrames: number;
  onUpdate: (updates: Partial<TextOverlay>) => void;
}

export const TextAnimationControls = memo(function TextAnimationControls({
  animation,
  animationDurationFrames,
  onUpdate,
}: TextAnimationControlsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Type</label>
        <select
          value={animation}
          onChange={(e) => onUpdate({ animation: e.target.value as TextAnimation })}
          className={inputClass}
        >
          {TEXT_ANIMATIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {animation !== "none" && (
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">
            Duration: {animationDurationFrames}f
          </label>
          <input
            type="range"
            min={5}
            max={60}
            value={animationDurationFrames}
            onChange={(e) => onUpdate({ animationDurationFrames: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      )}
    </>
  );
});
