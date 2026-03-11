'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';

interface SelectFieldProps {
  value: string;
  options: string[];
  onSave: (v: string) => void;
  renderOption?: (v: string) => React.ReactNode;
}

export function SelectField({
  value,
  options,
  onSave,
  renderOption,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const optionsLengthRef = useRef(options.length);
  optionsLengthRef.current = options.length;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = optionsLengthRef.current * 32 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    setPos({
      top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 140),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="group/sf flex items-center gap-1.5 w-full text-left"
      >
        {renderOption ? (
          renderOption(value)
        ) : (
          <span className="text-sm text-gray-800 dark:text-brand-off-white">
            {value || <span className="text-gray-400 italic">None</span>}
          </span>
        )}
        <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover/sf:opacity-100 transition-opacity shrink-0" />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
          className="rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-lg py-1"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onSave(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-brand-light-pink/10 transition-colors ${
                opt === value
                  ? 'text-brand-light-pink font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {renderOption ? renderOption(opt) : opt}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
