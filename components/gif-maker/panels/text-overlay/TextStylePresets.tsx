"use client";

import { memo } from "react";
import type { TextOverlay } from "@/lib/gif-maker/types";

interface TextStylePreset {
  id: string;
  label: string;
  props: Partial<TextOverlay>;
}

/** Shared base for OF-style Impact presets */
const OF_PRESET_BASE: Partial<TextOverlay> = {
  fontFamily: "Impact",
  fontWeight: 400,
  fontSize: 56,
  backgroundColor: "transparent",
  backgroundOpacity: 0,
  strokeWidth: 3,
  strokeColor: "#000000",
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  shadowBlur: 4,
  shadowColor: "rgba(0,0,0,0.8)",
  textTransform: "uppercase",
  useGradient: false,
};

/** Create an OF-style preset with color overrides */
function ofPreset(overrides: Partial<TextOverlay>): Partial<TextOverlay> {
  return { ...OF_PRESET_BASE, ...overrides };
}

const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: "of-bold",
    label: "OF Bold",
    props: ofPreset({ color: "#ffffff" }),
  },
  {
    id: "of-gradient-sunset",
    label: "Gradient",
    props: ofPreset({
      color: "#FF6B35",
      useGradient: true,
      gradientColors: ["#FF6B35", "#FFD700"],
      gradientAngle: 180,
    }),
  },
  {
    id: "of-accent-cyan",
    label: "Cyan Pop",
    props: ofPreset({
      fontSize: 64,
      color: "#00D4FF",
      shadowBlur: 6,
      shadowColor: "rgba(0,212,255,0.4)",
    }),
  },
  {
    id: "of-accent-pink",
    label: "Hot Pink",
    props: ofPreset({
      fontSize: 64,
      color: "#FF1493",
      shadowBlur: 6,
      shadowColor: "rgba(255,20,147,0.4)",
    }),
  },
  {
    id: "of-accent-orange",
    label: "Orange",
    props: ofPreset({ fontSize: 64, color: "#FF8C00" }),
  },
  {
    id: "of-gold",
    label: "Gold",
    props: ofPreset({ color: "#FFD700" }),
  },
  {
    id: "of-neon-green",
    label: "Neon",
    props: ofPreset({
      color: "#39FF14",
      strokeWidth: 2,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 15,
      shadowColor: "#39FF14",
    }),
  },
  {
    id: "of-clean",
    label: "Clean",
    props: {
      fontFamily: "system-ui",
      fontWeight: 700,
      fontSize: 42,
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.6)",
      backgroundOpacity: 0.6,
      strokeWidth: 0,
      shadowBlur: 0,
      borderRadius: 8,
      textTransform: "none",
      useGradient: false,
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
          className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 border border-[#2d3142] hover:border-slate-600 transition-all duration-150"
          style={{
            color: preset.props.useGradient ? preset.props.gradientColors?.[0] : preset.props.color,
            WebkitTextStroke: preset.props.strokeWidth
              ? `${Math.min(preset.props.strokeWidth, 1)}px ${preset.props.strokeColor}`
              : undefined,
            fontFamily: preset.props.fontFamily,
            textTransform: (preset.props.textTransform as React.CSSProperties["textTransform"]) ?? undefined,
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
});
