'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Sparkles,
  Check,
  ArrowRight,
  ChevronDown,
  Pencil,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MODEL_BIBLE_FIELDS,
  CATEGORY_ORDER,
  getFieldsByCategory,
} from '@/lib/model-bible-fields';
import { buildModelBibleFromValues } from '@/lib/field-mapping-utils';

interface FormDataMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  formFields: Record<string, string>;
  fieldOrder?: string[];
  existingModelBible?: Record<string, unknown>;
  onApplied: (
    updatedBible: Record<string, unknown>,
    appliedMappings: Record<string, string>,
    editedValues: Record<string, string>,
  ) => void;
}

// --- FieldSourcePicker ---
// Dropdown portaled to document.body so it never clips.
// Form fields can be reused, but shows which profile fields already use them.
function FieldSourcePicker({
  value,
  formFields,
  formFieldKeys,
  sourceUsage,
  onChange,
}: {
  value: string;
  formFields: Record<string, string>;
  formFieldKeys: string[];
  /** Map of sourceFieldKey → array of profile field labels that use it */
  sourceUsage: Map<string, string[]>;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxH: 300, openUp: false });

  const MARGIN = 16; // px from viewport edge

  // Position the dropdown based on trigger rect, flip up if no room below
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
    const spaceAbove = rect.top - MARGIN;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;

    if (openUp) {
      setPos({
        top: rect.top - 4, // will use bottom anchor via transform
        left: rect.left,
        width: rect.width,
        maxH: Math.min(spaceAbove, window.innerHeight - MARGIN * 2),
        openUp: true,
      });
    } else {
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxH: Math.min(spaceBelow, window.innerHeight - MARGIN * 2),
        openUp: false,
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const isMapped = !!value;

  const filtered = formFieldKeys.filter((key) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      key.toLowerCase().includes(q) ||
      (formFields[key] || '').toLowerCase().includes(q)
    );
  });

  // Search bar height (~41px) + "No mapping" button (~33px) = ~74px reserved
  const SEARCH_AREA_HEIGHT = 74;
  const listMaxH = Math.max(pos.maxH - SEARCH_AREA_HEIGHT, 100);

  const dropdown =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-[#1a1a1f] border border-[#27272a] rounded-xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
            style={{
              zIndex: 99999,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxH,
              ...(pos.openUp
                ? { bottom: window.innerHeight - pos.top }
                : { top: pos.top }),
            }}
          >
            <div className="p-2 border-b border-[#27272a] shrink-0">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search form fields..."
                className="w-full text-xs bg-[#0c0c0f] border border-[#27272a] rounded-md px-2.5 py-1.5 text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-[#3b82f6] placeholder:text-[#52525b]"
              />
            </div>

            <div
              className="overflow-y-auto flex-1"
              style={{ maxHeight: listMaxH }}
            >
              {/* No mapping */}
              <button
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setSearch('');
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#27272a] transition-colors flex items-center gap-2 border-b border-[#27272a]/50 ${
                  !isMapped ? 'text-[#3b82f6]' : 'text-[#71717a]'
                }`}
              >
                <X size={10} className="shrink-0 opacity-50" />
                <span>No mapping</span>
              </button>

              {filtered.map((key) => {
                const fieldVal = formFields[key] || '';
                const isSelected = value === key;
                const usedBy = sourceUsage.get(key) || [];
                const isUsedElsewhere = !isSelected && usedBy.length > 0;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-3 py-2 transition-colors hover:bg-[#27272a] cursor-pointer ${
                      isSelected ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <Check
                          size={10}
                          className="text-emerald-400 shrink-0"
                        />
                      )}
                      <span
                        className={`text-xs font-medium truncate ${
                          isSelected ? 'text-emerald-300' : 'text-[#e4e4e7]'
                        }`}
                      >
                        {key}
                      </span>
                      {isUsedElsewhere && (
                        <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-px">
                          <Link2 size={8} />
                          {usedBy.length > 1
                            ? `${usedBy.length} fields`
                            : usedBy[0]}
                        </span>
                      )}
                    </div>
                    {fieldVal && (
                      <p className="text-[10px] text-[#52525b] mt-0.5 whitespace-pre-wrap break-words">
                        {fieldVal.length > 200
                          ? fieldVal.slice(0, 200) + '...'
                          : fieldVal}
                      </p>
                    )}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-[#52525b]">
                  No matching fields
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={`w-full text-left text-sm rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors ${
          isMapped
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            : 'bg-[#27272a] border border-[#3f3f46] text-[#71717a]'
        }`}
      >
        <span className="flex-1 min-w-0 truncate">
          {isMapped ? value : 'Select form field...'}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {dropdown}
    </>
  );
}

// --- Main Modal ---
export function FormDataMappingModal({
  isOpen,
  onClose,
  profileId,
  formFields,
  fieldOrder,
  existingModelBible = {},
  onApplied,
}: FormDataMappingModalProps) {
  // mappings: targetPath → source form field key (or '' for unmapped)
  const [mappings, setMappings] = useState<Record<string, string>>({});
  // editedValues: targetPath → user-edited value string
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [aiSuggested, setAiSuggested] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );

  const fieldsByCategory = useMemo(() => getFieldsByCategory(), []);

  const formFieldKeys = useMemo(() => {
    if (Array.isArray(fieldOrder) && fieldOrder.length > 0) {
      return fieldOrder.filter((k) => k in formFields);
    }
    return Object.keys(formFields);
  }, [formFields, fieldOrder]);

  // Build a map: sourceKey → [label of profile fields using it]
  const sourceUsage = useMemo(() => {
    const usage = new Map<string, string[]>();
    for (const [targetPath, sourceKey] of Object.entries(mappings)) {
      if (!sourceKey) continue;
      const field = MODEL_BIBLE_FIELDS.find((f) => f.path === targetPath);
      const label = field?.label || targetPath;
      const arr = usage.get(sourceKey) || [];
      arr.push(label);
      usage.set(sourceKey, arr);
    }
    return usage;
  }, [mappings]);

  const mappedCount = useMemo(
    () => Object.values(mappings).filter(Boolean).length,
    [mappings],
  );

  // Fetch AI suggestions
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function fetchSuggestions() {
      setLoading(true);
      try {
        const res = await fetch('/api/field-mapping/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: formFields }),
        });
        if (!res.ok) throw new Error('Failed to get suggestions');
        const data = (await res.json()) as {
          mappings: Record<string, string>;
          extractedValues?: Record<string, string>;
        };
        if (cancelled) return;

        const m = data.mappings || {};
        const extracted = data.extractedValues || {};
        setMappings(m);
        setAiSuggested(new Set(Object.keys(m)));

        // Pre-fill edited values: use AI-extracted value if available,
        // otherwise fall back to the full form field value
        const ev: Record<string, string> = {};
        for (const [targetPath, sourceKey] of Object.entries(m)) {
          if (extracted[targetPath]) {
            ev[targetPath] = extracted[targetPath];
          } else if (sourceKey && formFields[sourceKey] !== undefined) {
            ev[targetPath] = formFields[sourceKey];
          }
        }
        setEditedValues(ev);
      } catch (err) {
        console.error('AI suggestion failed:', err);
        if (!cancelled)
          toast.error('AI analysis failed. You can map fields manually.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [isOpen, formFields]);

  const handleSourceChange = (targetPath: string, sourceKey: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (!sourceKey) {
        delete next[targetPath];
      } else {
        next[targetPath] = sourceKey;
      }
      return next;
    });

    if (sourceKey && formFields[sourceKey] !== undefined) {
      setEditedValues((prev) => ({
        ...prev,
        [targetPath]: formFields[sourceKey],
      }));
    } else {
      setEditedValues((prev) => {
        const next = { ...prev };
        delete next[targetPath];
        return next;
      });
    }
  };

  const handleEditedValueChange = (targetPath: string, val: string) => {
    setEditedValues((prev) => ({ ...prev, [targetPath]: val }));
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const finalValues: Record<string, string> = {};
      for (const [targetPath, sourceKey] of Object.entries(mappings)) {
        if (!sourceKey) continue;
        finalValues[targetPath] =
          editedValues[targetPath] ?? formFields[sourceKey] ?? '';
      }

      const newBible = buildModelBibleFromValues(
        finalValues,
        existingModelBible,
      );

      const res = await fetch(`/api/instagram-profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelBible: newBible }),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      toast.success('Profile updated with form data');
      onApplied(newBible, mappings, editedValues);
      onClose();
    } catch (err) {
      console.error('Apply mappings failed:', err);
      toast.error('Failed to apply mappings');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#27272a] shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-[#e4e4e7] flex items-center gap-2">
              <Sparkles size={20} className="text-[#3b82f6]" />
              Map Form Data to Profile
            </h3>
            <p className="text-xs text-[#71717a] mt-1">
              Select a form field, then edit the value before applying.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6] mb-4" />
              <p className="text-sm text-[#a1a1aa]">
                AI is analyzing your form fields...
              </p>
              <p className="text-xs text-[#52525b] mt-1">
                This may take a few seconds
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORY_ORDER.map((cat) => {
                const fields = fieldsByCategory[cat];
                if (!fields || fields.length === 0) return null;

                const isCollapsed = collapsedCategories.has(cat);
                const catMappedCount = fields.filter(
                  (f) => !!mappings[f.path],
                ).length;

                return (
                  <div
                    key={cat}
                    className="rounded-xl border border-[#27272a] overflow-hidden"
                  >
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0c0c0f] hover:bg-[#141418] transition-colors"
                    >
                      <span className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">
                        {cat}
                      </span>
                      <div className="flex items-center gap-2">
                        {catMappedCount > 0 && (
                          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                            {catMappedCount} mapped
                          </span>
                        )}
                        <span className="text-[#52525b] text-xs">
                          {isCollapsed ? '▸' : '▾'}
                        </span>
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-[#27272a]/50">
                        {fields.map((field) => {
                          const sourceKey = mappings[field.path] || '';
                          const isMapped = !!sourceKey;
                          const isAi = aiSuggested.has(field.path);
                          const currentEditedValue =
                            editedValues[field.path] ?? '';
                          const originalValue = isMapped
                            ? (formFields[sourceKey] ?? '')
                            : '';
                          const isEdited =
                            isMapped && currentEditedValue !== originalValue;

                          return (
                            <div
                              key={field.path}
                              className={`px-4 py-3 ${
                                isMapped
                                  ? 'bg-emerald-500/[0.03]'
                                  : 'bg-[#18181b]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Profile field label */}
                                <div className="w-36 shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-[#e4e4e7]">
                                      {field.label}
                                    </span>
                                    {isAi && isMapped && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1 py-px">
                                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                        AI
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#52525b]">
                                    {field.type === 'string[]'
                                      ? 'list'
                                      : field.type === 'boolean'
                                      ? 'yes/no'
                                      : 'text'}
                                  </div>
                                </div>

                                <ArrowRight
                                  size={14}
                                  className={
                                    isMapped
                                      ? 'text-emerald-500 shrink-0'
                                      : 'text-[#27272a] shrink-0'
                                  }
                                />

                                {/* Source picker */}
                                <div className="flex-1 min-w-0">
                                  <FieldSourcePicker
                                    value={sourceKey}
                                    formFields={formFields}
                                    formFieldKeys={formFieldKeys}
                                    sourceUsage={sourceUsage}
                                    onChange={(key) =>
                                      handleSourceChange(field.path, key)
                                    }
                                  />
                                </div>
                              </div>

                              {/* Editable value */}
                              {isMapped && (
                                <div className="mt-2 ml-[calc(9rem+14px+0.75rem)]">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Pencil size={10} className="text-[#52525b]" />
                                    <span className="text-[10px] text-[#52525b]">
                                      Value to apply
                                      {isEdited && (
                                        <span className="text-amber-400 ml-1">
                                          (edited)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  {field.type === 'string' ||
                                  field.type === 'boolean' ? (
                                    <input
                                      type="text"
                                      value={currentEditedValue}
                                      onChange={(e) =>
                                        handleEditedValueChange(
                                          field.path,
                                          e.target.value,
                                        )
                                      }
                                      className="w-full text-xs bg-[#0c0c0f] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-[#3b82f6] placeholder:text-[#52525b]"
                                      placeholder="Edit value..."
                                    />
                                  ) : (
                                    <textarea
                                      value={currentEditedValue}
                                      onChange={(e) =>
                                        handleEditedValueChange(
                                          field.path,
                                          e.target.value,
                                        )
                                      }
                                      rows={2}
                                      className="w-full text-xs bg-[#0c0c0f] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-[#3b82f6] placeholder:text-[#52525b] resize-none"
                                      placeholder="Comma-separated values..."
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between p-6 border-t border-[#27272a] shrink-0">
            <span className="text-xs text-[#71717a]">
              {mappedCount} field{mappedCount !== 1 ? 's' : ''} mapped
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#27272a] text-[#e4e4e7] rounded-lg text-sm hover:bg-[#3f3f46] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying || mappedCount === 0}
                className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Apply Mappings
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
