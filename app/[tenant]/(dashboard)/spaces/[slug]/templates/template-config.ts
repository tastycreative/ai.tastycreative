import type { ComponentType } from 'react';
import type { BoardTask, BoardTab } from '../../board';
import type { BoardItem } from '@/lib/hooks/useBoardItems.query';
import type { ItemToTaskFn } from '../useSpaceBoard';
import { defaultItemToTask } from '../useSpaceBoard';

/* ------------------------------------------------------------------ */
/*  Task Detail Modal prop shape (shared by all modals)                */
/* ------------------------------------------------------------------ */

export interface TaskDetailModalProps {
  task: BoardTask;
  columnTitle: string;
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
    metadata: meta,
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
    metadata: meta,
  };
};

const otpPtrItemToTask: ItemToTaskFn = (item: BoardItem, spaceKey: string): BoardTask => {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const priceTag = meta.price ? `$${meta.price}` : undefined;
  return {
    id: item.id,
    taskKey: spaceKey ? `${spaceKey}-${item.itemNo}` : item.id.slice(-6).toUpperCase(),
    title: item.title,
    description: (item.description as string) ?? undefined,
    assignee: (meta.model as string) ?? (item.assigneeId as string) ?? undefined,
    priority: meta.isPaid ? ('Low' as const) : ('High' as const),
    tags: [
      ...(meta.requestType ? [meta.requestType as string] : []),
      ...(priceTag ? [priceTag] : []),
      ...(meta.buyer ? [`@${meta.buyer}`] : []),
    ],
    dueDate: (meta.deadline as string) ?? item.dueDate ?? undefined,
    metadata: meta,
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
}

// Lazy imports — resolved at render time, keeps this file light
import { KanbanTaskDetailModal } from './KanbanTaskDetailModal';
import { WallPostTaskDetailModal } from './WallPostTaskDetailModal';
import { SextingSetsTaskDetailModal } from './SextingSetsTaskDetailModal';
import { OtpPtrTaskDetailModal } from './OtpPtrTaskDetailModal';

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
  },
  WALL_POST: {
    label: 'Wall Post',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'calendar', label: 'Calendar' },
    ],
    itemToTask: wallPostItemToTask,
    DetailModal: WallPostTaskDetailModal,
  },
  SEXTING_SETS: {
    label: 'Sexting Sets',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'gallery', label: 'Gallery' },
    ],
    itemToTask: sextingSetsItemToTask,
    DetailModal: SextingSetsTaskDetailModal,
  },
  OTP_PTR: {
    label: 'OTP / PTR',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'board', label: 'Board' },
      { id: 'financials', label: 'Financials' },
    ],
    itemToTask: otpPtrItemToTask,
    DetailModal: OtpPtrTaskDetailModal,
  },
};
