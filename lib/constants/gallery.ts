/**
 * Gallery Content Type Constants
 * Used for categorizing posted content in the Gallery feature
 */
export const GALLERY_CONTENT_TYPES = [
  "DICK_RATING",
  "SOLO_DILDO",
  "SOLO_FINGERS",
  "SOLO_VIBRATOR",
  "JOI",
  "SQUIRTING",
  "BG",
  "BJ",
  "GG",
  "GGG",
  "BGG",
  "BBG",
  "ORGY",
  "ANAL_BUTT_PLUG",
  "ANAL_SOLO",
  "ANAL_BG",
  "CREAM_PIE",
  "LIVES",
  "CUSTOM",
  "OTHER",
] as const;

export type GalleryContentType = (typeof GALLERY_CONTENT_TYPES)[number];

/**
 * Gallery Platform Constants
 * Platforms where content can be posted
 */
export const GALLERY_PLATFORMS = [
  "OF",
  "FANSLY",
  "IG",
  "TWITTER",
  "TIKTOK",
  "FANVUE",
  "OTHER",
] as const;

export type GalleryPlatform = (typeof GALLERY_PLATFORMS)[number];

/**
 * Gallery Item Origin Constants
 * Indicates how the gallery item was created
 */
export const GALLERY_ORIGINS = [
  "pipeline", // Created through Content Flow pipeline
  "manual", // Manually entered
  "import", // Imported from external source
  "migration", // Migrated from another system
] as const;

export type GalleryOrigin = (typeof GALLERY_ORIGINS)[number];

/**
 * Human-readable labels for content types
 */
export const CONTENT_TYPE_LABELS: Record<GalleryContentType, string> = {
  DICK_RATING: "Dick Rating",
  SOLO_DILDO: "Solo (Dildo)",
  SOLO_FINGERS: "Solo (Fingers)",
  SOLO_VIBRATOR: "Solo (Vibrator)",
  JOI: "JOI",
  SQUIRTING: "Squirting",
  BG: "B/G",
  BJ: "BJ",
  GG: "G/G",
  GGG: "G/G/G",
  BGG: "B/G/G",
  BBG: "B/B/G",
  ORGY: "Orgy",
  ANAL_BUTT_PLUG: "Anal (Butt Plug)",
  ANAL_SOLO: "Anal (Solo)",
  ANAL_BG: "Anal (B/G)",
  CREAM_PIE: "Cream Pie",
  LIVES: "Lives",
  CUSTOM: "Custom",
  OTHER: "Other",
};

/**
 * Human-readable labels for platforms
 */
export const PLATFORM_LABELS: Record<GalleryPlatform, string> = {
  OF: "OnlyFans",
  FANSLY: "Fansly",
  IG: "Instagram",
  TWITTER: "Twitter/X",
  TIKTOK: "TikTok",
  FANVUE: "Fanvue",
  OTHER: "Other",
};
