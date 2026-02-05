"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { Transition, TransitionType } from "@/lib/gif-maker/types";

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "none", label: "None (Cut)" },
  { value: "fade", label: "Fade" },
  { value: "crossfade", label: "Crossfade" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "wipe", label: "Wipe" },
];

interface TransitionPropertiesProps {
  clipAId: string;
  clipBId: string;
  transition: Transition | null;
}

export function TransitionProperties({
  clipAId,
  clipBId,
  transition,
}: TransitionPropertiesProps) {
  const setTransition = useVideoEditorStore((s) => s.setTransition);
  const removeTransition = useVideoEditorStore((s) => s.removeTransition);

  const currentType: TransitionType = transition?.type || "none";
  const currentDuration = transition?.durationInFrames || 15;

  const handleTypeChange = (type: TransitionType) => {
    if (type === "none" && transition) {
      removeTransition(transition.id);
    } else if (type !== "none") {
      setTransition(clipAId, clipBId, type, currentDuration);
    }
  };

  const handleDurationChange = (frames: number) => {
    if (currentType !== "none") {
      setTransition(clipAId, clipBId, currentType, frames);
    }
  };

  return (
    <div className="space-y-2.5 pt-3 border-t border-[#252640]">
      <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">
        Transition
      </h5>

      <select
        value={currentType}
        onChange={(e) => handleTypeChange(e.target.value as TransitionType)}
        className="w-full h-7 px-2 bg-[#1a1b2e] border border-[#252640] rounded text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] outline-none transition-all duration-150"
      >
        {TRANSITION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {currentType !== "none" && (
        <div className="space-y-1">
          <label className="text-xs text-[#8490b0]">
            Duration: {currentDuration} frames
          </label>
          <input
            type="range"
            min={5}
            max={60}
            value={currentDuration}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            className="w-full h-1.5 accent-[#3b82f6]"
          />
        </div>
      )}
    </div>
  );
}
