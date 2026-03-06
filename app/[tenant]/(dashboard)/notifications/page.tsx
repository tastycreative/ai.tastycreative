'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { useNotificationRealtime } from '@/lib/hooks/useNotificationRealtime';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: unknown;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?unreadOnly=false&limit=50');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Real-time: push new notifications to the top
  const handleNewNotification = useCallback(
    (incoming: { id: string; type: string; title: string; message: string; link?: string | null; createdAt: string }) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incoming.id)) return prev;
        return [
          {
            id: incoming.id,
            type: incoming.type,
            title: incoming.title,
            message: incoming.message,
            link: incoming.link,
            read: false,
            createdAt: incoming.createdAt,
          },
          ...prev,
        ];
      });
      setUnreadCount((prev) => prev + 1);
    },
    [],
  );

  useNotificationRealtime(handleNewNotification);

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) router.push(n.link);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'POST_REMINDER': return '📸';
      case 'POST_APPROVED': return '✅';
      case 'POST_REJECTED': return '❌';
      case 'BOARD_MOVE': return '📋';
      default: return '📬';
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'POST_REMINDER': return 'bg-indigo-100 dark:bg-indigo-900/30';
      case 'POST_APPROVED': return 'bg-green-100 dark:bg-green-900/30';
      case 'POST_REJECTED': return 'bg-red-100 dark:bg-red-900/30';
      case 'BOARD_MOVE': return 'bg-blue-100 dark:bg-blue-900/30';
      default: return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-blue hover:text-brand-light-pink border border-brand-blue/20 hover:border-brand-light-pink/30 rounded-lg transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={[
                  'flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors',
                  !n.read
                    ? 'bg-brand-light-pink/5 dark:bg-brand-light-pink/10 hover:bg-brand-light-pink/10 dark:hover:bg-brand-light-pink/15'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                ].join(' ')}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getIconBg(n.type)}`}>
                  <span className="text-xl">{getIcon(n.type)}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatTimeAgo(n.createdAt)}</p>
                </div>

                {/* Read indicator / action */}
                <div className="flex-shrink-0 mt-1">
                  {!n.read ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      title="Mark as read"
                      className="p-1 text-brand-light-pink hover:text-brand-dark-pink transition-colors"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-brand-light-pink" />
                    </button>
                  ) : (
                    <Check className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
