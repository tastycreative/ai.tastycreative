"use client";

import { forwardRef, useMemo, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { PreviewPlayer, type PreviewPlayerRef } from "./PreviewPlayer";
import { CanvasOverlayLayer } from "./overlays/CanvasOverlayLayer";
import type { Clip, Transition, Overlay, CollageLayout } from "@/lib/gif-maker/types";

interface EditorPreviewProps {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface ClipEditorInputProps {
  clips: Clip[];
  transitions: Transition[];
  overlays: Overlay[];
  activeCollageLayout?: CollageLayout | null;
}

export const EditorPreview = forwardRef<PreviewPlayerRef, EditorPreviewProps>(
  function EditorPreview({ width, height, fps, durationInFrames }, ref) {
    const clips = useVideoEditorStore((s) => s.clips);
    const transitions = useVideoEditorStore((s) => s.transitions);
    const overlays = useVideoEditorStore((s) => s.overlays);
    const activeCollageLayout = useVideoEditorStore((s) => s.settings.activeCollageLayout);
    const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame);
    const setPlaying = useVideoEditorStore((s) => s.setPlaying);

    // Sync frame from Remotion Player → Zustand store
    const handleFrameUpdate = useCallback(
      (frame: number) => {
        setCurrentFrame(frame);
      },
      [setCurrentFrame]
    );

    // Sync play/pause from Remotion Player → Zustand store
    const handlePlayingChange = useCallback(
      (playing: boolean) => {
        setPlaying(playing);
      },
      [setPlaying]
    );

    const inputProps = useMemo(
      (): ClipEditorInputProps => ({
        clips,
        transitions,
        overlays,
        activeCollageLayout,
      }),
      [clips, transitions, overlays, activeCollageLayout]
    );

    return (
      <div
        className="relative rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] ring-1 ring-[#252640]"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: `${width}/${height}`,
          /* Fill the constraining dimension — portrait videos fill height, landscape fill width */
          height: height >= width ? "100%" : "auto",
          width: height >= width ? "auto" : "100%",
        }}
      >
        {/* Resolution badge */}
        <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded text-[10px] font-mono bg-black/60 text-[#8490b0] backdrop-blur-sm pointer-events-none select-none">
          {width} x {height}
        </div>

        <PreviewPlayer
          ref={ref}
          type="clip-editor"
          props={inputProps}
          width={width}
          height={height}
          fps={fps}
          durationInFrames={durationInFrames}
          className="w-full"
          onFrameUpdate={handleFrameUpdate}
          onPlayingChange={handlePlayingChange}
          overlaySlot={(cw, ch) => (
            <CanvasOverlayLayer containerWidth={cw} containerHeight={ch} />
          )}
        />
      </div>
    );
  }
);
