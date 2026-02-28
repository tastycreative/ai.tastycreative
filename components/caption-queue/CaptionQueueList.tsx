'use client';

import { useState } from 'react';
import { Calendar, Trash2, AlertCircle, Loader2, Users, Pencil } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { useCaptionQueue, useDeleteQueueItem, CaptionQueueItem } from '@/lib/hooks/useCaptionQueue.query';
import { useOrgRole } from '@/lib/hooks/useOrgRole.query';
import { useOrgCreators } from '@/lib/hooks/useOrgCreators.query';
import { CaptionQueueEditModal } from './CaptionQueueEditModal';

interface CaptionQueueListProps {
  refreshTrigger?: number;
}

const urgencyConfig = {
  low: { label: 'LOW', bg: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400' },
  medium: { label: 'MED', bg: 'bg-blue-100 dark:bg-blue-950/30', textColor: 'text-blue-600 dark:text-blue-400' },
  high: { label: 'HIGH', bg: 'bg-orange-100 dark:bg-orange-950/30', textColor: 'text-orange-600 dark:text-orange-400' },
  urgent: { label: 'URGENT', bg: 'bg-red-100 dark:bg-red-950/30', textColor: 'text-red-600 dark:text-red-400' },
};

// Skeleton loader for queue items
function QueueItemSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1a1625] border border-brand-mid-pink/20 rounded-2xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-md" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

export function CaptionQueueList({ refreshTrigger }: CaptionQueueListProps) {
  const { data: items = [], isLoading, error, refetch } = useCaptionQueue();
  const deleteItemMutation = useDeleteQueueItem();
  const { canManageQueue } = useOrgRole();
  const { data: creators = [] } = useOrgCreators(canManageQueue);
  const { user } = useUser();
  const [editingItem, setEditingItem] = useState<CaptionQueueItem | null>(null);

  // Build clerkId → display name map for assigned creator badges
  const creatorMap = Object.fromEntries(creators.map((c) => [c.clerkId, c.name || c.email || c.clerkId]));

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this queue item?')) return;

    deleteItemMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Queue item deleted');
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete item');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <QueueItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
        <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Failed to load queue'}
          </p>
          <button 
            onClick={() => refetch()} 
            className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1a1625] border border-brand-mid-pink/20 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-mid-pink/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-brand-mid-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">No queue items yet</h3>
        <p className="text-sm text-header-muted">Click "Add to Queue" to create your first caption task</p>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item: CaptionQueueItem) => {
        const config = urgencyConfig[item.urgency as keyof typeof urgencyConfig] || urgencyConfig.medium;
        const isDeleting = deleteItemMutation.isPending && deleteItemMutation.variables === item.id;
        
        return (
          <div
            key={item.id}
            className={`bg-white dark:bg-[#1a1625] border border-brand-mid-pink/20 rounded-2xl p-4 hover:shadow-md transition-all ${
              isDeleting ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-header-muted">
                {item.id.slice(0, 8).toUpperCase()}
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 ${config.bg} ${config.textColor} rounded text-[9px] font-bold`}>
                  {config.label}
                </span>
                {/* Edit button — managers+ or ticket creator */}
                {(canManageQueue || item.clerkId === user?.id) && (
                  <button
                    onClick={() => setEditingItem(item)}
                    className="p-1 hover:bg-brand-mid-pink/10 dark:hover:bg-brand-mid-pink/20 rounded transition-colors"
                    aria-label="Edit queue item"
                  >
                    <Pencil size={13} className="text-brand-mid-pink" />
                  </button>
                )}
                {/* Delete button — managers+ or ticket creator */}
                {(canManageQueue || item.clerkId === user?.id) && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isDeleting}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="text-red-500 animate-spin" />
                    ) : (
                      <Trash2 size={14} className="text-red-500" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Model info */}
            <div className="flex items-center gap-2 mb-3">
              {item.profileImageUrl ? (
                <img 
                  src={item.profileImageUrl} 
                  alt={item.modelName}
                  className="w-8 h-8 rounded-md object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-md bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-[10px] font-semibold text-white">
                  {item.modelAvatar}
                </div>
              )}
              <span className="text-sm font-medium text-sidebar-foreground">{item.modelName}</span>
            </div>

            {/* Description */}
            <div className="text-xs text-header-muted mb-3 line-clamp-2">
              {item.description}
            </div>

            {/* Tags */}
            <div className="space-y-2 mb-3">
              {/* Content Types */}
              <div className="flex flex-wrap gap-1">
                {item.contentTypes.map((type) => (
                  <span key={type} className="px-2 py-1 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded text-[10px] font-medium text-brand-mid-pink border border-brand-mid-pink/20">
                    {type}
                  </span>
                ))}
              </div>
              {/* Message Types */}
              <div className="flex flex-wrap gap-1">
                {item.messageTypes.map((type) => (
                  <span key={type} className="px-2 py-1 bg-brand-light-pink/10 dark:bg-brand-light-pink/20 rounded text-[10px] font-medium text-brand-light-pink border border-brand-light-pink/20">
                    {type}
                  </span>
                ))}
              </div>
            </div>

            {/* Release date */}
            <div className="flex items-center gap-1 text-[11px] text-header-muted mb-3">
              <Calendar size={10} />
              {new Date(item.releaseDate).toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </div>

            {/* Assigned creators */}
            {item.assignees && item.assignees.length > 0 && (
              <div className="flex items-start gap-2 mt-1 pt-3 border-t border-brand-mid-pink/10 dark:border-brand-mid-pink/15">
                <Users size={11} className="text-brand-mid-pink mt-0.5 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {item.assignees.map((a) => {
                    const name = creatorMap[a.clerkId] || a.clerkId.slice(0, 8);
                    return (
                      <span
                        key={a.clerkId}
                        className="px-1.5 py-0.5 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/15 text-brand-mid-pink rounded text-[10px] font-medium"
                        title={a.clerkId}
                      >
                        {name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Edit modal */}
    <CaptionQueueEditModal
      item={editingItem}
      isOpen={editingItem !== null}
      onClose={() => setEditingItem(null)}
    />
  </>
  );
}
