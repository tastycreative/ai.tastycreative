'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil, Check } from 'lucide-react';

interface EditableFieldProps {
  value: string;
  onSave: (v: string) => void;
  type?: 'text' | 'date';
  placeholder?: string;
}

export function EditableField({
  value,
  onSave,
  type = 'text',
  placeholder,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group/ef flex items-center gap-1.5 w-full text-left"
      >
        <span className="text-sm text-gray-800 dark:text-brand-off-white truncate">
          {value || <span className="text-gray-400 italic">{placeholder ?? 'None'}</span>}
        </span>
        <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover/ef:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  }

  const save = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="flex-1 min-w-0 rounded-lg border border-brand-light-pink/40 bg-white/80 dark:bg-gray-900/80 px-2 py-1 text-sm text-gray-900 dark:text-brand-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60"
      />
      <button type="button" onClick={save} className="p-1 text-brand-light-pink">
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
