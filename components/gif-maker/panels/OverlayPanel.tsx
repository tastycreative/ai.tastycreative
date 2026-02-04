"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import {
  createDefaultTextOverlay,
  createDefaultBlurOverlay,
  createDefaultStickerOverlay,
  createDefaultShapeOverlay,
} from "@/lib/gif-maker/overlay-defaults";
import {
  Type,
  Eye,
  Smile,
  Square,
  Trash2,
} from "lucide-react";
import type { Overlay } from "@/lib/gif-maker/types";

const OVERLAY_TYPE_CONFIG = [
  { type: "text" as const, icon: Type, label: "Text", color: "text-amber-400" },
  { type: "blur" as const, icon: Eye, label: "Blur", color: "text-purple-400" },
  { type: "sticker" as const, icon: Smile, label: "Sticker", color: "text-green-400" },
  { type: "shape" as const, icon: Square, label: "Shape", color: "text-rose-400" },
];

export function OverlayPanel() {
  const overlays = useVideoEditorStore((s) => s.overlays);
  const tracks = useVideoEditorStore((s) => s.tracks);
  const selectedOverlayId = useVideoEditorStore((s) => s.selectedOverlayId);
  const addOverlay = useVideoEditorStore((s) => s.addOverlay);
  const removeOverlay = useVideoEditorStore((s) => s.removeOverlay);
  const selectOverlay = useVideoEditorStore((s) => s.selectOverlay);

  const overlayTrack = tracks.find((t) => t.type === "overlay");
  const trackId = overlayTrack?.id || "track-overlay-1";

  const handleAddOverlay = (type: Overlay["type"]) => {
    let overlay: Overlay;
    switch (type) {
      case "text":
        overlay = createDefaultTextOverlay({ trackId });
        break;
      case "blur":
        overlay = createDefaultBlurOverlay({ trackId });
        break;
      case "sticker":
        overlay = createDefaultStickerOverlay({ trackId });
        break;
      case "shape":
        overlay = createDefaultShapeOverlay({ trackId });
        break;
    }
    addOverlay(overlay);
    selectOverlay(overlay.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add Overlay Buttons */}
      <div className="grid grid-cols-4 gap-1.5 p-3 border-b border-[#252640]/60">
        {OVERLAY_TYPE_CONFIG.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => handleAddOverlay(type)}
            className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-[#252640] hover:border-blue-500/30 hover:bg-blue-500/5 text-[#8490b0] hover:text-[#e6e8f0] transition-all duration-150 cursor-pointer"
            title={`Add ${label}`}
          >
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </div>

      {/* Overlay List */}
      {overlays.length > 0 && (
        <>
          <div className="px-3 py-2 border-b border-[#252640]/60">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578]">
              {overlays.length} overlay{overlays.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {overlays.map((overlay) => {
              const config = OVERLAY_TYPE_CONFIG.find((c) => c.type === overlay.type);
              const Icon = config?.icon || Square;
              const color = config?.color || "text-[#8490b0]";

              return (
                <div
                  key={overlay.id}
                  onClick={() => selectOverlay(overlay.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 mx-1.5 my-0.5 rounded-lg cursor-pointer transition-colors duration-150 ${
                    selectedOverlayId === overlay.id
                      ? "bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)]"
                      : "hover:bg-[#1e2038] border border-transparent"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-xs font-medium text-[#e6e8f0]">
                      {getOverlayLabel(overlay)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOverlay(overlay.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/10 hover:text-red-400 text-[#4d5578] transition-colors duration-150 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {overlays.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-[#4d5578] text-center">
            Add overlays using the buttons above
          </p>
        </div>
      )}
    </div>
  );
}

function getOverlayLabel(overlay: Overlay): string {
  switch (overlay.type) {
    case "text":
      return overlay.text.slice(0, 30) || "Text";
    case "blur":
      return `Blur (${overlay.intensity}px)`;
    case "sticker":
      return overlay.isEmoji ? overlay.src : "Sticker";
    case "shape":
      return `Shape (${overlay.shapeType})`;
  }
}
