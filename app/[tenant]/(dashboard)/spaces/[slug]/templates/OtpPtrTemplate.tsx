'use client';

import { DragDropContext } from '@hello-pangea/dnd';
import {
  BoardLayout,
  BoardColumn,
  type BoardTask,
  type BoardTab,
} from '../../board';
import { useSpaceBoard } from '../useSpaceBoard';
import { OtpPtrTaskDetailModal } from './OtpPtrTaskDetailModal';
import type { BoardItem } from '@/lib/hooks/useBoardItems.query';
import { Loader2, DollarSign } from 'lucide-react';
import type { TemplateProps } from './types';

const TABS: BoardTab[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'board', label: 'Board' },
  { id: 'financials', label: 'Financials' },
];

function otpPtrItemToTask(item: BoardItem, spaceKey: string): BoardTask {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const priceTag = meta.price ? `$${meta.price}` : undefined;
  return {
    id: item.id,
    taskKey: spaceKey
      ? `${spaceKey}-${item.position + 1}`
      : item.id.slice(-6).toUpperCase(),
    title: item.title,
    description: (item.description as string) ?? undefined,
    assignee: (meta.model as string) ?? (item.assigneeId as string) ?? undefined,
    priority: meta.isPaid ? ('Low' as const) : ('High' as const),
    tags: [
      ...(meta.requestType ? [meta.requestType as string] : []),
      ...(priceTag ? [priceTag] : []),
      ...(meta.buyer ? [`@${meta.buyer}`] : []),
    ],
    startDate: undefined,
    dueDate: (meta.deadline as string) ?? item.dueDate ?? undefined,
    reporter: undefined,
    metadata: meta,
  };
}

export function OtpPtrTemplate({ space }: TemplateProps) {
  const {
    itemsLoading,
    effectiveColumns,
    effectiveTasks,
    effectiveColumnOrder,
    selectedTask,
    selectedColumnTitle,
    handleDragEnd,
    handleAddTask,
    handleTaskClick,
    handleTaskUpdate,
    handleTitleUpdate,
    closeTaskModal,
  } = useSpaceBoard({ space, itemToTask: otpPtrItemToTask });

  return (
    <>
      <BoardLayout
        spaceName={space.name}
        templateLabel="OTP / PTR"
        tabs={TABS}
        defaultTab="board"
      >
        {(activeTab, searchQuery) => {
          if (activeTab === 'summary') {
            return (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-brand-mid-pink/20 bg-white/50 dark:bg-gray-900/40 px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-light-pink/10">
                  <DollarSign className="h-5 w-5 text-brand-light-pink" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  OTP/PTR summary &mdash; revenue tracking, fulfillment rates,
                  and pending requests will appear here.
                </p>
              </div>
            );
          }

          if (activeTab === 'financials') {
            return (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-brand-mid-pink/20 bg-white/50 dark:bg-gray-900/40 px-6 py-10 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Financials view coming soon &mdash; earnings breakdown, payout
                  tracking, and invoice management.
                </p>
              </div>
            );
          }

          if (itemsLoading) {
            return (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-brand-light-pink" />
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Loading board...
                </span>
              </div>
            );
          }

          const query = searchQuery.toLowerCase();

          return (
            <div className="rounded-2xl border border-gray-200 dark:border-brand-mid-pink/15 bg-gray-100/50 dark:bg-gray-950/40 p-3 sm:p-4 overflow-x-auto">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-3 sm:gap-4 min-w-max">
                  {effectiveColumnOrder.map((colId) => {
                    const col = effectiveColumns[colId];
                    if (!col) return null;

                    const colTasks = col.taskIds
                      .map((id) => effectiveTasks[id])
                      .filter(Boolean)
                      .filter(
                        (t) =>
                          !query ||
                          t.title.toLowerCase().includes(query) ||
                          t.taskKey.toLowerCase().includes(query) ||
                          t.assignee?.toLowerCase().includes(query) ||
                          t.tags?.some((tag) =>
                            tag.toLowerCase().includes(query),
                          ),
                      );

                    return (
                      <BoardColumn
                        key={col.id}
                        column={col}
                        tasks={colTasks}
                        onAddTask={handleAddTask}
                        onTaskClick={handleTaskClick}
                        onTaskTitleUpdate={handleTitleUpdate}
                      />
                    );
                  })}
                </div>
              </DragDropContext>
            </div>
          );
        }}
      </BoardLayout>

      {selectedTask && (
        <OtpPtrTaskDetailModal
          task={selectedTask}
          columnTitle={selectedColumnTitle}
          isOpen={!!selectedTask}
          onClose={closeTaskModal}
          onUpdate={handleTaskUpdate}
        />
      )}
    </>
  );
}
