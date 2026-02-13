"use client";

import { useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import type { TextOverlay } from "@/lib/gif-maker/types";
import { Section } from "./text-overlay/Section";
import { TextStylePresets } from "./text-overlay/TextStylePresets";
import { TextFontControls } from "./text-overlay/TextFontControls";
import { TextAnimationControls } from "./text-overlay/TextAnimationControls";

const inputClass =
  "w-full h-7 px-2 bg-slate-900 border border-[#2d3142] rounded-md text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150";

interface TextOverlayPropertiesProps {
  overlay: TextOverlay;
}

export function TextOverlayProperties({ overlay }: TextOverlayPropertiesProps) {
  // Optimize: Use shallow selector to only get the update function
  const updateOverlay = useVideoEditorStore(
    useShallow((s) => s.updateOverlay)
  );

  const update = useCallback(
    (updates: Partial<TextOverlay>) => {
      updateOverlay(overlay.id, updates);
    },
    [updateOverlay, overlay.id]
  );

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

      {/* Style Presets - Memoized */}
      <Section title="Style Presets" defaultOpen={true}>
        <TextStylePresets onApplyPreset={update} />
      </Section>

      {/* Font Controls - Memoized */}
      <Section title="Font" defaultOpen={true}>
        <TextFontControls
          fontFamily={overlay.fontFamily}
          fontSize={overlay.fontSize}
          fontWeight={overlay.fontWeight}
          textTransform={textTransform}
          onUpdate={update}
        />
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

      {/* Animation - Memoized */}
      <Section title="Animation" defaultOpen={true}>
        <TextAnimationControls
          animation={overlay.animation}
          animationDurationFrames={overlay.animationDurationFrames}
          onUpdate={update}
        />
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
