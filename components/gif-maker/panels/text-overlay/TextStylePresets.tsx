"use client";

import { memo } from "react";
import type { TextOverlay } from "@/lib/gif-maker/types";

interface TextStylePreset {
  id: string;
  label: string;
  props: Partial<TextOverlay>;
}

const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: "classic",
    label: "Classic",
    props: {
      fontFamily: "system-ui",
      fontWeight: 700,
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.5)",
      backgroundOpacity: 0.5,
      strokeWidth: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      borderRadius: 4,
    },
  },
  {
    id: "neon",
    label: "Neon",
    props: {
      color: "#39FF14",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowColor: "#39FF14",
      shadowBlur: 20,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    },
  },
  {
    id: "bold",
    label: "Bold",
    props: {
      fontWeight: 900,
      fontSize: 64,
      color: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 3,
      strokeColor: "#000000",
      shadowBlur: 0,
    },
  },
  {
    id: "outline",
    label: "Outline",
    props: {
      color: "transparent",
      strokeWidth: 3,
      strokeColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      shadowBlur: 0,
    },
  },
  {
    id: "shadow",
    label: "Shadow",
    props: {
      color: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      shadowBlur: 0,
      shadowColor: "#000000",
    },
  },
  {
    id: "retro",
    label: "Retro",
    props: {
      fontFamily: "Georgia",
      color: "#FFD700",
      backgroundColor: "#8B0000",
      backgroundOpacity: 1,
      borderRadius: 0,
      strokeWidth: 0,
      shadowBlur: 0,
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    props: {
      fontWeight: 300,
      fontSize: 36,
      color: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowBlur: 0,
    },
  },
  {
    id: "tag",
    label: "Tag",
    props: {
      fontSize: 24,
      fontWeight: 600,
      backgroundColor: "#3b82f6",
      backgroundOpacity: 1,
      color: "#ffffff",
      borderRadius: 20,
      strokeWidth: 0,
      shadowBlur: 0,
    },
  },
];

interface TextStylePresetsProps {
  onApplyPreset: (props: Partial<TextOverlay>) => void;
}

export const TextStylePresets = memo(function TextStylePresets({ onApplyPreset }: TextStylePresetsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {TEXT_STYLE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onApplyPreset(preset.props)}
          className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100 border border-[#2d3142] hover:border-slate-600 transition-all duration-150"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
});
