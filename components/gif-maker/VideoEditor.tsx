"use client";

import { useRef, useCallback, useEffect } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import { EditorToolbar } from "./EditorToolbar";
import { EditorPreview } from "./EditorPreview";
import { ClipPanel } from "./panels/ClipPanel";
import { OverlayPanel } from "./panels/OverlayPanel";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { Timeline } from "./timeline/Timeline";
import type { PreviewPlayerRef } from "./PreviewPlayer";

export function VideoEditor() {
  const playerRef = useRef<PreviewPlayerRef>(null);

  // Data fields — useShallow bails out when values are referentially the same
  const { settings, clips, overlays, totalDurationInFrames } = useVideoEditorStore(
    useShallow((s) => ({
      settings: s.settings,
      clips: s.clips,
      overlays: s.overlays,
      totalDurationInFrames: s.totalDurationInFrames,
    }))
  );
  // Actions are stable Zustand references — select separately, no shallow needed
  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame);

  const handleFrameChange = useCallback(
    (frame: number) => {
      setCurrentFrame(frame);
      playerRef.current?.seekToFrame(frame);
    },
    [setCurrentFrame]
  );

  const handleTogglePlayback = useCallback(() => {
    const store = useVideoEditorStore.getState();
    if (store.isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  }, []);

  // Keyboard shortcuts — use getState() to avoid re-attaching on every frame change
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      const state = useVideoEditorStore.getState();
      const frame = state.currentFrame;
      const total = state.totalDurationInFrames;
      const frameFps = state.settings.fps;

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          handleTogglePlayback();
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          handleFrameChange(Math.max(0, frame - 1));
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          handleFrameChange(Math.min(total - 1, frame + 1));
          break;
        }
        case "KeyJ": {
          e.preventDefault();
          handleFrameChange(Math.max(0, frame - frameFps));
          break;
        }
        case "KeyL": {
          e.preventDefault();
          handleFrameChange(Math.min(total - 1, frame + frameFps));
          break;
        }
        case "Home": {
          e.preventDefault();
          handleFrameChange(0);
          break;
        }
        case "End": {
          e.preventDefault();
          handleFrameChange(Math.max(0, total - 1));
          break;
        }
        case "Delete":
        case "Backspace": {
          if (state.selectedClipId) {
            state.removeClip(state.selectedClipId);
          } else if (state.selectedOverlayId) {
            state.removeOverlay(state.selectedOverlayId);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFrameChange, handleTogglePlayback]);

  return (
    <>
    <style>{`
      .pro-slider {
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        background: rgba(39, 39, 42, 0.5);
        border-radius: 2px;
        outline: none;
        width: 100%;
      }
      .pro-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: linear-gradient(135deg, #F774B9 0%, #EC67A1 100%);
        border-radius: 50%;
        cursor: pointer;
        transition: box-shadow 0.2s ease;
      }
      .pro-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 0 0 6px rgba(247, 116, 185, 0.2);
      }
      .pro-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: linear-gradient(135deg, #F774B9 0%, #EC67A1 100%);
        border-radius: 50%;
        cursor: pointer;
        border: none;
        transition: box-shadow 0.2s ease;
      }
      .pro-slider::-moz-range-thumb:hover {
        box-shadow: 0 0 0 6px rgba(247, 116, 185, 0.2);
      }
      .pro-slider::-moz-range-track {
        height: 4px;
        background: rgba(39, 39, 42, 0.5);
        border-radius: 2px;
      }
    `}</style>
    <div className="flex flex-col h-screen bg-[#0a0a0b] text-zinc-100 overflow-hidden relative">
      {/* Ambient background effects - matching submissions aesthetic */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]" />
      </div>
      {/* Top Toolbar */}
      <div className="relative z-10">
        <EditorToolbar playerRef={playerRef} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">
        {/* Left Panel: Clips + Overlays */}
        <div className="w-60 min-w-[240px] flex flex-col bg-zinc-900/40 backdrop-blur-xl border-r border-zinc-800/50">
          <LeftPanelTabs />
        </div>

        {/* Center: Preview Player */}
        <div className="flex-1 flex items-center justify-center p-6 min-w-0 bg-[#0a0a0b]/50 relative">
          <EditorPreview
            ref={playerRef}
            width={settings.width}
            height={settings.height}
            fps={settings.fps}
            durationInFrames={Math.max(1, totalDurationInFrames)}
          />
        </div>

        {/* Right Panel: Properties Inspector */}
        <div className="w-72 min-w-[280px] bg-zinc-900/40 backdrop-blur-xl border-l border-zinc-800/50 overflow-y-auto">
          <PropertiesPanel />
        </div>
      </div>

      {/* Resize handle */}
      <div className="h-1 w-full cursor-row-resize group flex-shrink-0 bg-[#0a0a0b] relative z-10">
        <div className="h-px w-full bg-zinc-800/50 group-hover:bg-gradient-to-r group-hover:from-brand-light-pink group-hover:via-brand-mid-pink group-hover:to-brand-blue transition-colors duration-150" />
      </div>

      {/* Bottom Timeline */}
      <div className="h-56 flex-shrink-0 relative z-10">
        <Timeline onFrameChange={handleFrameChange} onTogglePlayback={handleTogglePlayback} />
      </div>

      {/* Footer Status Bar */}
      <footer className="h-6 bg-zinc-900/80 backdrop-blur-sm border-t border-zinc-800/50 px-4 flex items-center justify-between text-[10px] text-zinc-500 font-medium flex-shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue shadow-[0_0_8px_rgba(93,195,248,0.5)]" />
            <span>System Ready</span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <span>GIF Maker v2.0</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{clips.length} clip{clips.length !== 1 ? "s" : ""} | {overlays.length} overlay{overlays.length !== 1 ? "s" : ""}</span>
        </div>
      </footer>
    </div>
    </>
  );
}

// ─── Left Panel Tabs ─────────────────────────────────

import { useState, lazy, Suspense } from "react";
import { Film, Layers, LayoutGrid, Sparkles, BookOpen } from "lucide-react";

// IMPORTANT: These must stay at module scope — React.lazy() must be called
// outside render functions or the lazy boundary resets on every render.
const LayoutPicker = lazy(() => import("./panels/LayoutPicker").then((m) => ({ default: m.LayoutPicker })));
const EffectsPanel = lazy(() => import("./panels/EffectsPanel").then((m) => ({ default: m.EffectsPanel })));
const TemplateLibrary = lazy(() => import("./panels/TemplateLibrary").then((m) => ({ default: m.TemplateLibrary })));

function LeftPanelTabs() {
  const [activeTab, setActiveTab] = useState<"clips" | "overlays" | "effects" | "layout" | "templates">("clips");

  return (
    <>
      <div className="grid grid-cols-5 h-11 bg-zinc-900/40 backdrop-blur-sm border-b border-zinc-800/50 flex-shrink-0">
        <button
          onClick={() => setActiveTab("clips")}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all duration-150 relative px-1 ${
            activeTab === "clips"
              ? "text-brand-light-pink"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          }`}
        >
          <Film className="h-4 w-4" />
          <span className="text-[10px] leading-none">Clips</span>
          {activeTab === "clips" && (
            <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-dark-pink rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("overlays")}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all duration-150 relative px-1 ${
            activeTab === "overlays"
              ? "text-brand-light-pink"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span className="text-[10px] leading-none">Layers</span>
          {activeTab === "overlays" && (
            <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-dark-pink rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("effects")}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all duration-150 relative px-1 ${
            activeTab === "effects"
              ? "text-brand-light-pink"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-[10px] leading-none">Effects</span>
          {activeTab === "effects" && (
            <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-dark-pink rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all duration-150 relative px-1 ${
            activeTab === "templates"
              ? "text-brand-light-pink"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span className="text-[10px] leading-none">Templates</span>
          {activeTab === "templates" && (
            <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-dark-pink rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all duration-150 relative px-1 ${
            activeTab === "layout"
              ? "text-brand-light-pink"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="text-[10px] leading-none">Layout</span>
          {activeTab === "layout" && (
            <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-dark-pink rounded-full" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "clips" ? (
          <ClipPanel />
        ) : activeTab === "overlays" ? (
          <OverlayPanel />
        ) : activeTab === "effects" ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-zinc-500 text-xs p-4">Loading...</div>}>
            <EffectsPanel />
          </Suspense>
        ) : activeTab === "templates" ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-zinc-500 text-xs p-4">Loading...</div>}>
            <TemplateLibrary />
          </Suspense>
        ) : (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-zinc-500 text-xs p-4">Loading...</div>}>
            <LayoutPicker />
          </Suspense>
        )}
      </div>
    </>
  );
}
