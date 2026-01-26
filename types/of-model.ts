// OF Models TypeScript Types
// Based on Prisma schema: of_models, of_model_details, of_model_assets, of_model_pricing_categories, of_model_pricing_items

// ============================================
// Enums
// ============================================

export type OfModelStatus = 'ACTIVE' | 'INACTIVE' | 'DROPPED' | 'PENDING';

export type OfModelAssetType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER';

// ============================================
// Core Models
// ============================================

export interface OfModel {
  id: string;
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
  launchDate: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
  profileLinkUrl: string | null;
  referrerName: string | null;
  chattingManagers: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  // Relations (optional, populated when included)
  of_model_details?: OfModelDetails | null;
  of_model_assets?: OfModelAsset[];
  of_model_pricing_categories?: OfModelPricingCategory[];
  // Count aggregations
  _count?: {
    of_model_assets?: number;
    of_model_pricing_categories?: number;
  };
}

export interface OfModelDetails {
  id: string;
  creatorId: string;
  fullName: string | null;
  age: number | null;
  birthday: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface OfModelAsset {
  id: string;
  creatorId: string;
  type: OfModelAssetType;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfModelPricingCategory {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  // Relations
  of_model_pricing_items?: OfModelPricingItem[];
}

export interface OfModelPricingItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  description: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface OfModelFilters {
  search?: string;
  status?: OfModelStatus | 'all';
  sort?: 'name' | 'createdAt' | 'launchDate';
  sortDirection?: 'asc' | 'desc';
}

export interface OfModelStats {
  total: number;
  active: number;
  inactive: number;
  dropped: number;
  pending: number;
}

export interface CreateOfModelInput {
  name: string;
  displayName: string;
  slug?: string; // Auto-generated if not provided
  status?: OfModelStatus;
  profileImageUrl?: string;
  bio?: string;
  personalityType?: string;
  commonTerms?: string[];
  commonEmojis?: string[];
  restrictedTerms?: string[];
  notes?: string;
  percentageTaken?: number;
  guaranteedAmount?: number;
  launchDate?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  profileLinkUrl?: string;
  referrerName?: string;
  chattingManagers?: string[];
}

export interface UpdateOfModelInput extends Partial<CreateOfModelInput> {
  id: string;
}

export interface CreateOfModelDetailsInput {
  fullName?: string;
  age?: number;
  birthday?: string;
  height?: string;
  weight?: string;
  ethnicity?: string;
  timezone?: string;
  currentCity?: string;
  interests?: string[];
  favoriteColors?: string[];
  favoriteEmojis?: string[];
  contentOffered?: string[];
  customMinPrice?: number;
  videoCallMinPrice?: number;
  limitations?: string[];
  verbiageRestrictions?: string[];
  amazonWishlist?: string;
  onboardingCompleted?: boolean;
}

export interface CreateOfModelAssetInput {
  type: OfModelAssetType;
  name: string;
  url: string;
  thumbnailUrl?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateOfModelPricingCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  order?: number;
}

export interface CreateOfModelPricingItemInput {
  name: string;
  price: number;
  description?: string;
  order?: number;
  isActive?: boolean;
}

// ============================================
// API Response Wrappers
// ============================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export type OfModelListResponse = ApiResponse<OfModel[]>;
export type OfModelResponse = ApiResponse<OfModel>;
export type OfModelDetailsResponse = ApiResponse<OfModelDetails>;
export type OfModelAssetsResponse = ApiResponse<OfModelAsset[]>;
export type OfModelStatsResponse = ApiResponse<OfModelStats>;
export type OfModelPricingCategoriesResponse = ApiResponse<OfModelPricingCategory[]>;
