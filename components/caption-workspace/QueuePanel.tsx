'use client';

import { useRef, memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Search, X, GripVertical, Loader2, AlertCircle, CheckCircle, XCircle, Lock, Unlock } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { QueueTicket, UrgencyLevel } from './types';
import { useReorderQueueItems } from '@/lib/hooks/useCaptionQueue.query';

interface QueuePanelProps {
  queue: QueueTicket[];
  selectedTicket: number;
  onSelectTicket: (index: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onReorder?: (startIndex: number, endIndex: number) => void;
  /** Present only for CREATOR-role users — enables the Available/My split */
  currentClerkId?: string;
  isCreator?: boolean;
  onClaimTicket?: (ticketId: string) => void;
  isClaimingId?: string | null;
}

const urgencyConfig: Record<UrgencyLevel, { bg: string; textColor: string; borderColor: string; label: string }> = {
  urgent: {
    bg: 'bg-red-500/15',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    label: 'URGENT'
  },
  high: {
    bg: 'bg-orange-500/15',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    label: 'HIGH'
  },
  medium: {
    bg: 'bg-yellow-500/15',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    label: 'MEDIUM'
  },
  low: {
    bg: 'bg-green-500/15',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    label: 'NORMAL'
  }
};

// Lazy-loaded image component with intersection observer
const LazyImage = memo(function LazyImage({ 
  src, 
  alt, 
  fallback 
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
        <img 
          src={src} 
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-brand-mid-pink/10 animate-pulse" />
      )}
    </div>
  );
});

// Memoized queue item component
const QueueItem = memo(function QueueItem({
  ticket,
  isSelected,
  onSelect,
  isDragging,
  dragHandleProps,
  onClaim,
  isClaiming,
  showClaimedBy,
}: {
  ticket: QueueTicket;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  isDragging?: boolean;
  dragHandleProps?: any;
  /** When defined, shows a Claim button (available-pool tickets only) */
  onClaim?: () => void;
  isClaiming?: boolean;
  /** Show a claimed-by indicator (manager/admin/owner view) */
  showClaimedBy?: boolean;
}) {
  const config = urgencyConfig[ticket.urgency];

  return (
    <div
      onClick={onSelect}
      className={`p-3 border-b border-brand-mid-pink/10 cursor-pointer transition-all ${
        isSelected 
          ? 'bg-brand-off-white dark:bg-gray-900/50 border-l-4 border-l-brand-mid-pink' 
          : 'border-l-4 border-l-transparent hover:bg-brand-off-white/50 dark:hover:bg-gray-900/30'
      } ${isDragging ? 'shadow-lg ring-2 ring-brand-mid-pink/50 bg-white dark:bg-gray-800' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            className="shrink-0 p-1 -ml-1 hover:bg-brand-mid-pink/10 rounded cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} className="text-gray-400" />
          </div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate" title={ticket.id}>{ticket.id}</span>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {ticket.status === 'partially_approved' && (
            <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded text-[10px] font-bold flex items-center gap-0.5">
              PARTIAL
            </span>
          )}
          {(ticket.status === 'in_revision' || ticket.qaRejectionReason) && ticket.status !== 'partially_approved' && (
            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded text-[10px] font-bold flex items-center gap-0.5">
              <AlertCircle size={9} />
              REVISION
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
          src={ticket.model.imageUrl} 
          alt={ticket.model.name}
          fallback={ticket.model.avatar}
        />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{ticket.model.name}</span>
      </div>

      {/* Description */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2">
        {ticket.description}
      </div>

      {/* QA rejection reason */}
      {ticket.qaRejectionReason && (
        <div className="mb-1.5 px-2 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg flex items-start gap-1.5">
          <AlertCircle size={10} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-2 leading-relaxed">
            <span className="font-semibold">QA feedback: </span>
            {ticket.qaRejectionReason}
          </p>
        </div>
      )}

      {/* Per-item status summary */}
      {ticket.contentItems.length > 1 && (() => {
        const approved = ticket.contentItems.filter(ci => ci.captionStatus === 'approved').length;
        const rejected = ticket.contentItems.filter(ci => ci.captionStatus === 'rejected').length;
        const notRequired = ticket.contentItems.filter(ci => ci.captionStatus === 'not_required').length;
        const total = ticket.contentItems.length;
        if (approved === 0 && rejected === 0 && notRequired === 0) return null;
        return (
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px]">
            {approved > 0 && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 font-medium">
                <CheckCircle size={9} />
                {approved}/{total - notRequired}
              </span>
            )}
            {rejected > 0 && (
              <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400 font-medium">
                <XCircle size={9} />
                {rejected} rejected
              </span>
            )}
            {notRequired > 0 && (
              <span className="text-gray-400 dark:text-gray-500 font-medium">
                {notRequired} skipped
              </span>
            )}
          </div>
        );
      })()}

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {[...new Set(ticket.contentTypes)].map((type, idx) => (
          <span key={`ct-${type}-${idx}`} className="px-1.5 py-0.5 bg-brand-off-white dark:bg-gray-800 rounded text-[10px] font-medium text-gray-700 dark:text-gray-300 border border-brand-mid-pink/10 whitespace-nowrap">
            {type}
          </span>
        ))}
        {[...new Set(Array.isArray(ticket.messageType) ? ticket.messageType : [ticket.messageType])].map((type, idx) => (
          <span key={`mt-${type}-${idx}`} className="px-1.5 py-0.5 bg-brand-blue/10 rounded text-[10px] font-medium text-brand-blue border border-brand-blue/20 whitespace-nowrap">
            {type}
          </span>
        ))}
      </div>

      {/* Release date */}
      <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
        <Calendar size={10} />
        {new Date(ticket.releaseDate).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}
      </div>

      {/* Claimed-by indicator — manager / admin / owner view only */}
      {showClaimedBy && ticket.claimedBy && (() => {
        const CLAIM_TTL_MS = 30 * 60 * 1000;
        const isActive = ticket.claimedAt
          ? Date.now() - new Date(ticket.claimedAt).getTime() < CLAIM_TTL_MS
          : false;
        if (!isActive) return null;
        const u = ticket.claimedByUser;
        const name = u?.firstName
          ? `${u.firstName}${u.lastName ? ` ${u.lastName[0]}.` : ''}`
          : 'a creator';
        return (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-brand-blue/10 border border-brand-blue/20 rounded-md">
            {u?.imageUrl ? (
              <img src={u.imageUrl} alt={name} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full bg-brand-blue/30 flex items-center justify-center shrink-0">
                <span className="text-[7px] font-bold text-brand-blue leading-none">
                  {u?.firstName?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <Lock size={8} className="text-brand-blue shrink-0" />
            <span className="text-[10px] text-brand-blue font-medium truncate">In use by {name}</span>
          </div>
        );
      })()}

      {/* Claim button — only shown for available-pool tickets */}
      {onClaim && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-brand-blue flex items-center gap-1">
            <Unlock size={9} />
            Available
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onClaim(); }}
            disabled={isClaiming}
            className="px-2.5 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 active:bg-brand-blue/40 text-brand-blue border border-brand-blue/30 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isClaiming ? <Loader2 size={10} className="animate-spin" /> : <Lock size={10} />}
            {isClaiming ? 'Claiming…' : 'Claim'}
          </button>
        </div>
      )}
    </div>
  );
});

function QueuePanel({ queue, selectedTicket, onSelectTicket, searchQuery, onSearchChange, onReorder, currentClerkId, isCreator, onClaimTicket, isClaimingId }: QueuePanelProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const reorderMutation = useReorderQueueItems();

  const handleClearSearch = () => {
    onSearchChange('');
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    
    if (!result.destination) return;

    // When in creator split-view, the DragDropContext only covers myItems.
    // Map draggable indices (within myItems) back to real queue indices.
    const myItemsForDrag = (isCreator && currentClerkId)
      ? queue.map((t, i) => ({ ticket: t, queueIndex: i })).filter(
          ({ ticket: t }) => t.claimedBy === currentClerkId || t.isAssignedToMe
        )
      : queue.map((t, i) => ({ ticket: t, queueIndex: i }));

    const startMyIdx = result.source.index;
    const endMyIdx = result.destination.index;

    if (startMyIdx === endMyIdx) return;

    const startIndex = myItemsForDrag[startMyIdx]?.queueIndex ?? startMyIdx;
    const endIndex = myItemsForDrag[endMyIdx]?.queueIndex ?? endMyIdx;

    if (onReorder) {
      onReorder(startIndex, endIndex);
    }

    // Reorder myItems according to drag result
    const reorderedMy = Array.from(myItemsForDrag);
    const [removed] = reorderedMy.splice(startMyIdx, 1);
    reorderedMy.splice(endMyIdx, 0, removed);

    // Available items keep their relative order, placed after my items
    const availableItems = (isCreator && currentClerkId)
      ? queue.filter((t) => t.claimedBy !== currentClerkId && !t.isAssignedToMe)
      : [];

    const combined = [
      ...reorderedMy.map((m) => m.ticket),
      ...availableItems,
    ];

    const newOrder = combined.map((item, idx) => ({
      id: item.id,
      sortOrder: idx,
    }));

    reorderMutation.mutate(newOrder, {
      onSuccess: () => { toast.success('Queue reordered'); },
      onError: () => { toast.error('Failed to reorder queue'); },
    });

    // Update selected ticket if needed (based on original queue indices)
    if (startIndex === selectedTicket) {
      onSelectTicket(endIndex);
    } else if (startIndex < selectedTicket && endIndex >= selectedTicket) {
      onSelectTicket(selectedTicket - 1);
    } else if (startIndex > selectedTicket && endIndex <= selectedTicket) {
      onSelectTicket(selectedTicket + 1);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-brand-mid-pink/20 bg-white dark:bg-gray-900/80">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-brand-mid-pink/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {isCreator ? 'Caption Queue' : 'My Queue'}
          </span>
          <div className="flex items-center gap-2">
            {reorderMutation.isPending && (
              <Loader2 size={12} className="animate-spin text-brand-mid-pink" />
            )}
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {queue.length} items
            </span>
          </div>
        </div>
        
        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search model or description..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-brand-off-white dark:bg-gray-800 border border-brand-mid-pink/20 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
          {searchQuery && (
            <button 
              onClick={handleClearSearch}
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
      {(() => {
        // ── Creator split-view ───────────────────────────────────────────────
        if (isCreator && currentClerkId && !searchQuery) {
          const myItems = queue
            .map((t, i) => ({ ticket: t, queueIndex: i }))
            .filter(({ ticket: t }) => t.claimedBy === currentClerkId || t.isAssignedToMe);

          const availableItems = queue
            .map((t, i) => ({ ticket: t, queueIndex: i }))
            .filter(({ ticket: t }) => t.claimedBy !== currentClerkId && !t.isAssignedToMe);

          return (
            <div className="flex-1 overflow-auto custom-scrollbar">
              {/* ── My Tickets ── */}
              <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  My Tickets
                </span>
                <span className="text-[9px] text-gray-500">{myItems.length}</span>
              </div>

              <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <Droppable droppableId="my-queue">
                  {(provided, snapshot) => (
                    <div
                      ref={(el) => {
                        provided.innerRef(el);
                        (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                      }}
                      {...provided.droppableProps}
                      className={snapshot.isDraggingOver ? 'bg-brand-mid-pink/5' : ''}
                    >
                      {myItems.length === 0 ? (
                        <div className="px-4 py-4 text-center">
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            No tickets assigned or claimed yet
                          </p>
                        </div>
                      ) : (
                        myItems.map(({ ticket, queueIndex }, myIdx) => (
                          <Draggable
                            key={ticket.id}
                            draggableId={ticket.id}
                            index={myIdx}
                            isDragDisabled={false}
                          >
                            {(provided, snapshot) => {
                              const style = provided.draggableProps.style;
                              const parentRect = parentRef.current?.getBoundingClientRect();
                              const draggingStyle = snapshot.isDragging
                                ? { ...style, position: 'fixed' as const, width: parentRect?.width || 300, left: parentRect?.left || 0, zIndex: 9999 }
                                : style;
                              const dragContent = (
                                <div ref={provided.innerRef} {...provided.draggableProps} style={draggingStyle}>
                                  <QueueItem
                                    ticket={ticket}
                                    index={queueIndex}
                                    isSelected={selectedTicket === queueIndex}
                                    onSelect={() => onSelectTicket(queueIndex)}
                                    isDragging={snapshot.isDragging}
                                    dragHandleProps={provided.dragHandleProps ?? undefined}
                                  />
                                </div>
                              );
                              if (snapshot.isDragging && typeof document !== 'undefined') {
                                return createPortal(dragContent, document.body);
                              }
                              return dragContent;
                            }}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* ── Available Pool ── */}
              {availableItems.length > 0 && (
                <>
                  <div className="px-3 pt-4 pb-1 flex items-center justify-between border-t border-brand-mid-pink/10 mt-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-brand-blue flex items-center gap-1">
                      <Unlock size={9} />
                      Available
                    </span>
                    <span className="text-[9px] text-brand-blue/70">{availableItems.length}</span>
                  </div>
                  {availableItems.map(({ ticket, queueIndex }) => (
                    <QueueItem
                      key={ticket.id}
                      ticket={ticket}
                      index={queueIndex}
                      isSelected={selectedTicket === queueIndex}
                      onSelect={() => onSelectTicket(queueIndex)}
                      onClaim={onClaimTicket ? () => onClaimTicket(ticket.id) : undefined}
                      isClaiming={isClaimingId === ticket.id}
                    />
                  ))}
                </>
              )}

              {queue.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-brand-mid-pink/10 flex items-center justify-center mb-3">
                    <Search size={20} className="text-brand-mid-pink" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No items in queue</p>
                </div>
              )}
            </div>
          );
        }

        // ── Default (manager / search active) flat list ──────────────────────
        return (
          <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <Droppable droppableId="queue-list">
              {(provided, snapshot) => (
                <div 
                  ref={(el) => {
                    provided.innerRef(el);
                    (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                  }}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-auto custom-scrollbar ${snapshot.isDraggingOver ? 'bg-brand-mid-pink/5' : ''}`}
                >
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
                          onClick={handleClearSearch}
                          className="mt-2 text-xs text-brand-mid-pink hover:underline"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {queue.map((ticket, index) => (
                        <Draggable
                          key={ticket.id}
                          draggableId={ticket.id}
                          index={index}
                          isDragDisabled={!!searchQuery}
                        >
                          {(provided, snapshot) => {
                            const style = provided.draggableProps.style;
                            const parentRect = parentRef.current?.getBoundingClientRect();
                            const draggingStyle = snapshot.isDragging
                              ? {
                                  ...style,
                                  position: 'fixed' as const,
                                  width: parentRect?.width || 300,
                                  left: parentRect?.left || 0,
                                  zIndex: 9999,
                                }
                              : style;

                            const dragContent = (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={draggingStyle}
                              >
                                <QueueItem
                                  ticket={ticket}
                                  index={index}
                                  isSelected={selectedTicket === index}
                                  onSelect={() => onSelectTicket(index)}
                                  isDragging={snapshot.isDragging}
                                  dragHandleProps={provided.dragHandleProps ?? undefined}
                                  showClaimedBy={!isCreator}
                                />
                              </div>
                            );

                            if (snapshot.isDragging && typeof document !== 'undefined') {
                              return createPortal(dragContent, document.body);
                            }

                            return dragContent;
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        );
      })()}
    </div>
  );
}

export default memo(QueuePanel);
