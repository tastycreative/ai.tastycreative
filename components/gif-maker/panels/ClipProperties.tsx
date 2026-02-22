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
        className="w-full h-8 px-2.5 bg-slate-800 border border-[#2d3142] rounded-lg text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150"
      >
        {collagePreset.slots.map((_, i) => (
          <option key={i} value={i}>Slot {i + 1}</option>
        ))}
      </select>
    </PropertySection>
  ) : null;

  if (clip.type === "image") {
    const durationSec = framesToSeconds(clip.displayDurationInFrames, fps);
    const imageSpeed = clip.speed ?? 1;
    const effectiveImageDurationSec = framesToSeconds(
      Math.max(1, Math.round(clip.displayDurationInFrames / imageSpeed)),
      fps
    );

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-slate-100 mb-0.5">{clip.name}</h4>
          <p className="text-[10px] text-emerald-400/80">
            Image clip
            {collagePreset && <span className="text-indigo-400 ml-1">· Slot {(clip.slotIndex ?? 0) + 1}</span>}
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
            className="w-full pro-slider"
          />
        </PropertySection>

        {/* Speed */}
        <PropertySection label={`Speed: ${imageSpeed.toFixed(2)}×`}>
          <div className="flex items-center gap-1 mb-1.5">
            {([0.25, 0.5, 1, 1.5, 2] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateClip(clip.id, { speed: s })}
                className={`flex-1 h-6 rounded text-[10px] font-medium transition-colors ${
                  imageSpeed === s
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-100"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.25}
            value={imageSpeed}
            onChange={(e) => updateClip(clip.id, { speed: Number(e.target.value) })}
            className="w-full pro-slider"
          />
          <p className="text-[10px] text-slate-500 mt-0.5">
            {effectiveImageDurationSec.toFixed(1)}s at {imageSpeed}×
          </p>
        </PropertySection>

        {/* Object Fit */}
        <PropertySection label="Object Fit">
          <select
            value={clip.objectFit}
            onChange={(e) =>
              updateClip(clip.id, { objectFit: e.target.value as "contain" | "cover" })
            }
            className="w-full h-8 px-2.5 bg-slate-800 border border-[#2d3142] rounded-lg text-xs text-slate-100 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all duration-150"
          >
            <option value="contain">Contain (fit inside)</option>
            <option value="cover">Cover (fill frame)</option>
          </select>
        </PropertySection>

        {/* Crop & Zoom */}
        <PropertySection label={`Zoom: ${(clip.zoom?.scale ?? 1).toFixed(1)}×`}>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={clip.zoom?.scale ?? 1}
            onChange={(e) => {
              const scale = Number(e.target.value);
              updateClip(clip.id, {
                zoom: { scale, x: clip.zoom?.x ?? 0, y: clip.zoom?.y ?? 0 },
              });
            }}
            className="w-full pro-slider"
          />
          {(clip.zoom?.scale ?? 1) > 1 && (
            <>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-500 w-4">X</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={clip.zoom?.x ?? 0}
                  onChange={(e) =>
                    updateClip(clip.id, {
                      zoom: { scale: clip.zoom?.scale ?? 1, x: Number(e.target.value), y: clip.zoom?.y ?? 0 },
                    })
                  }
                  className="flex-1 pro-slider"
                />
                <span className="text-[10px] text-slate-400 w-8 text-right">{clip.zoom?.x ?? 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-4">Y</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={clip.zoom?.y ?? 0}
                  onChange={(e) =>
                    updateClip(clip.id, {
                      zoom: { scale: clip.zoom?.scale ?? 1, x: clip.zoom?.x ?? 0, y: Number(e.target.value) },
                    })
                  }
                  className="flex-1 pro-slider"
                />
                <span className="text-[10px] text-slate-400 w-8 text-right">{clip.zoom?.y ?? 0}%</span>
              </div>
              <button
                onClick={() => updateClip(clip.id, { zoom: { scale: 1, x: 0, y: 0 } })}
                className="text-[10px] text-slate-500 hover:text-slate-300 mt-1 transition-colors"
              >
                Reset zoom
              </button>
            </>
          )}
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
  const videoSpeed = clip.speed ?? 1;
  const rawTrimDuration = clip.trimEndFrame - clip.trimStartFrame;
  const effectiveVideoDurationSec = framesToSeconds(
    Math.max(1, Math.round(rawTrimDuration / videoSpeed)),
    fps
  );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-slate-100 mb-0.5">{clip.name}</h4>
        <p className="text-[10px] text-slate-500">
          {totalSec.toFixed(1)}s total / {clip.durationInFrames} frames
          {collagePreset && <span className="text-indigo-400 ml-1">· Slot {(clip.slotIndex ?? 0) + 1}</span>}
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
          className="w-full h-1.5 pro-slider"
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
          className="w-full h-1.5 pro-slider"
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
          className="w-full h-1.5 pro-slider"
        />
      </PropertySection>

      {/* Speed */}
      <PropertySection label={`Speed: ${videoSpeed.toFixed(2)}×`}>
        <div className="flex items-center gap-1 mb-1.5">
          {([0.25, 0.5, 1, 1.5, 2] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateClip(clip.id, { speed: s })}
              className={`flex-1 h-6 rounded text-[10px] font-medium transition-colors ${
                videoSpeed === s
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-100"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0.25}
          max={2}
          step={0.25}
          value={videoSpeed}
          onChange={(e) => updateClip(clip.id, { speed: Number(e.target.value) })}
          className="w-full pro-slider"
        />
        <p className="text-[10px] text-slate-500 mt-0.5">
          {effectiveVideoDurationSec.toFixed(1)}s at {videoSpeed}×
        </p>
      </PropertySection>

      {/* Crop & Zoom */}
      <PropertySection label={`Zoom: ${(clip.zoom?.scale ?? 1).toFixed(1)}×`}>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={clip.zoom?.scale ?? 1}
          onChange={(e) => {
            const scale = Number(e.target.value);
            updateClip(clip.id, {
              zoom: { scale, x: clip.zoom?.x ?? 0, y: clip.zoom?.y ?? 0 },
            });
          }}
          className="w-full pro-slider"
        />
        {(clip.zoom?.scale ?? 1) > 1 && (
          <>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-slate-500 w-4">X</span>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={clip.zoom?.x ?? 0}
                onChange={(e) =>
                  updateClip(clip.id, {
                    zoom: { scale: clip.zoom?.scale ?? 1, x: Number(e.target.value), y: clip.zoom?.y ?? 0 },
                  })
                }
                className="flex-1 pro-slider"
              />
              <span className="text-[10px] text-slate-400 w-8 text-right">{clip.zoom?.x ?? 0}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-4">Y</span>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={clip.zoom?.y ?? 0}
                onChange={(e) =>
                  updateClip(clip.id, {
                    zoom: { scale: clip.zoom?.scale ?? 1, x: clip.zoom?.x ?? 0, y: Number(e.target.value) },
                  })
                }
                className="flex-1 pro-slider"
              />
              <span className="text-[10px] text-slate-400 w-8 text-right">{clip.zoom?.y ?? 0}%</span>
            </div>
            <button
              onClick={() => updateClip(clip.id, { zoom: { scale: 1, x: 0, y: 0 } })}
              className="text-[10px] text-slate-500 hover:text-slate-300 mt-1 transition-colors"
            >
              Reset zoom
            </button>
          </>
        )}
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
      <label className="text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}
