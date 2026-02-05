/**
 * Source Schema Types for ClientModel Migration
 *
 * These interfaces represent the source data structure from
 * tasty-creative-v2's ClientModel and ClientModelDetails tables.
 */

// ============================================
// ClientModel (Source)
// ============================================

export interface ClientModelSource {
  id: string;
  clientName: string;
  name: string | null;
  status: string | null;
  profilePicture: string | null;
  notes: string | null;
  personalityType: string | null;
  commonTerms: string | null; // Comma/semicolon delimited string
  commonEmojis: string | null; // Comma/semicolon delimited string
  restrictedTermsEmojis: string | null; // Comma/semicolon delimited string
  generalNotes: string | null;
  percentTaken: string | null; // Stored as string, needs parsing
  guaranteed: string | null; // Stored as string, needs parsing
  launchDate: string | Date | null;
  mainInstagram: string | null;
  mainTwitter: string | null;
  mainTiktok: string | null;
  profileLink: string | null;
  referrer: string | null;
  chattingManagers: string[]; // Already an array
  createdAt: Date;
  updatedAt: Date;
  // Relations
  details?: ClientModelDetailsSource | null;
}

// ============================================
// ClientModelDetails (Source)
// ============================================

export interface ClientModelDetailsSource {
  id: string;
  clientModelId: string;
  full_name: string | null;
  age: string | number | null; // May be string or number
  birthday: string | Date | null;
  height: string | null;
  weight: string | null;
  ethnicity: string | null;
  timezone: string | null;
  current_city: string | null;
  interests: string | null; // Comma/semicolon delimited string
  favorite_colors: string | null; // Comma/semicolon delimited string
  favorite_emojis: string | null; // Comma/semicolon delimited string
  content_offered: string | null; // Comma/semicolon delimited string
  custom_min_price: string | number | null; // May be string or number
  video_call_min_price: string | number | null; // May be string or number
  limitations: string | null; // Comma/semicolon delimited string
  verbiage_restrictions: string | null; // Comma/semicolon delimited string
  amazon_wishlist: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ContentDetails (Source)
// ============================================

export interface ContentDetailsSource {
  id: string;
  clientModelName: string;
  // Solo Content
  boobContent: string | null;
  pussyContent: string | null;
  soloSquirtContent: string | null;
  soloFingerContent: string | null;
  soloDildoContent: string | null;
  soloVibratorContent: string | null;
  joiContent: string | null;
  analContent: string | null;
  // Partner Content
  bgContent: string | null;
  bjHandjobContent: string | null;
  bggContent: string | null;
  bbgContent: string | null;
  orgyContent: string | null;
  ggContent: string | null;
  // Live & Custom
  livestreamContent: string | null;
  customVideoPricing: string | null;
  customCallPricing: string | null;
  // Bundle Packages
  bundleContent5_10: string | null;
  bundleContent10_15: string | null;
  bundleContent15_20: string | null;
  bundleContent20_25: string | null;
  bundleContent25_30: string | null;
  bundleContent30Plus: string | null;
  contentOptionsForGames: string | null;
  // Upsell Scripts
  upsell_1: string | null;
  upsell_2: string | null;
  upsell_3: string | null;
  upsell_4: string | null;
  upsell_5: string | null;
  upsell_6: string | null;
  upsell_7: string | null;
  upsell_8: string | null;
  upsell_9: string | null;
  upsell_10: string | null;
  upsell_11: string | null;
  upsell_12: string | null;
  upsell_13: string | null;
  upsell_14: string | null;
  upsell_15: string | null;
  upsell_16: string | null;
  upsell_17: string | null;
  // Restrictions & Notes
  twitterNudity: string | null;
  openToLivestreams: string | null;
  onlyFansWallLimitations: string | null;
  flyerCensorshipLimitations: string | null;
  notes: string | null;
  generalClientNotes: string | null;
  personalityType: string | null;
  restrictedTerms: string | null;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Migration Types
// ============================================

export interface MigrationPlan {
  sourceCount: number;
  targetExistingCount: number;
  toMigrate: MigrationRecord[];
  toSkip: SkippedRecord[];
  dryRun: boolean;
  generatedAt: string;
}

export interface MigrationRecord {
  sourceId: string;
  sourceName: string;
  targetSlug: string;
  hasDetails: boolean;
}

export interface SkippedRecord {
  sourceId: string;
  sourceName: string;
  reason: string;
}

export interface MigrationResult {
  success: boolean;
  modelsCreated: number;
  detailsCreated: number;
  skipped: number;
  errors: MigrationError[];
  completedAt: string;
}

export interface MigrationError {
  sourceId: string;
  sourceName: string;
  error: string;
}
