'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ToastNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  createdAt: string;
}

interface NotificationToastProps {
  notification: ToastNotification;
  onDismiss: (id: string) => void;
  onRead?: (id: string) => void;
}

function NotificationToastItem({ notification, onDismiss, onRead }: NotificationToastProps) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(notification.id), 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const handleClick = () => {
    onRead?.(notification.id);
    if (notification.link) {
      router.push(notification.link);
    }
    setIsExiting(true);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRead?.(notification.id);
    setIsExiting(true);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const icon = notification.type === 'BOARD_MOVE' ? '📋' : notification.type === 'ORG_INVITATION' ? '🏢' : '📬';

  return (
    <div
      onClick={handleClick}
      className={[
        'w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-brand-mid-pink/20 rounded-xl shadow-2xl p-4 cursor-pointer transition-all duration-300',
        isExiting
          ? 'opacity-0 translate-x-8'
          : 'opacity-100 translate-x-0 animate-slide-in-right',
      ].join(' ')}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-light-pink/10 dark:bg-brand-light-pink/15 flex items-center justify-center">
          <span className="text-lg">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {notification.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          {notification.link && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-blue mt-1.5">
              View item <ArrowRight className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook that manages toast notifications rendered via portal to document.body
 * so they always appear at the bottom-right of the viewport.
 */
export function useNotificationToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [mounted, setMounted] = useState(false);
  const [onReadCallback, setOnReadCallback] = useState<((id: string) => void) | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((notification: ToastNotification) => {
    setToasts((prev) => {
      if (prev.some((t) => t.id === notification.id)) return prev;
      return [notification, ...prev].slice(0, 3);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setOnRead = useCallback((cb: (id: string) => void) => {
    setOnReadCallback(() => cb);
  }, []);

  const ToastContainer = useCallback(() => {
    if (!mounted || toasts.length === 0) return null;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {toasts.map((toast) => (
          <NotificationToastItem
            key={toast.id}
            notification={toast}
            onDismiss={dismissToast}
            onRead={onReadCallback ?? undefined}
          />
        ))}
      </div>,
      document.body,
    );
  }, [mounted, toasts, dismissToast, onReadCallback]);

  return { showToast, dismissToast, setOnRead, ToastContainer };
}
