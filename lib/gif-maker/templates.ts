/**
 * Template Library for GIF Maker
 *
 * Pre-built templates for quick-start projects
 * organized by category and platform
 */

import type { PlatformPreset } from "./types";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  platform: PlatformPreset;
  thumbnail?: string;
  settings: {
    width: number;
    height: number;
    fps: number;
    duration: number; // in seconds
  };
  overlays: TemplateOverlay[];
  effects?: TemplateEffects;
  tags: string[];
}

export type TemplateCategory =
  | "social-media"
  | "marketing"
  | "tutorials"
  | "entertainment"
  | "professional";

export interface TemplateOverlay {
  type: "text" | "shape" | "blur";
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, any>;
}

export interface TemplateEffects {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  vignette?: number;
  [key: string]: number | undefined;
}

// ═══════════════════════════════════════════════════════
// TEMPLATE LIBRARY
// ═══════════════════════════════════════════════════════

export const TEMPLATES: Template[] = [
  // ─────────────────────────────────────────────────────
  // SOCIAL MEDIA TEMPLATES
  // ─────────────────────────────────────────────────────
  {
    id: "instagram-story-promo",
    name: "Instagram Story Promo",
    description: "Eye-catching vertical story with bold text and vibrant colors",
    category: "social-media",
    platform: "ig-story",
    settings: {
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 5,
    },
    overlays: [
      {
        type: "text",
        position: { x: 540, y: 300 },
        size: { width: 800, height: 150 },
        properties: {
          text: "YOUR MESSAGE HERE",
          fontSize: 72,
          fontWeight: "bold",
          color: "#FFFFFF",
          textAlign: "center",
          textShadow: "0 4px 12px rgba(0,0,0,0.5)",
        },
      },
      {
        type: "text",
        position: { x: 540, y: 1600 },
        size: { width: 700, height: 100 },
        properties: {
          text: "Swipe Up to Learn More",
          fontSize: 42,
          fontWeight: "medium",
          color: "#F774B9",
          textAlign: "center",
        },
      },
    ],
    effects: {
      brightness: 105,
      contrast: 110,
      saturation: 140,
    },
    tags: ["instagram", "story", "promo", "vibrant"],
  },
  {
    id: "tiktok-trend",
    name: "TikTok Trend",
    description: "Square format with centered text overlay, perfect for trends",
    category: "social-media",
    platform: "ig-post",
    settings: {
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 10,
    },
    overlays: [
      {
        type: "text",
        position: { x: 540, y: 900 },
        size: { width: 900, height: 120 },
        properties: {
          text: "POV:",
          fontSize: 64,
          fontWeight: "bold",
          color: "#FFFFFF",
          textAlign: "center",
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: "20px",
          borderRadius: "16px",
        },
      },
    ],
    effects: {
      brightness: 110,
      contrast: 115,
      saturation: 130,
    },
    tags: ["tiktok", "trend", "pov", "square"],
  },
  {
    id: "twitter-gif",
    name: "Twitter GIF",
    description: "Optimized for Twitter timeline with quick message",
    category: "social-media",
    platform: "twitter",
    settings: {
      width: 1200,
      height: 675,
      fps: 24,
      duration: 4,
    },
    overlays: [
      {
        type: "text",
        position: { x: 600, y: 338 },
        size: { width: 1000, height: 100 },
        properties: {
          text: "Breaking News",
          fontSize: 56,
          fontWeight: "bold",
          color: "#FFFFFF",
          textAlign: "center",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        },
      },
    ],
    effects: {
      brightness: 100,
      contrast: 105,
      saturation: 110,
    },
    tags: ["twitter", "news", "timeline", "landscape"],
  },

  // ─────────────────────────────────────────────────────
  // MARKETING TEMPLATES
  // ─────────────────────────────────────────────────────
  {
    id: "product-showcase",
    name: "Product Showcase",
    description: "Clean product display with elegant vignette",
    category: "marketing",
    platform: "of-standard",
    settings: {
      width: 1200,
      height: 1600,
      fps: 30,
      duration: 6,
    },
    overlays: [
      {
        type: "text",
        position: { x: 600, y: 200 },
        size: { width: 1000, height: 100 },
        properties: {
          text: "NEW ARRIVAL",
          fontSize: 48,
          fontWeight: "bold",
          color: "#F774B9",
          textAlign: "center",
          letterSpacing: "4px",
        },
      },
      {
        type: "text",
        position: { x: 600, y: 1400 },
        size: { width: 800, height: 80 },
        properties: {
          text: "Limited Edition",
          fontSize: 36,
          fontWeight: "medium",
          color: "#FFFFFF",
          textAlign: "center",
        },
      },
    ],
    effects: {
      brightness: 105,
      contrast: 110,
      saturation: 100,
      vignette: 30,
    },
    tags: ["product", "showcase", "marketing", "elegant"],
  },
  {
    id: "sale-announcement",
    name: "Sale Announcement",
    description: "Bold announcement with high-energy vibes",
    category: "marketing",
    platform: "ig-post",
    settings: {
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 5,
    },
    overlays: [
      {
        type: "text",
        position: { x: 540, y: 400 },
        size: { width: 900, height: 150 },
        properties: {
          text: "50% OFF",
          fontSize: 96,
          fontWeight: "black",
          color: "#FFFFFF",
          textAlign: "center",
          textShadow: "0 6px 16px rgba(0,0,0,0.7)",
        },
      },
      {
        type: "text",
        position: { x: 540, y: 680 },
        size: { width: 800, height: 100 },
        properties: {
          text: "Limited Time Only",
          fontSize: 42,
          fontWeight: "semibold",
          color: "#5DC3F8",
          textAlign: "center",
        },
      },
    ],
    effects: {
      brightness: 115,
      contrast: 120,
      saturation: 150,
    },
    tags: ["sale", "promo", "discount", "bold"],
  },

  // ─────────────────────────────────────────────────────
  // TUTORIAL TEMPLATES
  // ─────────────────────────────────────────────────────
  {
    id: "step-by-step",
    name: "Step-by-Step Tutorial",
    description: "Clear instructional format with numbered steps",
    category: "tutorials",
    platform: "ig-story",
    settings: {
      width: 1080,
      height: 1920,
      fps: 24,
      duration: 15,
    },
    overlays: [
      {
        type: "text",
        position: { x: 540, y: 200 },
        size: { width: 900, height: 100 },
        properties: {
          text: "Step 1",
          fontSize: 56,
          fontWeight: "bold",
          color: "#F774B9",
          textAlign: "center",
        },
      },
      {
        type: "text",
        position: { x: 540, y: 1700 },
        size: { width: 900, height: 120 },
        properties: {
          text: "Follow for more tips",
          fontSize: 36,
          fontWeight: "medium",
          color: "#FFFFFF",
          textAlign: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
          padding: "16px",
          borderRadius: "12px",
        },
      },
    ],
    effects: {
      brightness: 110,
      contrast: 110,
      saturation: 105,
    },
    tags: ["tutorial", "howto", "educational", "steps"],
  },

  // ─────────────────────────────────────────────────────
  // PROFESSIONAL TEMPLATES
  // ─────────────────────────────────────────────────────
  {
    id: "cinematic-intro",
    name: "Cinematic Intro",
    description: "Moody, professional look with subtle vignette",
    category: "professional",
    platform: "twitter",
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 8,
    },
    overlays: [
      {
        type: "text",
        position: { x: 960, y: 540 },
        size: { width: 1400, height: 120 },
        properties: {
          text: "Your Brand Name",
          fontSize: 72,
          fontWeight: "light",
          color: "#FFFFFF",
          textAlign: "center",
          letterSpacing: "8px",
        },
      },
    ],
    effects: {
      brightness: 95,
      contrast: 115,
      saturation: 90,
      vignette: 40,
    },
    tags: ["cinematic", "professional", "intro", "moody"],
  },
  {
    id: "minimal-portfolio",
    name: "Minimal Portfolio",
    description: "Clean, minimalist design for showcasing work",
    category: "professional",
    platform: "of-standard",
    settings: {
      width: 1200,
      height: 1600,
      fps: 24,
      duration: 7,
    },
    overlays: [
      {
        type: "text",
        position: { x: 600, y: 1450 },
        size: { width: 1000, height: 80 },
        properties: {
          text: "Portfolio 2026",
          fontSize: 32,
          fontWeight: "light",
          color: "#FFFFFF",
          textAlign: "center",
          letterSpacing: "4px",
        },
      },
    ],
    effects: {
      brightness: 100,
      contrast: 105,
      saturation: 85,
    },
    tags: ["minimal", "portfolio", "clean", "professional"],
  },
];

// ═══════════════════════════════════════════════════════
// TEMPLATE UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: TemplateCategory
): Template[] {
  return TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Search templates by tag or name
 */
export function searchTemplates(query: string): Template[] {
  const lowerQuery = query.toLowerCase();
  return TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get all template categories
 */
export function getTemplateCategories(): {
  id: TemplateCategory;
  name: string;
  count: number;
}[] {
  const categories: TemplateCategory[] = [
    "social-media",
    "marketing",
    "tutorials",
    "entertainment",
    "professional",
  ];

  return categories.map((cat) => ({
    id: cat,
    name: cat
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    count: getTemplatesByCategory(cat).length,
  }));
}
