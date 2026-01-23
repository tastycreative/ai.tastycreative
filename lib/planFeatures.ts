/**
 * Centralized Plan Features Configuration
 *
 * This file contains all available features and tabs in the system.
 * To add a new feature:
 * 1. Add it to the appropriate section below
 * 2. Run `npm run seed:plans` to update the database
 * 3. That's it! The UI will automatically pick it up.
 */

export interface FeatureDefinition {
  key: string;
  label: string;
  description?: string;
  category: 'tab' | 'generation' | 'training' | 'content' | 'collaboration' | 'advanced' | 'limit';
  type: 'boolean' | 'number';
  defaultValue: boolean | number;
}

export const PLAN_FEATURES: FeatureDefinition[] = [
  // ============================================
  // TABS - Main navigation tabs
  // ============================================
  {
    key: 'hasGenerateTab',
    label: 'Generate',
    description: 'AI image & video generation',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasVaultTab',
    label: 'Vault',
    description: 'Media storage & organization',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasTrainingTab',
    label: 'Training',
    description: 'LoRA model training',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasInstagramTab',
    label: 'Instagram',
    description: 'Instagram content management',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasPlanningTab',
    label: 'Planning',
    description: 'Content calendar',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasPipelineTab',
    label: 'Pipeline',
    description: 'Workflow management',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasAnalyticsTab',
    label: 'Analytics',
    description: 'Performance metrics',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasFeedTab',
    label: 'Feed',
    description: 'Social feed',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'hasMarketplaceTab',
    label: 'Marketplace',
    description: 'AI model marketplace',
    category: 'tab',
    type: 'boolean',
    defaultValue: true,
  },

  // ============================================
  // GENERATION FEATURES - AI generation tools
  // ============================================
  {
    key: 'canTextToImage',
    label: 'Text to Image',
    description: 'Generate images from text prompts',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canImageToVideo',
    label: 'Image to Video',
    description: 'Convert images to videos',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canImageToImage',
    label: 'Image to Image',
    description: 'Transform existing images',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canTextToVideo',
    label: 'Text to Video',
    description: 'Generate videos from text',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canFaceSwap',
    label: 'Face Swap',
    description: 'Swap faces in images/videos',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canFluxKontext',
    label: 'Flux Kontext',
    description: 'Context-aware generation',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canVideoFpsBoost',
    label: 'Video FPS Boost',
    description: 'Increase video frame rate',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canSkinEnhancement',
    label: 'Skin Enhancement',
    description: 'AI skin retouching',
    category: 'generation',
    type: 'boolean',
    defaultValue: true,
  },

  // ============================================
  // TRAINING FEATURES - Model training
  // ============================================
  {
    key: 'canTrainLoRA',
    label: 'Train LoRA',
    description: 'Train custom LoRA models',
    category: 'training',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canShareLoRA',
    label: 'Share LoRA',
    description: 'Share models with team',
    category: 'training',
    type: 'boolean',
    defaultValue: true,
  },

  // ============================================
  // CONTENT MANAGEMENT - Content tools
  // ============================================
  {
    key: 'canAutoSchedule',
    label: 'Auto Schedule',
    description: 'Automatic post scheduling',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canBulkUpload',
    label: 'Bulk Upload',
    description: 'Upload multiple files at once',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canCaptionBank',
    label: 'Caption Bank',
    description: 'Save and reuse captions',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canHashtagBank',
    label: 'Hashtag Bank',
    description: 'Hashtag library',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canStoryPlanner',
    label: 'Story Planner',
    description: 'Plan Instagram stories',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canReelPlanner',
    label: 'Reel Planner',
    description: 'Plan Instagram reels',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canFeedPostPlanner',
    label: 'Feed Post Planner',
    description: 'Plan feed posts',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canContentPipeline',
    label: 'Content Pipeline',
    description: 'Workflow management',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canPerformanceMetrics',
    label: 'Performance Metrics',
    description: 'Analytics dashboard',
    category: 'content',
    type: 'boolean',
    defaultValue: true,
  },

  // ============================================
  // COLLABORATION - Team features
  // ============================================
  {
    key: 'canShareFolders',
    label: 'Share Folders',
    description: 'Share vault folders with team',
    category: 'collaboration',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canCreateFolders',
    label: 'Create Folders',
    description: 'Create vault folders',
    category: 'collaboration',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canApproveContent',
    label: 'Approve Content',
    description: 'Content approval workflow',
    category: 'collaboration',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canCommentOnContent',
    label: 'Comment on Content',
    description: 'Add comments to content',
    category: 'collaboration',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canAssignTasks',
    label: 'Assign Tasks',
    description: 'Task assignment system',
    category: 'collaboration',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canMentionTeam',
    label: 'Mention Team',
    description: 'Tag team members',
    category: 'collaboration',
    type: 'boolean',
    defaultValue: true,
  },

  // ============================================
  // ADVANCED FEATURES - Enterprise features
  // ============================================
  {
    key: 'canAccessMarketplace',
    label: 'Access Marketplace',
    description: 'Browse & purchase models',
    category: 'advanced',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canExportData',
    label: 'Export Data',
    description: 'Export analytics & content',
    category: 'advanced',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'canAccessAPI',
    label: 'API Access',
    description: 'Use platform API',
    category: 'advanced',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'canWhiteLabel',
    label: 'White Label',
    description: 'Remove branding',
    category: 'advanced',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'canCustomBranding',
    label: 'Custom Branding',
    description: 'Add custom branding',
    category: 'advanced',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'canWebhooks',
    label: 'Webhooks',
    description: 'Configure webhooks',
    category: 'advanced',
    type: 'boolean',
    defaultValue: false,
  },

  // ============================================
  // LIMITS - Numeric limits
  // ============================================
  {
    key: 'maxVaultFolders',
    label: 'Max Vault Folders',
    description: 'Maximum number of vault folders (0 = unlimited)',
    category: 'limit',
    type: 'number',
    defaultValue: 10,
  },
];

// Helper functions
export const getFeaturesByCategory = (category: FeatureDefinition['category']) => {
  return PLAN_FEATURES.filter(f => f.category === category);
};

export const getDefaultFeatures = (): Record<string, boolean | number> => {
  return PLAN_FEATURES.reduce((acc, feature) => {
    acc[feature.key] = feature.defaultValue;
    return acc;
  }, {} as Record<string, boolean | number>);
};

export const getCategoryIcon = (category: FeatureDefinition['category']) => {
  const icons = {
    tab: 'Layers',
    generation: 'Sparkles',
    training: 'Star',
    content: 'Zap',
    collaboration: 'Users',
    advanced: 'Shield',
    limit: 'Settings',
  };
  return icons[category];
};

export const getCategoryTitle = (category: FeatureDefinition['category']) => {
  const titles = {
    tab: 'Available Tabs',
    generation: 'Generation Features',
    training: 'Training Features',
    content: 'Content Management',
    collaboration: 'Collaboration',
    advanced: 'Advanced Features',
    limit: 'Limits',
  };
  return titles[category];
};
