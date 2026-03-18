'use client';

import { memo } from 'react';
import { Search, X, Calendar, CheckCircle2, GripVertical } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import type { GifQueueTicket } from '@/lib/hooks/useGifQueue.query';
import { urgencyConfig, safeUrgency } from './queue-constants';

interface GifQueuePanelProps {
  queue: GifQueueTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// Lazy-loaded image component with intersection observer
const LazyImage = memo(function LazyImage({
  src,
  alt,
  fallback,
}: {
  src: string | null | undefined;
  alt: string;
  fallback: string;
}) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: '100px',
  });

  if (!src) {
    return (
      <div className="w-6 h-6 rounded-md bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-[10px] font-semibold text-white">
        {fallback}
      </div>
    );
  }

  return (
    <div ref={ref} className="w-6 h-6 rounded-md overflow-hidden bg-brand-mid-pink/20">
      {inView ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-brand-mid-pink/10 animate-pulse" />
      )}
    </div>
  );
});

// Memoized queue item component — mirrors Caption Workspace QueueItem exactly
const QueueItem = memo(function QueueItem({
  ticket,
  isSelected,
  onSelect,
}: {
  ticket: GifQueueTicket;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = urgencyConfig[safeUrgency(ticket.urgency)];

  return (
    <div
      onClick={onSelect}
      className={`p-3 border-b border-brand-mid-pink/10 cursor-pointer transition-all ${
        isSelected
          ? 'bg-brand-off-white dark:bg-gray-900/50 border-l-4 border-l-brand-mid-pink'
          : 'border-l-4 border-l-transparent hover:bg-brand-off-white/50 dark:hover:bg-gray-900/30'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Drag handle (visual only — no drag in GIF workspace) */}
          <div className="shrink-0 p-1 -ml-1 hover:bg-brand-mid-pink/10 rounded">
            <GripVertical size={12} className="text-gray-400" />
          </div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate" title={ticket.id}>
            {ticket.id}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {ticket.hasGif && (
            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded text-[10px] font-bold flex items-center gap-0.5">
              <CheckCircle2 size={9} />
              GIF
            </span>
          )}
          <span className={`px-2 py-0.5 ${config.bg} ${config.textColor} rounded text-[10px] font-bold`}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Model info */}
      <div className="flex items-center gap-2 mb-1.5">
        <LazyImage
          src={ticket.profileImageUrl}
          alt={ticket.modelName}
          fallback={ticket.modelAvatar}
        />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{ticket.modelName}</span>
      </div>

      {/* Description */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2">
        {ticket.description}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {[...new Set(ticket.contentTypes)].map((type, idx) => (
          <span key={`ct-${type}-${idx}`} className="px-1.5 py-0.5 bg-brand-off-white dark:bg-gray-800 rounded text-[10px] font-medium text-gray-700 dark:text-gray-300 border border-brand-mid-pink/10 whitespace-nowrap">
            {type}
          </span>
        ))}
        {[...new Set(ticket.messageTypes)].map((type, idx) => (
          <span key={`mt-${type}-${idx}`} className="px-1.5 py-0.5 bg-brand-blue/10 rounded text-[10px] font-medium text-brand-blue border border-brand-blue/20 whitespace-nowrap">
            {type}
          </span>
        ))}
      </div>

      {/* Release date — same format as Caption Workspace */}
      <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
        <Calendar size={10} />
        {new Date(ticket.releaseDate).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}
      </div>
    </div>
  );
});

export function QueuePanel({
  queue,
  selectedTicketId,
  onSelectTicket,
  searchQuery,
  onSearchChange,
}: GifQueuePanelProps) {
  return (
    <div className="flex flex-col h-full border-r border-brand-mid-pink/20 bg-white dark:bg-gray-900/80">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-brand-mid-pink/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            MY QUEUE
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {queue.length} items
          </span>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search model or description..."
            className="w-full pl-9 pr-8 py-2 bg-brand-off-white dark:bg-gray-800 border border-brand-mid-pink/20 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X size={12} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Drag hint */}
        {queue.length > 1 && !searchQuery && (
          <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <GripVertical size={10} />
            Drag to reorder
          </p>
        )}
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-mid-pink/10 flex items-center justify-center mb-3">
              <Search size={20} className="text-brand-mid-pink" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No matching items found' : 'No items in queue'}
            </p>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="mt-2 text-xs text-brand-mid-pink hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          queue.map((ticket) => (
            <QueueItem
              key={ticket.id}
              ticket={ticket}
              isSelected={ticket.id === selectedTicketId}
              onSelect={() => onSelectTicket(ticket.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
