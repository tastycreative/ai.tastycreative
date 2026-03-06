'use client';

import { segmentMentionContent } from '@/lib/mention-utils';

interface CommentContentProps {
  content: string;
}

export function CommentContent({ content }: CommentContentProps) {
  const segments = segmentMentionContent(content);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'mention' ? (
          <span
            key={i}
            className="inline-block bg-brand-light-pink/10 text-brand-light-pink rounded px-1 font-medium"
          >
            @{seg.value}
          </span>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </>
  );
}
