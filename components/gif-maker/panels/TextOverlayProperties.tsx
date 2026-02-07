"use client";

import { useState } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
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

const inputClass =
  "w-full h-7 px-2 bg-slate-900 border border-[#2d3142] rounded-md text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150";

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#2d3142] pt-2.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400 transition-colors"
      >
        {title}
        <svg className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="mt-2 space-y-2.5">{children}</div>}
    </div>
  );
}

interface TextOverlayPropertiesProps {
  overlay: TextOverlay;
}

export function TextOverlayProperties({ overlay }: TextOverlayPropertiesProps) {
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);

  const update = (updates: Partial<TextOverlay>) => {
    updateOverlay(overlay.id, updates);
  };

  // Resolve optional fields with defaults
  const letterSpacing = overlay.letterSpacing ?? 0;
  const lineHeight = overlay.lineHeight ?? 1.3;
  const textTransform = overlay.textTransform ?? "none";
  const opacity = overlay.opacity ?? 1;
  const borderRadius = overlay.borderRadius ?? 4;
  const backgroundOpacity = overlay.backgroundOpacity ?? 0.5;
  const strokeWidth = overlay.strokeWidth ?? 0;
  const strokeColor = overlay.strokeColor ?? "#000000";
  const shadowOffsetX = overlay.shadowOffsetX ?? 0;
  const shadowOffsetY = overlay.shadowOffsetY ?? 0;
  const shadowBlur = overlay.shadowBlur ?? 0;
  const shadowColor = overlay.shadowColor ?? "rgba(0,0,0,0.5)";

  // Extract hex from shadowColor for color input
  const shadowColorHex = shadowColor.startsWith("rgba")
    ? "#000000"
    : shadowColor.startsWith("#")
      ? shadowColor
      : "#000000";

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate-100">Text Overlay</h4>

      {/* Text Input */}
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Text</label>
        <textarea
          value={overlay.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={2}
          className={`${inputClass} h-auto py-1.5 resize-none`}
        />
      </div>

      {/* Style Presets */}
      <Section title="Style Presets" defaultOpen={true}>
        <div className="flex flex-wrap gap-1">
          {TEXT_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => update(preset.props)}
              className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100 border border-[#2d3142] hover:border-slate-600 transition-all duration-150"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Font */}
      <Section title="Font" defaultOpen={true}>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Family</label>
          <select
            value={overlay.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
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
          <label className="text-xs text-slate-400">Size: {overlay.fontSize}px</label>
          <input
            type="range"
            min={12}
            max={120}
            value={overlay.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Weight: {overlay.fontWeight}</label>
          <input
            type="range"
            min={100}
            max={900}
            step={100}
            value={overlay.fontWeight}
            onChange={(e) => update({ fontWeight: Number(e.target.value) })}
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
                onClick={() => update({ textTransform: opt.value })}
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
      </Section>

      {/* Spacing */}
      <Section title="Spacing" defaultOpen={false}>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Letter Spacing: {letterSpacing}px</label>
          <input
            type="range"
            min={-5}
            max={20}
            step={0.5}
            value={letterSpacing}
            onChange={(e) => update({ letterSpacing: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Line Height: {lineHeight.toFixed(1)}</label>
          <input
            type="range"
            min={0.8}
            max={3}
            step={0.1}
            value={lineHeight}
            onChange={(e) => update({ lineHeight: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      </Section>

      {/* Color */}
      <Section title="Color" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Text</label>
            <input
              type="color"
              value={overlay.color === "transparent" ? "#000000" : overlay.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-full h-7 rounded cursor-pointer bg-slate-800 border border-[#2d3142]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Background</label>
            <input
              type="color"
              value={
                overlay.backgroundColor === "transparent"
                  ? "#000000"
                  : overlay.backgroundColor.startsWith("rgba")
                    ? "#000000"
                    : overlay.backgroundColor
              }
              onChange={(e) => update({ backgroundColor: e.target.value })}
              className="w-full h-7 rounded cursor-pointer bg-slate-800 border border-[#2d3142]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Bg Opacity: {Math.round(backgroundOpacity * 100)}%</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={backgroundOpacity}
            onChange={(e) => update({ backgroundOpacity: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      </Section>

      {/* Effects */}
      <Section title="Effects" defaultOpen={false}>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Stroke Width: {strokeWidth}px</label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={strokeWidth}
            onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>

        {strokeWidth > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Stroke Color</label>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => update({ strokeColor: e.target.value })}
              className="w-full h-7 rounded cursor-pointer bg-slate-800 border border-[#2d3142]"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Shadow</label>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="space-y-0.5">
              <label className="text-[9px] text-slate-500">X</label>
              <input
                type="number"
                min={-20}
                max={20}
                value={shadowOffsetX}
                onChange={(e) => update({ shadowOffsetX: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[9px] text-slate-500">Y</label>
              <input
                type="number"
                min={-20}
                max={20}
                value={shadowOffsetY}
                onChange={(e) => update({ shadowOffsetY: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[9px] text-slate-500">Blur</label>
              <input
                type="number"
                min={0}
                max={50}
                value={shadowBlur}
                onChange={(e) => update({ shadowBlur: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {(shadowOffsetX !== 0 || shadowOffsetY !== 0 || shadowBlur !== 0) && (
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Shadow Color</label>
            <input
              type="color"
              value={shadowColorHex}
              onChange={(e) => update({ shadowColor: e.target.value })}
              className="w-full h-7 rounded cursor-pointer bg-slate-800 border border-[#2d3142]"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Opacity: {Math.round(opacity * 100)}%</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => update({ opacity: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Border Radius: {borderRadius}px</label>
          <input
            type="range"
            min={0}
            max={40}
            value={borderRadius}
            onChange={(e) => update({ borderRadius: Number(e.target.value) })}
            className="w-full h-1.5 pro-slider"
          />
        </div>
      </Section>

      {/* Alignment */}
      <Section title="Alignment" defaultOpen={true}>
        <div className="grid grid-cols-3 gap-1">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              onClick={() => update({ textAlign: align })}
              className={`px-2 py-1.5 text-xs rounded transition-colors duration-150 ${
                overlay.textAlign === align
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100 border border-[#2d3142]"
              }`}
            >
              {align.charAt(0).toUpperCase() + align.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      {/* Animation */}
      <Section title="Animation" defaultOpen={true}>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Type</label>
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
            <label className="text-xs text-slate-400">
              Duration: {overlay.animationDurationFrames}f
            </label>
            <input
              type="range"
              min={5}
              max={60}
              value={overlay.animationDurationFrames}
              onChange={(e) => update({ animationDurationFrames: Number(e.target.value) })}
              className="w-full h-1.5 pro-slider"
            />
          </div>
        )}
      </Section>

      {/* Timing */}
      <Section title="Timing" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Start Frame</label>
            <input
              type="number"
              min={0}
              value={overlay.startFrame}
              onChange={(e) => update({ startFrame: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Duration</label>
            <input
              type="number"
              min={1}
              value={overlay.durationInFrames}
              onChange={(e) => update({ durationInFrames: Math.max(1, Number(e.target.value)) })}
              className={inputClass}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
