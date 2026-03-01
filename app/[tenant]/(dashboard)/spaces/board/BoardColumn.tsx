'use client';

import { useState, useRef, useEffect } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Plus, X, Pencil } from 'lucide-react';
import { BoardTaskCard, type BoardTask, type BoardTaskCardProps } from './BoardTaskCard';
import type { ComponentType } from 'react';

export interface BoardColumnData {
  id: string;
  title: string;
  color?: string;
}

interface BoardColumnProps {
  column: BoardColumnData;
  tasks: BoardTask[];
  onAddTask?: (columnId: string, title: string) => void;
  onTaskClick?: (task: BoardTask) => void;
  onTaskTitleUpdate?: (task: BoardTask, newTitle: string) => void;
  onColumnTitleUpdate?: (columnId: string, newTitle: string) => void;
  onColumnColorUpdate?: (columnId: string, newColor: string) => void;
  CardComponent?: ComponentType<BoardTaskCardProps>;
}

const STATUS_COLORS = [
  { id: 'blue', label: 'Blue', class: 'bg-brand-blue' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { id: 'green', label: 'Green', class: 'bg-emerald-500' },
  { id: 'purple', label: 'Purple', class: 'bg-violet-500' },
  { id: 'pink', label: 'Pink', class: 'bg-brand-light-pink' },
  { id: 'red', label: 'Red', class: 'bg-red-500' },
  { id: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { id: 'orange', label: 'Orange', class: 'bg-orange-500' },
];

const DOT_COLORS: Record<string, string> = {
  blue: 'bg-brand-blue',
  pink: 'bg-brand-light-pink',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  purple: 'bg-violet-500',
  red: 'bg-red-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
};

export function BoardColumn({
  column,
  tasks,
  onAddTask,
  onTaskClick,
  onTaskTitleUpdate,
  onColumnTitleUpdate,
  onColumnColorUpdate,
  CardComponent,
}: BoardColumnProps) {
  const Card = CardComponent ?? BoardTaskCard;
  const dotColor = DOT_COLORS[column.color ?? 'blue'] ?? 'bg-brand-blue';
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingColumnTitle, setEditingColumnTitle] = useState(false);
  const [columnTitleDraft, setColumnTitleDraft] = useState(column.title);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const columnTitleRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingColumnTitle) {
      columnTitleRef.current?.focus();
      columnTitleRef.current?.select();
    }
  }, [editingColumnTitle]);

  useEffect(() => {
    setColumnTitleDraft(column.title);
  }, [column.title]);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setColorPickerOpen(false);
      }
    };

    if (colorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [colorPickerOpen]);

  const handleSubmit = () => {
    const trimmed = newTitle.trim();
    if (trimmed && onAddTask) {
      onAddTask(column.id, trimmed);
    }
    setNewTitle('');
    setIsAdding(false);
  };

  const handleColumnTitleSave = () => {
    setEditingColumnTitle(false);
    const trimmed = columnTitleDraft.trim();
    if (trimmed && trimmed !== column.title && onColumnTitleUpdate) {
      onColumnTitleUpdate(column.id, trimmed);
    } else {
      setColumnTitleDraft(column.title);
    }
  };

  return (
    <div className="w-[280px] shrink-0 flex flex-col">
      <div className="rounded-2xl bg-gray-50/90 dark:bg-gray-900/70 border border-gray-200/80 dark:border-brand-mid-pink/20 shadow-sm flex flex-col overflow-hidden h-full">
        {/* Column header */}
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-200/70 dark:border-brand-mid-pink/15 bg-white/60 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Color picker */}
            <div className="relative" ref={colorPickerRef}>
              <button
                type="button"
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor} hover:scale-125 transition-transform cursor-pointer`}
                title="Change color"
              />
              {colorPickerOpen && (
                <div className="absolute left-0 top-5 z-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-brand-mid-pink/30 shadow-xl p-4 min-w-[200px]">
                  <div className="grid grid-cols-4 gap-3">
                    {STATUS_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => {
                          if (onColumnColorUpdate) {
                            onColumnColorUpdate(column.id, color.id);
                          }
                          setColorPickerOpen(false);
                        }}
                        className={`h-9 w-9 rounded-full ${color.class} hover:scale-110 transition-transform ${
                          column.color === color.id ? 'ring-2 ring-offset-2 ring-brand-light-pink dark:ring-brand-mid-pink' : ''
                        }`}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            {editingColumnTitle ? (
              <input
                ref={columnTitleRef}
                type="text"
                value={columnTitleDraft}
                onChange={(e) => setColumnTitleDraft(e.target.value)}
                onBlur={handleColumnTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleColumnTitleSave();
                  }
                  if (e.key === 'Escape') {
                    setColumnTitleDraft(column.title);
                    setEditingColumnTitle(false);
                  }
                }}
                className="flex-1 min-w-0 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-brand-light-pink/50 rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingColumnTitle(true)}
                className="flex-1 min-w-0 text-left group/coltitle flex items-center gap-1"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 truncate group-hover/coltitle:text-brand-light-pink transition-colors">
                  {column.title}
                </h4>
                <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover/coltitle:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
            <span className="inline-flex items-center justify-center rounded-full bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-semibold min-w-[20px] px-1.5 py-0.5 shrink-0">
              {tasks.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Droppable task list */}
        <Droppable droppableId={column.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={[
                'flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2.5 space-y-2 min-h-[120px] transition-colors duration-200',
                snapshot.isDraggingOver
                  ? 'bg-brand-light-pink/5 dark:bg-brand-dark-pink/5'
                  : '',
              ].join(' ')}
            >
              {/* Inline new-task card */}
              {isAdding && (
                <div className="rounded-xl border-2 border-brand-light-pink/50 bg-white dark:bg-gray-900/90 px-3 py-2.5 shadow-sm">
                  <textarea
                    ref={inputRef}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                      if (e.key === 'Escape') {
                        setNewTitle('');
                        setIsAdding(false);
                      }
                    }}
                    placeholder="What needs to be done?"
                    rows={2}
                    className="w-full bg-transparent text-[13px] font-medium text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none resize-none"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-2.5 py-1 rounded-lg bg-brand-light-pink text-white text-[11px] font-medium hover:bg-brand-mid-pink transition-colors"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewTitle('');
                        setIsAdding(false);
                      }}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {tasks.map((task, index) => (
                <Card
                  key={task.id}
                  task={task}
                  index={index}
                  onClick={onTaskClick}
                  onTitleUpdate={onTaskTitleUpdate}
                />
              ))}
              {provided.placeholder}

              {tasks.length === 0 && !isAdding && !snapshot.isDraggingOver && (
                <div className="flex items-center justify-center h-20 text-[11px] text-gray-400 dark:text-gray-500">
                  Drop tasks here
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}
