'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { useSchedulerPresenceContext } from './SchedulerPresenceContext';

export function SchedulerPresenceBar() {
  const { members } = useSchedulerPresenceContext();

  if (members.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Users className="h-3 w-3 text-gray-400 dark:text-[#3a3a5a]" />
      <div className="flex -space-x-1">
        {members.slice(0, 5).map((m) => {
          const label = m.name || m.clientId;
          return m.imageUrl ? (
            <img
              key={m.clientId}
              src={m.imageUrl}
              alt={label}
              title={label}
              className="h-5 w-5 rounded-full object-cover border-2 border-white dark:border-[#07070e]"
            />
          ) : (
            <div
              key={m.clientId}
              className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold font-sans bg-brand-dark-pink/10 text-brand-dark-pink border-2 border-white dark:bg-[#ff9a6c20] dark:text-[#ff9a6c] dark:border-[#07070e]"
              title={label}
            >
              {(m.name || '?')[0].toUpperCase()}
            </div>
          );
        })}
        {members.length > 5 && (
          <div className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold font-mono bg-gray-100 text-gray-400 border-2 border-white dark:bg-[#111124] dark:text-[#3a3a5a] dark:border-[#07070e]">
            +{members.length - 5}
          </div>
        )}
      </div>
      <span className="text-[9px] font-mono text-gray-400 dark:text-[#3a3a5a]">
        {members.length}
      </span>
    </div>
  );
}
