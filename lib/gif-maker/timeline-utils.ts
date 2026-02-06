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
 */
export function computeClipStartFrames(
  clips: Clip[],
  transitions: Transition[]
): Clip[] {
  if (clips.length === 0) return [];

  const groups = groupClipsBySlot(clips);
  const updatedMap = new Map<string, Clip>();

  for (const [, slotClips] of groups) {
    const updated = slotClips.map((c) => ({ ...c }));
    updated[0].startFrame = 0;

    for (let i = 1; i < updated.length; i++) {
      const prevClip = updated[i - 1];
      const prevDuration = getClipTrimmedDuration(prevClip);

      // Find transition between prev and current (only within same slot)
      const transition = transitions.find(
        (t) => t.clipAId === prevClip.id && t.clipBId === updated[i].id
      );

      const overlap = transition ? transition.durationInFrames : 0;
      updated[i].startFrame = prevClip.startFrame + prevDuration - overlap;
    }

    for (const clip of updated) {
      updatedMap.set(clip.id, clip);
    }
  }

  // Preserve original array order
  return clips.map((c) => updatedMap.get(c.id) || c);
}

/**
 * Compute total timeline duration — max across all tracks (not sum).
 */
export function computeTotalDuration(
  clips: Clip[],
  transitions: Transition[]
): number {
  if (clips.length === 0) return 0;

  const groups = groupClipsBySlot(clips);
  let maxDuration = 0;

  for (const [, slotClips] of groups) {
    let slotTotal = 0;
    for (const clip of slotClips) {
      slotTotal += getClipTrimmedDuration(clip);
    }

    // Subtract overlap from transitions within this slot
    for (const t of transitions) {
      const hasA = slotClips.some((c) => c.id === t.clipAId);
      const hasB = slotClips.some((c) => c.id === t.clipBId);
      if (hasA && hasB) {
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
