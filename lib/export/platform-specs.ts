/**
 * V1a Platform Specs - Dimension configurations for platform-ready exports
 *
 * These specs define the optimal image dimensions for each platform,
 * ensuring content is formatted correctly for maximum engagement.
 */

export type PlatformId =
  | 'onlyfans'
  | 'fansly'
  | 'fanvue'
  | 'instagram-posts'
  | 'instagram-stories'
  | 'instagram-reels'
  | 'twitter'
  | 'tiktok';

export type AspectRatio = '3:4' | '4:3' | '4:5' | '1:1' | '9:16' | '16:9';

export interface PlatformDimension {
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  label: string;
  recommended?: boolean;
}

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  shortName: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color
  dimensions: PlatformDimension[];
  captionLimits: {
    maxLength: number;
    hashtagLimit?: number;
    mentionLimit?: number;
  };
  fileFormats: string[];
  maxFileSize: number; // in MB
  notes?: string;
}

export const PLATFORM_SPECS: Record<PlatformId, PlatformSpec> = {
  'onlyfans': {
    id: 'onlyfans',
    name: 'OnlyFans',
    shortName: 'OF',
    icon: 'Heart',
    color: 'blue',
    dimensions: [
      { width: 1200, height: 1600, aspectRatio: '3:4', label: 'Portrait (3:4)', recommended: true },
      { width: 1600, height: 1200, aspectRatio: '4:3', label: 'Landscape (4:3)' },
      { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square (1:1)' },
    ],
    captionLimits: {
      maxLength: 1000,
    },
    fileFormats: ['jpg', 'jpeg', 'png', 'gif', 'mp4'],
    maxFileSize: 50,
    notes: 'Portrait format performs best for feed content',
  },

  'fansly': {
    id: 'fansly',
    name: 'Fansly',
    shortName: 'Fansly',
    icon: 'Star',
    color: 'cyan',
    dimensions: [
      { width: 1200, height: 1600, aspectRatio: '3:4', label: 'Portrait (3:4)', recommended: true },
      { width: 1600, height: 1200, aspectRatio: '4:3', label: 'Landscape (4:3)' },
      { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square (1:1)' },
    ],
    captionLimits: {
      maxLength: 1000,
    },
    fileFormats: ['jpg', 'jpeg', 'png', 'gif', 'mp4'],
    maxFileSize: 50,
    notes: 'Similar specs to OnlyFans',
  },

  'fanvue': {
    id: 'fanvue',
    name: 'Fanvue',
    shortName: 'Fanvue',
    icon: 'Sparkles',
    color: 'purple',
    dimensions: [
      { width: 1200, height: 1600, aspectRatio: '3:4', label: 'Portrait (3:4)', recommended: true },
      { width: 1600, height: 1200, aspectRatio: '4:3', label: 'Landscape (4:3)' },
      { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square (1:1)' },
    ],
    captionLimits: {
      maxLength: 1000,
    },
    fileFormats: ['jpg', 'jpeg', 'png', 'gif', 'mp4'],
    maxFileSize: 50,
    notes: 'Similar specs to OnlyFans',
  },

  'instagram-posts': {
    id: 'instagram-posts',
    name: 'Instagram Posts',
    shortName: 'IG Posts',
    icon: 'Instagram',
    color: 'pink',
    dimensions: [
      { width: 1080, height: 1350, aspectRatio: '4:5', label: 'Portrait (4:5)', recommended: true },
      { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Square (1:1)' },
    ],
    captionLimits: {
      maxLength: 2200,
      hashtagLimit: 30,
      mentionLimit: 20,
    },
    fileFormats: ['jpg', 'jpeg', 'png'],
    maxFileSize: 8,
    notes: '4:5 portrait takes up more screen space in feed',
  },

  'instagram-stories': {
    id: 'instagram-stories',
    name: 'Instagram Stories',
    shortName: 'IG Stories',
    icon: 'Circle',
    color: 'pink',
    dimensions: [
      { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Full Screen (9:16)', recommended: true },
    ],
    captionLimits: {
      maxLength: 2200,
      hashtagLimit: 10,
    },
    fileFormats: ['jpg', 'jpeg', 'png', 'mp4'],
    maxFileSize: 8,
    notes: 'Keep important content in center 1080x1420 safe zone',
  },

  'instagram-reels': {
    id: 'instagram-reels',
    name: 'Instagram Reels',
    shortName: 'IG Reels',
    icon: 'Play',
    color: 'pink',
    dimensions: [
      { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Full Screen (9:16)', recommended: true },
    ],
    captionLimits: {
      maxLength: 2200,
      hashtagLimit: 30,
    },
    fileFormats: ['mp4'],
    maxFileSize: 650,
    notes: 'Videos up to 90 seconds',
  },

  'twitter': {
    id: 'twitter',
    name: 'Twitter / X',
    shortName: 'X',
    icon: 'Twitter',
    color: 'slate',
    dimensions: [
      { width: 1200, height: 675, aspectRatio: '16:9', label: 'Landscape (16:9)', recommended: true },
      { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square (1:1)' },
    ],
    captionLimits: {
      maxLength: 280,
      hashtagLimit: 2, // Best practice, not enforced
    },
    fileFormats: ['jpg', 'jpeg', 'png', 'gif', 'mp4'],
    maxFileSize: 15,
    notes: 'Keep tweets concise; 1-2 hashtags max for engagement',
  },

  'tiktok': {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TikTok',
    icon: 'Music',
    color: 'rose',
    dimensions: [
      { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Full Screen (9:16)', recommended: true },
    ],
    captionLimits: {
      maxLength: 4000,
      hashtagLimit: 5, // Best practice
    },
    fileFormats: ['mp4'],
    maxFileSize: 287,
    notes: 'Videos perform best; 3-5 relevant hashtags',
  },
};

/**
 * Get all platforms as an array for iteration
 */
export function getAllPlatforms(): PlatformSpec[] {
  return Object.values(PLATFORM_SPECS);
}

/**
 * Get platform spec by ID
 */
export function getPlatformSpec(platformId: PlatformId): PlatformSpec | undefined {
  return PLATFORM_SPECS[platformId];
}

/**
 * Get recommended dimension for a platform
 */
export function getRecommendedDimension(platformId: PlatformId): PlatformDimension | undefined {
  const spec = PLATFORM_SPECS[platformId];
  if (!spec) return undefined;
  return spec.dimensions.find(d => d.recommended) || spec.dimensions[0];
}

/**
 * Get all platforms grouped by category
 */
export function getPlatformsByCategory() {
  return {
    subscription: [
      PLATFORM_SPECS['onlyfans'],
      PLATFORM_SPECS['fansly'],
      PLATFORM_SPECS['fanvue'],
    ],
    social: [
      PLATFORM_SPECS['instagram-posts'],
      PLATFORM_SPECS['instagram-stories'],
      PLATFORM_SPECS['instagram-reels'],
      PLATFORM_SPECS['twitter'],
      PLATFORM_SPECS['tiktok'],
    ],
  };
}

/**
 * Platform-specific folder names for export ZIP structure
 */
export const PLATFORM_FOLDER_NAMES: Record<PlatformId, string> = {
  'onlyfans': 'OnlyFans',
  'fansly': 'Fansly',
  'fanvue': 'Fanvue',
  'instagram-posts': 'Instagram-Posts',
  'instagram-stories': 'Instagram-Stories',
  'instagram-reels': 'Instagram-Reels',
  'twitter': 'Twitter',
  'tiktok': 'TikTok',
};

/**
 * Content type definitions for two-axis tagging
 * Axis 1: What's in the content
 */
export const CONTENT_TYPES = [
  { id: 'solo', label: 'Solo', description: 'Single person content' },
  { id: 'bg', label: 'B/G', description: 'Boy/Girl content' },
  { id: 'gg', label: 'G/G', description: 'Girl/Girl content' },
  { id: 'anal', label: 'Anal', description: 'Anal content' },
  { id: 'squirting', label: 'Squirting', description: 'Squirting content' },
  { id: 'bundles', label: 'Bundles', description: 'Bundle/set content' },
  { id: 'bts', label: 'BTS', description: 'Behind the scenes' },
  { id: 'tease', label: 'Tease', description: 'Teaser content' },
  { id: 'explicit', label: 'Explicit', description: 'Explicit content' },
  { id: 'sfw', label: 'SFW', description: 'Safe for work content' },
] as const;

/**
 * Message type definitions for two-axis tagging
 * Axis 2: Operational purpose of the message
 */
export const MESSAGE_TYPES = [
  { id: 'bundle_unlock', label: 'Bundle Unlock', description: 'Promoting bundle purchases' },
  { id: 'tip_me', label: 'Tip Me', description: 'Tip request messages' },
  { id: 'mass_message', label: 'Mass Message', description: 'Broadcast to all subscribers' },
  { id: 'dm_funnel', label: 'DM Funnel', description: 'Direct message conversation starters' },
  { id: 'wall_bump', label: 'Wall Bump', description: 'Wall/feed post engagement' },
  { id: 'renew', label: 'Renew', description: 'Subscription renewal prompts' },
  { id: 'welcome', label: 'Welcome', description: 'New subscriber welcome messages' },
  { id: 'promo', label: 'Promo', description: 'Promotional content' },
  { id: 'engagement', label: 'Engagement', description: 'Engagement-focused content' },
  { id: 'custom', label: 'Custom', description: 'Custom request responses' },
] as const;

export type ContentTypeId = typeof CONTENT_TYPES[number]['id'];
export type MessageTypeId = typeof MESSAGE_TYPES[number]['id'];
