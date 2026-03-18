export type UrgencyLevel = 'urgent' | 'high' | 'medium' | 'low';

export const VALID_URGENCIES = new Set<UrgencyLevel>(['urgent', 'high', 'medium', 'low']);

export const urgencyConfig: Record<UrgencyLevel, { bg: string; textColor: string; borderColor: string; label: string; dotColor: string }> = {
  urgent: {
    bg: 'bg-red-500/15',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    label: 'URGENT',
    dotColor: 'bg-red-500',
  },
  high: {
    bg: 'bg-orange-500/15',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    label: 'HIGH',
    dotColor: 'bg-orange-500',
  },
  medium: {
    bg: 'bg-yellow-500/15',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    label: 'MEDIUM',
    dotColor: 'bg-yellow-500',
  },
  low: {
    bg: 'bg-green-500/15',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    label: 'LOW',
    dotColor: 'bg-green-500',
  },
};

export function safeUrgency(value: string): UrgencyLevel {
  return VALID_URGENCIES.has(value as UrgencyLevel) ? (value as UrgencyLevel) : 'medium';
}
