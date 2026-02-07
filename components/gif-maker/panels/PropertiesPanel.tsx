"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { ClipProperties } from "./ClipProperties";
import { TextOverlayProperties } from "./TextOverlayProperties";
import { BlurOverlayProperties } from "./BlurOverlayProperties";
import { StickerOverlayProperties } from "./StickerOverlayProperties";
import { ShapeOverlayProperties } from "./ShapeOverlayProperties";
import { Settings2, MousePointerClick } from "lucide-react";

export function PropertiesPanel() {
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId);
  const selectedOverlayId = useVideoEditorStore((s) => s.selectedOverlayId);
  const clips = useVideoEditorStore((s) => s.clips);
  const overlays = useVideoEditorStore((s) => s.overlays);

  const selectedClip = selectedClipId
    ? clips.find((c) => c.id === selectedClipId)
    : null;
  const selectedOverlay = selectedOverlayId
    ? overlays.find((o) => o.id === selectedOverlayId)
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 h-9 bg-[#161925] border-b border-[#2d3142] sticky top-0 z-10 flex-shrink-0">
        <Settings2 className="h-3.5 w-3.5 text-slate-400" />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Properties
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedClip ? (
          <div className="p-4">
            <ClipProperties clip={selectedClip} />
          </div>
        ) : selectedOverlay ? (
          <div className="p-4">
            <OverlayPropertiesSwitch overlay={selectedOverlay} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 px-6">
            <MousePointerClick className="h-8 w-8 text-[#2d3142]" />
            <p className="text-xs text-slate-500 text-center">
              Select a clip or overlay to edit its properties
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function OverlayPropertiesSwitch({
  overlay,
}: {
  overlay: ReturnType<typeof useVideoEditorStore.getState>["overlays"][number];
}) {
  switch (overlay.type) {
    case "text":
      return <TextOverlayProperties overlay={overlay} />;
    case "blur":
      return <BlurOverlayProperties overlay={overlay} />;
    case "sticker":
      return <StickerOverlayProperties overlay={overlay} />;
    case "shape":
      return <ShapeOverlayProperties overlay={overlay} />;
    default:
      return null;
  }
}
