/**
 * Shared parsing utilities for @mention markup.
 * Mention format: @[Display Name](clerkId)
 * Works on both client and server.
 */

export const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

export interface ParsedMention {
  displayName: string;
  clerkId: string;
}

/** Extract all mentions from content string. */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_REGEX.source, 'g');
  while ((match = re.exec(content)) !== null) {
    mentions.push({ displayName: match[1], clerkId: match[2] });
  }
  return mentions;
}

/** Extract unique clerk IDs from mentions. */
export function extractMentionedClerkIds(content: string): string[] {
  const ids = new Set<string>();
  for (const m of parseMentions(content)) {
    ids.add(m.clerkId);
  }
  return [...ids];
}

export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; clerkId: string };

/** Split content into text and mention segments for rendering. */
export function segmentMentionContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const re = new RegExp(MENTION_REGEX.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'mention', value: match[1], clerkId: match[2] });
    lastIndex = re.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return segments;
}

/** Strip mention markup to plain text: @[John](id) → @John */
export function stripMentionMarkup(content: string): string {
  return content.replace(new RegExp(MENTION_REGEX.source, 'g'), '@$1');
}
