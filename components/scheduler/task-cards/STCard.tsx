'use client';

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
  FlagButton,
} from './shared';

const TYPE_COLOR = TASK_TYPE_COLORS['ST'];
const FIELD_DEFS = TASK_FIELD_DEFS['ST'];

export function STCard({ task, team, onUpdate, onDelete, compact }: TaskCardProps) {
  const [showModal, setShowModal] = useState(false);
  const { fields, save } = useFieldSave(task, onUpdate);
  const statusOpt = STATUS_OPTIONS.find((s) => s.key === task.status) || STATUS_OPTIONS[0];
  const isFlagged = fields.flagged === 'true' || fields.flagged === true as unknown as string;

  // ── Compact: two-row ──
  if (compact) {
    return (
      <>
        <div
          onClick={() => setShowModal(true)}
          className={`rounded-sm pl-2 pr-1 py-[3px] cursor-pointer transition-colors ${
            isFlagged
              ? 'bg-amber-100/80 dark:bg-amber-900/20'
              : 'hover:bg-purple-50/60 dark:hover:bg-purple-950/20'
          }`}
          style={{ borderLeft: `3px solid ${isFlagged ? '#f59e0b' : TYPE_COLOR}` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: statusOpt.color }} />
            {fields.storyPostSchedule && (
              <span className="text-[8px] font-mono shrink-0" style={{ color: TYPE_COLOR }}>{fields.storyPostSchedule}</span>
            )}
            <span className="text-[8px] font-semibold truncate text-gray-700 dark:text-gray-300 flex-1 min-w-0">
              {task.taskName || ''}
            </span>
            <FlagButton flagged={isFlagged} onToggle={() => save('flagged', isFlagged ? '' : 'true')} />
            {task.status === 'DONE' && <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-500/70" />}
          </div>
          {fields.contentFlyer && (
            <div className="text-[7px] font-mono truncate text-gray-400 dark:text-gray-600 ml-[13px] mt-px">
              {fields.contentFlyer}
            </div>
          )}
        </div>
        <SchedulerTaskModal task={task} open={showModal} onClose={() => setShowModal(false)} onUpdate={onUpdate} onDelete={onDelete} />
      </>
    );
  }

  // ── Expanded: click opens modal ──
  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className={`flex flex-col gap-1.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
          isFlagged
            ? 'bg-amber-100/80 dark:bg-amber-900/20 border-amber-400/30 dark:border-amber-500/20'
            : 'bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#111124] hover:bg-purple-50/40 dark:hover:bg-purple-950/10'
        }`}
        style={{ borderLeftWidth: 3, borderLeftColor: isFlagged ? '#f59e0b' : TYPE_COLOR }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TypeBadge task={task} onUpdate={onUpdate} />
            <StatusBadge task={task} onUpdate={onUpdate} />
          </div>
          <div className="flex items-center gap-0.5">
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
          {FIELD_DEFS.map((def) => (
            <FieldRow key={def.key} label={def.label} value={fields[def.key] || ''} placeholder={def.placeholder} onSave={(v) => save(def.key, v)} noTruncate />
          ))}
        </div>

        <TimeDisplay task={task} />
        {task.updatedBy && <div className="text-[8px] px-1 font-mono text-gray-400 dark:text-gray-700">updated by {task.updatedBy}</div>}
      </div>
      <SchedulerTaskModal task={task} open={showModal} onClose={() => setShowModal(false)} onUpdate={onUpdate} onDelete={onDelete} />
    </>
  );
}
