'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

interface AddColumnButtonProps {
  onAddColumn?: (name: string, color: string) => void;
}

const COLUMN_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-brand-blue' },
  { value: 'pink', label: 'Pink', class: 'bg-brand-light-pink' },
  { value: 'green', label: 'Green', class: 'bg-emerald-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { value: 'purple', label: 'Purple', class: 'bg-violet-500' },
  { value: 'gray', label: 'Gray', class: 'bg-gray-500' },
];

export function AddColumnButton({ onAddColumn }: AddColumnButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleSubmit = () => {
    const trimmed = columnName.trim();
    if (trimmed && onAddColumn) {
      onAddColumn(trimmed, selectedColor);
      setColumnName('');
      setSelectedColor('blue');
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setColumnName('');
    setSelectedColor('blue');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className="w-12 shrink-0 h-12 rounded-xl bg-gray-50/90 dark:bg-gray-900/70 border border-gray-200/80 dark:border-brand-mid-pink/20 hover:bg-gray-100 dark:hover:bg-brand-dark-pink/10 hover:border-brand-light-pink/50 dark:hover:border-brand-light-pink/50 shadow-sm transition-all flex items-center justify-center group"
      >
        <Plus className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-brand-light-pink transition-colors" />
      </button>
    );
  }

  return (
    <div className="w-[280px] shrink-0">
      <div className="rounded-2xl bg-white dark:bg-gray-900/70 border border-brand-light-pink/50 dark:border-brand-mid-pink/40 shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-brand-off-white">
            New Column
          </h4>
          <button
            type="button"
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Column Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder="e.g., In Review"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-brand-mid-pink/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-brand-off-white placeholder-gray-400 dark:placeholder-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLUMN_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`h-8 w-8 rounded-full ${color.class} transition-all ${
                    selectedColor === color.value
                      ? 'ring-2 ring-offset-2 ring-brand-light-pink dark:ring-offset-gray-900'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!columnName.trim()}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-brand-light-pink hover:bg-brand-mid-pink text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Column
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-brand-mid-pink/30 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
