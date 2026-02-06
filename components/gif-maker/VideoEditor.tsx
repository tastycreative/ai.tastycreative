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
  const totalDurationInFrames = useVideoEditorStore(
    (s) => s.totalDurationInFrames
  );
  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame);
  const currentFrame = useVideoEditorStore((s) => s.currentFrame);
  const fps = useVideoEditorStore((s) => s.settings.fps);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          handleTogglePlayback();
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const prev = Math.max(0, currentFrame - 1);
          handleFrameChange(prev);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const next = Math.min(totalDurationInFrames - 1, currentFrame + 1);
          handleFrameChange(next);
          break;
        }
        case "KeyJ": {
          e.preventDefault();
          const back = Math.max(0, currentFrame - fps);
          handleFrameChange(back);
          break;
        }
        case "KeyL": {
          e.preventDefault();
          const fwd = Math.min(totalDurationInFrames - 1, currentFrame + fps);
          handleFrameChange(fwd);
          break;
        }
        case "Home": {
          e.preventDefault();
          handleFrameChange(0);
          break;
        }
        case "End": {
          e.preventDefault();
          handleFrameChange(Math.max(0, totalDurationInFrames - 1));
          break;
        }
        case "Delete":
        case "Backspace": {
          const store = useVideoEditorStore.getState();
          if (store.selectedClipId) {
            store.removeClip(store.selectedClipId);
          } else if (store.selectedOverlayId) {
            store.removeOverlay(store.selectedOverlayId);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFrame, fps, totalDurationInFrames, handleFrameChange, handleTogglePlayback]);

  return (
    <div className="flex flex-col h-screen bg-[#0e0f1a] text-[#e6e8f0] overflow-hidden">
      {/* Top Toolbar */}
      <EditorToolbar playerRef={playerRef} />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel: Clips + Overlays */}
        <div className="w-60 min-w-[240px] flex flex-col bg-[#141524] border-r border-[#252640]">
          <LeftPanelTabs />
        </div>

        {/* Center: Preview Player */}
        <div className="flex-1 flex items-center justify-center p-6 min-w-0 bg-[#0e0f1a] relative">
          <EditorPreview
            ref={playerRef}
            width={settings.width}
            height={settings.height}
            fps={settings.fps}
            durationInFrames={Math.max(1, totalDurationInFrames)}
          />
        </div>

        {/* Right Panel: Properties Inspector */}
        <div className="w-72 min-w-[280px] bg-[#141524] border-l border-[#252640] overflow-y-auto">
          <PropertiesPanel />
        </div>
      </div>

      {/* Resize handle */}
      <div className="h-1 w-full cursor-row-resize group flex-shrink-0 bg-[#0e0f1a]">
        <div className="h-px w-full bg-[#252640] group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500 transition-colors duration-150" />
      </div>

      {/* Bottom Timeline */}
      <div className="h-56 flex-shrink-0">
        <Timeline onFrameChange={handleFrameChange} onTogglePlayback={handleTogglePlayback} />
      </div>
    </div>
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
      <div className="flex h-9 bg-[#1a1b2e] border-b border-[#252640] flex-shrink-0">
        <button
          onClick={() => setActiveTab("clips")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150 relative ${
            activeTab === "clips"
              ? "text-blue-400"
              : "text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038]"
          }`}
        >
          <Film className="h-3.5 w-3.5" />
          Clips
          {activeTab === "clips" && (
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("overlays")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150 relative ${
            activeTab === "overlays"
              ? "text-purple-400"
              : "text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038]"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Overlays
          {activeTab === "overlays" && (
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150 relative ${
            activeTab === "layout"
              ? "text-cyan-400"
              : "text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038]"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Layout
          {activeTab === "layout" && (
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
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
