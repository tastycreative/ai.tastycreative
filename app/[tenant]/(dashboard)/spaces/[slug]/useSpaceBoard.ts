'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { DropResult } from '@hello-pangea/dnd';
import type { BoardTask, BoardColumnData } from '../board';
import {
  useBoardItems,
  useCreateBoardItem,
  useUpdateBoardItem,
  useCreateColumn,
  useUpdateColumn,
  type BoardItem,
} from '@/lib/hooks/useBoardItems.query';
import type { SpaceWithBoards } from '@/lib/hooks/useSpaces.query';
import { useBoardRealtime } from '@/lib/hooks/useBoardRealtime';

/* ------------------------------------------------------------------ */
/*  Column state with task IDs for DnD                                 */
/* ------------------------------------------------------------------ */

export type ColumnWithTasks = BoardColumnData & { taskIds: string[] };

/* ------------------------------------------------------------------ */
/*  DB → UI transformer (overridable per template)                     */
/* ------------------------------------------------------------------ */

export type ItemToTaskFn = (item: BoardItem, spaceKey: string) => BoardTask;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export const defaultItemToTask: ItemToTaskFn = (item, spaceKey) => {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    id: item.id,
    taskKey: spaceKey
      ? `${spaceKey}-${item.itemNo}`
      : item.id.slice(-6).toUpperCase(),
    title: item.title,
    description: (item.description as string) ?? undefined,
    assignee: (item.assigneeId as string) ?? undefined,
    priority: capitalize(item.priority) as BoardTask['priority'],
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : undefined,
    startDate: undefined,
    dueDate: item.dueDate ?? undefined,
    reporter: undefined,
    metadata: meta,
  };
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

interface UseSpaceBoardOptions {
  space: SpaceWithBoards | undefined;
  itemToTask?: ItemToTaskFn;
}

export function useSpaceBoard({ space, itemToTask = defaultItemToTask }: UseSpaceBoardOptions) {
  const defaultBoard = space?.boards?.[0];
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    data: boardData,
    isLoading: itemsLoading,
  } = useBoardItems(space?.id, defaultBoard?.id);

  const createItemMutation = useCreateBoardItem(
    space?.id ?? '',
    defaultBoard?.id ?? '',
  );
  const updateItemMutation = useUpdateBoardItem(
    space?.id ?? '',
    defaultBoard?.id ?? '',
  );
  const createColumnMutation = useCreateColumn(
    space?.id ?? '',
    defaultBoard?.id ?? '',
  );
  const updateColumnMutation = useUpdateColumn(
    space?.id ?? '',
    defaultBoard?.id ?? '',
  );

  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [selectedColumnTitle, setSelectedColumnTitle] = useState('');

  useBoardRealtime(defaultBoard?.id, selectedTask?.id);
  const isClosingRef = useRef(false);

  // Build columns + tasks from real data
  const { columnsMap, columnOrder, tasksMap } = useMemo(() => {
    const empty = {
      columnsMap: {} as Record<string, ColumnWithTasks>,
      columnOrder: [] as string[],
      tasksMap: {} as Record<string, BoardTask>,
    };
    if (!boardData) return empty;

    const cols = [...boardData.columns].sort((a, b) => a.position - b.position);
    const spaceKey = space?.key ?? '';

    const tMap: Record<string, BoardTask> = {};
    const cMap: Record<string, ColumnWithTasks> = {};
    const cOrder: string[] = [];

    for (const col of cols) {
      cOrder.push(col.id);
      cMap[col.id] = {
        id: col.id,
        title: col.name,
        color: col.color ?? 'gray',
        taskIds: [],
      };
    }

    const sortedItems = [...boardData.items].sort(
      (a, b) => a.position - b.position,
    );

    for (const item of sortedItems) {
      const task = itemToTask(item, spaceKey);
      tMap[task.id] = task;
      if (cMap[item.columnId]) {
        cMap[item.columnId].taskIds.push(task.id);
      }
    }

    return { columnsMap: cMap, columnOrder: cOrder, tasksMap: tMap };
  }, [boardData, space?.key, itemToTask]);

  // Local state for optimistic drag-and-drop
  const [localColumns, setLocalColumns] = useState<Record<string, ColumnWithTasks> | null>(null);
  const [localTasks, setLocalTasks] = useState<Record<string, BoardTask> | null>(null);

  // Clear local overrides when server data arrives (refetch after mutation or realtime event)
  useEffect(() => {
    setLocalColumns(null);
    setLocalTasks(null);
  }, [boardData]);

  const effectiveColumns = localColumns ?? columnsMap;
  const effectiveTasks = localTasks ?? tasksMap;
  const effectiveColumnOrder = localColumns
    ? Object.keys(localColumns).sort((a, b) => {
        const posA = boardData?.columns.find((c) => c.id === a)?.position ?? 0;
        const posB = boardData?.columns.find((c) => c.id === b)?.position ?? 0;
        return posA - posB;
      })
    : columnOrder;

  const findColumnForTask = useCallback(
    (taskId: string) => {
      for (const col of Object.values(effectiveColumns)) {
        if (col.taskIds.includes(taskId)) return col;
      }
      return null;
    },
    [effectiveColumns],
  );

  /* ── Handlers ───────────────────────────────────────────────── */

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      )
        return;

      const startCol = effectiveColumns[source.droppableId];
      const finishCol = effectiveColumns[destination.droppableId];
      if (!startCol || !finishCol) return;

      const newCols = { ...effectiveColumns };

      if (startCol.id === finishCol.id) {
        const ids = Array.from(startCol.taskIds);
        ids.splice(source.index, 1);
        ids.splice(destination.index, 0, draggableId);
        newCols[startCol.id] = { ...startCol, taskIds: ids };
      } else {
        const startIds = Array.from(startCol.taskIds);
        startIds.splice(source.index, 1);
        const finishIds = Array.from(finishCol.taskIds);
        finishIds.splice(destination.index, 0, draggableId);
        newCols[startCol.id] = { ...startCol, taskIds: startIds };
        newCols[finishCol.id] = { ...finishCol, taskIds: finishIds };

        updateItemMutation.mutate({
          itemId: draggableId,
          columnId: finishCol.id,
          position: destination.index,
        });
      }

      setLocalColumns(newCols);
    },
    [effectiveColumns, updateItemMutation],
  );

  const handleAddTask = useCallback(
    (columnId: string, title: string) => {
      // Create optimistic task immediately
      const tempId = `temp-${Date.now()}`;
      const optimisticTask: BoardTask = {
        id: tempId,
        taskKey: 'CREATING...',
        title,
        priority: 'Medium',
      };

      // Add to local state immediately
      const newTasks = { ...(localTasks ?? tasksMap), [tempId]: optimisticTask };
      const newColumns = { ...(localColumns ?? columnsMap) };
      const targetColumn = newColumns[columnId];
      if (targetColumn) {
        newColumns[columnId] = {
          ...targetColumn,
          taskIds: [tempId, ...targetColumn.taskIds],
        };
      }

      setLocalTasks(newTasks);
      setLocalColumns(newColumns);

      // Perform actual mutation in background
      createItemMutation.mutate(
        { title, columnId },
        {
          onSuccess: () => {
            // Clear local state to show real data from server
            setLocalColumns(null);
            setLocalTasks(null);
          },
          onError: () => {
            // Revert optimistic update on error
            setLocalColumns(null);
            setLocalTasks(null);
          },
        },
      );
    },
    [createItemMutation, localTasks, tasksMap, localColumns, columnsMap],
  );

  const handleTaskClick = useCallback(
    (task: BoardTask) => {
      const col = findColumnForTask(task.id);
      setSelectedTask(task);
      setSelectedColumnTitle(col?.title ?? '');
      
      // Update URL with task query param
      const params = new URLSearchParams(searchParams.toString());
      params.set('task', task.taskKey.toLowerCase());
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [findColumnForTask, searchParams, router],
  );

  const handleTaskUpdate = useCallback(
    (updated: BoardTask) => {
      setLocalTasks((prev) => ({
        ...(prev ?? effectiveTasks),
        [updated.id]: updated,
      }));

      updateItemMutation.mutate({
        itemId: updated.id,
        title: updated.title,
        description: updated.description,
        priority: updated.priority?.toUpperCase(),
        dueDate: updated.dueDate,
        assigneeId: updated.assignee,
        metadata: updated.metadata,
      });

      setSelectedTask(updated);
    },
    [effectiveTasks, updateItemMutation],
  );

  const handleTitleUpdate = useCallback(
    (task: BoardTask, newTitle: string) => {
      const updated = { ...task, title: newTitle };
      setLocalTasks((prev) => ({
        ...(prev ?? effectiveTasks),
        [task.id]: updated,
      }));
      updateItemMutation.mutate({ itemId: task.id, title: newTitle });
    },
    [effectiveTasks, updateItemMutation],
  );

  const handleAddColumn = useCallback(
    (name: string, color: string) => {
      createColumnMutation.mutate({ name, color });
    },
    [createColumnMutation],
  );

  const handleColumnColorUpdate = useCallback(
    (columnId: string, newColor: string) => {
      updateColumnMutation.mutate({ columnId, color: newColor });
    },
    [updateColumnMutation],
  );

  const handleColumnTitleUpdate = useCallback(
    (columnId: string, newTitle: string) => {
      updateColumnMutation.mutate({ columnId, name: newTitle });
    },
    [updateColumnMutation],
  );

  const closeTaskModal = useCallback(() => {
    // Mark that we're intentionally closing
    isClosingRef.current = true;

    // Remove task query param from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete('task');
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });

    // Clear the selected task
    setSelectedTask(null);

    // Reset the closing flag after a small delay
    setTimeout(() => {
      isClosingRef.current = false;
    }, 100);
  }, [searchParams, router]);

  // Check for task query param on mount/data change and open modal if present
  useEffect(() => {
    // Don't do anything if we're in the process of closing
    if (isClosingRef.current) return;

    const taskParam = searchParams.get('task');
    if (!taskParam) {
      // If there's no task param but we have a selected task, clear it
      if (selectedTask) {
        setSelectedTask(null);
      }
      return;
    }

    // Wait for tasks to load
    if (!tasksMap || Object.keys(tasksMap).length === 0) return;

    // Find task by taskKey (e.g., "kb-1")
    const task = Object.values(tasksMap).find(
      (t) => t.taskKey.toLowerCase() === taskParam.toLowerCase(),
    );

    // Only open if we found a task and it's different from the currently selected one
    if (task && selectedTask?.id !== task.id) {
      const col = findColumnForTask(task.id);
      setSelectedTask(task);
      setSelectedColumnTitle(col?.title ?? '');
    }

    // If taskParam exists but no matching task found after tasks are loaded, clear the param
    if (!task) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('task');
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, tasksMap, findColumnForTask, router, selectedTask]);

  return {
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
    handleColumnColorUpdate,
    handleColumnTitleUpdate,
    handleTaskClick,
    handleTaskUpdate,
    handleTitleUpdate,
    closeTaskModal,
  };
}
