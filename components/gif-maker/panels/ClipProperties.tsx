"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { TransitionProperties } from "./TransitionProperties";
import type { VideoClip } from "@/lib/gif-maker/types";
import { framesToSeconds } from "@/lib/gif-maker/timeline-utils";

interface ClipPropertiesProps {
  clip: VideoClip;
}

export function ClipProperties({ clip }: ClipPropertiesProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip);
  const clips = useVideoEditorStore((s) => s.clips);
  const transitions = useVideoEditorStore((s) => s.transitions);
  const fps = useVideoEditorStore((s) => s.settings.fps);

  const clipIndex = clips.findIndex((c) => c.id === clip.id);
  const nextClip = clipIndex < clips.length - 1 ? clips[clipIndex + 1] : null;
  const existingTransition = nextClip
    ? transitions.find(
        (t) => t.clipAId === clip.id && t.clipBId === nextClip.id
      )
    : null;

  const trimStartSec = framesToSeconds(clip.trimStartFrame, fps);
  const trimEndSec = framesToSeconds(clip.trimEndFrame, fps);
  const totalSec = framesToSeconds(clip.durationInFrames, fps);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-[#e6e8f0] mb-0.5">{clip.name}</h4>
        <p className="text-[10px] text-[#4d5578]">
          {totalSec.toFixed(1)}s total / {clip.durationInFrames} frames
        </p>
      </div>

      {/* Trim Start */}
      <PropertySection label={`Trim Start: ${trimStartSec.toFixed(1)}s`}>
        <input
          type="range"
          min={0}
          max={clip.trimEndFrame - 1}
          value={clip.trimStartFrame}
          onChange={(e) =>
            updateClip(clip.id, { trimStartFrame: Number(e.target.value) })
          }
          className="w-full h-1.5 accent-[#3b82f6]"
        />
      </PropertySection>

      {/* Trim End */}
      <PropertySection label={`Trim End: ${trimEndSec.toFixed(1)}s`}>
        <input
          type="range"
          min={clip.trimStartFrame + 1}
          max={clip.durationInFrames}
          value={clip.trimEndFrame}
          onChange={(e) =>
            updateClip(clip.id, { trimEndFrame: Number(e.target.value) })
          }
          className="w-full h-1.5 accent-[#3b82f6]"
        />
      </PropertySection>

      {/* Volume */}
      <PropertySection label={`Volume: ${Math.round(clip.volume * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={clip.volume}
          onChange={(e) =>
            updateClip(clip.id, { volume: Number(e.target.value) })
          }
          className="w-full h-1.5 accent-[#3b82f6]"
        />
      </PropertySection>

      {/* Transition to next clip */}
      {nextClip && (
        <TransitionProperties
          clipAId={clip.id}
          clipBId={nextClip.id}
          transition={existingTransition || null}
        />
      )}
    </div>
  );
}

function PropertySection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-[#8490b0]">{label}</label>
      {children}
    </div>
  );
}
