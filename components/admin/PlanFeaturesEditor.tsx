'use client';

import { Shield, Layers, Zap, Users as UsersIcon, Sparkles, Star, Settings } from 'lucide-react';
import { PLAN_FEATURES, getFeaturesByCategory, getCategoryIcon, getCategoryTitle, FeatureDefinition } from '@/lib/planFeatures';

interface PlanFeaturesEditorProps {
  features: Record<string, boolean | number | null>;
  onChange: (features: Record<string, boolean | number | null>) => void;
}

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

  // Get icon component from icon name string
  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      Layers,
      Sparkles,
      Star,
      Zap,
      Users: UsersIcon,
      Shield,
      Settings,
    };
    return icons[iconName] || Shield;
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

  const FeatureSection = ({
    category,
  }: {
    category: FeatureDefinition['category'];
  }) => {
    const categoryFeatures = getFeaturesByCategory(category);
    if (categoryFeatures.length === 0) return null;

    const Icon = getIconComponent(getCategoryIcon(category));
    const title = getCategoryTitle(category);

    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4 text-blue-600" />
          {title}
        </h4>
        <div className="grid gap-2 grid-cols-2">
          {categoryFeatures.map((feature) => (
            <FeatureToggle key={feature.key} feature={feature} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <FeatureSection category="tab" />
      <FeatureSection category="generation" />
      <FeatureSection category="training" />
      <FeatureSection category="content" />
      <FeatureSection category="collaboration" />
      <FeatureSection category="limit" />
      <FeatureSection category="advanced" />
    </div>
  );
}
