'use client';

import { memo } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { QueueTicket } from './types';

interface ContentViewerProps {
  ticket: QueueTicket;
}

function ContentViewerComponent({ ticket }: ContentViewerProps) {
  return (
    <div className="h-full relative flex items-center justify-center bg-brand-off-white dark:bg-gray-800 border-b border-brand-mid-pink/20">
      {/* Video placeholder */}
      <div className="w-4/5 h-4/5 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex flex-col items-center justify-center gap-4 shadow-xl border border-brand-mid-pink/20">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
          <Play size={28} className="text-white" />
        </div>
        <div className="text-center px-4">
          <div className="text-sm font-medium text-white mb-1">
            {ticket.description}
          </div>
          <div className="text-xs text-gray-400">
            Click to play • 12:34 duration
          </div>
        </div>
      </div>

      {/* Drive link button */}
      <a 
        href={ticket.driveLink}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 px-3 py-2 bg-white dark:bg-gray-900 hover:bg-brand-off-white dark:hover:bg-gray-800 border border-brand-mid-pink/20 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
      >
        <ExternalLink size={12} />
        Open in Drive
      </a>
    </div>
  );
}

export default memo(ContentViewerComponent);
