import type { VideoClip, Transition } from "./types";

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
export function getClipTrimmedDuration(clip: VideoClip): number {
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
 * Recompute clip startFrames based on array order and transitions.
 * Clips are sequential; transitions cause overlap.
 */
export function computeClipStartFrames(
  clips: VideoClip[],
  transitions: Transition[]
): VideoClip[] {
  if (clips.length === 0) return [];

  const updated = clips.map((c) => ({ ...c }));
  updated[0].startFrame = 0;

  for (let i = 1; i < updated.length; i++) {
    const prevClip = updated[i - 1];
    const prevDuration = getClipTrimmedDuration(prevClip);

    // Find transition between prev and current
    const transition = transitions.find(
      (t) => t.clipAId === prevClip.id && t.clipBId === updated[i].id
    );

    const overlap = transition ? transition.durationInFrames : 0;
    updated[i].startFrame = prevClip.startFrame + prevDuration - overlap;
  }

  return updated;
}

/**
 * Compute total timeline duration from clips and transitions
 */
export function computeTotalDuration(
  clips: VideoClip[],
  transitions: Transition[]
): number {
  if (clips.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < clips.length; i++) {
    total += getClipTrimmedDuration(clips[i]);
  }

  // Subtract overlap from transitions
  for (const t of transitions) {
    total -= t.durationInFrames;
  }

  return Math.max(1, total);
}

/**
 * Get snap points for the timeline (clip boundaries, overlay boundaries)
 */
export function getTimelineSnapPoints(
  clips: VideoClip[],
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
