"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { Settings2, ChevronDown } from "lucide-react";
import type { GifExportSettings } from "@/lib/gif-maker/types";

export function ExportSettingsDropdown() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const gifExportSettings = useVideoEditorStore((s) => s.gifExportSettings);
  const updateGifExportSettings = useVideoEditorStore((s) => s.updateGifExportSettings);
  const setGifQualityPreset = useVideoEditorStore((s) => s.setGifQualityPreset);
  const settings = useVideoEditorStore((s) => s.settings);
  const totalDurationInFrames = useVideoEditorStore((s) => s.totalDurationInFrames);
  const clips = useVideoEditorStore((s) => s.clips);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Position dropdown relative to button
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      left: Math.max(8, rect.left - 200), // offset left so it doesn't overflow right edge
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Estimate file size based on settings
  const estimateSize = () => {
    if (clips.length === 0) return "—";
    const w = gifExportSettings.maxWidth ?? settings.width;
    const h = gifExportSettings.maxWidth && settings.width > 0
      ? Math.round((settings.height / settings.width) * gifExportSettings.maxWidth)
      : settings.height;
    const totalFrames = Math.ceil(totalDurationInFrames / gifExportSettings.frameSkip);

    const bytesPerPixel = gifExportSettings.colorCount <= 64 ? 0.3 : gifExportSettings.colorCount <= 128 ? 0.5 : 0.8;
    const rawBytes = w * h * totalFrames * bytesPerPixel;

    if (rawBytes < 1024) return `~${Math.round(rawBytes)} B`;
    if (rawBytes < 1024 * 1024) return `~${Math.round(rawBytes / 1024)} KB`;
    return `~${(rawBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const presets: { key: "high" | "medium" | "low"; label: string }[] = [
    { key: "high", label: "High Quality" },
    { key: "medium", label: "Balanced" },
    { key: "low", label: "Small File" },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
          open
            ? "bg-brand-light-pink/20 text-brand-light-pink"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
        }`}
        title="Export Settings"
      >
        <Settings2 className="h-4 w-4" />
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-72 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/50 p-4 z-[9999]"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100">Export Settings</h3>
            <span className="text-xs font-mono text-brand-blue">{estimateSize()}</span>
          </div>

          {/* Quality Presets */}
          <div className="flex gap-1.5 mb-4">
            {presets.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setGifQualityPreset(key)}
                className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                  gifExportSettings.quality === key
                    ? "bg-brand-light-pink text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Advanced Controls */}
          <div className="space-y-3">
            {/* Colors */}
            <SettingRow label="Colors">
              <select
                value={gifExportSettings.colorCount}
                onChange={(e) => updateGifExportSettings({ colorCount: Number(e.target.value) as GifExportSettings["colorCount"] })}
                className="w-20 h-7 px-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 outline-none"
              >
                <option value={256}>256</option>
                <option value={128}>128</option>
                <option value={64}>64</option>
                <option value={32}>32</option>
              </select>
            </SettingRow>

            {/* Dithering */}
            <SettingRow label="Dithering">
              <ToggleSwitch
                checked={gifExportSettings.dithering}
                onChange={(v) => updateGifExportSettings({ dithering: v })}
              />
            </SettingRow>

            {/* Lossy Compression (future — requires encoder upgrade) */}
            <SettingRow label={`Lossy ${gifExportSettings.lossy}%`}>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={gifExportSettings.lossy}
                  onChange={(e) => updateGifExportSettings({ lossy: Number(e.target.value) })}
                  className="w-20 h-1 accent-brand-light-pink opacity-40"
                  disabled
                />
                <span className="text-[9px] text-zinc-600">Soon</span>
              </div>
            </SettingRow>

            {/* Output FPS */}
            <SettingRow label="FPS">
              <select
                value={gifExportSettings.outputFps}
                onChange={(e) => updateGifExportSettings({ outputFps: Number(e.target.value) as GifExportSettings["outputFps"] })}
                className="w-16 h-7 px-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 outline-none"
              >
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={24}>24</option>
              </select>
            </SettingRow>

            {/* Frame Skip */}
            <SettingRow label="Frame Skip">
              <select
                value={gifExportSettings.frameSkip}
                onChange={(e) => updateGifExportSettings({ frameSkip: Number(e.target.value) as GifExportSettings["frameSkip"] })}
                className="w-20 h-7 px-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 outline-none"
              >
                <option value={1}>None</option>
                <option value={2}>Every 2nd</option>
                <option value={3}>Every 3rd</option>
                <option value={4}>Every 4th</option>
              </select>
            </SettingRow>

            {/* Max Width */}
            <SettingRow label="Max Width">
              <select
                value={gifExportSettings.maxWidth ?? "full"}
                onChange={(e) => updateGifExportSettings({ maxWidth: e.target.value === "full" ? null : Number(e.target.value) })}
                className="w-20 h-7 px-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 outline-none"
              >
                <option value="full">Full</option>
                <option value={800}>800px</option>
                <option value={600}>600px</option>
                <option value={480}>480px</option>
                <option value={320}>320px</option>
              </select>
            </SettingRow>

            {/* Optimize Frames (future — requires encoder with disposal mode support) */}
            <SettingRow label="Frame Optimization">
              <div className="flex items-center gap-1.5">
                <ToggleSwitch
                  checked={gifExportSettings.optimizeFrames}
                  onChange={(v) => updateGifExportSettings({ optimizeFrames: v })}
                  disabled
                />
                <span className="text-[9px] text-zinc-600">Soon</span>
              </div>
            </SettingRow>
          </div>

          <p className="text-[10px] text-zinc-500 mt-3">
            Lower colors + lossy compression = smaller files. Dithering smooths color banding.
          </p>
        </div>,
        document.body
      )}
    </>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${checked ? "bg-brand-light-pink" : "bg-zinc-700"}`}
      disabled={disabled}
    >
      <div
        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
