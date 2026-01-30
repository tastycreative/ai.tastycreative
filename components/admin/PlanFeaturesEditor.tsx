'use client';

import { Shield, Layers, Zap, Users as UsersIcon, Sparkles, Star, Settings, Wand2, Video, Film, Mic, Palette, PlayCircle, Shuffle, ImageIcon } from 'lucide-react';
import { PLAN_FEATURES, getFeaturesByCategory, getCategoryIcon, getCategoryTitle, FeatureDefinition } from '@/lib/planFeatures';

interface PlanFeaturesEditorProps {
  features: Record<string, boolean | number | null>;
  onChange: (features: Record<string, boolean | number | null>) => void;
}

// Define custom feature groups that match the navigation structure
const FEATURE_GROUPS = [
  {
    key: 'tabs',
    title: 'Navigation Tabs',
    icon: Layers,
    features: [
      'hasGenerateTab',
      'hasVaultTab',
      'hasTrainingTab',
      'hasInstagramTab',
      'hasPlanningTab',
      'hasPipelineTab',
      'hasAnalyticsTab',
      'hasFeedTab',
      'hasMarketplaceTab',
      'hasReferenceBank',
    ],
  },
  {
    key: 'flux_models',
    title: 'Flux Models',
    icon: Sparkles,
    features: [
      'canTextToImage',
      'canStyleTransfer',
      'canSkinEnhancer',
      'canFluxKontext',
    ],
  },
  {
    key: 'wan_models',
    title: 'Wan 2.2 Models',
    icon: Video,
    features: [
      'canTextToVideo',
      'canImageToVideo',
    ],
  },
  {
    key: 'advanced_tools',
    title: 'Advanced Tools',
    icon: Wand2,
    features: [
      'canFaceSwap',
      'canImageToImageSkinEnhancer',
      'canVideoFpsBoost',
    ],
  },
  {
    key: 'seedream',
    title: 'SeeDream 4.5',
    icon: Sparkles,
    features: [
      'canSeeDreamTextToImage',
      'canSeeDreamImageToImage',
      'canSeeDreamTextToVideo',
      'canSeeDreamImageToVideo',
    ],
  },
  {
    key: 'kling_ai',
    title: 'Kling AI',
    icon: Film,
    features: [
      'canKlingTextToVideo',
      'canKlingImageToVideo',
      'canKlingMultiImageToVideo',
      'canKlingMotionControl',
    ],
  },
  {
    key: 'ai_voice',
    title: 'AI Voice',
    icon: Mic,
    features: [
      'canAIVoice',
    ],
  },
  {
    key: 'training',
    title: 'Model Training',
    icon: Star,
    features: [
      'canTrainLoRA',
      'canShareLoRA',
    ],
  },
  {
    key: 'content_studio',
    title: 'Content Studio',
    icon: Zap,
    features: [
      'canAutoSchedule',
      'canBulkUpload',
      'canCaptionBank',
      'canHashtagBank',
      'canStoryPlanner',
      'canReelPlanner',
      'canFeedPostPlanner',
      'canContentPipeline',
      'canPerformanceMetrics',
    ],
  },
  {
    key: 'collaboration',
    title: 'Collaboration',
    icon: UsersIcon,
    features: [
      'canShareFolders',
      'canCreateFolders',
      'canApproveContent',
      'canCommentOnContent',
      'canAssignTasks',
      'canMentionTeam',
    ],
  },
  {
    key: 'advanced',
    title: 'Advanced Features',
    icon: Shield,
    features: [
      'canAccessMarketplace',
      'canExportData',
      'canAccessAPI',
      'canWhiteLabel',
      'canCustomBranding',
      'canWebhooks',
    ],
  },
  {
    key: 'limits',
    title: 'Limits',
    icon: Settings,
    features: [
      'maxVaultFolders',
    ],
  },
];

export default function PlanFeaturesEditor({ features, onChange }: PlanFeaturesEditorProps) {
  const toggleFeature = (key: string) => {
    onChange({
      ...features,
      [key]: !features[key],
    });
  };

  const setNumericValue = (key: string, value: number) => {
    onChange({
      ...features,
      [key]: value,
    });
  };

  const FeatureToggle = ({
    feature,
  }: {
    feature: FeatureDefinition;
  }) => {
    if (feature.type === 'number') {
      const numValue = typeof features[feature.key] === 'number' ? features[feature.key] as number : feature.defaultValue as number;
      return (
        <div className="col-span-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-900 dark:text-white">{feature.label}:</span>
            <input
              type="number"
              value={numValue}
              onChange={(e) => setNumericValue(feature.key, parseInt(e.target.value) || 0)}
              min="0"
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500"
            />
            {feature.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400">({feature.description})</span>
            )}
          </label>
        </div>
      );
    }

    return (
      <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group">
        <input
          type="checkbox"
          checked={!!features[feature.key]}
          onChange={() => toggleFeature(feature.key)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
        />
        <span className="text-sm text-gray-900 dark:text-white">{feature.label}</span>
      </label>
    );
  };

  // Toggle all features in a group
  const toggleAllInGroup = (groupKey: string) => {
    const group = FEATURE_GROUPS.find(g => g.key === groupKey);
    if (!group) return;

    const groupFeatures = PLAN_FEATURES.filter(f => group.features.includes(f.key));
    const allEnabled = groupFeatures.every(f => features[f.key]);

    const updates: Record<string, boolean | number | null> = {};
    groupFeatures.forEach(feature => {
      // Only toggle boolean features, not numeric ones
      if (feature.type === 'boolean') {
        updates[feature.key] = !allEnabled;
      }
    });

    onChange({
      ...features,
      ...updates,
    });
  };

  // Check if all features in a group are enabled
  const areGroupFeaturesEnabled = (groupKey: string) => {
    const group = FEATURE_GROUPS.find(g => g.key === groupKey);
    if (!group) return false;

    const groupFeatures = PLAN_FEATURES.filter(f => group.features.includes(f.key)).filter(f => f.type === 'boolean');
    if (groupFeatures.length === 0) return false;
    return groupFeatures.every(f => features[f.key]);
  };

  // Check if some (but not all) features in a group are enabled
  const areGroupFeaturesIndeterminate = (groupKey: string) => {
    const group = FEATURE_GROUPS.find(g => g.key === groupKey);
    if (!group) return false;

    const groupFeatures = PLAN_FEATURES.filter(f => group.features.includes(f.key)).filter(f => f.type === 'boolean');
    if (groupFeatures.length === 0) return false;
    const enabledCount = groupFeatures.filter(f => features[f.key]).length;
    return enabledCount > 0 && enabledCount < groupFeatures.length;
  };

  const FeatureGroup = ({
    group,
  }: {
    group: typeof FEATURE_GROUPS[0];
  }) => {
    const groupFeatures = PLAN_FEATURES.filter(f => group.features.includes(f.key));
    if (groupFeatures.length === 0) return null;

    const Icon = group.icon;
    const allEnabled = areGroupFeaturesEnabled(group.key);
    const indeterminate = areGroupFeaturesIndeterminate(group.key);

    return (
      <div>
        <label className="flex items-center gap-2 mb-3 cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors">
          <input
            type="checkbox"
            checked={allEnabled}
            ref={(el) => {
              if (el) el.indeterminate = indeterminate;
            }}
            onChange={() => toggleAllInGroup(group.key)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
          />
          <Icon className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{group.title}</h4>
        </label>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          {groupFeatures.map((feature) => (
            <FeatureToggle key={feature.key} feature={feature} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {FEATURE_GROUPS.map((group) => (
        <FeatureGroup key={group.key} group={group} />
      ))}
    </div>
  );
}
