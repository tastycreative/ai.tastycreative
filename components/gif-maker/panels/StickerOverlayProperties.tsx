"use client";

import { useRef, useState, useMemo } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { StickerOverlay, StickerAnimation } from "@/lib/gif-maker/types";
import { STICKER_CATEGORIES, STICKER_PRESETS } from "@/lib/gif-maker/sticker-presets";
import {
  Search,
  X,
  Upload,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Sparkles,
  Clock,
  SlidersHorizontal,
} from "lucide-react";

const STICKER_ANIMATIONS: { value: StickerAnimation; label: string; desc: string }[] = [
  { value: "none", label: "None", desc: "Static" },
  { value: "bounce", label: "Bounce", desc: "Up & down" },
  { value: "spin", label: "Spin", desc: "360° rotate" },
  { value: "pulse", label: "Pulse", desc: "Scale pulse" },
  { value: "wobble", label: "Wobble", desc: "Side wobble" },
  { value: "float", label: "Float", desc: "Gentle drift" },
];

const inputClass =
  "w-full h-8 px-2.5 bg-[#0f111a] border border-[#2d3142] rounded-lg text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150";

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <span className="text-sm leading-none">
            {overlay.isEmoji ? overlay.src : "🎨"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-100">Sticker</h4>
          <p className="text-[10px] text-slate-500">Choose or upload a sticker</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search stickers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputClass} pl-8 pr-8`}
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-2.5 h-2.5 text-slate-300" />
          </button>
        )}
      </div>

      {/* Category Tabs - pill style */}
      {!searchQuery && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-[#2d3142]">
          {STICKER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-150 ${
                activeCategory === cat.id
                  ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40"
                  : "bg-[#0f111a] text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-[#2d3142]"
              }`}
            >
              <span className="text-xs leading-none">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Sticker Grid */}
      <div className="grid grid-cols-6 gap-0.5 max-h-[180px] overflow-y-auto rounded-xl bg-[#0f111a] border border-[#2d3142] p-1.5 scrollbar-thin scrollbar-thumb-[#2d3142]">
        {filteredStickers.map((sticker) => {
          const isActive = overlay.src === sticker.src;
          return (
            <button
              key={sticker.id}
              title={sticker.label}
              onClick={() => update({ src: sticker.src, isEmoji: sticker.isEmoji })}
              className={`aspect-square flex items-center justify-center rounded-lg transition-all duration-150 hover:scale-110 ${
                isActive
                  ? "bg-indigo-500/20 ring-1.5 ring-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.25)]"
                  : "hover:bg-slate-800"
              }`}
            >
              {sticker.isEmoji ? (
                <span className="text-lg leading-none">{sticker.src}</span>
              ) : (
                <img
                  src={sticker.src}
                  alt={sticker.label}
                  className="w-6 h-6 object-contain"
                  draggable={false}
                />
              )}
            </button>
          );
        })}
        {filteredStickers.length === 0 && (
          <div className="col-span-6 text-center text-xs text-slate-500 py-6">
            No stickers found
          </div>
        )}
      </div>

      {/* Upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-8 flex items-center justify-center gap-1.5 bg-[#0f111a] border border-dashed border-[#2d3142] hover:border-indigo-500/40 hover:bg-indigo-500/5 rounded-lg text-xs text-slate-500 hover:text-indigo-300 transition-all duration-200 group"
      >
        <Upload className="w-3.5 h-3.5 group-hover:text-indigo-400 transition-colors" />
        Upload Custom Image
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

      {/* Transform Controls */}
      <div className="space-y-3 pt-3 border-t border-[#2d3142]">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3 h-3 text-slate-500" />
          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Transform</h5>
        </div>

        {/* Rotation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <RotateCw className="w-3 h-3" />
              Rotation
            </label>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
              {overlay.rotation}°
            </span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            value={overlay.rotation}
            onChange={(e) => update({ rotation: Number(e.target.value) })}
            className="w-full pro-slider"
          />
        </div>

        {/* Opacity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">Opacity</label>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
              {Math.round(overlay.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={overlay.opacity}
            onChange={(e) => update({ opacity: Number(e.target.value) })}
            className="w-full pro-slider"
          />
        </div>

        {/* Flip Controls */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => update({ flipH: !flipH })}
            className={`flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg transition-all duration-150 ${
              flipH
                ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40"
                : "bg-[#0f111a] text-slate-500 hover:text-slate-300 border border-[#2d3142] hover:border-slate-600"
            }`}
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
            Flip H
          </button>
          <button
            onClick={() => update({ flipV: !flipV })}
            className={`flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg transition-all duration-150 ${
              flipV
                ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40"
                : "bg-[#0f111a] text-slate-500 hover:text-slate-300 border border-[#2d3142] hover:border-slate-600"
            }`}
          >
            <FlipVertical2 className="w-3.5 h-3.5" />
            Flip V
          </button>
        </div>
      </div>

      {/* Animation */}
      <div className="space-y-3 pt-3 border-t border-[#2d3142]">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-slate-500" />
          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Animation</h5>
        </div>

        {/* Animation Type Grid */}
        <div className="grid grid-cols-3 gap-1">
          {STICKER_ANIMATIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ animation: opt.value })}
              className={`px-1.5 py-2 rounded-lg text-center transition-all duration-150 ${
                animation === opt.value
                  ? "bg-indigo-500/15 ring-1 ring-indigo-500/40"
                  : "bg-[#0f111a] border border-[#2d3142] hover:border-slate-600"
              }`}
            >
              <div className={`text-[10px] font-semibold ${animation === opt.value ? "text-indigo-300" : "text-slate-300"}`}>
                {opt.label}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>

        {animation !== "none" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Speed</label>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                {animDuration}f
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              value={animDuration}
              onChange={(e) => update({ animationDurationFrames: Number(e.target.value) })}
              className="w-full pro-slider"
            />
          </div>
        )}
      </div>

      {/* Timing */}
      <div className="space-y-3 pt-3 border-t border-[#2d3142]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-500" />
          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Timing</h5>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-slate-500">Start Frame</label>
            <input
              type="number"
              min={0}
              value={overlay.startFrame}
              onChange={(e) => update({ startFrame: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-slate-500">Duration</label>
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
