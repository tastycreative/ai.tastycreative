import { z } from "zod";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";

export const ImageCollageSchema = z.object({
  images: z.array(z.string()),
  layout: z
    .enum(["grid-2x2", "grid-3x3", "vertical-2", "horizontal-2", "featured"])
    .default("grid-2x2"),
  gap: z.number().min(0).default(10),
  borderRadius: z.number().min(0).default(0),
  backgroundColor: z.string().default("#000000"),
});

type ImageCollageProps = z.infer<typeof ImageCollageSchema>;

type LayoutItem = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const ImageCollage: React.FC<ImageCollageProps> = ({
  images,
  layout,
  gap,
  borderRadius,
  backgroundColor,
}) => {
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

  // Calculate layout positions
  const getLayoutPositions = (): LayoutItem[] => {
    const positions: LayoutItem[] = [];

    switch (layout) {
      case "grid-2x2": {
        const cellWidth = (width - gap * 3) / 2;
        const cellHeight = (height - gap * 3) / 2;
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            positions.push({
              x: gap + col * (cellWidth + gap),
              y: gap + row * (cellHeight + gap),
              width: cellWidth,
              height: cellHeight,
            });
          }
        }
        break;
      }

      case "grid-3x3": {
        const cellWidth = (width - gap * 4) / 3;
        const cellHeight = (height - gap * 4) / 3;
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            positions.push({
              x: gap + col * (cellWidth + gap),
              y: gap + row * (cellHeight + gap),
              width: cellWidth,
              height: cellHeight,
            });
          }
        }
        break;
      }

      case "vertical-2": {
        const cellHeight = (height - gap * 3) / 2;
        positions.push({
          x: gap,
          y: gap,
          width: width - gap * 2,
          height: cellHeight,
        });
        positions.push({
          x: gap,
          y: gap * 2 + cellHeight,
          width: width - gap * 2,
          height: cellHeight,
        });
        break;
      }

      case "horizontal-2": {
        const cellWidth = (width - gap * 3) / 2;
        positions.push({
          x: gap,
          y: gap,
          width: cellWidth,
          height: height - gap * 2,
        });
        positions.push({
          x: gap * 2 + cellWidth,
          y: gap,
          width: cellWidth,
          height: height - gap * 2,
        });
        break;
      }

      case "featured": {
        // First image takes 2/3 width, full height
        // Remaining images stack on the right
        const mainWidth = (width - gap * 3) * 0.65;
        const sideWidth = width - mainWidth - gap * 3;
        const sideCount = Math.min(images.length - 1, 3);
        const sideHeight =
          sideCount > 0 ? (height - gap * (sideCount + 1)) / sideCount : 0;

        positions.push({
          x: gap,
          y: gap,
          width: mainWidth,
          height: height - gap * 2,
        });

        for (let i = 0; i < sideCount; i++) {
          positions.push({
            x: gap * 2 + mainWidth,
            y: gap + i * (sideHeight + gap),
            width: sideWidth,
            height: sideHeight,
          });
        }
        break;
      }
    }

    return positions;
  };

  const positions = getLayoutPositions();

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {positions.map((pos, index) => {
        if (index >= images.length) return null;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.width,
              height: pos.height,
              overflow: "hidden",
              borderRadius,
            }}
          >
            <Img
              src={images[index]}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
