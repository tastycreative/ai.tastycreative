'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import {
  useWorkspaceEvents,
  useWorkspaceEvent,
  type WorkspaceEvent,
} from '@/lib/hooks/useWorkspaceEvents.query';
import { useTimezoneStore } from '@/stores/timezone-store';
import { getDateKeyInTimezone, getTodayKeyInTimezone, formatInTimezone, getTimezoneAbbreviation } from '@/lib/timezone-utils';
import { TimezonePicker } from '@/components/TimezonePicker';
import { EventDetailModal } from './EventDetailModal';

interface CalendarTabProps {
  workspaceId: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarTab({ workspaceId }: CalendarTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedTz = useTimezoneStore((s) => s.getResolvedTimezone());

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WorkspaceEvent | undefined>();
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  // Guard: tracks whether user intentionally closed the modal,
  // so the deep-link effect doesn't immediately reopen it.
  const dismissedEventIdRef = useRef<string | null>(null);

  // Date range for fetching events — pad to include full weeks shown
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const rangeStartISO = calStart.toISOString();
  const rangeEndISO = calEnd.toISOString();

  const { data: events = [], isLoading } = useWorkspaceEvents(
    workspaceId,
    rangeStartISO,
    rangeEndISO,
  );

  // Deep-link: ?event=<id>
  const deepLinkEventId = searchParams.get('event');
  const { data: deepLinkEvent } = useWorkspaceEvent(
    deepLinkEventId ? workspaceId : undefined,
    deepLinkEventId ?? undefined,
  );

  useEffect(() => {
    if (
      deepLinkEvent &&
      !modalOpen &&
      dismissedEventIdRef.current !== deepLinkEvent.id
    ) {
      setSelectedEvent(deepLinkEvent);
      setModalOpen(true);
    }
  }, [deepLinkEvent, modalOpen]);

  // Clear dismissed guard when URL param actually changes
  useEffect(() => {
    if (!deepLinkEventId) {
      dismissedEventIdRef.current = null;
    }
  }, [deepLinkEventId]);

  // Build calendar grid days
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [calStart.getTime(), calEnd.getTime()]);

  // "Today" in the selected timezone (e.g. still Mar 16 in LA when browser says Mar 17 in PH)
  const todayKey = useMemo(() => getTodayKeyInTimezone(resolvedTz), [resolvedTz]);

  // Group events by date string (timezone-aware)
  const eventsByDate = useMemo(() => {
    const map: Record<string, WorkspaceEvent[]> = {};
    for (const ev of events) {
      const startKey = getDateKeyInTimezone(ev.startDate, resolvedTz);
      const endKey = getDateKeyInTimezone(ev.endDate, resolvedTz);
      // Place event on each calendar day it spans
      for (const day of calendarDays) {
        const dayKey = format(day, 'yyyy-MM-dd');
        if (dayKey >= startKey && dayKey <= endKey) {
          if (!map[dayKey]) map[dayKey] = [];
          if (!map[dayKey].find((e) => e.id === ev.id)) {
            map[dayKey].push(ev);
          }
        }
      }
    }
    return map;
  }, [events, calendarDays, resolvedTz]);

  const handleDayClick = useCallback((day: Date) => {
    setSelectedEvent(undefined);
    setDefaultDate(format(day, 'yyyy-MM-dd'));
    setModalOpen(true);
  }, []);

  const handleEventClick = useCallback((ev: WorkspaceEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(ev);
    setDefaultDate(undefined);
    setModalOpen(true);
    // Set URL param for deep-linking
    const params = new URLSearchParams(searchParams.toString());
    params.set('event', ev.id);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleCloseModal = useCallback(() => {
    // Mark this event as dismissed so the deep-link effect won't reopen it
    if (selectedEvent) {
      dismissedEventIdRef.current = selectedEvent.id;
    }
    setModalOpen(false);
    setSelectedEvent(undefined);
    setDefaultDate(undefined);
    // Clear URL ?event= param
    const params = new URLSearchParams(searchParams.toString());
    if (params.has('event')) {
      params.delete('event');
      const qs = params.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    }
  }, [selectedEvent, searchParams, router]);

  const goToToday = () => setCurrentMonth(new Date());

  const tzAbbr = getTimezoneAbbreviation(resolvedTz);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/95 backdrop-blur-xl shadow-2xl shadow-black/60">
      {/* Top accent */}
      <div className="h-[3px] rounded-t-2xl bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
        <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-brand-light-pink" />
          Calendar
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1 rounded hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="px-2 py-0.5 rounded text-[11px] font-semibold text-brand-light-pink hover:bg-brand-light-pink/10 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 rounded hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-200 ml-2">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <TimezonePicker />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {isLoading ? (
          /* Skeleton calendar grid */
          <div className="grid grid-cols-7 border-t border-l border-white/[0.06]">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[100px] border-r border-b border-white/[0.06] p-1.5 animate-pulse"
              >
                <div className="w-6 h-6 rounded-full bg-white/[0.06] mb-2" />
                {i % 4 === 0 && <div className="h-4 w-3/4 rounded bg-white/[0.04] mb-1" />}
                {i % 5 === 1 && (
                  <>
                    <div className="h-4 w-full rounded bg-white/[0.04] mb-1" />
                    <div className="h-4 w-1/2 rounded bg-white/[0.04]" />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 border-t border-l border-white/[0.06]">
            {calendarDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] ?? [];
              const inCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = dateKey === todayKey;
              const maxVisible = 3;

              return (
                <div
                  key={dateKey}
                  onClick={() => handleDayClick(day)}
                  className={[
                    'relative min-h-[100px] border-r border-b border-white/[0.06] p-1.5 cursor-pointer transition-colors group',
                    inCurrentMonth
                      ? 'bg-transparent hover:bg-white/[0.03]'
                      : 'bg-white/[0.01] hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={[
                        'text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                        isToday
                          ? 'bg-brand-light-pink text-white'
                          : inCurrentMonth
                            ? 'text-gray-300'
                            : 'text-gray-600',
                      ].join(' ')}
                    >
                      {format(day, 'd')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(day);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-500 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Event chips */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, maxVisible).map((ev) => {
                      // Show time preview on hover via title attribute
                      const timeHint = ev.allDay
                        ? 'All day'
                        : `${formatInTimezone(ev.startDate, resolvedTz, { hour: 'numeric', minute: '2-digit' })} – ${formatInTimezone(ev.endDate, resolvedTz, { hour: 'numeric', minute: '2-digit' })} ${tzAbbr}`;

                      return (
                        <button
                          key={ev.id}
                          onClick={(e) => handleEventClick(ev, e)}
                          title={timeHint}
                          className="w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium text-white truncate transition-all hover:brightness-125"
                          style={{
                            backgroundColor: `${ev.color ?? '#F774B9'}25`,
                            borderLeft: `2px solid ${ev.color ?? '#F774B9'}`,
                          }}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > maxVisible && (
                      <span className="text-[9px] text-gray-500 pl-1">
                        +{dayEvents.length - maxVisible} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && events.length === 0 && (
          <div className="text-center py-8">
            <CalendarDays className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-[13px] text-gray-500">No events this month</p>
            <p className="text-[11px] text-gray-600 mt-1">Click on a day to create one</p>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal
        workspaceId={workspaceId}
        event={selectedEvent}
        isOpen={modalOpen}
        onClose={handleCloseModal}
        defaultDate={defaultDate}
        timezone={resolvedTz}
      />
    </div>
  );
}
