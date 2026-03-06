'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import type { SpaceMember } from '@/lib/hooks/useSpaceMembers.query';

export interface MentionDropdownHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean; // returns true if handled
}

interface MentionDropdownProps {
  members: SpaceMember[];
  query: string;
  position: { top: number; left: number };
  onSelect: (member: SpaceMember) => void;
  onClose: () => void;
  excludeClerkIds?: string[];
}

function getDisplayName(member: SpaceMember): string {
  const u = member.user;
  return u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
}

function getInitials(member: SpaceMember): string {
  const name = getDisplayName(member);
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

const MAX_RESULTS = 8;

export const MentionDropdown = forwardRef<MentionDropdownHandle, MentionDropdownProps>(
  function MentionDropdown({ members, query, position, onSelect, onClose, excludeClerkIds = [] }, ref) {
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const excludeSet = new Set(excludeClerkIds);
    const filtered = members
      .filter((m) => {
        if (excludeSet.has(m.user.clerkId)) return false;
        const q = query.toLowerCase();
        const name = getDisplayName(m).toLowerCase();
        const email = m.user.email.toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, MAX_RESULTS);

    // Reset active index when filtered list changes
    useEffect(() => {
      setActiveIndex(0);
    }, [query]);

    // Scroll active item into view
    useEffect(() => {
      const list = listRef.current;
      if (!list) return;
      const active = list.children[activeIndex] as HTMLElement | undefined;
      active?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    useImperativeHandle(ref, () => ({
      handleKeyDown(e: React.KeyboardEvent): boolean {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % filtered.length);
          return true;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
          return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (filtered[activeIndex]) onSelect(filtered[activeIndex]);
          return true;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return true;
        }
        return false;
      },
    }));

    if (filtered.length === 0) return null;

    return (
      <div
        className="absolute z-50 w-64 max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-lg"
        style={{ top: position.top, left: position.left }}
        ref={listRef}
      >
        {filtered.map((member, i) => (
          <button
            key={member.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // keep textarea focus
              onSelect(member);
            }}
            onMouseEnter={() => setActiveIndex(i)}
            className={[
              'flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs transition-colors',
              i === activeIndex
                ? 'bg-brand-light-pink/10 text-brand-light-pink'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
            ].join(' ')}
          >
            <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue text-[10px] font-bold">
              {getInitials(member)}
            </span>
            <span className="truncate font-medium">{getDisplayName(member)}</span>
          </button>
        ))}
      </div>
    );
  }
);
