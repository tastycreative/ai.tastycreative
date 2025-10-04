"use client";

import { useEffect, useRef } from 'react';

interface BrowserNotificationProps {
  enabled: boolean;
  onPermissionChange?: (permission: NotificationPermission) => void;
}

/**
 * Browser notification manager component
 * Handles permission requests and displays notifications when reminders are due
 */
export default function BrowserNotificationManager({ 
  enabled,
  onPermissionChange 
}: BrowserNotificationProps) {
  const permissionRef = useRef<NotificationPermission>('default');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    // Check current permission
    permissionRef.current = Notification.permission;
    onPermissionChange?.(Notification.permission);

    // Request permission if not granted
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        permissionRef.current = permission;
        onPermissionChange?.(permission);
      });
    }
  }, [enabled, onPermissionChange]);

  return null; // This is a headless component
}

/**
 * Show a browser notification for post reminder
 */
export function showPostReminder(data: {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Browser notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  const notification = new Notification(data.title, {
    body: data.body,
    icon: data.icon || '/instagram-icon.png',
    badge: data.badge || '/instagram-icon.png',
    data: data.data,
    requireInteraction: true, // Keep notification visible until user interacts
    tag: 'instagram-post-reminder', // Replace previous notifications
  });

  // Handle notification click
  notification.onclick = () => {
    window.focus();
    if (data.data?.url) {
      window.location.href = data.data.url;
    }
    notification.close();
  };

  return notification;
}

/**
 * Request notification permission explicitly
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  return permission;
}
