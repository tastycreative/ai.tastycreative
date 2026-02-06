"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { TransitionProperties } from "./TransitionProperties";
import type { Clip } from "@/lib/gif-maker/types";
import { COLLAGE_PRESETS } from "@/lib/gif-maker/types";
import { framesToSeconds } from "@/lib/gif-maker/timeline-utils";

interface ClipPropertiesProps {
  clip: Clip;
}

export function ClipProperties({ clip }: ClipPropertiesProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip);
  const clips = useVideoEditorStore((s) => s.clips);
  const transitions = useVideoEditorStore((s) => s.transitions);
  const fps = useVideoEditorStore((s) => s.settings.fps);
  const activeCollageLayout = useVideoEditorStore((s) => s.settings.activeCollageLayout);
  const moveClipToSlot = useVideoEditorStore((s) => s.moveClipToSlot);

  const collagePreset = activeCollageLayout ? COLLAGE_PRESETS[activeCollageLayout] : null;

  // Find next clip in same slot for transition controls
  const sameSlotClips = clips.filter((c) => (c.slotIndex ?? 0) === (clip.slotIndex ?? 0));
  const clipIndex = sameSlotClips.findIndex((c) => c.id === clip.id);
  const nextClip = clipIndex < sameSlotClips.length - 1 ? sameSlotClips[clipIndex + 1] : null;
  const existingTransition = nextClip
    ? transitions.find(
        (t) => t.clipAId === clip.id && t.clipBId === nextClip.id
      )
    : null;

  // Slot controls (only when collage is active)
  const slotControls = collagePreset ? (
    <PropertySection label="Slot">
      <select
        value={clip.slotIndex ?? 0}
        onChange={(e) => moveClipToSlot(clip.id, Number(e.target.value))}
        className="w-full h-8 px-2.5 bg-[#1a1b2e] border border-[#252640] rounded-lg text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all duration-150"
      >
        {collagePreset.slots.map((_, i) => (
          <option key={i} value={i}>Slot {i + 1}</option>
        ))}
      </select>
    </PropertySection>
  ) : null;

  if (clip.type === "image") {
    const durationSec = framesToSeconds(clip.displayDurationInFrames, fps);

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-[#e6e8f0] mb-0.5">{clip.name}</h4>
          <p className="text-[10px] text-emerald-400/80">
            Image clip
            {collagePreset && <span className="text-blue-400 ml-1">· Slot {(clip.slotIndex ?? 0) + 1}</span>}
          </p>
        </div>

        {/* Duration */}
        <PropertySection label={`Duration: ${durationSec.toFixed(1)}s`}>
          <input
            type="range"
            min={Math.round(fps * 0.5)}
            max={fps * 30}
            value={clip.displayDurationInFrames}
            onChange={(e) =>
              updateClip(clip.id, { displayDurationInFrames: Number(e.target.value) })
            }
            className="w-full h-1.5 accent-emerald-500"
          />
        </PropertySection>

        {/* Object Fit */}
        <PropertySection label="Object Fit">
          <select
            value={clip.objectFit}
            onChange={(e) =>
              updateClip(clip.id, { objectFit: e.target.value as "contain" | "cover" })
            }
            className="w-full h-8 px-2.5 bg-[#1a1b2e] border border-[#252640] rounded-lg text-xs text-[#e6e8f0] hover:border-[#354065] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all duration-150"
          >
            <option value="contain">Contain (fit inside)</option>
            <option value="cover">Cover (fill frame)</option>
          </select>
        </PropertySection>

        {slotControls}

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

  const trimStartSec = framesToSeconds(clip.trimStartFrame, fps);
  const trimEndSec = framesToSeconds(clip.trimEndFrame, fps);
  const totalSec = framesToSeconds(clip.durationInFrames, fps);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-[#e6e8f0] mb-0.5">{clip.name}</h4>
        <p className="text-[10px] text-[#4d5578]">
          {totalSec.toFixed(1)}s total / {clip.durationInFrames} frames
          {collagePreset && <span className="text-blue-400 ml-1">· Slot {(clip.slotIndex ?? 0) + 1}</span>}
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

      {slotControls}

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
