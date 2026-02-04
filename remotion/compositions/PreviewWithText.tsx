import { z } from "zod";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

export const PreviewWithTextSchema = z.object({
  images: z.array(z.string()),
  text: z.string(),
  textPosition: z.enum(["top", "bottom", "center"]).default("bottom"),
  textStyle: z
    .enum(["price-tag", "banner", "minimal", "gradient"])
    .default("price-tag"),
  fontSize: z.number().min(12).default(48),
  textColor: z.string().default("#ffffff"),
  backgroundColor: z.string().default("rgba(0,0,0,0.7)"),
  frameDuration: z.number().min(1).default(30),
});

type PreviewWithTextProps = z.infer<typeof PreviewWithTextSchema>;

export const PreviewWithText: React.FC<PreviewWithTextProps> = ({
  images,
  text,
  textPosition,
  textStyle,
  fontSize,
  textColor,
  backgroundColor,
  frameDuration,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Calculate which image to show
  const currentImageIndex =
    images.length > 0
      ? Math.min(Math.floor(frame / frameDuration), images.length - 1)
      : 0;

  const currentImage = images[currentImageIndex] || "";

  // Text animation - slide in at start
  const textAnimationProgress = interpolate(frame, [0, 20], [0, 1], {
    easing: Easing.out(Easing.back(1.5)),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Text position styles
  const getPositionStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "20px 40px",
    };

    switch (textPosition) {
      case "top":
        return {
          ...baseStyle,
          top: 0,
          transform: `translateY(${interpolate(
            textAnimationProgress,
            [0, 1],
            [-100, 0]
          )}px)`,
        };
      case "center":
        return {
          ...baseStyle,
          top: "50%",
          transform: `translateY(-50%) scale(${textAnimationProgress})`,
        };
      case "bottom":
      default:
        return {
          ...baseStyle,
          bottom: 0,
          transform: `translateY(${interpolate(
            textAnimationProgress,
            [0, 1],
            [100, 0]
          )}px)`,
        };
    }
  };

  // Text style variations
  const getTextContainerStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: textAnimationProgress,
    };

    switch (textStyle) {
      case "price-tag":
        return {
          ...baseStyle,
          backgroundColor,
          padding: "16px 32px",
          borderRadius: 8,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        };
      case "banner":
        return {
          ...baseStyle,
          backgroundColor,
          padding: "24px 48px",
          width: "100%",
        };
      case "minimal":
        return {
          ...baseStyle,
          textShadow: "0 2px 10px rgba(0,0,0,0.8)",
        };
      case "gradient":
        return {
          ...baseStyle,
          background: `linear-gradient(180deg, transparent 0%, ${backgroundColor} 100%)`,
          padding: "60px 40px 30px",
          width: "100%",
        };
      default:
        return baseStyle;
    }
  };

  // Subtle zoom animation for the image
  const imageScale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.05],
    {
      easing: Easing.linear,
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background Image */}
      {currentImage && (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={currentImage}
            style={{
              width,
              height,
              objectFit: "cover",
              transform: `scale(${imageScale})`,
            }}
          />
        </AbsoluteFill>
      )}

      {/* Text Overlay */}
      {text && (
        <div style={getPositionStyle()}>
          <div style={getTextContainerStyle()}>
            <span
              style={{
                color: textColor,
                fontSize,
                fontWeight: 700,
                fontFamily: "system-ui, -apple-system, sans-serif",
                textAlign: "center",
                letterSpacing: "0.02em",
              }}
            >
              {text}
            </span>
          </div>
        </div>
      )}

      {/* No image placeholder */}
      {!currentImage && (
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
            No images provided
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
