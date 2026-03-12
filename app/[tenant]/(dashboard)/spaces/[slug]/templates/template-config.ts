import type { ComponentType } from 'react';
import type { BoardTask, BoardTab, BoardTaskCardProps } from '../../board';
import type { BoardItem } from '@/lib/hooks/useBoardItems.query';
import type { ItemToTaskFn } from '../useSpaceBoard';
import { defaultItemToTask } from '../useSpaceBoard';
import type { SummaryTabProps } from './summary';

/* ------------------------------------------------------------------ */
/*  Task Detail Modal prop shape (shared by all modals)                */
/* ------------------------------------------------------------------ */

export interface TaskDetailModalProps {
  task: BoardTask;
  columnTitle: string;
  columns?: { id: string; name: string }[];
  onColumnChange?: (columnId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: BoardTask) => void;
}

/* ------------------------------------------------------------------ */
/*  Per-template itemToTask transformers                               */
/* ------------------------------------------------------------------ */

const wallPostItemToTask: ItemToTaskFn = (item: BoardItem, spaceKey: string): BoardTask => {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    id: item.id,
    taskKey: spaceKey ? `${spaceKey}-${item.itemNo}` : item.id.slice(-6).toUpperCase(),
    title: item.title,
    description: (item.description as string) ?? undefined,
    assignee: (meta.model as string) ?? (item.assigneeId as string) ?? undefined,
    priority: undefined,
    tags: [
      ...(meta.platform ? [meta.platform as string] : []),
      ...(Array.isArray(meta.hashtags) ? (meta.hashtags as string[]) : []),
    ],
    dueDate: (meta.scheduledDate as string) ?? item.dueDate ?? undefined,
    metadata: { ...meta, _createdAt: item.createdAt, _updatedAt: item.updatedAt },
  };
};

const sextingSetsItemToTask: ItemToTaskFn = (item: BoardItem, spaceKey: string): BoardTask => {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    id: item.id,
    taskKey: spaceKey ? `${spaceKey}-${item.itemNo}` : item.id.slice(-6).toUpperCase(),
    title: item.title,
    description: (item.description as string) ?? undefined,
    assignee: (meta.model as string) ?? (item.assigneeId as string) ?? undefined,
    priority: undefined,
    tags: [
      ...(meta.category ? [meta.category as string] : []),
      ...(meta.quality ? [meta.quality as string] : []),
      ...(Array.isArray(meta.tags) ? (meta.tags as string[]) : []),
    ],
    dueDate: item.dueDate ?? undefined,
    metadata: { ...meta, _createdAt: item.createdAt, _updatedAt: item.updatedAt },
  };
};

const modelOnboardingItemToTask: ItemToTaskFn = (item: BoardItem, spaceKey: string): BoardTask => {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const checklist = Array.isArray(meta.checklist) ? (meta.checklist as { completed: boolean }[]) : [];
  const total = checklist.length;
  const done = checklist.filter((c) => c.completed).length;
  const progressTag = total > 0 ? `${done}/${total}` : undefined;
  return {
    id: item.id,
    taskKey: spaceKey ? `${spaceKey}-${item.itemNo}` : item.id.slice(-6).toUpperCase(),
    title: item.title,
    description: (item.description as string) ?? undefined,
    assignee: (item.assigneeId as string) ?? undefined,
    priority: undefined,
    tags: [
      ...(meta.platform ? [meta.platform as string] : []),
      ...(progressTag ? [progressTag] : []),
      ...(Array.isArray(meta.tags) ? (meta.tags as string[]) : []),
    ],
    dueDate: item.dueDate ?? undefined,
    metadata: { ...meta, _createdAt: item.createdAt, _updatedAt: item.updatedAt },
  };
};

const otpPtrItemToTask: ItemToTaskFn = (item: BoardItem, spaceKey: string): BoardTask => {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const priceTag = meta.price ? `$${meta.price}` : undefined;
  // Backward compat: read postOrigin, fall back to old requestType
  const postOrigin = (meta.postOrigin as string) ?? (meta.requestType as string) ?? '';
  const typeTag = postOrigin || undefined;
  return {
    id: item.id,
    taskKey: spaceKey ? `${spaceKey}-${item.itemNo}` : item.id.slice(-6).toUpperCase(),
    title: item.title,
    description: (item.description as string) ?? undefined,
    assignee: (item.assigneeId as string) ?? undefined,
    priority: item.priority === 'HIGH' ? 'High' : item.priority === 'LOW' ? 'Low' : 'Medium',
    tags: [
      ...(typeTag ? [typeTag] : []),
      ...(priceTag ? [priceTag] : []),
    ],
    dueDate: (meta.deadline as string) ?? item.dueDate ?? undefined,
    metadata: { ...meta, _createdAt: item.createdAt, _updatedAt: item.updatedAt },
  };
};

/* ------------------------------------------------------------------ */
/*  Template config registry                                           */
/* ------------------------------------------------------------------ */

export interface TemplateConfig {
  label: string;
  tabs: BoardTab[];
  itemToTask: ItemToTaskFn;
  DetailModal: ComponentType<TaskDetailModalProps>;
  CardComponent?: ComponentType<BoardTaskCardProps>;
  SummaryComponent?: ComponentType<SummaryTabProps>;
}

// Lazy imports — resolved at render time, keeps this file light
import { KanbanTaskDetailModal } from './KanbanTaskDetailModal';
import { WallPostTaskDetailModal } from './WallPostTaskDetailModal';
import { SextingSetsTaskDetailModal } from './SextingSetsTaskDetailModal';
import { OtpPtrTaskDetailModal } from './OtpPtrTaskDetailModal';
import { OtpPtrTaskCard } from './OtpPtrTaskCard';
import { WallPostTaskCard } from './WallPostTaskCard';
import { ModelOnboardingTaskDetailModal } from './ModelOnboardingTaskDetailModal';
import { ModelOnboardingTaskCard } from './ModelOnboardingTaskCard';
import {
  KanbanSummary,
  WallPostSummary,
  SextingSetsSummary,
  OtpPtrSummary,
  ModelOnboardingSummary,
} from './summary';

export const TEMPLATE_CONFIG: Record<string, TemplateConfig> = {
  KANBAN: {
    label: 'Kanban',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'timeline', label: 'Timeline' },
    ],
    itemToTask: defaultItemToTask,
    DetailModal: KanbanTaskDetailModal,
    SummaryComponent: KanbanSummary,
  },
  WALL_POST: {
    label: 'Wall Post',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'timeline', label: 'Timeline' },
      // { id: 'calendar', label: 'Calendar' },
    ],
    itemToTask: wallPostItemToTask,
    DetailModal: WallPostTaskDetailModal,
    CardComponent: WallPostTaskCard,
    SummaryComponent: WallPostSummary,
  },
  SEXTING_SETS: {
    label: 'Sexting Sets',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'timeline', label: 'Timeline' },
      // { id: 'gallery', label: 'Gallery' },
    ],
    itemToTask: sextingSetsItemToTask,
    DetailModal: SextingSetsTaskDetailModal,
    SummaryComponent: SextingSetsSummary,
  },
  OTP_PTR: {
    label: 'OTP / PTR',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'timeline', label: 'Timeline' },
      // { id: 'financials', label: 'Financials' },
    ],
    itemToTask: otpPtrItemToTask,
    DetailModal: OtpPtrTaskDetailModal,
    CardComponent: OtpPtrTaskCard,
    SummaryComponent: OtpPtrSummary,
  },
  MODEL_ONBOARDING: {
    label: 'Model Onboarding',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'timeline', label: 'Timeline' },
    ],
    itemToTask: modelOnboardingItemToTask,
    DetailModal: ModelOnboardingTaskDetailModal,
    CardComponent: ModelOnboardingTaskCard,
    SummaryComponent: ModelOnboardingSummary,
  },
};
