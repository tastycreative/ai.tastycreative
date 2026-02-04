import { z } from "zod";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

export const ImageSlideshowSchema = z.object({
  images: z.array(z.string()),
  frameDuration: z.number().min(1).default(30),
  transition: z.enum(["fade", "slide", "zoom", "none"]).default("fade"),
  transitionDuration: z.number().min(0).default(15),
});

type ImageSlideshowProps = z.infer<typeof ImageSlideshowSchema>;

export const ImageSlideshow: React.FC<ImageSlideshowProps> = ({
  images,
  frameDuration,
  transition,
  transitionDuration,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  if (images.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ color: "#ffffff", fontSize: 32, fontFamily: "system-ui" }}>
          No images provided
        </div>
      </AbsoluteFill>
    );
  }

  // Calculate which image should be shown
  const totalFramesPerImage = frameDuration;
  const currentImageIndex = Math.floor(frame / totalFramesPerImage);
  const frameInCurrentImage = frame % totalFramesPerImage;

  // Clamp to valid image index
  const safeCurrentIndex = Math.min(currentImageIndex, images.length - 1);
  const nextIndex = Math.min(safeCurrentIndex + 1, images.length - 1);

  const currentImage = images[safeCurrentIndex];
  const nextImage = images[nextIndex];

  // Calculate transition progress
  const isTransitioning =
    frameInCurrentImage >= frameDuration - transitionDuration &&
    safeCurrentIndex < images.length - 1;

  const transitionProgress = isTransitioning
    ? interpolate(
        frameInCurrentImage,
        [frameDuration - transitionDuration, frameDuration],
        [0, 1],
        {
          easing: Easing.inOut(Easing.ease),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      )
    : 0;

  const renderImage = (
    src: string,
    opacity: number,
    transform: string,
    zIndex: number
  ) => (
    <AbsoluteFill style={{ zIndex }}>
      <Img
        src={src}
        style={{
          width,
          height,
          objectFit: "cover",
          opacity,
          transform,
        }}
      />
    </AbsoluteFill>
  );

  // Render based on transition type
  if (transition === "none" || !isTransitioning) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        {renderImage(currentImage, 1, "none", 1)}
      </AbsoluteFill>
    );
  }

  if (transition === "fade") {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        {renderImage(currentImage, 1 - transitionProgress, "none", 1)}
        {renderImage(nextImage, transitionProgress, "none", 2)}
      </AbsoluteFill>
    );
  }

  if (transition === "slide") {
    const currentX = interpolate(transitionProgress, [0, 1], [0, -width]);
    const nextX = interpolate(transitionProgress, [0, 1], [width, 0]);

    return (
      <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
        {renderImage(currentImage, 1, `translateX(${currentX}px)`, 1)}
        {renderImage(nextImage, 1, `translateX(${nextX}px)`, 2)}
      </AbsoluteFill>
    );
  }

  if (transition === "zoom") {
    const currentScale = interpolate(transitionProgress, [0, 1], [1, 1.2]);
    const currentOpacity = 1 - transitionProgress;
    const nextScale = interpolate(transitionProgress, [0, 1], [0.8, 1]);

    return (
      <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
        {renderImage(
          currentImage,
          currentOpacity,
          `scale(${currentScale})`,
          1
        )}
        {renderImage(nextImage, transitionProgress, `scale(${nextScale})`, 2)}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {renderImage(currentImage, 1, "none", 1)}
    </AbsoluteFill>
  );
};
