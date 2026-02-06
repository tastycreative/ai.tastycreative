"use client";

import { useRef, useState, useMemo } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { StickerOverlay, StickerAnimation } from "@/lib/gif-maker/types";
import { STICKER_CATEGORIES, STICKER_PRESETS } from "@/lib/gif-maker/sticker-presets";

const STICKER_ANIMATIONS: { value: StickerAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "bounce", label: "Bounce" },
  { value: "spin", label: "Spin" },
  { value: "pulse", label: "Pulse" },
  { value: "wobble", label: "Wobble" },
  { value: "float", label: "Float" },
];

const inputClass =
  "w-full h-7 px-2 bg-[#1a1b2e] border border-[#252640] rounded text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] outline-none transition-all duration-150";

interface StickerOverlayPropertiesProps {
  overlay: StickerOverlay;
}

export function StickerOverlayProperties({ overlay }: StickerOverlayPropertiesProps) {
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState("popular");
  const [searchQuery, setSearchQuery] = useState("");

  const update = (updates: Partial<StickerOverlay>) => {
    updateOverlay(overlay.id, updates);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    update({ src: url, isEmoji: false });
  };

  const filteredStickers = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return STICKER_PRESETS.filter((s) => s.label.toLowerCase().includes(q));
    }
    return STICKER_PRESETS.filter((s) => s.category === activeCategory);
  }, [activeCategory, searchQuery]);

  const animation = overlay.animation ?? "none";
  const animDuration = overlay.animationDurationFrames ?? 30;
  const flipH = overlay.flipH ?? false;
  const flipV = overlay.flipV ?? false;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-[#e6e8f0]">Sticker</h4>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search stickers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputClass} pl-7`}
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4d5578]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4d5578] hover:text-[#e6e8f0] text-xs"
          >
            ×
          </button>
        )}
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#252640]">
          {STICKER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-colors duration-150 ${
                activeCategory === cat.id
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#1a1b2e] text-[#8490b0] hover:bg-[#1e2038] hover:text-[#e6e8f0] border border-[#252640]"
              }`}
            >
              <span className="mr-0.5">{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Sticker Grid */}
      <div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-[#252640]">
        {filteredStickers.map((sticker) => {
          const isActive = overlay.src === sticker.src;
          return (
            <button
              key={sticker.id}
              title={sticker.label}
              onClick={() => update({ src: sticker.src, isEmoji: sticker.isEmoji })}
              className={`aspect-square flex items-center justify-center rounded transition-all duration-150 hover:scale-110 ${
                isActive
                  ? "bg-[rgba(59,130,246,0.15)] ring-1 ring-[#3b82f6]"
                  : "hover:bg-[#1e2038]"
              }`}
            >
              {sticker.isEmoji ? (
                <span className="text-xl leading-none">{sticker.src}</span>
              ) : (
                <img
                  src={sticker.src}
                  alt={sticker.label}
                  className="w-7 h-7 object-contain"
                  draggable={false}
                />
              )}
            </button>
          );
        })}
        {filteredStickers.length === 0 && (
          <div className="col-span-5 text-center text-xs text-[#4d5578] py-4">
            No stickers found
          </div>
        )}
      </div>

      {/* Upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-7 bg-[#1a1b2e] border border-[#252640] hover:border-[#354065] hover:bg-[#1e2038] rounded text-xs text-[#8490b0] hover:text-[#e6e8f0] transition-all duration-150"
      >
        Upload Image
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

      {/* Controls */}
      <div className="space-y-2.5 pt-3 border-t border-[#252640]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">Controls</h5>

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

        <div className="space-y-1.5">
          <label className="text-xs text-[#8490b0]">Opacity: {Math.round(overlay.opacity * 100)}%</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={overlay.opacity}
            onChange={(e) => update({ opacity: Number(e.target.value) })}
            className="w-full h-1.5 accent-[#3b82f6]"
          />
        </div>

        {/* Flip Controls */}
        <div className="space-y-1.5">
          <label className="text-xs text-[#8490b0]">Flip</label>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => update({ flipH: !flipH })}
              className={`px-2 py-1.5 text-xs rounded transition-colors duration-150 ${
                flipH
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#1a1b2e] text-[#8490b0] hover:bg-[#1e2038] hover:text-[#e6e8f0] border border-[#252640]"
              }`}
            >
              ↔ Horizontal
            </button>
            <button
              onClick={() => update({ flipV: !flipV })}
              className={`px-2 py-1.5 text-xs rounded transition-colors duration-150 ${
                flipV
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#1a1b2e] text-[#8490b0] hover:bg-[#1e2038] hover:text-[#e6e8f0] border border-[#252640]"
              }`}
            >
              ↕ Vertical
            </button>
          </div>
        </div>
      </div>

      {/* Animation */}
      <div className="space-y-2.5 pt-3 border-t border-[#252640]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">Animation</h5>

        <div className="space-y-1.5">
          <label className="text-xs text-[#8490b0]">Type</label>
          <select
            value={animation}
            onChange={(e) => update({ animation: e.target.value as StickerAnimation })}
            className={inputClass}
          >
            {STICKER_ANIMATIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {animation !== "none" && (
          <div className="space-y-1.5">
            <label className="text-xs text-[#8490b0]">
              Duration: {animDuration}f
            </label>
            <input
              type="range"
              min={5}
              max={60}
              value={animDuration}
              onChange={(e) => update({ animationDurationFrames: Number(e.target.value) })}
              className="w-full h-1.5 accent-[#3b82f6]"
            />
          </div>
        )}
      </div>

      {/* Timing */}
      <div className="space-y-2.5 pt-3 border-t border-[#252640]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">Timing</h5>
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
