"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { TimelineClipItem } from "./TimelineClipItem";
import { TimelineOverlayItem } from "./TimelineOverlayItem";
import type { Track } from "@/lib/gif-maker/types";

interface TimelineTrackProps {
  track: Track;
  zoom: number;
}

export const TimelineTrack = memo(function TimelineTrack({ track, zoom }: TimelineTrackProps) {
  const clips = useVideoEditorStore((s) => s.clips);
  const overlays = useVideoEditorStore((s) => s.overlays);
  const moveClipToSlot = useVideoEditorStore((s) => s.moveClipToSlot);

  const [isDragOver, setIsDragOver] = useState(false);

  const isSlotTrack = track.type === "slot";
  const isVideoTrack = track.type === "video";
  const isClipTrack = isSlotTrack || isVideoTrack;

  const trackOverlays = useMemo(
    () => overlays.filter((o) => o.trackId === track.id),
    [overlays, track.id]
  );

  const trackClips = useMemo(() => {
    if (isSlotTrack) {
      const slotIndex = parseInt(track.id.replace("slot-", ""), 10);
      return clips.filter((c) => (c.slotIndex ?? 0) === slotIndex);
    }
    if (isVideoTrack) {
      return clips; // single-track mode — show all clips
    }
    return [];
  }, [clips, isSlotTrack, isVideoTrack, track.id]);

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
      // Read clips from store directly to avoid `clips` in dependency array
      const clip = useVideoEditorStore.getState().clips.find((c) => c.id === clipId);
      if (!clip) return;
      if ((clip.slotIndex ?? 0) === targetSlotIndex) return;

      moveClipToSlot(clipId, targetSlotIndex);
    },
    [isSlotTrack, track.id, moveClipToSlot] // clips removed from deps
  );

  const bgClass = isDragOver
    ? "bg-cyan-500/10 border-cyan-500/40"
    : isSlotTrack
    ? "bg-[#12141e] border-[#2d3142]/40"
    : isVideoTrack
    ? "bg-[#12141e] border-[#2d3142]/40"
    : "bg-[#131520] border-[#2d3142]/40";

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
});
