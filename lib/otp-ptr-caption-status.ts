/**
 * OTP / PTR Caption Workflow Status Constants
 *
 * These statuses are stored in BoardItem.metadata.otpPtrCaptionStatus
 * and control the lifecycle of an OTP/PTR ticket from creation through
 * caption writing, PGT Team approval, and revision.
 *
 * Flow:
 *   PENDING_CAPTION → IN_CAPTION → AWAITING_APPROVAL
 *                                → APPROVED  (done)
 *                                → NEEDS_REVISION → IN_CAPTION → …
 *
 * Key difference from Wall Post:
 *   OTP/PTR uses a single ticket-level caption (not per-content-item),
 *   so approval/rejection acts on the whole caption at once.
 */

export const OTP_PTR_CAPTION_STATUS = {
  /** Ticket created; not yet pushed to Caption Workspace */
  PENDING_CAPTION: 'PENDING_CAPTION',
  /** Caption Workspace ticket is active — captioner is working */
  IN_CAPTION: 'IN_CAPTION',
  /** Captioner submitted — PGT Team is reviewing */
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  /** PGT Team approved — caption is locked */
  APPROVED: 'APPROVED',
  /** PGT Team rejected — returned for revision */
  NEEDS_REVISION: 'NEEDS_REVISION',
} as const;

export type OtpPtrCaptionStatus =
  (typeof OTP_PTR_CAPTION_STATUS)[keyof typeof OTP_PTR_CAPTION_STATUS];

/** Map CaptionQueueTicket.status → OtpPtrCaptionStatus for board item metadata sync */
export function captionStatusToOtpPtrStatus(
  captionStatus: string,
): OtpPtrCaptionStatus | null {
  switch (captionStatus) {
    case 'pending':
    case 'draft':
    case 'in_progress':
    case 'in_caption':
      return OTP_PTR_CAPTION_STATUS.IN_CAPTION;
    case 'pending_qa':
      return OTP_PTR_CAPTION_STATUS.AWAITING_APPROVAL;
    case 'in_revision':
      return OTP_PTR_CAPTION_STATUS.NEEDS_REVISION;
    case 'completed':
      return OTP_PTR_CAPTION_STATUS.APPROVED;
    default:
      return null;
  }
}

export interface OtpPtrStatusConfig {
  label: string;
  color: string;
  dotColor: string;
  bgColor: string;
}

export const OTP_PTR_STATUS_CONFIG: Record<OtpPtrCaptionStatus, OtpPtrStatusConfig> = {
  [OTP_PTR_CAPTION_STATUS.PENDING_CAPTION]: {
    label: 'Pending Caption',
    color: 'text-amber-400',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  [OTP_PTR_CAPTION_STATUS.IN_CAPTION]: {
    label: 'In Caption',
    color: 'text-brand-blue',
    dotColor: 'bg-brand-blue',
    bgColor: 'bg-brand-blue/10 border-brand-blue/20',
  },
  [OTP_PTR_CAPTION_STATUS.AWAITING_APPROVAL]: {
    label: 'Awaiting Approval',
    color: 'text-violet-400',
    dotColor: 'bg-violet-500',
    bgColor: 'bg-violet-500/10 border-violet-500/20',
  },
  [OTP_PTR_CAPTION_STATUS.APPROVED]: {
    label: 'Approved',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
  [OTP_PTR_CAPTION_STATUS.NEEDS_REVISION]: {
    label: 'Needs Revision',
    color: 'text-red-400',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-500/10 border-red-500/20',
  },
};

/**
 * Parse a Google Drive URL and extract the resource ID + type.
 * Returns null if the URL is not a recognisable Drive link.
 */
export function parseDriveLink(url: string): {
  id: string;
  type: 'folder' | 'file';
} | null {
  try {
    const u = new URL(url);

    // Folder patterns:
    //   https://drive.google.com/drive/folders/{id}
    //   https://drive.google.com/drive/u/0/folders/{id}
    const folderMatch = u.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return { id: folderMatch[1], type: 'folder' };

    // File patterns:
    //   https://drive.google.com/file/d/{id}/view
    //   https://drive.google.com/open?id={id}
    const filePathMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (filePathMatch) return { id: filePathMatch[1], type: 'file' };

    const openIdParam = u.searchParams.get('id');
    if (openIdParam && u.hostname === 'drive.google.com') {
      return { id: openIdParam, type: 'file' };
    }

    return null;
  } catch {
    return null;
  }
}
