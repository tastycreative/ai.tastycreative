'use client';

import { memo } from 'react';
import { useSpaces, type Space } from '@/lib/hooks/useSpaces.query';
import {
  Check,
  Loader2,
  AlertTriangle,
  DollarSign,
  Image,
  MessageSquare,
  LayoutGrid,
} from 'lucide-react';

const TEMPLATE_INFO: Record<
  string,
  { label: string; description: string; icon: React.ElementType }
> = {
  OTP_PTR: {
    label: 'OTP / PTR',
    description: 'Custom paid requests',
    icon: DollarSign,
  },
  WALL_POST: {
    label: 'Wall Post',
    description: 'Post photos & captions',
    icon: Image,
  },
  SEXTING_SETS: {
    label: 'Sexting Sets',
    description: 'Adult content sets',
    icon: MessageSquare,
  },
  KANBAN: {
    label: 'General',
    description: 'Kanban board',
    icon: LayoutGrid,
  },
};

interface SpacePickerProps {
  selectedSpaceId: string | undefined;
  onSelect: (space: Space) => void;
}

export const SpacePicker = memo(function SpacePicker({
  selectedSpaceId,
  onSelect,
}: SpacePickerProps) {
  const { data, isLoading } = useSpaces();

  const submissionSpaces = data?.spaces ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (submissionSpaces.length === 0) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-amber-200 font-medium mb-1">No spaces found</p>
          <p className="text-sm text-amber-200/70">
            Create a space first in the Spaces section before submitting
            content.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {submissionSpaces.map((space) => {
        const isSelected = selectedSpaceId === space.id;
        const info = TEMPLATE_INFO[space.templateType] ?? {
          label: space.templateType,
          description: '',
          icon: LayoutGrid,
        };
        const Icon = info.icon;

        return (
          <button
            key={space.id}
            type="button"
            onClick={() => onSelect(space)}
            className={`relative flex flex-col items-start gap-3 p-5 rounded-xl border transition-all duration-200 text-left ${
              isSelected
                ? 'bg-gradient-to-br from-brand-light-pink/15 via-brand-mid-pink/5 to-transparent border-brand-light-pink shadow-lg shadow-brand-light-pink/10'
                : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-600'
            }`}
          >
            {/* Icon */}
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-lg ${
                isSelected
                  ? 'bg-gradient-to-br from-brand-light-pink/30 to-brand-dark-pink/20'
                  : 'bg-zinc-700/40'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${isSelected ? 'text-brand-light-pink' : 'text-zinc-400'}`}
              />
            </div>
            {/* Space name + template info */}
            <div>
              <p
                className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-zinc-300'}`}
              >
                {space.name}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {info.label}
              </p>
            </div>
            {/* Check mark */}
            {isSelected && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-brand-light-pink flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
});
