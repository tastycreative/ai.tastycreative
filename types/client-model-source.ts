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
