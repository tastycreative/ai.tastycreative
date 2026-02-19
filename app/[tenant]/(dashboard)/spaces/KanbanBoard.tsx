'use client';

import { useState, useCallback } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import {
  BoardLayout,
  BoardColumn,
  TaskDetailModal,
  type BoardTask,
  type BoardColumnData,
  type BoardTab,
} from './board';

interface ColumnState extends BoardColumnData {
  taskIds: string[];
}

interface KanbanBoardProps {
  spaceName?: string;
}

const TABS: BoardTab[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'board', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
];

const COLUMN_ORDER = ['todo', 'inProgress', 'done'] as const;

const PLACEHOLDER_TASKS: Record<string, BoardTask> = {
  'task-1': {
    id: 'task-1',
    taskKey: 'KANBAN-1',
    title: 'Define goals for this space',
    description: 'Outline the key objectives, milestones, and success criteria for this space.',
    assignee: 'Alex',
    reporter: 'Jordan',
    priority: 'High',
    tags: ['planning'],
    startDate: '2026-02-10',
    dueDate: '2026-02-28',
  },
  'task-2': {
    id: 'task-2',
    taskKey: 'KANBAN-2',
    title: 'Add key workflows as cards',
    description: 'Break down the main workflows into individual task cards that the team can pick up.',
    assignee: 'Jordan',
    reporter: 'Alex',
    priority: 'Medium',
    tags: ['workflow'],
  },
  'task-3': {
    id: 'task-3',
    taskKey: 'KANBAN-3',
    title: 'Invite teammates and assign owners',
    assignee: 'Taylor',
    reporter: 'Alex',
    priority: 'Low',
    tags: ['team'],
  },
  'task-4': {
    id: 'task-4',
    taskKey: 'KANBAN-4',
    title: 'Create content calendar lane',
    assignee: 'Morgan',
    priority: 'Medium',
    tags: ['content'],
  },
  'task-5': {
    id: 'task-5',
    taskKey: 'KANBAN-5',
    title: 'Set up automated notifications',
    assignee: 'Alex',
    priority: 'Low',
    tags: ['automation'],
  },
};

const PLACEHOLDER_COLUMNS: Record<string, ColumnState> = {
  todo: {
    id: 'todo',
    title: 'To Do',
    color: 'blue',
    taskIds: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'],
  },
  inProgress: {
    id: 'inProgress',
    title: 'In Progress',
    color: 'amber',
    taskIds: [],
  },
  done: {
    id: 'done',
    title: 'Done',
    color: 'green',
    taskIds: [],
  },
};

let taskCounter = 5;

export function KanbanBoard({ spaceName }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(PLACEHOLDER_TASKS);
  const [columns, setColumns] = useState(PLACEHOLDER_COLUMNS);
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [selectedColumnTitle, setSelectedColumnTitle] = useState('');

  const findColumnForTask = useCallback(
    (taskId: string) => {
      for (const col of Object.values(columns)) {
        if (col.taskIds.includes(taskId)) return col;
      }
      return null;
    },
    [columns],
  );

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    const startCol = columns[source.droppableId];
    const finishCol = columns[destination.droppableId];

    if (startCol.id === finishCol.id) {
      const ids = Array.from(startCol.taskIds);
      ids.splice(source.index, 1);
      ids.splice(destination.index, 0, draggableId);
      setColumns((prev) => ({
        ...prev,
        [startCol.id]: { ...startCol, taskIds: ids },
      }));
      return;
    }

    const startIds = Array.from(startCol.taskIds);
    startIds.splice(source.index, 1);
    const finishIds = Array.from(finishCol.taskIds);
    finishIds.splice(destination.index, 0, draggableId);

    setColumns((prev) => ({
      ...prev,
      [startCol.id]: { ...startCol, taskIds: startIds },
      [finishCol.id]: { ...finishCol, taskIds: finishIds },
    }));
  };

  const handleAddTask = (columnId: string, title: string) => {
    const nextNum = ++taskCounter;
    const newId = `task-new-${nextNum}`;
    const newTask: BoardTask = {
      id: newId,
      taskKey: `KANBAN-${nextNum}`,
      title,
    };
    setTasks((prev) => ({ ...prev, [newId]: newTask }));
    setColumns((prev) => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        taskIds: [newId, ...prev[columnId].taskIds],
      },
    }));
  };

  const handleTaskClick = (task: BoardTask) => {
    const col = findColumnForTask(task.id);
    setSelectedTask(task);
    setSelectedColumnTitle(col?.title ?? '');
  };

  const handleTaskUpdate = (updated: BoardTask) => {
    setTasks((prev) => ({ ...prev, [updated.id]: updated }));
    setSelectedTask(updated);
  };

  const handleTitleUpdate = (task: BoardTask, newTitle: string) => {
    const updated = { ...task, title: newTitle };
    setTasks((prev) => ({ ...prev, [task.id]: updated }));
  };

  return (
    <>
      <BoardLayout
        spaceName={spaceName ?? 'Sample Space'}
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
                  Timeline view coming soon &mdash; visualize tasks across time
                  for planning and execution.
                </p>
              </div>
            );
          }

          const query = searchQuery.toLowerCase();

          return (
            <div className="rounded-2xl border border-gray-200 dark:border-brand-mid-pink/15 bg-gray-100/50 dark:bg-gray-950/40 p-3 sm:p-4 overflow-x-auto">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-3 sm:gap-4 min-w-max">
                  {COLUMN_ORDER.map((colId) => {
                    const col = columns[colId];
                    const colTasks = col.taskIds
                      .map((id) => tasks[id])
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
        <TaskDetailModal
          task={selectedTask}
          columnTitle={selectedColumnTitle}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}
    </>
  );
}
