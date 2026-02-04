import { z } from "zod";
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const BlurRegionSchema = z.object({
  id: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
});

export const VideoToGifSchema = z.object({
  videoSrc: z.string(),
  fullBlurIntensity: z.number().min(0).max(20).default(0),
  blurRegions: z.array(BlurRegionSchema).default([]),
  regionBlurIntensity: z.number().min(1).max(30).default(10),
  trimStartFrame: z.number().min(0).default(0),
  trimEndFrame: z.number().min(0).default(150),
});

type VideoToGifProps = z.infer<typeof VideoToGifSchema>;

export const VideoToGif: React.FC<VideoToGifProps> = ({
  videoSrc,
  fullBlurIntensity,
  blurRegions,
  regionBlurIntensity,
  trimStartFrame,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  if (!videoSrc) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{ color: "#ffffff", fontSize: 32, fontFamily: "system-ui" }}
        >
          No video provided
        </div>
      </AbsoluteFill>
    );
  }

  const hasFullBlur = fullBlurIntensity > 0;
  const hasRegionBlur = blurRegions.length > 0;

  // Strategy: Use dual-video approach for region blur to ensure canvas capture works.
  // Layer 1: Main video (with optional full blur)
  // Layer 2: For each region, a clipped copy of the un-blurred video behind a blur div
  //          OR a clipped blurred video on top

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* Base video layer with optional full-frame blur */}
      <Video
        src={videoSrc}
        startFrom={trimStartFrame}
        crossOrigin="anonymous"
        style={{
          width,
          height,
          objectFit: "cover",
          filter: hasFullBlur ? `blur(${fullBlurIntensity}px)` : undefined,
          // Scale up slightly when blurred to avoid transparent edges
          transform: hasFullBlur ? "scale(1.1)" : undefined,
        }}
      />

      {/* Region blur overlays using backdrop-filter */}
      {hasRegionBlur &&
        blurRegions.map((region) => (
          <div
            key={region.id}
            style={{
              position: "absolute",
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.width}%`,
              height: `${region.height}%`,
              backdropFilter: `blur(${regionBlurIntensity}px)`,
              WebkitBackdropFilter: `blur(${regionBlurIntensity}px)`,
              zIndex: 10,
            }}
          />
        ))}
    </AbsoluteFill>
  );
};
