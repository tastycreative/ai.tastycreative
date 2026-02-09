'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateChange: (startDate: Date | null, endDate: Date | null) => void;
  placeholder?: string;
  className?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  placeholder = 'Select date range',
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth1, setCurrentMonth1] = useState(new Date());
  const [currentMonth2, setCurrentMonth2] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  });
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick select presets
  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'This month', days: 0, type: 'thisMonth' },
    { label: 'Last month', days: 0, type: 'lastMonth' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePresetClick = (preset: any) => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.setHours(23, 59, 59, 999));

    if (preset.type === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (preset.type === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else {
      start = new Date();
      start.setDate(start.getDate() - preset.days);
      start.setHours(0, 0, 0, 0);
    }

    setTempStartDate(start);
    setTempEndDate(end);
  };

  const handleDayClick = (year: number, month: number, day: number) => {
    const clickedDate = new Date(year, month, day);

    if (selecting === 'start') {
      setTempStartDate(clickedDate);
      setTempEndDate(null);
      setSelecting('end');
    } else {
      if (tempStartDate && clickedDate < tempStartDate) {
        // If end date is before start date, swap them
        setTempEndDate(tempStartDate);
        setTempStartDate(clickedDate);
      } else {
        setTempEndDate(clickedDate);
      }
      setSelecting('start');
    }
  };

  const handleApply = () => {
    onDateChange(tempStartDate, tempEndDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStartDate(null);
    setTempEndDate(null);
    onDateChange(null, null);
    setSelecting('start');
  };

  const isDateInRange = (date: Date) => {
    if (!tempStartDate || !tempEndDate) return false;
    return date >= tempStartDate && date <= tempEndDate;
  };

  const isDateSelected = (date: Date) => {
    if (!tempStartDate && !tempEndDate) return false;
    if (tempStartDate && date.toDateString() === tempStartDate.toDateString()) return true;
    if (tempEndDate && date.toDateString() === tempEndDate.toDateString()) return true;
    return false;
  };

  const renderCalendar = (currentMonth: Date, setCurrentMonth: (date: Date) => void) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);

    const days = [];
    const totalCells = Math.ceil((daysInMonth + firstDay) / 7) * 7;

    // Previous month days
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 sm:h-10" />);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isInRange = isDateInRange(date);
      const isSelected = isDateSelected(date);
      const isToday = date.toDateString() === new Date().toDateString();

      days.push(
        <button
          key={day}
          onClick={() => handleDayClick(year, month, day)}
          className={`h-8 sm:h-10 flex items-center justify-center text-xs sm:text-sm rounded-lg transition-colors ${
            isSelected
              ? 'bg-brand-blue text-white font-semibold'
              : isInRange
              ? 'bg-blue-100 dark:bg-blue-900/30 text-brand-blue'
              : isToday
              ? 'border-2 border-brand-blue text-brand-blue'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {day}
        </button>
      );
    }

    // Next month days
    for (let i = days.length; i < totalCells; i++) {
      days.push(<div key={`empty-end-${i}`} className="h-8 sm:h-10" />);
    }

    const prevMonth = () => {
      const prev = new Date(currentMonth);
      prev.setMonth(prev.getMonth() - 1);
      setCurrentMonth(prev);
    };

    const nextMonth = () => {
      const next = new Date(currentMonth);
      next.setMonth(next.getMonth() + 1);
      setCurrentMonth(next);
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={nextMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400">
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className={startDate || endDate ? '' : 'text-gray-500'}>
            {startDate && endDate
              ? `${formatDate(startDate)} - ${formatDate(endDate)}`
              : startDate
              ? formatDate(startDate)
              : placeholder}
          </span>
        </div>
        {(startDate || endDate) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 sm:p-6 min-w-[320px] sm:min-w-[600px] max-w-[95vw] left-0 right-0 mx-auto">
          {/* Presets */}
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-brand-blue hover:text-white rounded-lg transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected dates display */}
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="font-medium">From:</span>
              <span className={tempStartDate ? 'text-brand-blue font-semibold' : 'text-gray-400'}>
                {tempStartDate ? formatDate(tempStartDate) : 'Select start date'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-medium">To:</span>
              <span className={tempEndDate ? 'text-brand-blue font-semibold' : 'text-gray-400'}>
                {tempEndDate ? formatDate(tempEndDate) : 'Select end date'}
              </span>
            </div>
          </div>

          {/* Calendars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {renderCalendar(currentMonth1, setCurrentMonth1)}
            <div className="hidden sm:block">
              {renderCalendar(currentMonth2, setCurrentMonth2)}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!tempStartDate && !tempEndDate}
              className="px-4 py-2 text-sm font-medium bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
