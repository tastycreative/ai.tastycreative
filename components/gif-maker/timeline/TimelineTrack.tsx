"use client";

import { useState, useCallback } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { TimelineClipItem } from "./TimelineClipItem";
import { TimelineOverlayItem } from "./TimelineOverlayItem";
import type { Track } from "@/lib/gif-maker/types";

interface TimelineTrackProps {
  track: Track;
  zoom: number;
}

export function TimelineTrack({ track, zoom }: TimelineTrackProps) {
  const clips = useVideoEditorStore((s) => s.clips);
  const overlays = useVideoEditorStore((s) => s.overlays);
  const moveClipToSlot = useVideoEditorStore((s) => s.moveClipToSlot);

  const [isDragOver, setIsDragOver] = useState(false);

  const trackOverlays = overlays.filter((o) => o.trackId === track.id);

  // For slot tracks, extract slotIndex from track ID (e.g. "slot-0" → 0)
  // For the single video track, all clips belong to slot 0
  const isSlotTrack = track.type === "slot";
  const isVideoTrack = track.type === "video";
  const isClipTrack = isSlotTrack || isVideoTrack;

  const trackClips = clips.filter((c) => {
    if (isSlotTrack) {
      const slotIndex = parseInt(track.id.replace("slot-", ""), 10);
      return (c.slotIndex ?? 0) === slotIndex;
    }
    if (isVideoTrack) {
      return true; // single-track mode — show all clips
    }
    return false;
  });

  // Drop handler — accept clips dragged between slots
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isClipTrack) return;
      if (!e.dataTransfer.types.includes("application/x-clip-id")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    },
    [isClipTrack]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setIsDragOver(false);
      if (!isSlotTrack) return;
      const clipId = e.dataTransfer.getData("application/x-clip-id");
      if (!clipId) return;
      e.preventDefault();

      const targetSlotIndex = parseInt(track.id.replace("slot-", ""), 10);
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;
      if ((clip.slotIndex ?? 0) === targetSlotIndex) return;

      moveClipToSlot(clipId, targetSlotIndex);
    },
    [isSlotTrack, clips, track.id, moveClipToSlot]
  );

  const bgClass = isDragOver
    ? "bg-cyan-500/10 border-cyan-500/40"
    : isSlotTrack
    ? "bg-[#0e0f1a] border-[#252640]/40"
    : isVideoTrack
    ? "bg-[#0e0f1a] border-[#252640]/40"
    : "bg-[#111220] border-[#252640]/40";

  return (
    <div
      className={`h-10 relative border-b transition-colors duration-100 ${bgClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isClipTrack &&
        trackClips.map((clip) => (
          <TimelineClipItem key={clip.id} clip={clip} zoom={zoom} />
        ))}
      {track.type === "overlay" &&
        trackOverlays.map((overlay) => (
          <TimelineOverlayItem
            key={overlay.id}
            overlay={overlay}
            zoom={zoom}
          />
        ))}
    </div>
  );
}
