'use client';

import React from 'react';
import { SchedulerTask } from '@/lib/hooks/useScheduler.query';
import { MMCard } from './task-cards/MMCard';
import { WPCard } from './task-cards/WPCard';
import { STCard } from './task-cards/STCard';
import { SPCard } from './task-cards/SPCard';

// Re-export shared constants for backward compat (used by SchedulerDayColumn, SchedulerGrid, etc.)
export { TASK_TYPES, TASK_TYPE_COLORS } from './task-cards/shared';
export type { TaskType } from './task-cards/shared';

export const TASK_TYPE_LABELS: Record<string, string> = {
  MM: 'MM',
  WP: 'WP',
  ST: 'ST',
  SP: 'SP',
};

interface SchedulerTaskCardProps {
  task: SchedulerTask;
  team: string;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  schedulerToday?: string;
  weekStart?: string;
}

const CARD_MAP: Record<string, React.ComponentType<SchedulerTaskCardProps>> = {
  MM: MMCard,
  WP: WPCard,
  ST: STCard,
  SP: SPCard,
};

export function SchedulerTaskCard(props: SchedulerTaskCardProps) {
  const Card = CARD_MAP[props.task.taskType] || MMCard;
  return <Card {...props} />;
}
