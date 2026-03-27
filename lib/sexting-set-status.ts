/**
 * Sexting Set Workflow Status Constants
 *
 * These statuses are stored in BoardItem.metadata.sextingSetStatus
 * and control the lifecycle of a Sexting Set from push through
 * caption writing and QA review.
 *
 * Flow:
 *   PENDING_CAPTION → IN_CAPTION → FOR_QA → QA_APPROVED → (Mark as Final) → COMPLETED
 *                                          → REVISION_REQUIRED → IN_CAPTION → …
 */

export const SEXTING_SET_STATUS = {
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
  /** QA approved all items — awaiting final review */
  QA_APPROVED: 'QA_APPROVED',
  /** Fully finalized — saved to gallery & caption bank */
  COMPLETED: 'COMPLETED',
} as const;

export type SextingSetStatus = (typeof SEXTING_SET_STATUS)[keyof typeof SEXTING_SET_STATUS];

export const SEXTING_SET_STATUS_VALUES = Object.values(SEXTING_SET_STATUS) as SextingSetStatus[];

export const SEXTING_SET_STATUS_CONFIG: Record<
  SextingSetStatus,
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  [SEXTING_SET_STATUS.PENDING_CAPTION]: {
    label: 'Pending Caption',
    color: 'gray',
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-400',
  },
  [SEXTING_SET_STATUS.IN_CAPTION]: {
    label: 'In Caption',
    color: 'amber',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
  },
  [SEXTING_SET_STATUS.FOR_QA]: {
    label: 'For QA',
    color: 'blue',
    bgClass: 'bg-brand-blue/10',
    textClass: 'text-brand-blue',
  },
  [SEXTING_SET_STATUS.REVISION_REQUIRED]: {
    label: 'Revision Required',
    color: 'red',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
  },
  [SEXTING_SET_STATUS.PARTIALLY_APPROVED]: {
    label: 'Partially Approved',
    color: 'orange',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
  },
  [SEXTING_SET_STATUS.IN_REVISION]: {
    label: 'In Revision',
    color: 'orange',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
  },
  [SEXTING_SET_STATUS.QA_APPROVED]: {
    label: 'QA Approved',
    color: 'cyan',
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-400',
  },
  [SEXTING_SET_STATUS.COMPLETED]: {
    label: 'Completed',
    color: 'green',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
  },
};

/**
 * Map a caption-queue ticket status string to a SextingSetStatus value.
 * Mirrors `captionStatusToWallPostStatus` for the sexting-sets workflow.
 */
export function captionStatusToSextingSetStatus(
  captionStatus: string,
): SextingSetStatus | null {
  switch (captionStatus) {
    case 'pending':
    case 'draft':
    case 'in_caption':
    case 'in_progress':
      return SEXTING_SET_STATUS.IN_CAPTION;
    case 'pending_qa':
    case 'caption_completed':
      return SEXTING_SET_STATUS.FOR_QA;
    case 'partially_approved':
      return SEXTING_SET_STATUS.PARTIALLY_APPROVED;
    case 'in_revision':
      return SEXTING_SET_STATUS.IN_REVISION;
    case 'completed':
      return SEXTING_SET_STATUS.QA_APPROVED;
    default:
      return null;
  }
}

/**
 * Derive the high-level set status from caption ticket status.
 */
export function deriveSextingSetStatus(
  ticketStatus: string | null | undefined,
): SextingSetStatus | null {
  if (!ticketStatus) return null;
  switch (ticketStatus) {
    case 'pending':
    case 'draft':
      return SEXTING_SET_STATUS.IN_CAPTION;
    case 'in_progress':
      return SEXTING_SET_STATUS.IN_CAPTION;
    case 'pending_qa':
      return SEXTING_SET_STATUS.FOR_QA;
    case 'partially_approved':
      return SEXTING_SET_STATUS.PARTIALLY_APPROVED;
    case 'in_revision':
      return SEXTING_SET_STATUS.IN_REVISION;
    case 'completed':
      return SEXTING_SET_STATUS.QA_APPROVED;
    default:
      return null;
  }
}
