"use client";

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

  const trackOverlays = overlays.filter((o) => o.trackId === track.id);

  return (
    <div
      className={`h-10 relative border-b border-[#252640]/40 ${
        track.type === "video" ? "bg-[#0e0f1a]" : "bg-[#111220]"
      }`}
    >
      {track.type === "video" &&
        clips.map((clip) => (
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
