/**
 * Client Model Mapper Utilities
 *
 * Field transformation functions for migrating ClientModel data
 * from tasty-creative-v2 to ai.tastycreative's of_models schema.
 */

import type { OfModelStatus } from "@/types/of-model";
import type {
  ClientModelSource,
  ClientModelDetailsSource,
} from "@/types/client-model-source";

// ============================================
// Slug Generation
// ============================================

/**
 * Generate a URL-friendly slug from a name
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug by appending numbers if necessary
 */
export function generateUniqueSlug(
  baseName: string,
  existingSlugs: Set<string>
): string {
  const baseSlug = slugify(baseName);

  if (!baseSlug) {
    // Handle empty slugs
    let counter = 1;
    while (existingSlugs.has(`model-${counter}`)) {
      counter++;
    }
    return `model-${counter}`;
  }

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  // Append incrementing numbers until we find a unique one
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}

// ============================================
// Status Mapping
// ============================================

const STATUS_MAP: Record<string, OfModelStatus> = {
  active: "ACTIVE",
  inactive: "INACTIVE",
  dropped: "DROPPED",
  pending: "PENDING",
  // Common variations
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DROPPED: "DROPPED",
  PENDING: "PENDING",
  // Legacy/alternative values
  disabled: "INACTIVE",
  paused: "INACTIVE",
  archived: "DROPPED",
  new: "PENDING",
};

/**
 * Map source status string to OfModelStatus enum
 */
export function mapStatus(status: string | null | undefined): OfModelStatus {
  if (!status) return "PENDING";

  const normalized = status.trim().toLowerCase();
  return STATUS_MAP[status] || STATUS_MAP[normalized] || "PENDING";
}

// ============================================
// Type Parsers
// ============================================

/**
 * Safely parse a string or number to Float
 * Returns null for invalid/empty values
 */
export function parseToFloat(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  // Remove currency symbols, commas, percentages
  const cleaned = value.replace(/[$,%\s]/g, "").trim();
  if (!cleaned) return null;

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Safely parse a string or number to Int
 * Returns null for invalid/empty values
 */
export function parseToInt(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return isNaN(value) ? null : Math.floor(value);
  }

  const cleaned = value.replace(/[^\d-]/g, "").trim();
  if (!cleaned) return null;

  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse a delimited string to an array
 * Handles comma, semicolon, and newline delimiters
 */
export function parseToArray(
  value: string | string[] | null | undefined
): string[] {
  if (!value) return [];

  // Already an array
  if (Array.isArray(value)) {
    return value.map((v) => v.trim()).filter(Boolean);
  }

  // Split by common delimiters
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Safely parse a date string to Date object
 * Returns null for invalid dates
 */
export function parseToDate(
  value: string | Date | null | undefined
): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normalize empty strings to null
 */
export function normalizeString(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

// ============================================
// Full Record Mappers
// ============================================

export interface MappedOfModel {
  name: string;
  displayName: string;
  slug: string;
  status: OfModelStatus;
  profileImageUrl: string | null;
  bio: string | null;
  personalityType: string | null;
  commonTerms: string[];
  commonEmojis: string[];
  restrictedTerms: string[];
  notes: string | null;
  percentageTaken: number | null;
  guaranteedAmount: number | null;
  launchDate: Date | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  profileLinkUrl: string | null;
  referrerName: string | null;
  chattingManagers: string[];
}

export interface MappedOfModelDetails {
  fullName: string | null;
  age: number | null;
  birthday: Date | null;
  height: string | null;
  weight: string | null;
  ethnicity: string | null;
  timezone: string | null;
  currentCity: string | null;
  interests: string[];
  favoriteColors: string[];
  favoriteEmojis: string[];
  contentOffered: string[];
  customMinPrice: number | null;
  videoCallMinPrice: number | null;
  limitations: string[];
  verbiageRestrictions: string[];
  amazonWishlist: string | null;
  onboardingCompleted: boolean;
}

/**
 * Map a source ClientModel to target of_models fields
 */
export function mapClientModelToOfModel(
  source: ClientModelSource,
  existingSlugs: Set<string>
): MappedOfModel {
  const name = source.clientName || "Unnamed Model";
  const displayName = source.name || source.clientName || "Unnamed Model";

  return {
    name,
    displayName,
    slug: generateUniqueSlug(name, existingSlugs),
    status: mapStatus(source.status),
    profileImageUrl: normalizeString(source.profileLink), // profileLink is used as image URL in old app
    bio: normalizeString(source.notes),
    personalityType: normalizeString(source.personalityType),
    commonTerms: parseToArray(source.commonTerms),
    commonEmojis: parseToArray(source.commonEmojis),
    restrictedTerms: parseToArray(source.restrictedTermsEmojis),
    notes: normalizeString(source.generalNotes),
    percentageTaken: parseToFloat(source.percentTaken),
    guaranteedAmount: parseToFloat(source.guaranteed),
    launchDate: parseToDate(source.launchDate),
    instagramUrl: normalizeString(source.mainInstagram),
    twitterUrl: normalizeString(source.mainTwitter),
    tiktokUrl: normalizeString(source.mainTiktok),
    profileLinkUrl: normalizeString(source.profileLink),
    referrerName: normalizeString(source.referrer),
    chattingManagers: source.chattingManagers || [],
  };
}

/**
 * Map source ClientModelDetails to target of_model_details fields
 */
export function mapClientModelDetailsToOfModelDetails(
  source: ClientModelDetailsSource
): MappedOfModelDetails {
  return {
    fullName: normalizeString(source.full_name),
    age: parseToInt(source.age),
    birthday: parseToDate(source.birthday),
    height: normalizeString(source.height),
    weight: normalizeString(source.weight),
    ethnicity: normalizeString(source.ethnicity),
    timezone: normalizeString(source.timezone),
    currentCity: normalizeString(source.current_city),
    interests: parseToArray(source.interests),
    favoriteColors: parseToArray(source.favorite_colors),
    favoriteEmojis: parseToArray(source.favorite_emojis),
    contentOffered: parseToArray(source.content_offered),
    customMinPrice: parseToFloat(source.custom_min_price),
    videoCallMinPrice: parseToFloat(source.video_call_min_price),
    limitations: parseToArray(source.limitations),
    verbiageRestrictions: parseToArray(source.verbiage_restrictions),
    amazonWishlist: normalizeString(source.amazon_wishlist),
    onboardingCompleted: source.onboardingCompleted ?? false,
  };
}
