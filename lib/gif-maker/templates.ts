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
  | "of-content"
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
// SHARED OVERLAY PROPERTY BASES
// ═══════════════════════════════════════════════════════

/** Properties shared by all OF-style Impact text overlays */
const OF_TEXT_BASE = {
  fontFamily: "Impact",
  fontWeight: 400,
  textAlign: "center",
  textTransform: "uppercase",
  strokeColor: "#000000",
  backgroundColor: "transparent",
  backgroundOpacity: 0,
} as const;

/** Standard shadow for OF headline text (strong dark shadow) */
const OF_SHADOW_STRONG = {
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  shadowBlur: 4,
  shadowColor: "rgba(0,0,0,0.8)",
} as const;

/** Lighter shadow for OF subtitle text */
const OF_SHADOW_LIGHT = {
  shadowOffsetX: 1,
  shadowOffsetY: 1,
  shadowBlur: 3,
  shadowColor: "rgba(0,0,0,0.7)",
} as const;

/** Standard OF content settings (900x1200 @ 15fps) */
const OF_SETTINGS = {
  width: 900,
  height: 1200,
  fps: 15,
} as const;

/** Build a headline overlay for OF templates */
function ofHeadline(
  text: string,
  y: number,
  overrides: Record<string, unknown> = {},
): TemplateOverlay {
  return {
    type: "text",
    position: { x: 5, y },
    size: { width: 90, height: 20 },
    properties: {
      text,
      fontSize: 56,
      ...OF_TEXT_BASE,
      strokeWidth: 3,
      ...OF_SHADOW_STRONG,
      color: "#ffffff",
      ...overrides,
    },
  };
}

/** Build a subtitle overlay for OF templates */
function ofSubtitle(
  text: string,
  y: number,
  overrides: Record<string, unknown> = {},
): TemplateOverlay {
  return {
    type: "text",
    position: { x: 5, y },
    size: { width: 90, height: 12 },
    properties: {
      text,
      fontSize: 36,
      ...OF_TEXT_BASE,
      strokeWidth: 2,
      ...OF_SHADOW_LIGHT,
      color: "#ffffff",
      ...overrides,
    },
  };
}

// ═══════════════════════════════════════════════════════
// TEMPLATE LIBRARY
// ═══════════════════════════════════════════════════════

export const TEMPLATES: Template[] = [
  // ─────────────────────────────────────────────────────
  // OF CONTENT TEMPLATES (PRIMARY)
  // ─────────────────────────────────────────────────────
  {
    id: "of-renewal-promo",
    name: "Renewal Promo",
    description: "Bold renewal call-to-action with accent keywords — 3:4 format",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("TURN ON RENEW", 55),
      ofHeadline("FOR HUGE GIFT", 72, {
        fontSize: 64,
        color: "#FF8C00",
        size: { width: 90, height: 18 },
      }),
    ],
    tags: ["of", "renewal", "promo", "gift", "3:4"],
  },
  {
    id: "of-content-teaser",
    name: "Content Teaser",
    description: "Descriptive content teaser with colored buzz word — 3:4 format",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("NEW EXCLUSIVE", 58),
      ofHeadline("CONTENT", 74, {
        fontSize: 72,
        color: "#00D4FF",
        strokeWidth: 3,
        shadowBlur: 6,
        shadowColor: "rgba(0,212,255,0.4)",
        size: { width: 90, height: 16 },
      }),
    ],
    tags: ["of", "content", "teaser", "exclusive", "3:4"],
  },
  {
    id: "of-mass-message",
    name: "Mass Message",
    description: "Eye-catching mass message promo with colored headline — 3:4 format",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 5 },
    overlays: [
      ofHeadline("CHECK YOUR DMS", 55, {
        fontSize: 60,
        color: "#FF1493",
        shadowBlur: 6,
        shadowColor: "rgba(255,20,147,0.3)",
      }),
      ofSubtitle("SOMETHING SPECIAL WAITING", 73),
    ],
    tags: ["of", "mass-message", "dm", "promo", "3:4"],
  },
  {
    id: "of-sale-promo",
    name: "Sale / Discount",
    description: "Limited-time discount promo with gold accent — 3:4 format",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 5 },
    overlays: [
      ofHeadline("LIMITED TIME", 50, { fontSize: 48 }),
      ofHeadline("50% OFF", 66, {
        fontSize: 80,
        color: "#FFD700",
        shadowBlur: 6,
        shadowColor: "rgba(255,215,0,0.4)",
        size: { width: 90, height: 22 },
      }),
    ],
    tags: ["of", "sale", "discount", "promo", "gold", "3:4"],
  },
  {
    id: "of-ppv-unlock",
    name: "PPV Unlock",
    description: "Pay-per-view unlock teaser with neon glow — 3:4 format",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("UNLOCK NOW", 56, {
        fontSize: 64,
        color: "#39FF14",
        strokeWidth: 2,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 15,
        shadowColor: "#39FF14",
        size: { width: 90, height: 18 },
      }),
      ofSubtitle("EXCLUSIVE VIDEO", 73),
    ],
    tags: ["of", "ppv", "unlock", "neon", "3:4"],
  },
  {
    id: "of-gradient-headline",
    name: "Gradient Headline",
    description: "Gradient text headline with clean subtitle — 3:4 format",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 5 },
    overlays: [
      ofHeadline("NEW DROP", 55, {
        fontSize: 72,
        color: "#FF6B35",
        useGradient: true,
        gradientColors: ["#FF6B35", "#FFD700"],
        gradientAngle: 180,
        size: { width: 90, height: 22 },
      }),
      ofSubtitle("AVAILABLE NOW", 75, {
        fontSize: 32,
        size: { width: 85, height: 10 },
      }),
    ],
    tags: ["of", "gradient", "headline", "new", "3:4"],
  },

  // ─────────────────────────────────────────────────────
  // SOCIAL MEDIA TEMPLATES (kept for non-OF use cases)
  // ─────────────────────────────────────────────────────
  {
    id: "instagram-story-promo",
    name: "Instagram Story",
    description: "Vertical story with bold text overlay",
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
        position: { x: 10, y: 15 },
        size: { width: 80, height: 10 },
        properties: {
          text: "YOUR MESSAGE HERE",
          fontSize: 72,
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
          strokeWidth: 2,
          strokeColor: "#000000",
        },
      },
    ],
    tags: ["instagram", "story", "vertical"],
  },
  {
    id: "twitter-gif",
    name: "Twitter / X Post",
    description: "Landscape format optimized for timeline",
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
        position: { x: 5, y: 50 },
        size: { width: 90, height: 15 },
        properties: {
          text: "YOUR TEXT",
          fontSize: 56,
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
          strokeWidth: 2,
          strokeColor: "#000000",
        },
      },
    ],
    tags: ["twitter", "landscape", "timeline"],
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

function formatCategoryName(cat: TemplateCategory): string {
  if (cat === "of-content") return "OF Content";
  return cat
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
    "of-content",
    "social-media",
    "marketing",
    "tutorials",
    "entertainment",
    "professional",
  ];

  return categories
    .map((cat) => ({
      id: cat,
      name: formatCategoryName(cat),
      count: getTemplatesByCategory(cat).length,
    }))
    .filter((c) => c.count > 0);
}
