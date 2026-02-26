'use client';

import { useRef, useCallback, memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Search, X, GripVertical, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
}: {
  ticket: QueueTicket;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
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
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            className="p-1 -ml-1 hover:bg-brand-mid-pink/10 rounded cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} className="text-gray-400" />
          </div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{ticket.id}</span>
        </div>
        <span className={`px-2 py-0.5 ${config.bg} ${config.textColor} rounded text-[10px] font-bold`}>
          {config.label}
        </span>
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

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        <span className="px-2 py-0.5 bg-brand-off-white dark:bg-gray-800 rounded text-[10px] font-medium text-gray-700 dark:text-gray-300 border border-brand-mid-pink/10">
          {ticket.contentTypes.join(', ')}
        </span>
        <span className="px-2 py-0.5 bg-brand-off-white dark:bg-gray-800 rounded text-[10px] font-medium text-gray-700 dark:text-gray-300 border border-brand-mid-pink/10">
          {Array.isArray(ticket.messageType) ? ticket.messageType.join(', ') : ticket.messageType}
        </span>
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
    </div>
  );
});

function QueuePanel({ queue, selectedTicket, onSelectTicket, searchQuery, onSearchChange, onReorder }: QueuePanelProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const reorderMutation = useReorderQueueItems();
  
  // Virtual list for performance with large queues (disabled when dragging)
  const virtualizer = useVirtualizer({
    count: queue.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 150, []), // Estimated height of each item
    overscan: 5,
    enabled: !isDragging, // Disable virtualization while dragging
  });

  const handleClearSearch = () => {
    onSearchChange('');
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    
    if (!result.destination) return;
    
    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    
    if (startIndex === endIndex) return;

    // Call the onReorder callback if provided
    if (onReorder) {
      onReorder(startIndex, endIndex);
    }

    // Prepare the new order for the API
    const reorderedItems = Array.from(queue);
    const [removed] = reorderedItems.splice(startIndex, 1);
    reorderedItems.splice(endIndex, 0, removed);

    // Create the payload with new sort orders
    const newOrder = reorderedItems.map((item, index) => ({
      id: item.id,
      sortOrder: index,
    }));

    // Update via mutation
    reorderMutation.mutate(newOrder, {
      onSuccess: () => {
        toast.success('Queue reordered');
      },
      onError: () => {
        toast.error('Failed to reorder queue');
      },
    });

    // Update selected ticket if needed
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
            My Queue
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

      {/* Queue list with drag and drop */}
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Droppable droppableId="queue-list">
          {(provided, snapshot) => (
            <div 
              ref={(el) => {
                provided.innerRef(el);
                if (parentRef.current !== el) {
                  (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
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
              ) : isDragging || searchQuery ? (
                // Non-virtualized list when dragging or searching
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
                              dragHandleProps={provided.dragHandleProps || {}}
                            />
                          </div>
                        );

                        // Use portal when dragging
                        if (snapshot.isDragging && typeof document !== 'undefined') {
                          return createPortal(dragContent, document.body);
                        }

                        return dragContent;
                      }}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </>
              ) : (
                // Virtualized list when not dragging
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => (
                    <Draggable 
                      key={queue[virtualRow.index].id} 
                      draggableId={queue[virtualRow.index].id} 
                      index={virtualRow.index}
                    >
                      {(provided, snapshot) => {
                        const style = provided.draggableProps.style;
                        let draggingStyle: React.CSSProperties;
                        
                        if (snapshot.isDragging) {
                          // When dragging, use fixed positioning
                          const parentRect = parentRef.current?.getBoundingClientRect();
                          draggingStyle = {
                            ...style,
                            position: 'fixed',
                            width: parentRect?.width || 300,
                            left: parentRect?.left || 0,
                            zIndex: 9999,
                          };
                        } else {
                          // When not dragging, position absolutely within the virtual list
                          draggingStyle = {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                          };
                        }

                        const dragContent = (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={draggingStyle}
                          >
                            <QueueItem
                              ticket={queue[virtualRow.index]}
                              index={virtualRow.index}
                              isSelected={selectedTicket === virtualRow.index}
                              onSelect={() => onSelectTicket(virtualRow.index)}
                              isDragging={snapshot.isDragging}
                              dragHandleProps={provided.dragHandleProps || {}}
                            />
                          </div>
                        );

                        // Use portal when dragging to avoid positioning issues
                        if (snapshot.isDragging && typeof document !== 'undefined') {
                          return createPortal(dragContent, document.body);
                        }

                        return dragContent;
                      }}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

export default memo(QueuePanel);
