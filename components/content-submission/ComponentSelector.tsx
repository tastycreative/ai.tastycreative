'use client';

import { Calendar, DollarSign, Upload } from 'lucide-react';
import type { ComponentModule } from '@/lib/validations/content-submission';

interface ComponentDefinition {
  id: ComponentModule;
  name: string;
  description: string;
  icon: typeof Calendar;
  gradient: string;
  features: string[];
  addedTime: string;
}

const components: ComponentDefinition[] = [
  {
    id: 'release',
    name: 'Release Schedule',
    description: 'Set specific date and time for content release',
    icon: Calendar,
    gradient: 'from-orange-500 to-red-500',
    features: ['Date', 'Time', 'Timezone'],
    addedTime: '~30s',
  },
  {
    id: 'pricing',
    name: 'Pricing',
    description: 'Add monetization and pricing tiers',
    icon: DollarSign,
    gradient: 'from-green-500 to-emerald-500',
    features: ['Price', 'Type', 'Notes'],
    addedTime: '~1 min',
  },
  {
    id: 'upload',
    name: 'File Uploads',
    description: 'Attach media files and documents',
    icon: Upload,
    gradient: 'from-violet-500 to-purple-500',
    features: ['Images', 'Videos', 'Docs'],
    addedTime: '~2 min',
  },
];

interface ComponentSelectorProps {
  selected: ComponentModule[];
  onChange: (components: ComponentModule[]) => void;
  recommendations: ComponentModule[];
  disabled?: ComponentModule[]; // Force-enabled components
}

export function ComponentSelector({
  selected,
  onChange,
  recommendations,
  disabled = [],
}: ComponentSelectorProps) {
  const toggle = (id: ComponentModule) => {
    if (disabled.includes(id)) return;

    const newSelected = selected.includes(id)
      ? selected.filter((c) => c !== id)
      : [...selected, id];
    onChange(newSelected);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">
          Add Component Modules
        </h3>
        <p className="text-zinc-400">
          Enhance your submission with optional components
        </p>
      </div>

      {/* Smart Recommendations Alert */}
      {recommendations.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl mt-0.5">💡</div>
            <div>
              <h4 className="font-medium text-amber-200 mb-1">
                Smart Recommendations
              </h4>
              <p className="text-sm text-amber-300/90">
                Based on your selections, we recommend:{' '}
                <span className="font-semibold">
                  {recommendations
                    .map((r) => components.find((c) => c.id === r)?.name)
                    .join(', ')}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Component Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {components.map((component) => {
          const isSelected = selected.includes(component.id);
          const isRecommended = recommendations.includes(component.id);
          const isDisabled = disabled.includes(component.id);
          const Icon = component.icon;

          return (
            <button
              key={component.id}
              type="button"
              onClick={() => toggle(component.id)}
              disabled={isDisabled}
              className={`
                relative p-6 rounded-xl border-2 transition-all text-left
                ${
                  isSelected
                    ? 'border-brand-light-pink bg-brand-light-pink/10 ring-2 ring-brand-light-pink/30'
                    : 'border-zinc-700/50 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/70'
                }
                ${isDisabled ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Recommendation Badge */}
              {isRecommended && !isDisabled && (
                <div className="absolute -top-2 -right-2 z-10">
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-lg">
                    ⭐ Smart Pick
                  </span>
                </div>
              )}

              {/* Required Badge */}
              {isDisabled && (
                <div className="absolute -top-2 -right-2 z-10">
                  <span className="inline-flex items-center gap-1 bg-brand-light-pink text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-lg">
                    Required
                  </span>
                </div>
              )}

              {/* Icon */}
              <div
                className={`
                  w-12 h-12 rounded-lg bg-gradient-to-br ${component.gradient}
                  flex items-center justify-center mb-4 shadow-lg
                `}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <div className="mb-4">
                <h3 className="font-semibold text-white mb-1">
                  {component.name}
                </h3>
                <p className="text-sm text-zinc-400 mb-2">
                  {component.description}
                </p>
                <p className="text-xs text-zinc-500">
                  Adds {component.addedTime}
                </p>
              </div>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {component.features.map((feature) => (
                  <span
                    key={feature}
                    className="inline-block px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded-md"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              {/* Checkbox */}
              <div className="absolute top-4 right-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  readOnly
                  className="w-4 h-4 rounded border-zinc-600 text-brand-light-pink focus:ring-brand-light-pink focus:ring-offset-0"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-sm text-zinc-500 text-center">
        Selected components will add additional steps to the wizard
      </p>
    </div>
  );
}
