/**
 * Wall Post Workflow Status Constants
 *
 * These statuses are stored in BoardItem.metadata.wallPostStatus
 * and control the lifecycle of a Wall Post from submission through
 * caption writing and QA review.
 *
 * Flow:
 *   PENDING_CAPTION → IN_CAPTION → FOR_QA → COMPLETED
 *                                          → REVISION_REQUIRED → IN_CAPTION → …
 */

// ─── Wall Post Status ───────────────────────────────────────────────

export const WALL_POST_STATUS = {
  /** Awaiting push to Caption Workspace */
  PENDING_CAPTION: 'PENDING_CAPTION',
  /** Caption ticket active — captioner is working on it */
  IN_CAPTION: 'IN_CAPTION',
  /** Caption submitted — awaiting QA review */
  FOR_QA: 'FOR_QA',
  /** QA rejected — returned for revision */
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  /** Some items approved, some rejected — partially done */
  PARTIALLY_APPROVED: 'PARTIALLY_APPROVED',
  /** Rejected items are being revised by the captioner */
  IN_REVISION: 'IN_REVISION',
  /** QA approved — workflow complete */
  COMPLETED: 'COMPLETED',
} as const;

export type WallPostStatus = (typeof WALL_POST_STATUS)[keyof typeof WALL_POST_STATUS];

/** All valid wall post statuses as an array */
export const WALL_POST_STATUS_VALUES = Object.values(WALL_POST_STATUS) as WallPostStatus[];

// ─── Caption Ticket Status ──────────────────────────────────────────

export const CAPTION_TICKET_STATUS = {
  /** Ticket is active — captioner is working */
  IN_CAPTION: 'in_caption',
  /** All captions submitted — pending QA */
  CAPTION_COMPLETED: 'caption_completed',
} as const;

export type CaptionTicketStatus =
  (typeof CAPTION_TICKET_STATUS)[keyof typeof CAPTION_TICKET_STATUS];

// ─── Per-Content-Item Caption Status ────────────────────────────────

export const CONTENT_ITEM_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NOT_REQUIRED: 'not_required',
} as const;

export type ContentItemStatus =
  (typeof CONTENT_ITEM_STATUS)[keyof typeof CONTENT_ITEM_STATUS];

/** Maximum number of revisions per content item before the system blocks further resubmission */
export const MAX_REVISIONS_PER_ITEM = 10;

/**
 * Derive the overall ticket status from the individual content-item statuses.
 *
 * Rules:
 *  - All approved / not_required          → 'completed'
 *  - All submitted (or approved/nr)       → 'pending_qa'
 *  - Some approved + some rejected        → 'partially_approved'
 *  - Some rejected, captioner re-working  → 'in_revision'
 *  - Otherwise (pending/in_progress)      → 'in_progress' (or 'pending' if all untouched)
 */
export function deriveTicketStatus(
  itemStatuses: string[],
): string {
  if (itemStatuses.length === 0) return 'pending';

  const counts: Record<string, number> = {};
  for (const s of itemStatuses) counts[s] = (counts[s] || 0) + 1;

  const total = itemStatuses.length;
  const approved = (counts['approved'] || 0) + (counts['not_required'] || 0);
  const submitted = counts['submitted'] || 0;
  const rejected = counts['rejected'] || 0;
  const inProgress = counts['in_progress'] || 0;
  const pending = counts['pending'] || 0;

  // All done
  if (approved === total) return 'completed';

  // All submitted (or already approved/nr) — ready for QA
  if (submitted + approved === total) return 'pending_qa';

  // Some items have been reviewed (approved or rejected) but not all yet
  // OR all reviewed but some rejected — partially approved, stay in QA
  if (rejected > 0 && inProgress === 0 && pending === 0) {
    return 'partially_approved';
  }

  // Captioner is re-working rejected items (items flipped back to pending/in_progress)
  if (rejected > 0 && (inProgress > 0 || pending > 0)) {
    return 'in_revision';
  }

  // Default: captioner working
  if (inProgress > 0 || submitted > 0) return 'in_progress';

  return 'pending';
}

// ─── Status Display Config ──────────────────────────────────────────

export const WALL_POST_STATUS_CONFIG: Record<
  WallPostStatus,
  { label: string; color: string; dotColor: string; bgColor: string }
> = {
  [WALL_POST_STATUS.PENDING_CAPTION]: {
    label: 'Pending Caption',
    color: 'text-amber-400',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  [WALL_POST_STATUS.IN_CAPTION]: {
    label: 'In Caption',
    color: 'text-brand-blue',
    dotColor: 'bg-brand-blue',
    bgColor: 'bg-brand-blue/10 border-brand-blue/20',
  },
  [WALL_POST_STATUS.FOR_QA]: {
    label: 'For QA',
    color: 'text-violet-400',
    dotColor: 'bg-violet-500',
    bgColor: 'bg-violet-500/10 border-violet-500/20',
  },
  [WALL_POST_STATUS.REVISION_REQUIRED]: {
    label: 'Revision Required',
    color: 'text-red-400',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-500/10 border-red-500/20',
  },
  [WALL_POST_STATUS.PARTIALLY_APPROVED]: {
    label: 'Partially Approved',
    color: 'text-orange-400',
    dotColor: 'bg-orange-500',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
  },
  [WALL_POST_STATUS.IN_REVISION]: {
    label: 'In Revision',
    color: 'text-amber-400',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  [WALL_POST_STATUS.COMPLETED]: {
    label: 'Completed',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
};

/**
 * Map existing caption-queue ticket status strings to WallPostStatus.
 * Used when syncing caption workspace actions back to the board item.
 */
export function captionStatusToWallPostStatus(
  captionStatus: string,
): WallPostStatus | null {
  switch (captionStatus) {
    case 'pending':
    case 'draft':
    case 'in_caption':
    case 'in_progress':
      return WALL_POST_STATUS.IN_CAPTION;
    case 'pending_qa':
    case 'caption_completed':
      return WALL_POST_STATUS.FOR_QA;
    case 'partially_approved':
      return WALL_POST_STATUS.PARTIALLY_APPROVED;
    case 'in_revision':
      return WALL_POST_STATUS.IN_REVISION;
    case 'completed':
      return WALL_POST_STATUS.COMPLETED;
    default:
      return null;
  }
}
