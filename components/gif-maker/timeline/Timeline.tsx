"use client";

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineTrack } from "./TimelineTrack";
import { TimelinePlayhead } from "./TimelinePlayhead";
import { TimelineControls } from "./TimelineControls";
import { framesToPixels, pixelsToFrames } from "@/lib/gif-maker/timeline-utils";
import { Film, Layers, LayoutGrid } from "lucide-react";
import type { TrackType } from "@/lib/gif-maker/types";

const SLOT_COLORS = ["text-indigo-400", "text-cyan-400", "text-emerald-400", "text-amber-400", "text-rose-400", "text-purple-400"];

interface TimelineProps {
  onFrameChange: (frame: number) => void;
  onTogglePlayback: () => void;
}

export function Timeline({ onFrameChange, onTogglePlayback }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Optimize: Use single selector with useShallow to prevent re-renders on unrelated state changes
  const {
    getEffectiveTracks,
    totalDurationInFrames,
    currentFrame,
    activeCollageLayout,
    timelineZoom,
    snapEnabled,
    fps,
    tracks,
    setCurrentFrame,
  } = useVideoEditorStore(
    useShallow((s) => ({
      getEffectiveTracks: s.getEffectiveTracks,
      totalDurationInFrames: s.totalDurationInFrames,
      currentFrame: s.currentFrame,
      activeCollageLayout: s.settings.activeCollageLayout,
      timelineZoom: s.settings.timelineZoom,
      snapEnabled: s.settings.snapEnabled,
      fps: s.settings.fps,
      tracks: s.tracks,
      setCurrentFrame: s.setCurrentFrame,
    }))
  );

  // Memoize effective tracks — only recompute when layout or tracks change
  const effectiveTracks = useMemo(
    () => getEffectiveTracks(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCollageLayout, tracks]
  );

  const [isScrubbing, setIsScrubbing] = useState(false);
  const zoom = timelineZoom;
  const totalWidth = framesToPixels(
    Math.max(totalDurationInFrames + 60, 300),
    zoom
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      if (!scrollRef.current) return;
      const scrollContainer = scrollRef.current;
      const rect = scrollContainer.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      const x = clientX - rect.left + scrollLeft;
      const frame = Math.max(
        0,
        Math.min(pixelsToFrames(x, zoom), totalDurationInFrames - 1)
      );
      setCurrentFrame(frame);
      onFrameChange(frame);
    },
    [zoom, totalDurationInFrames, setCurrentFrame, onFrameChange]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seekFromClientX(e.clientX);
    },
    [seekFromClientX]
  );

  const handleScrubStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seekFromClientX(e.clientX);
      setIsScrubbing(true);
    },
    [seekFromClientX]
  );

  // Global mouse move/up for scrubbing
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e: MouseEvent) => {
      seekFromClientX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isScrubbing, seekFromClientX]);

  const trackHeight = 40; // h-10

  return (
    <div className="flex flex-col h-full bg-[#0f111a]">
      {/* Timeline Controls */}
      <TimelineControls onFrameChange={onFrameChange} onTogglePlayback={onTogglePlayback} />

      {/* Scrollable Timeline Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Labels */}
        <div className="w-32 min-w-[128px] flex-shrink-0 bg-[#161925] border-r border-[#2d3142] flex flex-col">
          {/* Ruler spacer */}
          <div className="h-7 border-b border-[#2d3142] flex-shrink-0" />
          {effectiveTracks.map((track, i) => (
            <div
              key={track.id}
              className="h-10 flex items-center gap-2 px-3 border-b border-[#2d3142]/60 group hover:bg-slate-800 transition-colors duration-100"
            >
              <TrackIcon type={track.type} slotIndex={track.type === "slot" ? i : undefined} />
              <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                {track.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div style={{ width: totalWidth, position: "relative" }}>
            {/* Time Ruler — clickable for seeking */}
            <TimelineHeader
              totalWidth={totalWidth}
              zoom={zoom}
              fps={fps}
              onMouseDown={handleScrubStart}
            />

            {/* Tracks — clickable for seeking */}
            <div
              className="relative cursor-crosshair"
              onClick={handleTimelineClick}
            >
              {effectiveTracks.map((track) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  zoom={zoom}
                />
              ))}

              {/* Playhead */}
              <TimelinePlayhead
                frame={currentFrame}
                zoom={zoom}
                height={effectiveTracks.length * trackHeight}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Track Icon ──────────────────────────────────────

function TrackIcon({ type, slotIndex }: { type: TrackType; slotIndex?: number }) {
  if (type === "slot") {
    const colorClass = SLOT_COLORS[slotIndex ?? 0] || "text-indigo-400";
    return <LayoutGrid className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} />;
  }
  if (type === "video") {
    return <Film className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />;
  }
  return <Layers className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />;
}
