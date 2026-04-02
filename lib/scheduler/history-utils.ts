/**
 * Diff old vs new task values and produce history entries for createMany.
 */

const TRACKED_SCALARS = ['status', 'taskType', 'taskName', 'notes', 'sortOrder'] as const;

function stringify(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

export function diffTaskChanges(
  oldTask: Record<string, unknown>,
  newData: Record<string, unknown>,
  userId: string,
  taskId: string,
): { field: string; oldValue: string | null; newValue: string | null; action: string }[] {
  const changes: { field: string; oldValue: string | null; newValue: string | null; action: string }[] = [];

  // Compare scalar fields
  for (const key of TRACKED_SCALARS) {
    if (!(key in newData)) continue;
    const oldVal = stringify(oldTask[key]);
    const newVal = stringify(newData[key]);
    if (oldVal !== newVal) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
        action: key === 'status' ? 'STATUS_CHANGED' : 'UPDATED',
      });
    }
  }

  // Deep-diff the `fields` JSON object
  if ('fields' in newData && newData.fields !== undefined) {
    const oldFields = (oldTask.fields as Record<string, unknown>) || {};
    const newFields = (newData.fields as Record<string, unknown>) || {};

    // All keys from both old and new
    const allKeys = new Set([...Object.keys(oldFields), ...Object.keys(newFields)]);
    for (const fk of allKeys) {
      const ov = stringify(oldFields[fk]);
      const nv = stringify(newFields[fk]);
      if (ov !== nv) {
        // Map captionQAStatus transitions to specific action names
        let action = 'UPDATED';
        if (fk === 'captionQAStatus') {
          if (nv === 'sent_to_qa') action = 'caption_sent_to_qa';
          else if (nv === 'approved') action = 'caption_qa_approved';
          else if (nv === 'rejected') action = 'caption_qa_rejected';
        }
        changes.push({
          field: `fields.${fk}`,
          oldValue: ov,
          newValue: nv,
          action,
        });
      }
    }
  }

  return changes;
}
