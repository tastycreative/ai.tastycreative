'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Calendar, Trash2, AlertCircle } from 'lucide-react';

interface QueueItem {
  id: string;
  modelName: string;
  modelAvatar: string;
  profileImageUrl: string | null;
  description: string;
  contentTypes: string[];
  messageTypes: string[];
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  releaseDate: string;
  status: string;
  createdAt: string;
}

interface CaptionQueueListProps {
  refreshTrigger: number;
}

const urgencyConfig = {
  low: { label: 'LOW', bg: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400' },
  medium: { label: 'MED', bg: 'bg-blue-100 dark:bg-blue-950/30', textColor: 'text-blue-600 dark:text-blue-400' },
  high: { label: 'HIGH', bg: 'bg-orange-100 dark:bg-orange-950/30', textColor: 'text-orange-600 dark:text-orange-400' },
  urgent: { label: 'URGENT', bg: 'bg-red-100 dark:bg-red-950/30', textColor: 'text-red-600 dark:text-red-400' },
};

// Urgency priority for sorting
const urgencyPriority: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function CaptionQueueList({ refreshTrigger }: CaptionQueueListProps) {
  const { user } = useUser();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/caption-queue');
        if (!response.ok) throw new Error('Failed to fetch queue');
        
        const data = await response.json();
        const fetchedItems = data.items || [];
        
        // Sort by urgency (urgent > high > medium > low), then by releaseDate
        const sortedItems = [...fetchedItems].sort((a: QueueItem, b: QueueItem) => {
          const urgencyDiff = (urgencyPriority[b.urgency] || 0) - (urgencyPriority[a.urgency] || 0);
          if (urgencyDiff !== 0) return urgencyDiff;
          
          // If same urgency, sort by releaseDate (earliest first)
          return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
        });
        
        setItems(sortedItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load queue');
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
  }, [user, refreshTrigger]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this queue item?')) return;

    try {
      const response = await fetch(`/api/caption-queue/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-header-muted">Loading queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
        <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const config = urgencyConfig[item.urgency];
        
        return (
          <div
            key={item.id}
            className="bg-white dark:bg-[#1a1625] border border-brand-mid-pink/20 rounded-2xl p-4 hover:shadow-md transition-shadow"
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
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
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
            <div className="flex items-center gap-1 text-[11px] text-header-muted">
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
          </div>
        );
      })}
    </div>
  );
}
