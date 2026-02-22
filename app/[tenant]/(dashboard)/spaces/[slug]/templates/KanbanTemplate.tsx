'use client';

import { DragDropContext } from '@hello-pangea/dnd';
import {
  BoardLayout,
  BoardColumn,
  AddColumnButton,
  type BoardTab,
} from '../../board';
import { useSpaceBoard, defaultItemToTask } from '../useSpaceBoard';
import { KanbanTaskDetailModal } from './KanbanTaskDetailModal';
import { Loader2 } from 'lucide-react';
import type { TemplateProps } from './types';

const TABS: BoardTab[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'board', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
];

export function KanbanTemplate({ space }: TemplateProps) {
  const {
    itemsLoading,
    effectiveColumns,
    effectiveTasks,
    effectiveColumnOrder,
    selectedTask,
    selectedColumnTitle,
    handleDragEnd,
    handleAddTask,
    handleAddColumn,
    handleTaskClick,
    handleTaskUpdate,
    handleTitleUpdate,
    closeTaskModal,
  } = useSpaceBoard({ space, itemToTask: defaultItemToTask });

  return (
    <>
      <BoardLayout
        spaceName={space.name}
        templateLabel="Kanban"
        tabs={TABS}
        defaultTab="board"
      >
        {(activeTab, searchQuery) => {
          if (activeTab === 'summary') {
            return (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-brand-mid-pink/20 bg-white/50 dark:bg-gray-900/40 px-6 py-10 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Summary view coming soon &mdash; overview metrics, recent
                  activity, and key insights will appear here.
                </p>
              </div>
            );
          }

          if (activeTab === 'timeline') {
            return (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-brand-mid-pink/20 bg-white/50 dark:bg-gray-900/40 px-6 py-10 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Timeline view coming soon &mdash; visualize tasks across time.
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
                  
                  <AddColumnButton onAddColumn={handleAddColumn} />
                </div>
              </DragDropContext>
            </div>
          );
        }}
      </BoardLayout>

      {selectedTask && (
        <KanbanTaskDetailModal
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
