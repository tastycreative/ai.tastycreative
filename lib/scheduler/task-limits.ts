export interface TaskLimits {
  defaults: Record<string, number>;
  overrides: Record<string, Record<string, number>>;
}

export const DEFAULT_MAX = 5;

/** Get the max task count for a given day + type. Falls back to DEFAULT_MAX (5). */
export function getTaskLimit(
  taskLimits: TaskLimits | null | undefined,
  dayIndex: number,
  taskType: string,
): number {
  if (!taskLimits) return DEFAULT_MAX;
  const dayOverrides = taskLimits.overrides?.[String(dayIndex)];
  if (dayOverrides && taskType in dayOverrides) return dayOverrides[taskType];
  if (taskLimits.defaults && taskType in taskLimits.defaults) return taskLimits.defaults[taskType];
  return DEFAULT_MAX;
}

/** Remove overrides that match defaults, and empty override objects. */
export function cleanTaskLimits(taskLimits: TaskLimits): TaskLimits {
  const cleaned: TaskLimits = {
    defaults: { ...taskLimits.defaults },
    overrides: {},
  };

  for (const [dayIndex, dayOverrides] of Object.entries(taskLimits.overrides ?? {})) {
    const filteredOverrides: Record<string, number> = {};
    for (const [type, value] of Object.entries(dayOverrides)) {
      if (cleaned.defaults[type] !== value) {
        filteredOverrides[type] = value;
      }
    }
    if (Object.keys(filteredOverrides).length > 0) {
      cleaned.overrides[dayIndex] = filteredOverrides;
    }
  }

  return cleaned;
}
