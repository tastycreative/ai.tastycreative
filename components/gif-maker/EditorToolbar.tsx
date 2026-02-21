"use client";

import { RefObject, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useEditorHistory } from "@/lib/hooks/useEditorHistory";
import {
  PLATFORM_DIMENSIONS,
  type PlatformPreset,
} from "@/lib/gif-maker/types";
import {
  captureVideoWithBlur,
  capturePlayerFrames,
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
  Wand2,
} from "lucide-react";
import { ExportImageButton } from "./ExportImageButton";

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
  const loopMode = useVideoEditorStore((s) => s.settings.loopMode ?? "forward");
  const updateSettings = useVideoEditorStore((s) => s.updateSettings);

  // History management
  const { undo, redo, canUndo, canRedo, manualSave, lastSaveTime } = useEditorHistory();

  const activeCollageLayout = useVideoEditorStore((s) => s.settings.activeCollageLayout);

  // Check if timeline needs canvas-based export (images, collage, or multi-slot)
  const hasImageClips = clips.some((c) => c.type === "image");
  const hasCollage = activeCollageLayout !== null;
  const needsCanvasExport = hasImageClips || hasCollage;

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
        // Image/collage timeline: capture by drawing media elements from the player DOM
        frames = await capturePlayerFrames(
          () => player.getContainerElement(),
          (frame) => player.seekToFrame(frame),
          {
            totalFrames,
            width: settings.width,
            height: settings.height,
            everyNthFrame,
            fps: settings.fps,
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

        // Fallback: if video capture returned 0 frames, try DOM-based capture
        if (frames.length === 0) {
          setExportState({
            progress: 0,
            phase: "capturing",
            message: "Retrying capture...",
          });

          frames = await capturePlayerFrames(
            () => player.getContainerElement(),
            (frame) => player.seekToFrame(frame),
            {
              totalFrames,
              width: settings.width,
              height: settings.height,
              everyNthFrame,
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
      }

      if (frames.length === 0) throw new Error("No frames captured");

      // Apply loop mode
      let processedFrames: HTMLCanvasElement[];
      if (loopMode === "reverse") {
        processedFrames = [...frames].reverse();
      } else if (loopMode === "ping-pong") {
        processedFrames = [...frames, ...[...frames].reverse()];
      } else {
        processedFrames = frames;
      }

      setExportState({
        progress: 50,
        phase: "encoding",
        message: "Encoding GIF...",
      });

      const gifBlob = await renderFramesToGif(
        processedFrames,
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
  }, [playerRef, clips, overlays, totalDurationInFrames, settings, setExportState, needsCanvasExport, loopMode]);

  return (
    <div className="flex items-center gap-2 px-3 h-14 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50 flex-shrink-0">
      {/* GIF MAKER Branding */}
      <div className="flex items-center gap-2 mr-1">
        <div className="w-8 h-8 bg-gradient-to-br from-brand-light-pink to-brand-dark-pink rounded flex items-center justify-center shadow-lg shadow-brand-light-pink/20">
          <Wand2 className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue bg-clip-text text-transparent">GIF MAKER</span>
      </div>

      <div className="w-px h-5 bg-zinc-800 mx-1" />

      {/* Platform Preset */}
      <select
        value={settings.platform}
        onChange={(e) => setPlatform(e.target.value as PlatformPreset)}
        className="h-8 px-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-100 hover:border-zinc-600 focus:border-brand-light-pink focus:ring-1 focus:ring-brand-light-pink/30 outline-none transition-all duration-150"
      >
        {Object.entries(PLATFORM_DIMENSIONS).map(([key, value]) => (
          <option key={key} value={key}>
            {value.label}
          </option>
        ))}
      </select>

      {/* Dimension display */}
      <span className="text-zinc-500 text-xs font-mono">{settings.width} x {settings.height}</span>

      <div className="w-px h-5 bg-zinc-800 mx-1" />

      {/* Zoom Group */}
      <div className="flex items-center bg-zinc-800/50 rounded-lg overflow-hidden border border-zinc-700/50">
        <button
          onClick={() => setTimelineZoom(settings.timelineZoom - 0.5)}
          className="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 transition-colors duration-150"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="h-8 px-2 flex items-center text-[10px] font-mono text-zinc-400 border-x border-zinc-700/50 min-w-[40px] justify-center select-none">
          {settings.timelineZoom.toFixed(1)}x
        </span>
        <button
          onClick={() => setTimelineZoom(settings.timelineZoom + 0.5)}
          className="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 transition-colors duration-150"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-zinc-800 mx-1" />

      {/* Snap Toggle */}
      <button
        onClick={() => setSnapEnabled(!settings.snapEnabled)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors duration-150 ${
          settings.snapEnabled
            ? "text-brand-light-pink bg-brand-light-pink/15 hover:bg-brand-light-pink/20"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
        }`}
        title="Snap to grid"
      >
        <Magnet className="h-4 w-4" />
        Snap
      </button>

      <div className="w-px h-5 bg-zinc-800 mx-1" />

      {/* Undo/Redo */}
      <div className="flex items-center bg-zinc-800/50 rounded-lg overflow-hidden border border-zinc-700/50">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`h-8 w-8 flex items-center justify-center transition-colors duration-150 ${
            canUndo
              ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
              : "text-zinc-600 cursor-not-allowed"
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`h-8 w-8 flex items-center justify-center transition-colors duration-150 ${
            canRedo
              ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
              : "text-zinc-600 cursor-not-allowed"
          }`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Manual Save Button */}
      <button
        onClick={manualSave}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-all duration-150"
        title="Save (Ctrl+S)"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
          />
        </svg>
        {lastSaveTime && (
          <span className="text-[10px] text-brand-blue">
            Saved
          </span>
        )}
      </button>

      <div className="flex-1" />

      {/* Export Progress */}
      {exportState.isExporting && (
        <div className="flex items-center gap-2 mr-2">
          <div className="w-24 bg-zinc-800/50 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue h-full rounded-full transition-all duration-200"
              style={{ width: `${exportState.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-400">{exportState.message}</span>
        </div>
      )}

      {/* Export Message (non-exporting) */}
      {!exportState.isExporting && exportState.phase !== "idle" && (
        <span
          className={`text-[10px] mr-2 ${
            exportState.phase === "done" ? "text-brand-blue" : "text-red-400"
          }`}
        >
          {exportState.message}
        </span>
      )}

      {/* Export Image Button */}
      <ExportImageButton playerRef={playerRef} />

      {/* Loop Mode Toggle */}
      <div className="flex items-center bg-zinc-800/50 rounded-lg overflow-hidden border border-zinc-700/50">
        {(
          [
            { mode: "forward" as const, icon: "→", title: "Forward (normal)" },
            { mode: "reverse" as const, icon: "←", title: "Reverse" },
            { mode: "ping-pong" as const, icon: "↔", title: "Ping-Pong (forward+reverse)" },
          ] as const
        ).map(({ mode, icon, title }) => (
          <button
            key={mode}
            onClick={() => updateSettings({ loopMode: mode })}
            className={`h-8 px-2.5 text-sm flex items-center justify-center transition-colors duration-150 ${
              loopMode === mode
                ? "bg-brand-light-pink/20 text-brand-light-pink"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
            }`}
            title={title}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Export GIF Button */}
      <button
        onClick={handleExportGif}
        disabled={clips.length === 0 || exportState.isExporting}
        className={`flex items-center gap-2 h-9 px-5 rounded-lg text-xs font-semibold transition-all duration-150 ${
          clips.length === 0 || exportState.isExporting
            ? "bg-zinc-800/30 text-zinc-500 cursor-not-allowed"
            : "bg-gradient-to-r from-brand-light-pink to-brand-dark-pink text-white hover:from-brand-dark-pink hover:to-brand-light-pink active:opacity-80 shadow-lg shadow-brand-light-pink/20 hover:shadow-brand-light-pink/40"
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
