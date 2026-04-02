'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { isTaskLocked } from '@/lib/hooks/useScheduler.query';
import { TASK_FIELD_DEFS } from '@/lib/hooks/useScheduler.query';
import { SchedulerTaskModal } from '../SchedulerTaskModal';
import {
  TaskCardProps,
  TASK_TYPE_COLORS,
  STATUS_OPTIONS,
  FieldRow,
  StatusBadge,
  TypeBadge,
  DeleteButton,
  TimeDisplay,
  useFieldSave,
  CaptionPreview,
  FlyerPreview,
  FlagButton,
  PostedBadge,
  TaskViewerAvatars,
  CaptionQAIndicator,
  StreakIndicator,
} from './shared';
import { useSchedulerPresenceContext } from '../SchedulerPresenceContext';

const TYPE_COLOR = TASK_TYPE_COLORS['SP'];
const FIELD_DEFS = TASK_FIELD_DEFS['SP'];

export function SPCard({ task, team, onUpdate, onDelete, compact, schedulerToday, weekStart, profileName, autoOpen, onModalOpen, onModalClose, streak }: TaskCardProps) {
  const [showModal, setShowModal] = useState(false);
  const { setActiveTask } = useSchedulerPresenceContext();

  const wasAutoOpened = useRef(false);
  useEffect(() => {
    if (autoOpen && !showModal) {
      setShowModal(true);
      setActiveTask(task.id);
      wasAutoOpened.current = true;
    } else if (!autoOpen && showModal && wasAutoOpened.current) {
      setShowModal(false);
      setActiveTask(null);
      wasAutoOpened.current = false;
    }
  }, [autoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardClick = useCallback(() => {
    setShowModal(true);
    setActiveTask(task.id);
    onModalOpen?.(task.slotLabel);
  }, [onModalOpen, task.slotLabel, task.id, setActiveTask]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setActiveTask(null);
    wasAutoOpened.current = false;
    onModalClose?.();
  }, [onModalClose, setActiveTask]);
  const { fields, save } = useFieldSave(task, onUpdate);
  const statusOpt = STATUS_OPTIONS.find((s) => s.key === task.status) || STATUS_OPTIONS[0];
  const isFlagged = fields.flagged === 'true' || fields.flagged === true as unknown as string;
  const locked = schedulerToday ? isTaskLocked(task, schedulerToday) : false;

  // ── Compact ──
  if (compact) {
    const label = fields.subscriberPromoSchedule || fields.type || task.taskName || '';
    return (
      <>
        <div
          onClick={handleCardClick}
          className={`rounded-sm pl-2 pr-1 py-[3px] cursor-pointer transition-colors ${
            isFlagged
              ? 'bg-amber-100/80 dark:bg-amber-900/20'
              : 'hover:bg-orange-50/60 dark:hover:bg-orange-950/20'
          }`}
          style={{ borderLeft: `3px solid ${isFlagged ? '#f59e0b' : TYPE_COLOR}` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: statusOpt.color }} />
            {fields.time && (
              <span className="text-[8px] font-mono shrink-0" style={{ color: TYPE_COLOR }}>{fields.time}</span>
            )}
            {label && (
              <span className="text-[8px] font-semibold truncate text-gray-700 dark:text-gray-300 flex-1 min-w-0">{label}</span>
            )}
            {locked && <Lock className="h-2.5 w-2.5 shrink-0 text-gray-400 dark:text-gray-600" />}
            <FlagButton flagged={isFlagged} onToggle={() => save('flagged', isFlagged ? '' : 'true')} />
          </div>
          {fields.contentFlyer && (
            <div className="text-[7px] font-mono truncate text-gray-400 dark:text-gray-600 ml-3.5 mt-px">
              {fields.contentFlyer}
            </div>
          )}
          {/* Bottom status row: QA status + Streak + Posted + Presence */}
          <div className="flex items-center gap-1 ml-3.5 mt-0.5">
            <CaptionQAIndicator status={fields.captionQAStatus} />
            <StreakIndicator streak={streak} />
            {task.status === 'DONE' && <PostedBadge />}
            <TaskViewerAvatars taskId={task.id} size="sm" />
          </div>
        </div>
        <SchedulerTaskModal task={task} open={showModal} onClose={handleModalClose} onUpdate={onUpdate} onDelete={onDelete} schedulerToday={schedulerToday} weekStart={weekStart} profileName={profileName} streak={streak} />
      </>
    );
  }

  // ── Expanded: click opens modal ──
  return (
    <>
      <div
        onClick={handleCardClick}
        className={`flex flex-col gap-1.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
          isFlagged
            ? 'bg-amber-100/80 dark:bg-amber-900/20 border-amber-400/30 dark:border-amber-500/20'
            : 'bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#111124] hover:bg-orange-50/40 dark:hover:bg-orange-950/10'
        }`}
        style={{ borderLeftWidth: 3, borderLeftColor: isFlagged ? '#f59e0b' : TYPE_COLOR }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TypeBadge task={task} />
            <StatusBadge task={task} onUpdate={onUpdate} />
            <StreakIndicator streak={streak} />
          </div>
          <div className="flex items-center gap-1">
            <TaskViewerAvatars taskId={task.id} size="md" />
            <FlagButton
              flagged={isFlagged}
              onToggle={() => save('flagged', isFlagged ? '' : 'true')}
            />
            {onDelete && <DeleteButton onDelete={() => onDelete(task.id)} />}
          </div>
        </div>

        {!task.fields && task.taskName && (
          <div className="text-xs px-1 font-mono text-gray-700 dark:text-gray-300">{task.taskName}</div>
        )}

        <div className="flex flex-col gap-0.5">
          {FIELD_DEFS.filter((def) => def.key !== 'caption').map((def) => (
            <FieldRow key={def.key} label={def.label} value={fields[def.key] || ''} placeholder={def.placeholder} onSave={(v) => save(def.key, v)} noTruncate />
          ))}
          <CaptionPreview fields={fields} typeColor={TYPE_COLOR} noTruncate />
          <FlyerPreview fields={fields} noTruncate />
        </div>

        <TimeDisplay task={task} />
        {task.updatedBy && <div className="text-[8px] px-1 font-mono text-gray-400 dark:text-gray-700">updated by {task.updatedBy}</div>}
      </div>
      <SchedulerTaskModal task={task} open={showModal} onClose={handleModalClose} onUpdate={onUpdate} onDelete={onDelete} schedulerToday={schedulerToday} weekStart={weekStart} profileName={profileName} />
    </>
  );
}
