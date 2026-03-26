export interface TaskLimits {
  defaults: Record<string, number>;
  overrides: Record<string, Record<string, number>>;
  /** Per-platform default limits: platform -> taskType -> max */
  platformDefaults?: Record<string, Record<string, number>>;
}

export const DEFAULT_MAX = 5;

/**
 * Get the max task count for a given day + type.
 * Priority: day overrides → platform defaults → global defaults → DEFAULT_MAX.
 */
export function getTaskLimit(
  taskLimits: TaskLimits | null | undefined,
  dayIndex: number,
  taskType: string,
  platform?: string,
): number {
  if (!taskLimits) return DEFAULT_MAX;
  const dayOverrides = taskLimits.overrides?.[String(dayIndex)];
  if (dayOverrides && taskType in dayOverrides) return dayOverrides[taskType];
  if (platform && taskLimits.platformDefaults?.[platform] && taskType in taskLimits.platformDefaults[platform]) {
    return taskLimits.platformDefaults[platform][taskType];
  }
  if (taskLimits.defaults && taskType in taskLimits.defaults) return taskLimits.defaults[taskType];
  return DEFAULT_MAX;
}

/** Remove overrides that match defaults, and empty override/platform objects. */
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

  // Clean platformDefaults
  if (taskLimits.platformDefaults) {
    const cleanedPlatform: Record<string, Record<string, number>> = {};
    for (const [platform, typeLimits] of Object.entries(taskLimits.platformDefaults)) {
      const filtered: Record<string, number> = {};
      for (const [type, value] of Object.entries(typeLimits)) {
        if (value > 0) filtered[type] = value;
      }
      if (Object.keys(filtered).length > 0) {
        cleanedPlatform[platform] = filtered;
      }
    }
    if (Object.keys(cleanedPlatform).length > 0) {
      cleaned.platformDefaults = cleanedPlatform;
    }
  }

  return cleaned;
}
