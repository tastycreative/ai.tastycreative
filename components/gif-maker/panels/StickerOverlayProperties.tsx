"use client";

import { useRef } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { StickerOverlay } from "@/lib/gif-maker/types";

const EMOJI_PRESETS = ["⭐", "❤️", "🔥", "💀", "🎯", "✅", "❌", "💎", "👑", "🚀", "💰", "🎬"];

const inputClass =
  "w-full h-7 px-2 bg-[#1a1b2e] border border-[#252640] rounded text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] outline-none transition-all duration-150";

interface StickerOverlayPropertiesProps {
  overlay: StickerOverlay;
}

export function StickerOverlayProperties({ overlay }: StickerOverlayPropertiesProps) {
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (updates: Partial<StickerOverlay>) => {
    updateOverlay(overlay.id, updates);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    update({ src: url, isEmoji: false });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[#e6e8f0]">Sticker</h4>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Emoji</label>
        <div className="grid grid-cols-6 gap-1">
          {EMOJI_PRESETS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => update({ src: emoji, isEmoji: true })}
              className={`text-lg p-1.5 rounded transition-all duration-150 ${
                overlay.isEmoji && overlay.src === emoji
                  ? "bg-[rgba(59,130,246,0.15)] ring-1 ring-[#3b82f6]"
                  : "hover:bg-[#1e2038]"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-8 bg-[#1a1b2e] border border-[#252640] hover:border-[#354065] hover:bg-[#1e2038] rounded-lg text-xs text-[#8490b0] hover:text-[#e6e8f0] transition-all duration-150"
      >
        Upload Image
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Rotation: {overlay.rotation}°</label>
        <input type="range" min={-180} max={180} value={overlay.rotation} onChange={(e) => update({ rotation: Number(e.target.value) })} className="w-full h-1.5 accent-[#3b82f6]" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-[#8490b0]">Opacity: {Math.round(overlay.opacity * 100)}%</label>
        <input type="range" min={0} max={1} step={0.05} value={overlay.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} className="w-full h-1.5 accent-[#3b82f6]" />
      </div>

      <div className="space-y-2.5 pt-3 border-t border-[#252640]">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">Timing</h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-[#4d5578]">Start Frame</label>
            <input type="number" min={0} value={overlay.startFrame} onChange={(e) => update({ startFrame: Math.max(0, Number(e.target.value)) })} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#4d5578]">Duration</label>
            <input type="number" min={1} value={overlay.durationInFrames} onChange={(e) => update({ durationInFrames: Math.max(1, Number(e.target.value)) })} className={inputClass} />
          </div>
        </div>
      </div>
    </div>
  );
}
