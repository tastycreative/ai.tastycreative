"use client";

import { useState } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { Settings, Download, Zap, Star, Crown, FileVideo, FileImage } from "lucide-react";

type QualityPreset = "low" | "medium" | "high" | "ultra";
type ExportFormat = "gif" | "mp4" | "webm";

interface ExportSettings {
  quality: QualityPreset;
  fps: number;
  format: ExportFormat;
  gifQuality: number;
}

const QUALITY_PRESETS = {
  low: {
    label: "Low",
    description: "Faster encoding, smaller file",
    icon: Zap,
    fps: 15,
    gifQuality: 20,
    color: "text-zinc-400",
  },
  medium: {
    label: "Medium",
    description: "Balanced quality and size",
    icon: Settings,
    fps: 24,
    gifQuality: 15,
    color: "text-brand-blue",
  },
  high: {
    label: "High",
    description: "Better quality, larger file",
    icon: Star,
    fps: 30,
    gifQuality: 10,
    color: "text-brand-mid-pink",
  },
  ultra: {
    label: "Ultra",
    description: "Maximum quality",
    icon: Crown,
    fps: 60,
    gifQuality: 5,
    color: "text-brand-light-pink",
  },
};

export function ExportSettingsPanel() {
  const settings = useVideoEditorStore((s) => s.settings);
  const totalDurationInFrames = useVideoEditorStore((s) => s.totalDurationInFrames);

  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    quality: "high",
    fps: 30,
    format: "gif",
    gifQuality: 10,
  });

  // Estimate file size (rough approximation)
  const estimateFileSize = () => {
    const { width, height, fps } = settings;
    const duration = totalDurationInFrames / settings.fps;
    const pixels = width * height;
    const frames = duration * exportSettings.fps;

    let bytesPerFrame;
    if (exportSettings.format === "gif") {
      // GIF: rough estimate based on quality
      bytesPerFrame = (pixels * (40 - exportSettings.gifQuality)) / 10;
    } else {
      // Video: compression ratios
      bytesPerFrame = exportSettings.quality === "ultra" ? pixels * 0.5 : pixels * 0.2;
    }

    const totalBytes = frames * bytesPerFrame;
    const mb = totalBytes / (1024 * 1024);

    return mb > 1 ? `~${mb.toFixed(1)} MB` : `~${(totalBytes / 1024).toFixed(0)} KB`;
  };

  const handleQualityChange = (quality: QualityPreset) => {
    const preset = QUALITY_PRESETS[quality];
    setExportSettings({
      ...exportSettings,
      quality,
      fps: preset.fps,
      gifQuality: preset.gifQuality,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-2">
          <Download className="w-4 h-4 text-brand-light-pink" />
          Export Settings
        </h3>
        <p className="text-xs text-zinc-500">
          Configure quality and format options
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-zinc-300 block">
            Export Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            <FormatButton
              icon={<FileImage className="w-4 h-4" />}
              label="GIF"
              active={exportSettings.format === "gif"}
              onClick={() => setExportSettings({ ...exportSettings, format: "gif" })}
            />
            <FormatButton
              icon={<FileVideo className="w-4 h-4" />}
              label="MP4"
              active={exportSettings.format === "mp4"}
              onClick={() => setExportSettings({ ...exportSettings, format: "mp4" })}
              badge="Soon"
            />
            <FormatButton
              icon={<FileVideo className="w-4 h-4" />}
              label="WebM"
              active={exportSettings.format === "webm"}
              onClick={() => setExportSettings({ ...exportSettings, format: "webm" })}
              badge="Soon"
            />
          </div>
        </div>

        {/* Quality Presets */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-zinc-300 block">
            Quality Preset
          </label>
          <div className="space-y-2">
            {Object.entries(QUALITY_PRESETS).map(([key, preset]) => {
              const Icon = preset.icon;
              const isActive = exportSettings.quality === key;

              return (
                <button
                  key={key}
                  onClick={() => handleQualityChange(key as QualityPreset)}
                  className={`w-full p-3 rounded-lg border transition-all duration-150 ${
                    isActive
                      ? "bg-brand-light-pink/10 border-brand-light-pink/30"
                      : "bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isActive ? "bg-brand-light-pink/20" : "bg-zinc-700/50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-brand-light-pink" : preset.color}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100">
                          {preset.label}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {preset.fps} fps
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Frame Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300">
              Frame Rate
            </label>
            <span className="text-xs font-mono text-brand-light-pink">
              {exportSettings.fps} fps
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={exportSettings.fps}
            onChange={(e) =>
              setExportSettings({
                ...exportSettings,
                fps: Number(e.target.value),
              })
            }
            className="pro-slider w-full"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>10</span>
            <span>30</span>
            <span>60</span>
          </div>
        </div>

        {/* GIF Quality (only for GIF format) */}
        {exportSettings.format === "gif" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                GIF Compression
              </label>
              <span className="text-xs font-mono text-brand-light-pink">
                {exportSettings.gifQuality}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={exportSettings.gifQuality}
              onChange={(e) =>
                setExportSettings({
                  ...exportSettings,
                  gifQuality: Number(e.target.value),
                })
              }
              className="pro-slider w-full"
            />
            <p className="text-[10px] text-zinc-600">
              Lower = Better quality, larger file
            </p>
          </div>
        )}

        {/* File Size Estimate */}
        <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">
              Estimated Size
            </span>
            <span className="text-sm font-bold text-brand-blue">
              {estimateFileSize()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <div className="text-zinc-600">Resolution</div>
              <div className="text-zinc-400 font-mono">
                {settings.width}×{settings.height}
              </div>
            </div>
            <div>
              <div className="text-zinc-600">Duration</div>
              <div className="text-zinc-400 font-mono">
                {(totalDurationInFrames / settings.fps).toFixed(1)}s
              </div>
            </div>
            <div>
              <div className="text-zinc-600">Frames</div>
              <div className="text-zinc-400 font-mono">
                {Math.round((totalDurationInFrames / settings.fps) * exportSettings.fps)}
              </div>
            </div>
          </div>
        </div>

        {/* Export Tips */}
        <div className="p-3 rounded-lg bg-brand-blue/5 border border-brand-blue/20">
          <p className="text-xs text-brand-blue font-medium mb-2">💡 Export Tips</p>
          <ul className="text-[10px] text-zinc-400 space-y-1.5">
            <li>• Lower FPS reduces file size significantly</li>
            <li>• Ultra quality best for professional use</li>
            <li>• Medium preset works for most cases</li>
            <li>• GIFs larger than 10MB may not load on some platforms</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface FormatButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}

function FormatButton({ icon, label, active, onClick, badge }: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={!!badge}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-150 ${
        active
          ? "bg-brand-light-pink/10 border-brand-light-pink/30"
          : badge
          ? "bg-zinc-800/20 border-zinc-700/30 cursor-not-allowed opacity-50"
          : "bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600"
      }`}
    >
      {badge && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-zinc-700 text-zinc-400 rounded-full">
          {badge}
        </span>
      )}
      <div className={active ? "text-brand-light-pink" : "text-zinc-400"}>
        {icon}
      </div>
      <span className={`text-xs font-medium ${active ? "text-zinc-100" : "text-zinc-400"}`}>
        {label}
      </span>
    </button>
  );
}
