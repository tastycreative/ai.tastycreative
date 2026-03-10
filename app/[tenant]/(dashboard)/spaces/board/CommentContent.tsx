'use client';

import { segmentMentionContent } from '@/lib/mention-utils';

interface CommentContentProps {
  content: string;
}

const URL_REGEX = /(https?:\/\/[^\s<>]+)/g;

/** Render a plain text string, turning URLs into clickable links. */
function TextWithLinks({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-blue hover:underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
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
          <TextWithLinks key={i} text={seg.value} />
        )
      )}
    </>
  );
}
