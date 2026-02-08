'use client';

import { FileText, BarChart3, Gamepad2, DollarSign, Package } from 'lucide-react';

const CONTENT_STYLES = [
  {
    id: 'normal',
    name: 'Normal Content',
    description: 'Standard content posting',
    icon: FileText,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'poll',
    name: 'Poll Content',
    description: 'Interactive audience polls',
    icon: BarChart3,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'game',
    name: 'Game Content',
    description: 'Interactive gaming content',
    icon: Gamepad2,
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'ppv',
    name: 'PPV Content',
    description: 'Pay-per-view exclusive content',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'bundle',
    name: 'Bundle Content',
    description: 'Multi-content bundle packages',
    icon: Package,
    color: 'from-indigo-500 to-purple-500',
  },
] as const;

interface ContentStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  submissionType: 'otp' | 'ptr';
}

export function ContentStyleSelector({ value, onChange, submissionType }: ContentStyleSelectorProps) {
  // Filter styles based on submission type (optional filtering)
  const availableStyles = CONTENT_STYLES; // Show all for now

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {availableStyles.map((style) => {
        const Icon = style.icon;
        const isSelected = value === style.id;

        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            className={`
              relative p-4 rounded-xl border-2 transition-all text-left
              ${isSelected
                ? 'border-brand-light-pink bg-brand-light-pink/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-brand-light-pink/50'
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <div className={`
                w-10 h-10 rounded-lg bg-gradient-to-br ${style.color} flex items-center justify-center flex-shrink-0
              `}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {style.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {style.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
