import type { Clip, Transition } from "./types";

/**
 * Convert a frame number to a time string (MM:SS:FF)
 */
export function framesToTime(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const remainingFrames = Math.round(frame % fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(remainingFrames).padStart(2, "0")}`;
}

/**
 * Convert time in seconds to frame number
 */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/**
 * Convert frames to seconds
 */
export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

/**
 * Get the trimmed duration of a clip in frames
 */
export function getClipTrimmedDuration(clip: Clip): number {
  if (clip.type === "image") {
    return clip.displayDurationInFrames;
  }
  return clip.trimEndFrame - clip.trimStartFrame;
}

/**
 * Snap a frame value to the nearest grid point
 */
export function snapToNearest(
  frame: number,
  snapThreshold: number,
  snapPoints: number[]
): number {
  let closest = frame;
  let minDist = snapThreshold + 1;

  for (const point of snapPoints) {
    const dist = Math.abs(frame - point);
    if (dist < minDist) {
      minDist = dist;
      closest = point;
    }
  }

  return minDist <= snapThreshold ? closest : frame;
}

/**
 * Group clips by slotIndex. Clips without a slotIndex go to slot 0.
 */
export function groupClipsBySlot(clips: Clip[]): Map<number, Clip[]> {
  const groups = new Map<number, Clip[]>();
  for (const clip of clips) {
    const slot = clip.slotIndex ?? 0;
    const group = groups.get(slot) || [];
    group.push(clip);
    groups.set(slot, group);
  }
  return groups;
}

/**
 * Recompute clip startFrames based on array order and transitions.
 * Clips on the SAME track are sequential; different tracks play simultaneously.
 * Optimized: only creates new clip objects when startFrame actually changes,
 * and uses a transition Map for O(1) lookup.
 */
export function computeClipStartFrames(
  clips: Clip[],
  transitions: Transition[]
): Clip[] {
  if (clips.length === 0) return [];

  // Build transition lookup: "clipAId:clipBId" → durationInFrames
  const transitionMap = new Map<string, number>();
  for (const t of transitions) {
    transitionMap.set(`${t.clipAId}:${t.clipBId}`, t.durationInFrames);
  }

  const groups = groupClipsBySlot(clips);
  const updatedMap = new Map<string, Clip>();

  for (const [, slotClips] of groups) {
    let prevDuration = getClipTrimmedDuration(slotClips[0]);

    // First clip always starts at 0
    if (slotClips[0].startFrame !== 0) {
      updatedMap.set(slotClips[0].id, { ...slotClips[0], startFrame: 0 });
    }

    for (let i = 1; i < slotClips.length; i++) {
      const prevClip = updatedMap.get(slotClips[i - 1].id) || slotClips[i - 1];
      const overlap = transitionMap.get(`${prevClip.id}:${slotClips[i].id}`) || 0;
      const newStartFrame = prevClip.startFrame + prevDuration - overlap;

      if (slotClips[i].startFrame !== newStartFrame) {
        updatedMap.set(slotClips[i].id, { ...slotClips[i], startFrame: newStartFrame });
      }

      prevDuration = getClipTrimmedDuration(slotClips[i]);
    }
  }

  // If nothing changed, return original array (preserves reference equality)
  if (updatedMap.size === 0) return clips;

  // Preserve original array order, only replace changed clips
  return clips.map((c) => updatedMap.get(c.id) || c);
}

/**
 * Compute total timeline duration — max across all tracks (not sum).
 * Optimized: builds a clip→slot lookup set to avoid O(n²) .some() calls.
 */
export function computeTotalDuration(
  clips: Clip[],
  transitions: Transition[]
): number {
  if (clips.length === 0) return 0;

  const groups = groupClipsBySlot(clips);

  // Build clip-id → slot lookup for O(1) transition matching
  const clipSlotMap = new Map<string, number>();
  for (const clip of clips) {
    clipSlotMap.set(clip.id, clip.slotIndex ?? 0);
  }

  let maxDuration = 0;

  for (const [slot, slotClips] of groups) {
    let slotTotal = 0;
    for (const clip of slotClips) {
      slotTotal += getClipTrimmedDuration(clip);
    }

    // Subtract overlap from transitions within this slot (O(1) lookup per transition)
    for (const t of transitions) {
      if (clipSlotMap.get(t.clipAId) === slot && clipSlotMap.get(t.clipBId) === slot) {
        slotTotal -= t.durationInFrames;
      }
    }

    maxDuration = Math.max(maxDuration, slotTotal);
  }

  return Math.max(1, maxDuration);
}

/**
 * Get snap points for the timeline (clip boundaries from all tracks)
 */
export function getTimelineSnapPoints(
  clips: Clip[],
  fps: number
): number[] {
  const points: number[] = [0];

  for (const clip of clips) {
    points.push(clip.startFrame);
    points.push(clip.startFrame + getClipTrimmedDuration(clip));
  }

  // Add second markers
  const maxFrame = Math.max(...points, 0);
  for (let f = 0; f <= maxFrame; f += fps) {
    points.push(f);
  }

  return [...new Set(points)].sort((a, b) => a - b);
}

/**
 * Convert pixel position on timeline to frame number
 */
export function pixelsToFrames(px: number, zoom: number): number {
  return Math.round(px / zoom);
}

/**
 * Convert frame number to pixel position on timeline
 */
export function framesToPixels(frames: number, zoom: number): number {
  return frames * zoom;
}
