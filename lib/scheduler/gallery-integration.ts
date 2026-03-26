/**
 * Creates gallery items from scheduler tasks.
 * Called server-side when a scheduler task transitions to DONE.
 * Stores scheduler fields as-is — no transformation or mapping.
 */
import { Prisma } from '@/lib/generated/prisma';

/** Check if a string looks like a URL */
function isUrl(str: string): boolean {
  return /^https?:\/\//.test(str);
}

/** Parse "$12.99" or "12.99" to a number, or null */
function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export interface SchedulerTaskForGallery {
  id: string;
  organizationId: string;
  taskType: string;
  taskName: string;
  platform: string;
  profileId: string | null;
  endTime: string | null;
  fields: Record<string, string> | null;
}

/**
 * Build a Prisma create payload for gallery_items from a scheduler task.
 * Stores all scheduler fields in boardMetadata so the gallery can display
 * the raw scheduler data and show it came from the scheduler.
 * Returns null if no preview image exists.
 */
export function buildGalleryItemFromTask(
  task: SchedulerTaskForGallery,
  userId: string,
): Prisma.gallery_itemsCreateInput | null {
  const fields = (task.fields || {}) as Record<string, string>;

  // Resolve preview URL — skip gallery creation if no meaningful image exists
  const previewUrl =
    fields.flyerAssetUrl ||
    (fields.contentPreview && isUrl(fields.contentPreview) ? fields.contentPreview : null);

  if (!previewUrl) return null;

  // Store ALL scheduler fields as metadata so the gallery preserves the original data
  const schedulerMetadata: Record<string, unknown> = {
    ...fields,
    taskType: task.taskType,
    taskName: task.taskName,
    platform: task.platform,
    source: 'scheduler',
  };

  return {
    previewUrl,
    contentType: fields.tag || 'OTHER',
    platform: task.platform,
    postedAt: task.endTime ? new Date(task.endTime) : new Date(),
    captionUsed: fields.caption || fields.captionBankText || null,
    pricingAmount: parsePrice(fields.price || fields.priceInfo),
    title: fields.type || task.taskName || `${task.taskType} Task`,
    tags: [task.taskType, fields.tag, fields.type].filter(Boolean),
    origin: 'scheduler',
    postOrigin: task.taskType,
    schedulerTaskId: task.id,
    createdBy: userId,
    boardMetadata: schedulerMetadata as unknown as Prisma.InputJsonValue,
    ...(task.profileId && {
      profile: { connect: { id: task.profileId } },
    }),
    ...(task.organizationId && {
      organization: { connect: { id: task.organizationId } },
    }),
  };
}
