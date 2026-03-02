export interface ContentItemData {
  id: string;
  url: string;
  sourceType: 'upload' | 'gdrive';
  fileName?: string | null;
  fileType?: 'image' | 'video' | null;
  sortOrder: number;
  captionText?: string | null;
  // Per-item QA fields
  requiresCaption: boolean;
  captionStatus: string;
  qaRejectionReason?: string | null;
  qaRejectedAt?: string | null;
  qaRejectedBy?: string | null;
  qaApprovedAt?: string | null;
  qaApprovedBy?: string | null;
  revisionCount: number;
}

export interface QueueTicket {
  id: string;
  status: string;
  model: {
    name: string;
    avatar: string;
    imageUrl?: string | null;
  };
  contentTypes: string[];
  messageType: string[];
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  releaseDate: string;
  description: string;
  driveLink: string;
  videoUrl: string | null;
  contentUrl?: string | null;
  contentSourceType?: 'upload' | 'gdrive' | null;
  /** Multi-content items (each has its own caption) */
  contentItems: ContentItemData[];
  /** Reason left by QA when the ticket was rejected and returned; null if never rejected */
  qaRejectionReason?: string | null;
}

export interface ModelContext {
  name: string;
  avatar: string;
  imageUrl?: string | null;
  pageStrategy: string;
  personality: string;
  background: string;
  lingo: string[];
  emojis: string[];
  restrictions: string[];
  wordingToAvoid: string[];
}

// Helper function to format page strategy
export function formatPageStrategy(strategy: string): string {
  return strategy
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export interface TopCaption {
  id: number;
  caption: string;
  contentType: string;
  revenue: number;
  sales: number;
  model: string;
}

export type UrgencyLevel = 'urgent' | 'high' | 'medium' | 'low';

export interface UrgencyConfig {
  bg: string;
  textColor: string;
  borderColor: string;
  label: string;
}
