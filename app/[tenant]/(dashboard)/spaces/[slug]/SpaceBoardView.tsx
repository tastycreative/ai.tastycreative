'use client';

import { DragDropContext } from '@hello-pangea/dnd';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { Loader2 } from 'lucide-react';
import {
  BoardLayout,
  BoardColumn,
  AddColumnButton,
  type BoardFilters,
} from '../board';
import { useSpaceBoard } from './useSpaceBoard';
import { TEMPLATE_CONFIG } from './templates/template-config';

interface SpaceBoardViewProps {
  slug: string;
}

export function SpaceBoardView({ slug }: SpaceBoardViewProps) {
  const { data: space, isLoading } = useSpaceBySlug(slug);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading space...
        </span>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-brand-mid-pink/30 bg-gray-50/70 dark:bg-gray-900/50 px-4 py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Space not found.
        </p>
      </div>
    );
  }

  const config = TEMPLATE_CONFIG[space.templateType];

  if (!config) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-brand-mid-pink/30 bg-gray-50/70 dark:bg-gray-900/50 px-4 py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Unknown template type: <strong>{space.templateType}</strong>
        </p>
      </div>
    );
  }

  return <TemplateBoardView slug={slug} />;
}

/**
 * Inner component that renders after space is confirmed to exist.
 * Separated so hooks are only called when we have valid data.
 */
function TemplateBoardView({ slug }: { slug: string }) {
  const { data: space } = useSpaceBySlug(slug);
  const config = TEMPLATE_CONFIG[space!.templateType];
  const { DetailModal } = config;

  const {
    boardData,
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
  } = useSpaceBoard({ space, itemToTask: config.itemToTask });

  // Extract unique assignees from all tasks
  const uniqueAssignees = Array.from(
    new Set(
      Object.values(effectiveTasks)
        .map((t) => t.assignee)
        .filter(Boolean) as string[],
    ),
  ).sort();

  return (
    <>
      <BoardLayout
        spaceName={space!.name}
        templateLabel={config.label}
        tabs={config.tabs}
        defaultTab="board"
        columns={boardData?.columns.map((c) => ({ id: c.id, name: c.name })) ?? []}
        assignees={uniqueAssignees}
      >
        {(activeTab, filters) => {
          // Any non-board tab → placeholder
          if (activeTab !== 'board') {
            return (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-brand-mid-pink/20 bg-white/50 dark:bg-gray-900/40 px-6 py-10 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} view
                  coming soon.
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

          const query = filters.searchQuery.toLowerCase();

          return (
            <div className="rounded-2xl border border-gray-200 dark:border-brand-mid-pink/15 bg-gray-100/50 dark:bg-gray-950/40 p-3 sm:p-4 overflow-x-auto">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-3 sm:gap-4 min-w-max items-stretch">
                  {effectiveColumnOrder.map((colId) => {
                    const col = effectiveColumns[colId];
                    if (!col) return null;

                    // Apply filters
                    const colTasks = col.taskIds
                      .map((id) => effectiveTasks[id])
                      .filter(Boolean)
                      .filter((t) => {
                        // Search query filter
                        if (query) {
                          const matchesSearch =
                            t.title.toLowerCase().includes(query) ||
                            t.taskKey.toLowerCase().includes(query) ||
                            t.assignee?.toLowerCase().includes(query) ||
                            t.tags?.some((tag) => tag.toLowerCase().includes(query));
                          if (!matchesSearch) return false;
                        }

                        // Status filter (column filter)
                        if (filters.statusFilter && colId !== filters.statusFilter) {
                          return false;
                        }

                        // Assignee filter
                        if (filters.assigneeFilter && t.assignee !== filters.assigneeFilter) {
                          return false;
                        }

                        // Priority filter
                        if (filters.priorityFilter && t.priority !== filters.priorityFilter) {
                          return false;
                        }

                        return true;
                      });

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
        <DetailModal
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
