export interface QueueTicket {
  id: string;
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
