'use client';

import { FileText, BarChart3, Gamepad2, DollarSign, Package, Crown, Disc3, HelpCircle } from 'lucide-react';

export const CONTENT_STYLES = [
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
  {
    id: 'vip',
    name: 'VIP',
    description: 'Exclusive VIP content for top subscribers',
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
  },
] as const;

export interface ContentStyleFields {
  gameType: string;
  gifUrl: string;
  gameNotes: string;
  originalPollReference: string;
}

interface ContentStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  submissionType: 'otp' | 'ptr';
  styleFields: ContentStyleFields;
  onStyleFieldsChange: (fields: Partial<ContentStyleFields>) => void;
  pausedStyles?: string[];
}

export function ContentStyleSelector({
  value,
  onChange,
  submissionType,
  styleFields,
  onStyleFieldsChange,
  pausedStyles,
}: ContentStyleSelectorProps) {
  const availableStyles = CONTENT_STYLES;

  const showGameFields = value === 'game';
  const showPpvBundleFields = value === 'ppv' || value === 'bundle';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableStyles.map((style) => {
          const Icon = style.icon;
          const isSelected = value === style.id;
          const isPaused = pausedStyles?.includes(style.id) ?? false;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => { if (!isPaused) onChange(style.id); }}
              disabled={isPaused}
              className={`
                relative p-4 rounded-xl border-2 transition-all text-left
                ${isPaused
                  ? 'border-amber-500/30 bg-amber-500/5 opacity-60 cursor-not-allowed'
                  : isSelected
                  ? 'border-brand-light-pink bg-brand-light-pink/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-light-pink/50'
                }
              `}
            >
              {isPaused && (
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
                    PAUSED
                  </span>
                </div>
              )}
              {isSelected && !isPaused && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-brand-light-pink" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="flex items-start space-x-3">
                <div className={`
                  w-10 h-10 rounded-lg bg-gradient-to-br ${isPaused ? 'from-amber-500/30 to-amber-600/30' : style.color} flex items-center justify-center flex-shrink-0
                `}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${isPaused ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
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

      {/* Game Post Specific Fields */}
      {showGameFields && (
        <div className="animate-fade-in-up rounded-xl border border-brand-dark-pink/30 bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Disc3 className="w-5 h-5 text-brand-light-pink" />
            <h3 className="text-lg font-semibold text-white">Game Post Specific Fields</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Game Type</label>
              <input
                type="text"
                value={styleFields.gameType}
                onChange={(e) => onStyleFieldsChange({ gameType: e.target.value })}
                placeholder="e.g. Spin the Wheel, Tip Game, Dice Roll..."
                className="w-full px-4 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-brand-light-pink/50 focus:ring-1 focus:ring-brand-light-pink/30 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1.5">Enter the type or name of the game</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1.5">GIF URL</label>
              <input
                type="text"
                value={styleFields.gifUrl}
                onChange={(e) => onStyleFieldsChange({ gifUrl: e.target.value })}
                placeholder="https://giphy.com/... or https://i.imgur.com/..."
                className="w-full px-4 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-brand-light-pink/50 focus:ring-1 focus:ring-brand-light-pink/30 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1.5">Link to a GIF for this game post</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Notes</label>
              <textarea
                value={styleFields.gameNotes}
                onChange={(e) => onStyleFieldsChange({ gameNotes: e.target.value })}
                placeholder="Add any additional notes or context for the flyer team..."
                rows={3}
                className="w-full px-4 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-brand-light-pink/50 focus:ring-1 focus:ring-brand-light-pink/30 transition-colors resize-y"
              />
              <p className="text-xs text-zinc-500 mt-1.5">Additional notes or instructions for the team</p>
            </div>
          </div>
        </div>
      )}

      {/* PPV/Bundle Specific Fields */}
      {showPpvBundleFields && (
        <div className="animate-fade-in-up rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-zinc-900/60 p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">PPV/Bundle Specific Fields</h3>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="block text-sm font-medium text-white">Original Poll Reference</label>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-zinc-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 w-56 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                  Reference the original poll this PPV/Bundle is based on to help the team track content lineage.
                </div>
              </div>
            </div>
            <textarea
              value={styleFields.originalPollReference}
              onChange={(e) => onStyleFieldsChange({ originalPollReference: e.target.value })}
              placeholder="Reference to original poll this PPV is based on"
              rows={3}
              className="w-full px-4 py-2.5 bg-purple-900/20 border border-purple-500/20 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 transition-colors resize-y"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              Include any poll IDs, dates, or references that connect this PPV/Bundle to the original poll content
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
