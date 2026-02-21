"use client";

import {
  RefObject,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  ImageDown,
  ChevronDown,
  Loader2,
  Check,
  FileImage,
} from "lucide-react";
import html2canvas from "html2canvas";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import {
  exportCanvasAsPng,
  exportCanvasAsJpg,
  exportCanvasAsWebP,
} from "@/lib/gif-maker/gif-renderer";
import type { PreviewPlayerRef } from "./PreviewPlayer";

type ImageFormat = "png" | "jpeg" | "webp";
type ExportQuality = "max" | "high" | "medium";

interface FormatMeta {
  label: string;
  ext: string;
  tag: string;
  tagColor: string;
  description: string;
  supportsQuality: boolean;
}

const FORMATS: Record<ImageFormat, FormatMeta> = {
  png: {
    label: "PNG",
    ext: "png",
    tag: "Lossless",
    tagColor: "text-emerald-400",
    description: "Perfect quality, larger file",
    supportsQuality: false,
  },
  jpeg: {
    label: "JPEG",
    ext: "jpg",
    tag: "Compressed",
    tagColor: "text-amber-400",
    description: "Smaller file, slight loss",
    supportsQuality: true,
  },
  webp: {
    label: "WebP",
    ext: "webp",
    tag: "Modern",
    tagColor: "text-brand-blue",
    description: "Best size/quality balance",
    supportsQuality: true,
  },
};

const QUALITY_OPTIONS: { id: ExportQuality; label: string; value: number }[] =
  [
    { id: "max", label: "Max", value: 0.95 },
    { id: "high", label: "High", value: 0.85 },
    { id: "medium", label: "Med", value: 0.70 },
  ];

interface ExportImageButtonProps {
  playerRef: RefObject<PreviewPlayerRef | null>;
}

export function ExportImageButton({ playerRef }: ExportImageButtonProps) {
  const clips = useVideoEditorStore((s) => s.clips);
  const settings = useVideoEditorStore((s) => s.settings);
  const exportState = useVideoEditorStore((s) => s.exportState);

  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [quality, setQuality] = useState<ExportQuality>("max");
  const [isCapturing, setIsCapturing] = useState(false);
  const [justDone, setJustDone] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleExport = useCallback(
    async (fmt: ImageFormat = format) => {
      if (!playerRef.current) return;
      setIsCapturing(true);
      setIsOpen(false);

      const player = playerRef.current;
      player.pause();
      await new Promise((r) => setTimeout(r, 100));

      try {
        let outCanvas: HTMLCanvasElement | null = null;

        // Try native canvas first (works for Remotion video compositions)
        const rawCanvas = player.getCanvas();
        if (rawCanvas) {
          outCanvas = document.createElement("canvas");
          outCanvas.width = settings.width;
          outCanvas.height = settings.height;
          const ctx = outCanvas.getContext("2d");
          ctx?.drawImage(rawCanvas, 0, 0, settings.width, settings.height);
        } else {
          // Fallback: html2canvas for image/collage compositions
          const container = player.getContainerElement();
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const scale =
              containerRect.width > 0
                ? settings.width / containerRect.width
                : 1;
            const captured = await html2canvas(container, {
              scale,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#000000",
              logging: false,
            });
            outCanvas = document.createElement("canvas");
            outCanvas.width = settings.width;
            outCanvas.height = settings.height;
            const ctx = outCanvas.getContext("2d");
            ctx?.drawImage(captured, 0, 0, settings.width, settings.height);
          }
        }

        if (!outCanvas) throw new Error("Could not capture frame");

        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const qualityValue =
          QUALITY_OPTIONS.find((q) => q.id === quality)?.value ?? 0.95;

        if (fmt === "png") {
          exportCanvasAsPng(outCanvas, `creative-${timestamp}.png`);
        } else if (fmt === "jpeg") {
          exportCanvasAsJpg(
            outCanvas,
            `creative-${timestamp}.jpg`,
            qualityValue
          );
        } else {
          exportCanvasAsWebP(
            outCanvas,
            `creative-${timestamp}.webp`,
            qualityValue
          );
        }

        setJustDone(true);
        setTimeout(() => setJustDone(false), 2000);
      } catch (error) {
        console.error("Image export error:", error);
      } finally {
        setIsCapturing(false);
      }
    },
    [playerRef, settings, format, quality]
  );

  const disabled =
    clips.length === 0 || exportState.isExporting || isCapturing;
  const currentFormat = FORMATS[format];
  const showQuality = currentFormat.supportsQuality;

  return (
    <div className="relative" ref={triggerRef}>
      {/* Split button row */}
      <div className="flex items-stretch">
        {/* Main quick-export button */}
        <button
          onClick={() => handleExport()}
          disabled={disabled}
          title={`Export current frame as ${currentFormat.label}`}
          className={[
            "flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-l-lg text-xs font-medium transition-all duration-150",
            disabled
              ? "bg-zinc-800/30 text-zinc-500 cursor-not-allowed border border-zinc-700/30"
              : justDone
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/15"
              : "text-zinc-300 hover:text-white bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/50 hover:border-zinc-600/70",
          ].join(" ")}
        >
          {isCapturing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : justDone ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <ImageDown className="h-3.5 w-3.5" />
          )}
          <span className="font-semibold tracking-wide text-[11px]">
            {justDone ? "Saved!" : currentFormat.label}
          </span>
        </button>

        {/* Chevron dropdown trigger */}
        <button
          onClick={() => !disabled && setIsOpen((v) => !v)}
          disabled={disabled}
          title="Choose image format"
          className={[
            "flex items-center justify-center h-8 w-6 rounded-r-lg transition-all duration-150 border-l-0",
            disabled
              ? "bg-zinc-800/30 text-zinc-600 cursor-not-allowed border border-zinc-700/30"
              : isOpen
              ? "bg-zinc-700/60 text-zinc-100 border border-zinc-600/70"
              : "text-zinc-500 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/50 hover:border-zinc-600/70",
          ].join(" ")}
        >
          <ChevronDown
            className={[
              "h-3 w-3 transition-transform duration-200",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Popover */}
      {isOpen && !disabled && (
        <div
          ref={popoverRef}
          className="absolute top-[calc(100%+6px)] right-0 w-[228px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50"
          style={{
            animation: "popoverIn 0.15s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5 border-b border-zinc-800/60">
            <FileImage className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-zinc-400">
              Export Image
            </span>
          </div>

          {/* Format selector */}
          <div className="px-2.5 pt-2.5 pb-1">
            <p className="text-[9px] font-semibold tracking-[0.08em] uppercase text-zinc-600 mb-1.5 px-1">
              Format
            </p>
            <div className="space-y-0.5">
              {(Object.entries(FORMATS) as [ImageFormat, FormatMeta][]).map(
                ([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={[
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-100 group",
                      format === key
                        ? "bg-zinc-800/70 border border-zinc-700/60"
                        : "border border-transparent hover:bg-zinc-800/40 hover:border-zinc-800/60",
                    ].join(" ")}
                  >
                    {/* Radio indicator */}
                    <div
                      className={[
                        "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-100",
                        format === key
                          ? "border-brand-light-pink"
                          : "border-zinc-600 group-hover:border-zinc-500",
                      ].join(" ")}
                    >
                      {format === key && (
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-light-pink" />
                      )}
                    </div>

                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={[
                            "text-xs font-bold",
                            format === key ? "text-zinc-100" : "text-zinc-400",
                          ].join(" ")}
                        >
                          {meta.label}
                        </span>
                        <span
                          className={[
                            "text-[9px] font-semibold",
                            meta.tagColor,
                          ].join(" ")}
                        >
                          {meta.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-none mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Quality selector — only for lossy formats */}
          <div
            className={[
              "overflow-hidden transition-all duration-200",
              showQuality
                ? "max-h-20 opacity-100 mt-0"
                : "max-h-0 opacity-0",
            ].join(" ")}
          >
            <div className="px-2.5 pb-1">
              <p className="text-[9px] font-semibold tracking-[0.08em] uppercase text-zinc-600 mb-1.5 px-1">
                Quality
              </p>
              <div className="flex gap-1 px-0.5">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setQuality(opt.id)}
                    className={[
                      "flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-100",
                      quality === opt.id
                        ? "bg-brand-blue/20 text-brand-blue border border-brand-blue/40"
                        : "text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Divider + CTA */}
          <div className="px-2.5 pt-2 pb-2.5 border-t border-zinc-800/60 mt-1">
            <button
              onClick={() => handleExport(format)}
              className="w-full h-8 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-mid-pink hover:to-brand-dark-pink active:opacity-80 transition-all duration-150 shadow-md shadow-brand-light-pink/20 hover:shadow-brand-light-pink/30"
            >
              <ImageDown className="h-3.5 w-3.5" />
              Export {currentFormat.label}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes popoverIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
}
