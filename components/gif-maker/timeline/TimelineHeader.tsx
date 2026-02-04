"use client";

import { framesToTime } from "@/lib/gif-maker/timeline-utils";

interface TimelineHeaderProps {
  totalWidth: number;
  zoom: number;
  fps: number;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function TimelineHeader({ totalWidth, zoom, fps, onMouseDown }: TimelineHeaderProps) {
  const framesPerMarker = zoom >= 4 ? fps / 2 : zoom >= 2 ? fps : fps * 2;
  const markerCount = Math.ceil(totalWidth / (framesPerMarker * zoom));

  const markers: { frame: number; x: number; isMajor: boolean }[] = [];
  for (let i = 0; i <= markerCount; i++) {
    const frame = i * framesPerMarker;
    const x = frame * zoom;
    const isMajor = frame % fps === 0;
    markers.push({ frame, x, isMajor });
  }

  return (
    <div
      className="h-7 border-b border-[#252640] relative bg-[#141524] select-none cursor-crosshair"
      style={{ width: totalWidth }}
      onMouseDown={onMouseDown}
    >
      {markers.map(({ frame, x, isMajor }) => (
        <div
          key={frame}
          className="absolute top-0 h-full"
          style={{ left: x }}
        >
          <div
            className={`absolute bottom-0 w-px ${
              isMajor ? "h-3 bg-[#4d5578]" : "h-1.5 bg-[#252640]"
            }`}
          />
          {isMajor && (
            <span className="absolute top-1 left-1.5 text-[10px] font-mono text-[#4d5578] whitespace-nowrap pointer-events-none">
              {framesToTime(frame, fps)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
