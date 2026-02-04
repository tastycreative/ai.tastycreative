"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Film } from "lucide-react";

interface VideoInfo {
  url: string;
  duration: number; // seconds
  width: number;
  height: number;
  name: string;
  size: number; // bytes
}

interface VideoUploaderProps {
  video: VideoInfo | null;
  onVideoChange: (video: VideoInfo | null) => void;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_TYPES = ["video/mp4", "video/webm"];

export type { VideoInfo };

export function VideoUploader({ video, onVideoChange }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processVideo = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Please upload an MP4 or WebM video.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("File size must be under 100MB.");
        return;
      }

      setIsProcessing(true);
      const url = URL.createObjectURL(file);
      const videoEl = document.createElement("video");
      videoEl.preload = "metadata";

      videoEl.onloadedmetadata = () => {
        onVideoChange({
          url,
          duration: videoEl.duration,
          width: videoEl.videoWidth,
          height: videoEl.videoHeight,
          name: file.name,
          size: file.size,
        });
        setIsProcessing(false);
      };

      videoEl.onerror = () => {
        URL.revokeObjectURL(url);
        setError("Failed to read video metadata.");
        setIsProcessing(false);
      };

      videoEl.src = url;
    },
    [onVideoChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processVideo(file);
    },
    [processVideo]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processVideo(file);
      // Reset input so re-uploading the same file triggers onChange
      e.target.value = "";
    },
    [processVideo]
  );

  const handleRemove = useCallback(() => {
    if (video) {
      URL.revokeObjectURL(video.url);
      onVideoChange(null);
    }
  }, [video, onVideoChange]);

  if (video) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-lg overflow-hidden border border-border bg-black">
          <video
            src={video.url}
            className="w-full max-h-48 object-contain"
            muted
            playsInline
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="truncate" title={video.name}>
            {video.name}
          </div>
          <div className="text-right">
            {(video.size / 1024 / 1024).toFixed(1)} MB
          </div>
          <div>
            {video.width}x{video.height}
          </div>
          <div className="text-right">{video.duration.toFixed(1)}s</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 p-8
          border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }
        `}
      >
        {isProcessing ? (
          <div className="animate-pulse text-muted-foreground text-sm">
            Reading video...
          </div>
        ) : (
          <>
            <div className="p-3 rounded-full bg-muted">
              <Film className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                Drop a video here or click to upload
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                MP4 or WebM, up to 100MB
              </p>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
