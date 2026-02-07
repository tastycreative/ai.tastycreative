"use client";

import { RefObject, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import {
  PLATFORM_DIMENSIONS,
  type PlatformPreset,
} from "@/lib/gif-maker/types";
import {
  captureVideoWithBlur,
  captureCanvasAnimation,
  renderFramesToGif,
  downloadBlob,
  exportCanvasAsPng,
  type BlurRegionDef,
} from "@/lib/gif-maker/gif-renderer";
import type { PreviewPlayerRef } from "./PreviewPlayer";
import {
  Camera,
  Download,
  Loader2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Wand2,
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

  const activeCollageLayout = useVideoEditorStore((s) => s.settings.activeCollageLayout);

  // Check if timeline needs canvas-based export (images, collage, or multi-slot)
  const hasImageClips = clips.some((c) => c.type === "image");
  const hasCollage = activeCollageLayout !== null;
  const needsCanvasExport = hasImageClips || hasCollage;

  const handleCaptureFrame = useCallback(async () => {
    if (!playerRef.current) return;
    const player = playerRef.current;
    player.pause();

    // Wait a moment for the frame to render
    await new Promise((r) => setTimeout(r, 100));

    const canvas = player.getCanvas();
    if (!canvas) {
      setExportState({
        isExporting: false,
        progress: 0,
        phase: "error",
        message: "Could not capture frame — no canvas found",
      });
      return;
    }

    // Create output canvas at full resolution
    const outCanvas = document.createElement("canvas");
    outCanvas.width = settings.width;
    outCanvas.height = settings.height;
    const ctx = outCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, settings.width, settings.height);
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    exportCanvasAsPng(outCanvas, `frame-${timestamp}.png`);

    setExportState({
      isExporting: false,
      progress: 100,
      phase: "done",
      message: "Frame captured!",
    });
  }, [playerRef, settings, setExportState]);

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

      let frames: HTMLCanvasElement[];

      if (needsCanvasExport) {
        // Mixed timeline or image-only: use canvas-based capture (works with <Img>)
        frames = await captureCanvasAnimation(
          () => player.getCanvas(),
          (frame) => player.seekToFrame(frame),
          {
            totalFrames,
            width: settings.width,
            height: settings.height,
            everyNthFrame,
          },
          (progress) =>
            setExportState({
              progress: progress.progress * 0.5,
              phase: "capturing",
              message: `Capturing... ${Math.round(progress.progress)}%`,
            })
        );
      } else {
        // Video-only timeline: use fast video-to-canvas capture
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

        frames = await captureVideoWithBlur(
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
      }

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
  }, [playerRef, clips, overlays, totalDurationInFrames, settings, setExportState, needsCanvasExport]);

  return (
    <div className="flex items-center gap-2 px-3 h-14 bg-[#161925] border-b border-[#2d3142] flex-shrink-0">
      {/* GIF MAKER Branding */}
      <div className="flex items-center gap-2 mr-1">
        <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center">
          <Wand2 className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-slate-100">GIF MAKER</span>
      </div>

      <div className="w-px h-5 bg-[#2d3142] mx-1" />

      {/* Platform Preset */}
      <select
        value={settings.platform}
        onChange={(e) => setPlatform(e.target.value as PlatformPreset)}
        className="h-8 px-2.5 bg-slate-800 border border-[#2d3142] rounded-lg text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150"
      >
        {Object.entries(PLATFORM_DIMENSIONS).map(([key, value]) => (
          <option key={key} value={key}>
            {value.label}
          </option>
        ))}
      </select>

      {/* Dimension display */}
      <span className="text-slate-500 text-xs font-mono">{settings.width} x {settings.height}</span>

      <div className="w-px h-5 bg-[#2d3142] mx-1" />

      {/* Zoom Group */}
      <div className="flex items-center bg-slate-800 rounded-lg overflow-hidden border border-[#2d3142]">
        <button
          onClick={() => setTimelineZoom(settings.timelineZoom - 0.5)}
          className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors duration-150"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="h-8 px-2 flex items-center text-[10px] font-mono text-slate-400 border-x border-[#2d3142] min-w-[40px] justify-center select-none">
          {settings.timelineZoom.toFixed(1)}x
        </span>
        <button
          onClick={() => setTimelineZoom(settings.timelineZoom + 0.5)}
          className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors duration-150"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-[#2d3142] mx-1" />

      {/* Snap Toggle */}
      <button
        onClick={() => setSnapEnabled(!settings.snapEnabled)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors duration-150 ${
          settings.snapEnabled
            ? "text-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/20"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
        }`}
        title="Snap to grid"
      >
        <Magnet className="h-4 w-4" />
        Snap
      </button>

      <div className="w-px h-5 bg-[#2d3142] mx-1" />

      {/* Undo/Redo Placeholder */}
      <div className="flex items-center bg-slate-800 rounded-lg overflow-hidden border border-[#2d3142]">
        <button
          className="h-8 w-8 flex items-center justify-center text-slate-500 cursor-not-allowed"
          title="Undo (coming soon)"
          disabled
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          className="h-8 w-8 flex items-center justify-center text-slate-500 cursor-not-allowed"
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
          <div className="w-24 bg-[#2d3142] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full transition-all duration-200"
              style={{ width: `${exportState.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{exportState.message}</span>
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

      {/* Capture Frame Button */}
      <button
        onClick={handleCaptureFrame}
        disabled={clips.length === 0 || exportState.isExporting}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150 ${
          clips.length === 0 || exportState.isExporting
            ? "bg-[#2d3142] text-slate-500 cursor-not-allowed"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
        }`}
        title="Capture current frame as PNG"
      >
        <Camera className="h-4 w-4" />
        Frame
      </button>

      {/* Export Button */}
      <button
        onClick={handleExportGif}
        disabled={clips.length === 0 || exportState.isExporting}
        className={`flex items-center gap-2 h-9 px-5 rounded-lg text-xs font-semibold transition-all duration-150 ${
          clips.length === 0 || exportState.isExporting
            ? "bg-[#2d3142] text-slate-500 cursor-not-allowed"
            : "bg-gradient-to-r from-indigo-500 to-indigo-400 text-white hover:opacity-90 active:opacity-80 shadow-lg shadow-indigo-500/20"
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
