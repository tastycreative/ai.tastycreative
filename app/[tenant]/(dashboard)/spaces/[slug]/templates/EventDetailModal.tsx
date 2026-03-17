'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Trash2, CalendarDays, Pencil, Clock, AlignLeft, Link2, Check } from 'lucide-react';
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  type WorkspaceEvent,
} from '@/lib/hooks/useWorkspaceEvents.query';
import { useTimezoneStore } from '@/stores/timezone-store';
import {
  utcToDatetimeLocal,
  datetimeLocalToUTC,
  getTimezoneAbbreviation,
  formatInTimezone,
} from '@/lib/timezone-utils';

const EVENT_COLORS = [
  { label: 'Pink', value: '#F774B9' },
  { label: 'Blue', value: '#5DC3F8' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Mid Pink', value: '#EC67A1' },
];

type ModalMode = 'view' | 'edit' | 'create';

interface EventDetailModalProps {
  workspaceId: string;
  event?: WorkspaceEvent;
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string; // "YYYY-MM-DD" for pre-filling
  timezone?: string; // IANA timezone; falls back to store
}

export function EventDetailModal({
  workspaceId,
  event,
  isOpen,
  onClose,
  defaultDate,
  timezone,
}: EventDetailModalProps) {
  const storeTz = useTimezoneStore((s) => s.getResolvedTimezone());
  const tz = timezone ?? storeTz;
  const tzAbbr = getTimezoneAbbreviation(tz);

  const [mode, setMode] = useState<ModalMode>('view');
  const [linkCopied, setLinkCopied] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState(EVENT_COLORS[0].value);

  const createMutation = useCreateEvent(workspaceId);
  const updateMutation = useUpdateEvent(workspaceId);
  const deleteMutation = useDeleteEvent(workspaceId);

  // Determine mode and populate form when props change
  useEffect(() => {
    if (!isOpen) return;
    if (event) {
      setMode('view');
      setTitle(event.title);
      setDescription(event.description ?? '');
      setAllDay(event.allDay);
      setColor(event.color ?? EVENT_COLORS[0].value);
      if (event.allDay) {
        setStartDate(event.startDate.slice(0, 10));
        setEndDate(event.endDate.slice(0, 10));
      } else {
        setStartDate(utcToDatetimeLocal(event.startDate, tz));
        setEndDate(utcToDatetimeLocal(event.endDate, tz));
      }
    } else {
      setMode('create');
      setTitle('');
      setDescription('');
      setAllDay(false);
      setColor(EVENT_COLORS[0].value);
      if (defaultDate) {
        setStartDate(`${defaultDate}T09:00`);
        setEndDate(`${defaultDate}T10:00`);
      } else {
        setStartDate('');
        setEndDate('');
      }
    }
  }, [event, defaultDate, tz, isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSave = async () => {
    if (!title.trim() || !startDate || !endDate) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      startDate: allDay ? `${startDate}T00:00:00.000Z` : datetimeLocalToUTC(startDate, tz),
      endDate: allDay ? `${endDate}T23:59:59.999Z` : datetimeLocalToUTC(endDate, tz),
      allDay,
      color,
    };

    if (event) {
      await updateMutation.mutateAsync({ eventId: event.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    handleClose();
  };

  const handleDelete = async () => {
    if (!event) return;
    await deleteMutation.mutateAsync(event.id);
    handleClose();
  };

  if (!isOpen) return null;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isEditOrCreate = mode === 'edit' || mode === 'create';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: event?.color ?? color }}
            />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white">
              {mode === 'create' ? 'New Event' : mode === 'edit' ? 'Edit Event' : 'Event Details'}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {mode === 'view' && event && (
              <>
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('event', event.id);
                    navigator.clipboard.writeText(url.toString());
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    linkCopied
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10'
                  }`}
                  title={linkCopied ? 'Copied!' : 'Copy link'}
                >
                  {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-colors"
                  title="Edit event"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── VIEW MODE ── */}
        {mode === 'view' && event && (
          <>
            <div className="px-5 py-5 space-y-4">
              {/* Title */}
              <h2 className="text-base font-bold text-gray-900 dark:text-brand-off-white leading-tight">
                {event.title}
              </h2>

              {/* Date/Time */}
              <div className="flex items-start gap-2.5 text-[13px]">
                <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="text-gray-600 dark:text-gray-300">
                  {event.allDay ? (
                    <p>
                      {formatInTimezone(event.startDate, tz, { month: 'long', day: 'numeric', year: 'numeric' })}
                      {event.startDate.slice(0, 10) !== event.endDate.slice(0, 10) && (
                        <> &ndash; {formatInTimezone(event.endDate, tz, { month: 'long', day: 'numeric', year: 'numeric' })}</>
                      )}
                      <span className="text-gray-500 dark:text-gray-500 ml-1">(All day)</span>
                    </p>
                  ) : (
                    <>
                      <p>
                        {formatInTimezone(event.startDate, tz, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        to {formatInTimezone(event.endDate, tz, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{tzAbbr}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div className="flex items-start gap-2.5 text-[13px]">
                  <AlignLeft className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}
            </div>

            {/* Footer — View mode */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white bg-brand-light-pink hover:bg-brand-mid-pink transition-colors"
              >
                Edit Event
              </button>
            </div>
          </>
        )}

        {/* ── EDIT / CREATE MODE ── */}
        {isEditOrCreate && (
          <>
            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40 resize-none"
                />
              </div>

              {/* All Day Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAllDay(checked);
                    if (checked) {
                      if (startDate.includes('T')) setStartDate(startDate.slice(0, 10));
                      if (endDate.includes('T')) setEndDate(endDate.slice(0, 10));
                    } else {
                      if (!startDate.includes('T') && startDate) setStartDate(`${startDate}T09:00`);
                      if (!endDate.includes('T') && endDate) setEndDate(`${endDate}T10:00`);
                    }
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-brand-light-pink focus:ring-brand-light-pink/50 h-3.5 w-3.5"
                />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">All day event</span>
              </label>

              {/* Start / End Date */}
              {!allDay && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Times in <span className="font-semibold text-brand-light-pink">{tzAbbr}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start</label>
                  <input
                    type={allDay ? 'date' : 'datetime-local'}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End</label>
                  <input
                    type={allDay ? 'date' : 'datetime-local'}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40"
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Color</label>
                <div className="flex items-center gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        color === c.value
                          ? 'border-white dark:border-brand-off-white scale-110 shadow-lg'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer — Edit/Create mode */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-white/[0.06]">
              <div>
                {mode === 'edit' && event && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={mode === 'edit' ? () => setMode('view') : handleClose}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!title.trim() || !startDate || !endDate || isSaving}
                  className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white bg-brand-light-pink hover:bg-brand-mid-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
