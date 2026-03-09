'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import {
  useUpdateSpaceChecklist,
  type ChecklistConfig,
} from '@/lib/hooks/useSpaceChecklist.query';
import {
  DEFAULT_CHECKLIST,
  type ChecklistItem,
} from '@/lib/spaces/template-metadata';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Loader2, GripVertical, Trash2, Plus, RotateCcw, Info } from 'lucide-react';

interface Props {
  slug: string;
}

export function SpaceChecklistSettings({ slug }: Props) {
  const { data: space, isLoading } = useSpaceBySlug(slug);

  const config = (space?.config as Record<string, unknown>) ?? {};
  const checklistConfig = config.checklist as ChecklistConfig | undefined;
  const savedItems: ChecklistItem[] = checklistConfig?.items ?? DEFAULT_CHECKLIST;

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newStepText, setNewStepText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Sync from server once loaded
  useEffect(() => {
    if (space && !initialized.current) {
      setItems(savedItems.map((item, idx) => ({ ...item, order: idx })));
      initialized.current = true;
    }
  }, [space, savedItems]);

  const mutation = useUpdateSpaceChecklist(space?.id, config);

  const saveItems = useCallback(
    (nextItems: ChecklistItem[]) => {
      setItems(nextItems);
      mutation.mutate({ items: nextItems });
    },
    [mutation],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const reordered = Array.from(items);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      const updated = reordered.map((item, idx) => ({ ...item, order: idx }));
      saveItems(updated);
    },
    [items, saveItems],
  );

  const handleAddStep = useCallback(() => {
    const text = newStepText.trim();
    if (!text) return;
    const id = `step-${Date.now()}`;
    const nextItems = [
      ...items,
      { id, text, completed: false, order: items.length },
    ];
    saveItems(nextItems);
    setNewStepText('');
  }, [items, newStepText, saveItems]);

  const handleDelete = useCallback(
    (id: string) => {
      const nextItems = items
        .filter((item) => item.id !== id)
        .map((item, idx) => ({ ...item, order: idx }));
      saveItems(nextItems);
    },
    [items, saveItems],
  );

  const handleStartEdit = useCallback((item: ChecklistItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    const nextItems = items.map((item) =>
      item.id === editingId ? { ...item, text } : item,
    );
    saveItems(nextItems);
    setEditingId(null);
  }, [editingId, editingText, items, saveItems]);

  const handleResetToDefaults = useCallback(() => {
    const resetItems = DEFAULT_CHECKLIST.map((item) => ({ ...item }));
    saveItems(resetItems);
  }, [saveItems]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading settings...
        </span>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400">Space not found</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Default Checklist
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Customize the default checklist steps for new onboarding tasks
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetToDefaults}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to defaults
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="checklist">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {items.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={[
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group',
                          snapshot.isDragging
                            ? 'border-brand-light-pink/40 bg-brand-light-pink/5 dark:bg-brand-light-pink/10 shadow-lg'
                            : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:border-gray-200 dark:hover:border-gray-700',
                        ].join(' ')}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <span className="shrink-0 w-6 h-6 rounded-full bg-brand-light-pink/10 dark:bg-brand-light-pink/15 text-brand-dark-pink dark:text-brand-light-pink text-xs font-semibold flex items-center justify-center">
                          {index + 1}
                        </span>

                        {editingId === item.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 min-w-0 text-sm bg-white dark:bg-gray-800 border border-brand-light-pink/30 rounded-lg px-2.5 py-1 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-light-pink/40"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="flex-1 min-w-0 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 truncate"
                          >
                            {item.text}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={mutation.isPending}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add step input */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            value={newStepText}
            onChange={(e) => setNewStepText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddStep();
            }}
            placeholder="Add a new step..."
            className="flex-1 min-w-0 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-light-pink/40 focus:border-brand-light-pink/30"
          />
          <button
            type="button"
            onClick={handleAddStep}
            disabled={mutation.isPending || !newStepText.trim()}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-light-pink hover:bg-brand-mid-pink rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {/* Info note */}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/15 px-4 py-3">
        <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Changes are saved automatically. New tasks created manually or via webhook will use this checklist.
          Existing tasks are not affected.
        </p>
      </div>
    </div>
  );
}
