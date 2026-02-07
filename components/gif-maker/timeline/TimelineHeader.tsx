"use client";

import { memo, useMemo } from "react";
import { framesToTime } from "@/lib/gif-maker/timeline-utils";

interface TimelineHeaderProps {
  totalWidth: number;
  zoom: number;
  fps: number;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const TimelineHeader = memo(function TimelineHeader({ totalWidth, zoom, fps, onMouseDown }: TimelineHeaderProps) {
  const markers = useMemo(() => {
    const framesPerMarker = zoom >= 4 ? fps / 2 : zoom >= 2 ? fps : fps * 2;
    const markerCount = Math.ceil(totalWidth / (framesPerMarker * zoom));
    const result: { frame: number; x: number; isMajor: boolean }[] = [];
    for (let i = 0; i <= markerCount; i++) {
      const frame = i * framesPerMarker;
      const x = frame * zoom;
      const isMajor = frame % fps === 0;
      result.push({ frame, x, isMajor });
    }
    return result;
  }, [totalWidth, zoom, fps]);

  return (
    <div
      className="h-7 border-b border-[#2d3142] relative bg-[#161925] select-none cursor-crosshair"
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
              isMajor ? "h-3 bg-slate-500" : "h-1.5 bg-[#2d3142]"
            }`}
          />
          {isMajor && (
            <span className="absolute top-1 left-1.5 text-[10px] font-mono text-slate-500 whitespace-nowrap pointer-events-none">
              {framesToTime(frame, fps)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});
