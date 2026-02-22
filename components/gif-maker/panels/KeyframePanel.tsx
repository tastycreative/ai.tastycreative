"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import type { Overlay, OverlayKeyframe } from "@/lib/gif-maker/types";
import { Plus, Trash2, Clock } from "lucide-react";

interface KeyframePanelProps {
  overlay: Overlay;
}

export function KeyframePanel({ overlay }: KeyframePanelProps) {
  const currentFrame = useVideoEditorStore((s) => s.currentFrame);
  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame);
  const updateOverlay = useVideoEditorStore((s) => s.updateOverlay);
  const fps = useVideoEditorStore((s) => s.settings.fps);

  const keyframes: OverlayKeyframe[] = overlay.keyframes ?? [];
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  const baseOpacity = (overlay as { opacity?: number }).opacity ?? 1;

  function addKeyframe() {
    const alreadyExists = keyframes.some((kf) => kf.frame === currentFrame);
    if (alreadyExists) return;

    const newKf: OverlayKeyframe = {
      frame: currentFrame,
      x: overlay.x,
      y: overlay.y,
      opacity: baseOpacity,
    };
    updateOverlay(overlay.id, { keyframes: [...keyframes, newKf] } as Partial<Overlay>);
  }

  function removeKeyframe(frame: number) {
    updateOverlay(overlay.id, {
      keyframes: keyframes.filter((kf) => kf.frame !== frame),
    } as Partial<Overlay>);
  }

  function seekToKeyframe(frame: number) {
    setCurrentFrame(frame);
  }

  const isCurrentFrameKeyframe = keyframes.some((kf) => kf.frame === currentFrame);
  const isWithinOverlay =
    currentFrame >= overlay.startFrame &&
    currentFrame < overlay.startFrame + overlay.durationInFrames;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-slate-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
            Keyframes
          </span>
        </div>
        <button
          onClick={addKeyframe}
          disabled={isCurrentFrameKeyframe || !isWithinOverlay}
          title={
            !isWithinOverlay
              ? "Scrub into the overlay's range to add a keyframe"
              : isCurrentFrameKeyframe
              ? "Keyframe already exists at this frame"
              : `Add keyframe at frame ${currentFrame}`
          }
          className={`flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium transition-colors ${
            isCurrentFrameKeyframe || !isWithinOverlay
              ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
              : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:text-indigo-300"
          }`}
        >
          <Plus className="h-3 w-3" />
          Add at {(currentFrame / fps).toFixed(1)}s
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-[10px] text-slate-600 italic">
          No keyframes — overlay stays at its default position. Scrub to a frame and click Add to animate.
        </p>
      ) : (
        <div className="space-y-1">
          {sorted.map((kf) => (
            <div
              key={kf.frame}
              className={`flex items-center gap-2 p-1.5 rounded-md border transition-colors ${
                kf.frame === currentFrame
                  ? "bg-indigo-500/15 border-indigo-500/30"
                  : "bg-slate-800/50 border-[#2d3142] hover:border-slate-600"
              }`}
            >
              <button
                onClick={() => seekToKeyframe(kf.frame)}
                className="flex-1 flex items-center gap-2 text-left"
                title={`Seek to frame ${kf.frame}`}
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    kf.frame === currentFrame ? "bg-indigo-400" : "bg-slate-600"
                  }`}
                />
                <span className="text-[10px] text-slate-300 font-mono">
                  {(kf.frame / fps).toFixed(2)}s
                </span>
                <span className="text-[10px] text-slate-500">
                  x:{kf.x.toFixed(0)}% y:{kf.y.toFixed(0)}%
                  {kf.opacity !== undefined && ` α:${(kf.opacity * 100).toFixed(0)}%`}
                </span>
              </button>
              <button
                onClick={() => removeKeyframe(kf.frame)}
                className="h-5 w-5 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                title="Delete keyframe"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {sorted.length > 1 && (
        <button
          onClick={() => updateOverlay(overlay.id, { keyframes: [] } as Partial<Overlay>)}
          className="text-[10px] text-slate-600 hover:text-red-400 transition-colors mt-1"
        >
          Clear all keyframes
        </button>
      )}
    </div>
  );
}
