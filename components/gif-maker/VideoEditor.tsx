"use client";

import { useRef, useCallback, useEffect } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { EditorToolbar } from "./EditorToolbar";
import { EditorPreview } from "./EditorPreview";
import { ClipPanel } from "./panels/ClipPanel";
import { OverlayPanel } from "./panels/OverlayPanel";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { Timeline } from "./timeline/Timeline";
import type { PreviewPlayerRef } from "./PreviewPlayer";

export function VideoEditor() {
  const playerRef = useRef<PreviewPlayerRef>(null);
  const settings = useVideoEditorStore((s) => s.settings);
  const clips = useVideoEditorStore((s) => s.clips);
  const overlays = useVideoEditorStore((s) => s.overlays);
  const totalDurationInFrames = useVideoEditorStore(
    (s) => s.totalDurationInFrames
  );
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
        background: #2d3142;
        border-radius: 2px;
        outline: none;
        width: 100%;
      }
      .pro-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: #6366f1;
        border-radius: 50%;
        cursor: pointer;
        transition: box-shadow 0.2s ease;
      }
      .pro-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.2);
      }
      .pro-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: #6366f1;
        border-radius: 50%;
        cursor: pointer;
        border: none;
        transition: box-shadow 0.2s ease;
      }
      .pro-slider::-moz-range-thumb:hover {
        box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.2);
      }
      .pro-slider::-moz-range-track {
        height: 4px;
        background: #2d3142;
        border-radius: 2px;
      }
    `}</style>
    <div className="flex flex-col h-screen bg-[#0f111a] text-slate-100 overflow-hidden">
      {/* Top Toolbar */}
      <EditorToolbar playerRef={playerRef} />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel: Clips + Overlays */}
        <div className="w-60 min-w-[240px] flex flex-col bg-[#161925] border-r border-[#2d3142]">
          <LeftPanelTabs />
        </div>

        {/* Center: Preview Player */}
        <div className="flex-1 flex items-center justify-center p-6 min-w-0 bg-[#0f111a] relative">
          <EditorPreview
            ref={playerRef}
            width={settings.width}
            height={settings.height}
            fps={settings.fps}
            durationInFrames={Math.max(1, totalDurationInFrames)}
          />
        </div>

        {/* Right Panel: Properties Inspector */}
        <div className="w-72 min-w-[280px] bg-[#161925] border-l border-[#2d3142] overflow-y-auto">
          <PropertiesPanel />
        </div>
      </div>

      {/* Resize handle */}
      <div className="h-1 w-full cursor-row-resize group flex-shrink-0 bg-[#0f111a]">
        <div className="h-px w-full bg-[#2d3142] group-hover:bg-gradient-to-r group-hover:from-indigo-500 group-hover:to-indigo-400 transition-colors duration-150" />
      </div>

      {/* Bottom Timeline */}
      <div className="h-56 flex-shrink-0">
        <Timeline onFrameChange={handleFrameChange} onTogglePlayback={handleTogglePlayback} />
      </div>

      {/* Footer Status Bar */}
      <footer className="h-6 bg-[#0c0e16] border-t border-[#2d3142] px-4 flex items-center justify-between text-[10px] text-slate-500 font-medium flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>System Ready</span>
          </div>
          <div className="h-3 w-px bg-[#2d3142]" />
          <span>GIF Maker v1.0</span>
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

import { useState } from "react";
import { Film, Layers, LayoutGrid } from "lucide-react";
import { LayoutPicker } from "./panels/LayoutPicker";

function LeftPanelTabs() {
  const [activeTab, setActiveTab] = useState<"clips" | "overlays" | "layout">("clips");

  return (
    <>
      <div className="flex h-9 bg-[#161925] border-b border-[#2d3142] flex-shrink-0">
        <button
          onClick={() => setActiveTab("clips")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150 relative ${
            activeTab === "clips"
              ? "text-indigo-400"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          }`}
        >
          <Film className="h-3.5 w-3.5" />
          Clips
          {activeTab === "clips" && (
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("overlays")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150 relative ${
            activeTab === "overlays"
              ? "text-indigo-400"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Overlays
          {activeTab === "overlays" && (
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150 relative ${
            activeTab === "layout"
              ? "text-indigo-400"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Layout
          {activeTab === "layout" && (
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "clips" ? (
          <ClipPanel />
        ) : activeTab === "overlays" ? (
          <OverlayPanel />
        ) : (
          <LayoutPicker />
        )}
      </div>
    </>
  );
}
