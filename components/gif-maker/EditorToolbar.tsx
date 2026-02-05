"use client";

import { RefObject, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import {
  PLATFORM_DIMENSIONS,
  type PlatformPreset,
} from "@/lib/gif-maker/types";
import {
  captureVideoWithBlur,
  renderFramesToGif,
  downloadBlob,
  type BlurRegionDef,
} from "@/lib/gif-maker/gif-renderer";
import type { PreviewPlayerRef } from "./PreviewPlayer";
import {
  Download,
  Loader2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
} from "lucide-react";

interface EditorToolbarProps {
  playerRef: RefObject<PreviewPlayerRef | null>;
}

export function EditorToolbar({ playerRef }: EditorToolbarProps) {
  const settings = useVideoEditorStore((s) => s.settings);
  const clips = useVideoEditorStore((s) => s.clips);
  const overlays = useVideoEditorStore((s) => s.overlays);
  const totalDurationInFrames = useVideoEditorStore(
    (s) => s.totalDurationInFrames
  );
  const setPlatform = useVideoEditorStore((s) => s.setPlatform);
  const setTimelineZoom = useVideoEditorStore((s) => s.setTimelineZoom);
  const setSnapEnabled = useVideoEditorStore((s) => s.setSnapEnabled);
  const exportState = useVideoEditorStore((s) => s.exportState);
  const setExportState = useVideoEditorStore((s) => s.setExportState);

  const handleExportGif = useCallback(async () => {
    if (!playerRef.current || clips.length === 0) return;

    const player = playerRef.current;
    player.pause();

    setExportState({
      isExporting: true,
      progress: 0,
      phase: "capturing",
      message: "Capturing frames...",
    });

    try {
      const totalFrames = totalDurationInFrames;
      const everyNthFrame = 2;

      // Convert blur overlays to BlurRegionDef for canvas-based blur
      const blurRegions: BlurRegionDef[] = overlays
        .filter((o) => o.type === "blur")
        .map((o) => ({
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
          intensity: (o as { intensity?: number }).intensity || 20,
          shape: (o as { shape?: "rectangle" | "ellipse" | "rounded-rect" }).shape || "rectangle",
          borderRadius: (o as { borderRadius?: number }).borderRadius,
          blurMode: (o as { blurMode?: "gaussian" | "heavy" | "pixelate" | "solid" }).blurMode,
          fillColor: (o as { fillColor?: string }).fillColor,
        }));

      const frames = await captureVideoWithBlur(
        () => player.getVideoElement(),
        (frame) => player.seekToFrame(frame),
        {
          totalFrames,
          width: settings.width,
          height: settings.height,
          everyNthFrame,
          blurRegions,
          fps: settings.fps,
        },
        (progress) =>
          setExportState({
            progress: progress.progress * 0.5,
            phase: "capturing",
            message: `Capturing... ${Math.round(progress.progress)}%`,
          })
      );

      if (frames.length === 0) throw new Error("No frames captured");

      setExportState({
        progress: 50,
        phase: "encoding",
        message: "Encoding GIF...",
      });

      const gifBlob = await renderFramesToGif(
        frames,
        {
          width: settings.width,
          height: settings.height,
          fps: 15,
          quality: 10,
        },
        (progress) =>
          setExportState({
            progress: 50 + progress.progress * 0.5,
            phase: "encoding",
            message: `Encoding... ${progress.progress}%`,
          })
      );

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      downloadBlob(gifBlob, `editor-${timestamp}.gif`);

      setExportState({
        isExporting: false,
        progress: 100,
        phase: "done",
        message: `Exported! (${(gifBlob.size / 1024 / 1024).toFixed(2)} MB)`,
      });

      player.seekToFrame(0);
    } catch (error) {
      console.error("Export error:", error);
      setExportState({
        isExporting: false,
        progress: 0,
        phase: "error",
        message:
          error instanceof Error ? error.message : "Export failed",
      });
    }
  }, [playerRef, clips, overlays, totalDurationInFrames, settings, setExportState]);

  return (
    <div className="flex items-center gap-1 px-3 h-11 bg-[#141524] border-b border-[#252640] flex-shrink-0">
      {/* Platform Preset */}
      <select
        value={settings.platform}
        onChange={(e) => setPlatform(e.target.value as PlatformPreset)}
        className="h-8 px-2.5 bg-[#1a1b2e] border border-[#252640] rounded-lg text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] outline-none transition-all duration-150"
      >
        {Object.entries(PLATFORM_DIMENSIONS).map(([key, value]) => (
          <option key={key} value={key}>
            {value.label}
          </option>
        ))}
      </select>

      <div className="w-px h-5 bg-[#252640] mx-1" />

      {/* Zoom Group */}
      <div className="flex items-center bg-[#1a1b2e] rounded-lg overflow-hidden">
        <button
          onClick={() => setTimelineZoom(settings.timelineZoom - 0.5)}
          className="h-8 w-8 flex items-center justify-center text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038] transition-colors duration-150"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="h-8 px-2 flex items-center text-[10px] font-mono text-[#8490b0] border-x border-[#252640] min-w-[40px] justify-center select-none">
          {settings.timelineZoom.toFixed(1)}x
        </span>
        <button
          onClick={() => setTimelineZoom(settings.timelineZoom + 0.5)}
          className="h-8 w-8 flex items-center justify-center text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038] transition-colors duration-150"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-[#252640] mx-1" />

      {/* Snap Toggle */}
      <button
        onClick={() => setSnapEnabled(!settings.snapEnabled)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors duration-150 ${
          settings.snapEnabled
            ? "text-blue-400 bg-blue-500/15 hover:bg-blue-500/20"
            : "text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038]"
        }`}
        title="Snap to grid"
      >
        <Magnet className="h-4 w-4" />
        Snap
      </button>

      <div className="w-px h-5 bg-[#252640] mx-1" />

      {/* Undo/Redo Placeholder */}
      <div className="flex items-center bg-[#1a1b2e] rounded-lg overflow-hidden">
        <button
          className="h-8 w-8 flex items-center justify-center text-[#4d5578] cursor-not-allowed"
          title="Undo (coming soon)"
          disabled
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          className="h-8 w-8 flex items-center justify-center text-[#4d5578] cursor-not-allowed"
          title="Redo (coming soon)"
          disabled
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1" />

      {/* Export Progress */}
      {exportState.isExporting && (
        <div className="flex items-center gap-2 mr-2">
          <div className="w-24 bg-[#252640] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-200"
              style={{ width: `${exportState.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-[#8490b0]">{exportState.message}</span>
        </div>
      )}

      {/* Export Message (non-exporting) */}
      {!exportState.isExporting && exportState.phase !== "idle" && (
        <span
          className={`text-[10px] mr-2 ${
            exportState.phase === "done" ? "text-green-400" : "text-red-400"
          }`}
        >
          {exportState.message}
        </span>
      )}

      {/* Export Button */}
      <button
        onClick={handleExportGif}
        disabled={clips.length === 0 || exportState.isExporting}
        className={`flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold transition-all duration-150 ${
          clips.length === 0 || exportState.isExporting
            ? "bg-[#252640] text-[#4d5578] cursor-not-allowed"
            : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-400 hover:to-purple-500 active:from-blue-600 active:to-purple-700 shadow-[0_0_16px_rgba(59,130,246,0.3)]"
        }`}
      >
        {exportState.isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export GIF
      </button>
    </div>
  );
}
