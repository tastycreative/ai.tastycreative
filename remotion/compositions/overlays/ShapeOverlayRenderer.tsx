import React from "react";
import type { ShapeOverlay } from "@/lib/gif-maker/types";

interface ShapeOverlayRendererProps {
  overlay: ShapeOverlay;
}

export const ShapeOverlayRenderer: React.FC<ShapeOverlayRendererProps> = ({
  overlay,
}) => {
  const renderShape = () => {
    const commonProps = {
      fill: overlay.fill,
      stroke: overlay.stroke,
      strokeWidth: overlay.strokeWidth,
    };

    switch (overlay.shapeType) {
      case "rect":
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="0" y="0" width="100" height="100" {...commonProps} />
          </svg>
        );
      case "circle":
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            <ellipse cx="50" cy="50" rx="48" ry="48" {...commonProps} />
          </svg>
        );
      case "line":
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke={overlay.stroke}
              strokeWidth={overlay.strokeWidth * 2}
            />
          </svg>
        );
      case "arrow":
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker
                id={`arrow-${overlay.id}`}
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={overlay.stroke}
                />
              </marker>
            </defs>
            <line
              x1="5"
              y1="50"
              x2="85"
              y2="50"
              stroke={overlay.stroke}
              strokeWidth={overlay.strokeWidth * 2}
              markerEnd={`url(#arrow-${overlay.id})`}
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        width: `${overlay.width}%`,
        height: `${overlay.height}%`,
        transform: `rotate(${overlay.rotation}deg)`,
        opacity: overlay.opacity,
      }}
    >
      {renderShape()}
    </div>
  );
};
