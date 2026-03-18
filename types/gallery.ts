import type { Decimal } from "@prisma/client/runtime/library";
import type {
  GalleryContentType,
  GalleryOrigin,
  GalleryPlatform,
} from "@/lib/constants/gallery";

/** Wall Post carousel media item stored inside boardMetadata */
export interface WallPostMediaItem {
  url: string;
  captionText: string | null;
  contentType: string;
  fileName: string | null;
  contentItemId: string | null;
}

/** OTP/PTR and Wall Post board-specific metadata stored as JSON */
export interface GalleryBoardMetadata {
  contentLength?: string;
  contentCount?: string;
  driveLink?: string;
  postLinkOnlyfans?: string;
  postLinkFansly?: string;
  gifUrl?: string;
  gifUrlFansly?: string;
  caption?: string;
  captionText?: string;
  internalModelTags?: string[];
  externalCreatorTags?: string[];
  profileId?: string;
  /** Resolved thumbnail from Google Drive folder or category placeholder */
  resolvedThumbnailUrl?: string;
  /** Whether the resolved thumbnail is an animated GIF (use GifThumbnail) */
  resolvedThumbnailIsGif?: string;
  /** Wall Post: all media items for the carousel */
  mediaItems?: WallPostMediaItem[];
}

/**
 * Gallery Item - Represents a piece of posted content with performance metrics
 */
export interface GalleryItem {
  id: string;

  // Organization scoping
  organizationId: string | null;

  // Content URLs
  previewUrl: string;
  thumbnailUrl: string | null;
  originalAssetUrl: string | null;

  // Metadata
  title: string | null;
  contentType: GalleryContentType | string;
  tags: string[];
  platform: GalleryPlatform | string;
  pricingAmount: Decimal | number | null;

  // Relations
  modelId: string | null;
  profileId: string | null;
  pipelineItemId: string | null;
  captionUsed: string | null;

  // Performance metrics
  revenue: Decimal | number;
  salesCount: number;
  conversionRate: Decimal | number | null;
  viewCount: number;

  // Tracking
  postedAt: Date;
  origin: GalleryOrigin | string | null;
  sourceId: string | null;

  // OTP/PTR fields
  postOrigin: string | null;
  pricingTier: string | null;
  pageType: string | null;
  boardMetadata: GalleryBoardMetadata | null;

  // Archive
  isArchived: boolean;
  archivedAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

/**
 * Gallery Item with Profile relation expanded
 */
export interface GalleryItemWithModel extends GalleryItem {
  profile: {
    id: string;
    name: string;
    profileImageUrl: string | null;
  } | null;
}

/**
 * Gallery Item Create Input
 */
export interface GalleryItemCreateInput {
  organizationId?: string;
  previewUrl: string;
  thumbnailUrl?: string;
  originalAssetUrl?: string;
  title?: string;
  contentType: GalleryContentType | string;
  tags?: string[];
  platform: GalleryPlatform | string;
  pricingAmount?: number;
  modelId?: string;
  profileId?: string;
  pipelineItemId?: string;
  captionUsed?: string;
  revenue?: number;
  salesCount?: number;
  conversionRate?: number;
  viewCount?: number;
  postedAt: Date | string;
  origin?: GalleryOrigin | string;
  sourceId?: string;
  createdBy?: string;
}

/**
 * Gallery Item Update Input
 */
export interface GalleryItemUpdateInput {
  previewUrl?: string;
  thumbnailUrl?: string | null;
  originalAssetUrl?: string | null;
  title?: string | null;
  contentType?: GalleryContentType | string;
  tags?: string[];
  platform?: GalleryPlatform | string;
  pricingAmount?: number | null;
  modelId?: string | null;
  captionUsed?: string | null;
  revenue?: number;
  salesCount?: number;
  conversionRate?: number | null;
  viewCount?: number;
  postedAt?: Date | string;
  isArchived?: boolean;
}

/**
 * Gallery Performance Summary
 */
export interface GalleryPerformanceSummary {
  totalItems: number;
  totalRevenue: number;
  totalSales: number;
  totalViews: number;
  averageConversionRate: number | null;
  topContentTypes: {
    contentType: string;
    count: number;
    revenue: number;
  }[];
  topPlatforms: {
    platform: string;
    count: number;
    revenue: number;
  }[];
}

/**
 * Gallery Filters
 */
export interface GalleryFilters {
  organizationId?: string;
  modelId?: string;
  profileId?: string;
  contentType?: GalleryContentType | string;
  platform?: GalleryPlatform | string;
  isArchived?: boolean;
  postedAfter?: Date | string;
  postedBefore?: Date | string;
  minRevenue?: number;
  maxRevenue?: number;
  tags?: string[];
  search?: string;
}

/**
 * Gallery Sort Options
 */
export type GallerySortField =
  | "postedAt"
  | "revenue"
  | "salesCount"
  | "viewCount"
  | "conversionRate"
  | "createdAt";

export type GallerySortOrder = "asc" | "desc";

export interface GallerySort {
  field: GallerySortField;
  order: GallerySortOrder;
}

/**
 * Gallery Pagination
 */
export interface GalleryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Gallery List Response
 */
export interface GalleryListResponse {
  items: GalleryItemWithModel[];
  pagination: GalleryPagination;
  summary?: GalleryPerformanceSummary;
}
