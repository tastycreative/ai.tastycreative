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
  type: "text" | "shape" | "blur" | "sticker";
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

/** Big colored/gradient buzz word — the focal point */
function ofBuzzWord(
  text: string,
  x: number,
  y: number,
  color: string,
  overrides: Record<string, unknown> = {},
): TemplateOverlay {
  return {
    type: "text",
    position: { x, y },
    size: { width: 90, height: 22 },
    properties: {
      text,
      fontSize: 80,
      ...OF_TEXT_BASE,
      strokeWidth: 4,
      ...OF_SHADOW_STRONG,
      color,
      ...overrides,
    },
  };
}

/** Standard white headline — smaller than buzz word */
function ofHeadline(
  text: string,
  y: number,
  overrides: Record<string, unknown> = {},
): TemplateOverlay {
  return {
    type: "text",
    position: { x: 5, y },
    size: { width: 90, height: 16 },
    properties: {
      text,
      fontSize: 48,
      ...OF_TEXT_BASE,
      strokeWidth: 3,
      ...OF_SHADOW_STRONG,
      color: "#ffffff",
      ...overrides,
    },
  };
}

/** Small descriptor text */
function ofSubtitle(
  text: string,
  y: number,
  overrides: Record<string, unknown> = {},
): TemplateOverlay {
  return {
    type: "text",
    position: { x: 5, y },
    size: { width: 90, height: 10 },
    properties: {
      text,
      fontSize: 32,
      ...OF_TEXT_BASE,
      strokeWidth: 2,
      ...OF_SHADOW_LIGHT,
      color: "#ffffff",
      ...overrides,
    },
  };
}

/** Emoji sticker overlay */
function ofEmoji(
  emoji: string,
  x: number,
  y: number,
  size: number = 12,
  overrides: Record<string, unknown> = {},
): TemplateOverlay {
  return {
    type: "sticker",
    position: { x, y },
    size: { width: size, height: size },
    properties: {
      src: emoji,
      isEmoji: true,
      rotation: 0,
      opacity: 1,
      ...overrides,
    },
  };
}

// ═══════════════════════════════════════════════════════
// TEMPLATE LIBRARY
// ═══════════════════════════════════════════════════════

export const TEMPLATES: Template[] = [
  // ─────────────────────────────────────────────────────
  // OF CONTENT TEMPLATES
  // Guide rules: different sizes per word, gradient on buzz words,
  // emojis match color theme, text at bottom to not cover model
  // ─────────────────────────────────────────────────────

  // ── BJ / Wet theme (blue gradient + 💦 emojis) ────
  {
    id: "of-bj-blue",
    name: "BJ / Wet (Blue)",
    description: "Blue gradient buzz word + 💦 emojis — matches wet/BJ content tone",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("SUCKED &", 55),
      ofBuzzWord("EVERY", 5, 63, "#00AAFF", {
        useGradient: true,
        gradientColors: ["#00D4FF", "#0077FF"],
        gradientAngle: 180,
      }),
      ofHeadline("LAST DROP", 72, { textAlign: "right" }),
      ofEmoji("💦", 5, 80, 14),
      ofEmoji("💦", 75, 80, 14),
    ],
    tags: ["of", "bj", "wet", "blue", "gradient", "emoji", "3:4"],
  },
  {
    id: "of-sloppy-blue",
    name: "Sloppy (Blue)",
    description: "Sloppy content with blue gradient emphasis + drool emoji",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofBuzzWord("SLOPPY", 5, 58, "#00AAFF", {
        useGradient: true,
        gradientColors: ["#00D4FF", "#0066FF"],
        gradientAngle: 180,
      }),
      ofHeadline("& MESSY", 72),
      ofEmoji("🤤", 5, 80, 14),
      ofEmoji("💦", 78, 55, 10),
    ],
    tags: ["of", "sloppy", "messy", "blue", "gradient", "3:4"],
  },

  // ── Hot / Fire theme (pink-red gradient + 🔥 emojis) ──
  {
    id: "of-hot-pink",
    name: "Hot Content (Pink)",
    description: "Pink gradient buzz word + 🔥 emojis — intense content",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("SO FUCKING", 55),
      ofBuzzWord("HOT", 5, 64, "#FF1493", {
        fontSize: 96,
        useGradient: true,
        gradientColors: ["#FF69B4", "#FF1493"],
        gradientAngle: 180,
      }),
      ofEmoji("🔥", 5, 82, 14),
      ofEmoji("🥵", 78, 82, 14),
    ],
    tags: ["of", "hot", "pink", "fire", "gradient", "emoji", "3:4"],
  },
  {
    id: "of-pounding-pink",
    name: "Pounding (Pink)",
    description: "Bold pink headline with scared emoji — intense action",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofEmoji("😱", 2, 2, 14),
      ofBuzzWord("PUSSY", 5, 50, "#FF69B4", {
        useGradient: true,
        gradientColors: ["#FF69B4", "#E1518E"],
        gradientAngle: 180,
      }),
      ofHeadline("POUNDING!!", 63, { fontSize: 56 }),
      ofSubtitle("SQUIRTING, ANAL + MORE!!!!", 76),
    ],
    tags: ["of", "pounding", "pink", "intense", "3:4"],
  },

  // ── Naughty / Tears theme (cyan gradient + 😏🥺 emojis) ──
  {
    id: "of-tears-cyan",
    name: "To Tears (Cyan)",
    description: "Cyan gradient on TEARS + sad emojis — crying content tone",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("SUCKED & FUCKED", 52),
      ofHeadline("TO", 66),
      ofBuzzWord("TEARS", 30, 64, "#00D4FF", {
        useGradient: true,
        gradientColors: ["#5DC3F8", "#00AAFF"],
        gradientAngle: 180,
        textAlign: "left",
      }),
      ofEmoji("😏", 10, 80, 16),
      ofEmoji("🥺", 65, 80, 16),
    ],
    tags: ["of", "tears", "crying", "cyan", "gradient", "emoji", "3:4"],
  },

  // ── Sale / Promo theme (gold gradient + 💰 emojis) ──
  {
    id: "of-sale-gold",
    name: "Sale (Gold)",
    description: "Gold gradient on discount amount + money emojis",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 5 },
    overlays: [
      ofHeadline("LIMITED TIME", 50),
      ofBuzzWord("50% OFF", 5, 60, "#FFD700", {
        fontSize: 88,
        useGradient: true,
        gradientColors: ["#FFD700", "#FF8C00"],
        gradientAngle: 180,
      }),
      ofSubtitle("DON'T MISS OUT", 78),
      ofEmoji("💰", 5, 82, 12),
      ofEmoji("🤑", 80, 82, 12),
    ],
    tags: ["of", "sale", "discount", "gold", "promo", "3:4"],
  },

  // ── Renewal / Gift theme (orange-gold + 🎁 emojis) ──
  {
    id: "of-renewal-gift",
    name: "Renewal Gift",
    description: "Renewal CTA with orange buzz word + gift emoji",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("TURN ON", 52),
      ofBuzzWord("RENEW", 5, 61, "#FF8C00", {
        useGradient: true,
        gradientColors: ["#FF8C00", "#FFD700"],
        gradientAngle: 180,
      }),
      ofHeadline("FOR A HUGE", 74),
      ofBuzzWord("GIFT", 30, 82, "#FFD700", {
        fontSize: 64,
        textAlign: "left",
      }),
      ofEmoji("🎁", 65, 82, 14),
    ],
    tags: ["of", "renewal", "gift", "orange", "gradient", "3:4"],
  },

  // ── Check DMs / Mass Message (pink + 📩 emojis) ──
  {
    id: "of-check-dms",
    name: "Check DMs",
    description: "Mass message promo with pink DMs buzz word + envelope emoji",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 5 },
    overlays: [
      ofHeadline("CHECK YOUR", 55),
      ofBuzzWord("DMS", 5, 64, "#FF1493", {
        fontSize: 96,
        useGradient: true,
        gradientColors: ["#FF69B4", "#FF1493"],
        gradientAngle: 180,
      }),
      ofSubtitle("SOMETHING SPECIAL WAITING 😈", 80),
    ],
    tags: ["of", "mass-message", "dm", "pink", "promo", "3:4"],
  },

  // ── PPV / Unlock (green neon glow + 🔓 emojis) ──
  {
    id: "of-ppv-unlock",
    name: "PPV Unlock",
    description: "Neon green UNLOCK buzz word + lock emoji",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofBuzzWord("UNLOCK", 5, 55, "#39FF14", {
        fontSize: 88,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 15,
        shadowColor: "#39FF14",
      }),
      ofHeadline("THIS VIDEO", 70),
      ofEmoji("🔓", 5, 80, 14),
      ofEmoji("👀", 78, 80, 14),
    ],
    tags: ["of", "ppv", "unlock", "neon", "green", "3:4"],
  },

  // ── New Content Drop (orange-gold gradient) ──
  {
    id: "of-new-drop",
    name: "New Drop",
    description: "Orange-gold gradient NEW DROP + fire emoji",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 5 },
    overlays: [
      ofBuzzWord("NEW", 5, 55, "#FF6B35", {
        fontSize: 96,
        useGradient: true,
        gradientColors: ["#FF6B35", "#FFD700"],
        gradientAngle: 180,
      }),
      ofHeadline("DROP", 70, { fontSize: 56 }),
      ofSubtitle("AVAILABLE NOW", 82),
      ofEmoji("🔥", 78, 55, 12),
    ],
    tags: ["of", "new", "drop", "orange", "gradient", "3:4"],
  },

  // ── Creampie / Cum theme (white + 🍦 emojis) ──
  {
    id: "of-creampie",
    name: "Creampie",
    description: "White glow CREAMPIE buzz word with matching emojis",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("DEEP", 52),
      ofBuzzWord("CREAMPIE", 5, 61, "#FFFFFF", {
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 12,
        shadowColor: "rgba(255,255,255,0.6)",
      }),
      ofSubtitle("WATCH IT DRIP", 78),
      ofEmoji("🍦", 5, 82, 12),
      ofEmoji("😩", 80, 82, 12),
    ],
    tags: ["of", "creampie", "white", "glow", "3:4"],
  },

  // ── Anal theme (purple gradient + 🍑 emojis) ──
  {
    id: "of-anal-purple",
    name: "Anal (Purple)",
    description: "Purple gradient ANAL buzz word + peach emoji",
    category: "of-content",
    platform: "of-standard",
    settings: { ...OF_SETTINGS, duration: 4 },
    overlays: [
      ofHeadline("FIRST TIME", 52),
      ofBuzzWord("ANAL", 5, 62, "#A855F7", {
        fontSize: 96,
        useGradient: true,
        gradientColors: ["#C084FC", "#A855F7"],
        gradientAngle: 180,
      }),
      ofSubtitle("IT BARELY FITS", 78),
      ofEmoji("🍑", 5, 82, 14),
      ofEmoji("😳", 78, 82, 14),
    ],
    tags: ["of", "anal", "purple", "gradient", "3:4"],
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
