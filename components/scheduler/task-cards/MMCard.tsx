'use client';

import React, { useState } from 'react';
import { CheckCircle2, DollarSign } from 'lucide-react';
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
} from './shared';

const TYPE_COLOR = TASK_TYPE_COLORS['MM'];
const FIELD_DEFS = TASK_FIELD_DEFS['MM'];

export function MMCard({ task, team, onUpdate, onDelete, compact }: TaskCardProps) {
  const [showModal, setShowModal] = useState(false);
  const { fields, save } = useFieldSave(task, onUpdate);
  const statusOpt = STATUS_OPTIONS.find((s) => s.key === task.status) || STATUS_OPTIONS[0];
  const isFlagged = fields.flagged === 'true' || fields.flagged === true as unknown as string;

  // ── Compact: slim row, click → modal ──
  if (compact) {
    return (
      <>
        <div
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-all hover:shadow-md hover:border-pink-300 dark:hover:border-pink-800/40 bg-white dark:bg-[#0c0c1a] ${
            isFlagged
              ? 'border-amber-400/30 dark:border-amber-500/20'
              : 'border-gray-200 dark:border-[#111124]'
          }`}
          style={{ borderLeftWidth: 3, borderLeftColor: TYPE_COLOR }}
        >
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: statusOpt.color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full font-sans shrink-0" style={{ background: TYPE_COLOR + '20', color: TYPE_COLOR }}>
                MM
              </span>
              {fields.time && (
                <span className="text-[9px] font-mono text-pink-400 dark:text-pink-500 shrink-0">{fields.time}</span>
              )}
              <span className="text-[10px] font-mono truncate text-gray-600 dark:text-gray-400">
                {fields.contentPreview || <span className="italic text-gray-400 dark:text-gray-700">no content</span>}
              </span>
              {isFlagged && <span className="text-[8px] shrink-0">🚩</span>}
            </div>
            {fields.price && (
              <div className="flex items-center gap-1 mt-0.5">
                <DollarSign className="h-2.5 w-2.5 text-pink-400" />
                <span className="text-[9px] font-mono text-pink-400">{fields.price}</span>
                {fields.tag && (
                  <span className="text-[8px] font-mono px-1 rounded bg-pink-50 text-pink-400 dark:bg-pink-900/20 dark:text-pink-400">{fields.tag}</span>
                )}
              </div>
            )}
            {(fields.captionBankText || fields.caption) && (
              <div className="text-[8px] font-mono truncate text-gray-500 dark:text-gray-600 mt-0.5">
                {fields.captionBankText || fields.caption}
              </div>
            )}
          </div>
          {task.status === 'DONE' && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
        </div>
        <SchedulerTaskModal task={task} open={showModal} onClose={() => setShowModal(false)} onUpdate={onUpdate} onDelete={onDelete} />
      </>
    );
  }

  // ── Expanded: full inline editable ──
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border p-2.5 bg-white dark:bg-[#0c0c1a] ${
        isFlagged
          ? 'border-amber-400/30 dark:border-amber-500/20'
          : 'border-gray-200 dark:border-[#111124]'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: TYPE_COLOR }}
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
        <div className="text-xs truncate px-1 font-mono text-gray-700 dark:text-gray-300">{task.taskName}</div>
      )}

      <div className="flex flex-col gap-0.5">
        {FIELD_DEFS.filter((def) => def.key !== 'caption').map((def) => (
          <FieldRow key={def.key} label={def.label} value={fields[def.key] || ''} placeholder={def.placeholder} onSave={(v) => save(def.key, v)} />
        ))}
        <CaptionPreview fields={fields} typeColor={TYPE_COLOR} />
        <FlyerPreview fields={fields} />
      </div>

      <TimeDisplay task={task} />
      {task.updatedBy && <div className="text-[8px] px-1 truncate font-mono text-gray-400 dark:text-gray-700">updated by {task.updatedBy}</div>}
    </div>
  );
}
