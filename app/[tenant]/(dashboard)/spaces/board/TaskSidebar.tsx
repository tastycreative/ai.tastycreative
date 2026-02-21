'use client';

import {
  User,
  Flag,
  CalendarDays,
  CalendarClock,
  UserCircle,
  Tag,
  ListTodo,
} from 'lucide-react';
import type { BoardTask } from './BoardTaskCard';
import { EditableField } from './EditableField';
import { SelectField } from './SelectField';

interface TaskSidebarProps {
  task: BoardTask;
  columnTitle: string;
  onUpdate: (updated: BoardTask) => void;
}

const PRIORITY_OPTIONS: BoardTask['priority'][] = ['Low', 'Medium', 'High'];

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-emerald-500',
};

function SidebarLabel({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="h-3.5 w-3.5 text-gray-400" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  );
}

export function TaskSidebar({ task, columnTitle, onUpdate }: TaskSidebarProps) {
  return (
    <div className="space-y-5">
      {/* Status */}
      <div>
        <SidebarLabel icon={ListTodo} label="Status" />
        <span className="inline-flex items-center rounded-lg bg-brand-blue/10 text-brand-blue px-2.5 py-1 text-xs font-medium">
          {columnTitle}
        </span>
      </div>

      {/* Assignee */}
      <div>
        <SidebarLabel icon={User} label="Assignee" />
        <EditableField
          value={task.assignee ?? ''}
          placeholder="Unassigned"
          onSave={(v) => onUpdate({ ...task, assignee: v || undefined })}
        />
      </div>

      {/* Reporter */}
      <div>
        <SidebarLabel icon={UserCircle} label="Reporter" />
        <EditableField
          value={task.reporter ?? ''}
          placeholder="None"
          onSave={(v) => onUpdate({ ...task, reporter: v || undefined })}
        />
      </div>

      {/* Priority */}
      <div>
        <SidebarLabel icon={Flag} label="Priority" />
        <SelectField
          value={task.priority ?? ''}
          options={PRIORITY_OPTIONS.filter(Boolean) as string[]}
          onSave={(v) => onUpdate({ ...task, priority: v as BoardTask['priority'] })}
          renderOption={(v) => (
            <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-brand-off-white">
              <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[v] ?? 'bg-gray-400'}`} />
              {v || <span className="text-gray-400 italic">None</span>}
            </span>
          )}
        />
      </div>

      {/* Start date */}
      <div>
        <SidebarLabel icon={CalendarClock} label="Start date" />
        <EditableField
          value={task.startDate ?? ''}
          type="date"
          placeholder="Not set"
          onSave={(v) => onUpdate({ ...task, startDate: v || undefined })}
        />
      </div>

      {/* Due date */}
      <div>
        <SidebarLabel icon={CalendarDays} label="Due date" />
        <EditableField
          value={task.dueDate ?? ''}
          type="date"
          placeholder="Not set"
          onSave={(v) => onUpdate({ ...task, dueDate: v || undefined })}
        />
      </div>

      {/* Tags */}
      <div>
        <SidebarLabel icon={Tag} label="Tags" />
        {task.tags && task.tags.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-brand-light-pink/10 text-brand-light-pink px-2 py-0.5 text-[10px] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">No tags</span>
        )}
      </div>
    </div>
  );
}
