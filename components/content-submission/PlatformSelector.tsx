'use client';

import { Check } from 'lucide-react';

interface PlatformOption {
  id: 'onlyfans' | 'fansly';
  name: string;
  description: string;
  teamName: string;
  gradient: string;
}

const platforms: PlatformOption[] = [
  {
    id: 'onlyfans',
    name: 'OnlyFans',
    description: 'Primary content platform',
    teamName: 'OTP-PTR',
    gradient: 'from-brand-blue to-brand-light-pink',
  },
  {
    id: 'fansly',
    name: 'Fansly',
    description: 'Alternative platform',
    teamName: 'OTP-Fansly',
    gradient: 'from-brand-mid-pink to-brand-dark-pink',
  },
];

interface PlatformSelectorProps {
  value: ('onlyfans' | 'fansly')[];
  onChange: (value: ('onlyfans' | 'fansly')[]) => void;
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  const toggle = (id: 'onlyfans' | 'fansly') => {
    if (value.includes(id)) {
      // Don't allow deselecting if it's the only one selected
      if (value.length === 1) return;
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">
          Select Platform
        </h3>
        <p className="text-zinc-400">
          Choose which platform(s) this content will be posted to
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {platforms.map((platform) => {
          const isSelected = value.includes(platform.id);

          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => toggle(platform.id)}
              className={`
                relative p-6 rounded-xl border-2 transition-all text-left
                ${
                  isSelected
                    ? 'border-brand-light-pink bg-brand-light-pink/10 ring-4 ring-brand-light-pink/20'
                    : 'border-zinc-700/50 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/70'
                }
              `}
            >
              {/* Icon and Check */}
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`
                    w-14 h-14 rounded-lg bg-gradient-to-br ${platform.gradient}
                    flex items-center justify-center text-white font-bold text-xl
                    shadow-lg
                  `}
                >
                  {platform.name.substring(0, 2)}
                </div>
                {isSelected && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-light-pink">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-1">
                {platform.name}
              </h3>
              <p className="text-sm text-zinc-400 mb-3">
                {platform.description}
              </p>

              {/* Team Badge */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Routes to:</span>
                <span className="px-2 py-1 rounded-md bg-brand-light-pink/20 border border-brand-light-pink/30 text-brand-light-pink font-medium">
                  {platform.teamName}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
