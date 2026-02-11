'use client';

import { useEffect, useState } from 'react';
import { Bell, Calendar, User, Image as ImageIcon, Video, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: any;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

interface ProductionTask {
  id: string;
  deadline: string;
  assignee: string;
  influencer: string;
  instagramSource: string;
  loraModel: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  imagesTarget: number;
  imagesGenerated: number;
  videosTarget: number;
  videosGenerated: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  overdue: number;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productionTasks, setProductionTasks] = useState<ProductionTask[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    overdue: 0
  });
  const [hasManagerRole, setHasManagerRole] = useState(false);
  const [hasProductionAccess, setHasProductionAccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'tasks'>('notifications');
  const router = useRouter();

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?unreadOnly=false&limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch production tasks for managers and content creators
  const fetchProductionTasks = async () => {
    try {
      const response = await fetch('/api/manager/tasks');
      if (response.ok) {
        const data = await response.json();
        setProductionTasks(data.tasks);
        setTaskStats(data.stats);
        setHasManagerRole(true);
        setHasProductionAccess(true);
      } else if (response.status === 403) {
        setHasManagerRole(false);
        setHasProductionAccess(false);
      }
    } catch (error) {
      console.error('Failed to fetch production tasks:', error);
    }
  };

  //TODO: ably realtime notification

  // useEffect(() => {
  //   fetchNotifications();
  //   fetchProductionTasks();
    
  //   // Poll for new notifications and tasks every 10 seconds
  //   const interval = setInterval(() => {
  //     fetchNotifications();
  //     fetchProductionTasks();
  //   }, 10000);
  //   return () => clearInterval(interval);
  // }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    if (notification.link) {
      setIsOpen(false);
      router.push(notification.link);
    }
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

  const getStatusBadge = (status: ProductionTask['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
    }
  };

  const isOverdue = (deadline: string, status: string) => {
    return new Date(deadline) < new Date() && !['COMPLETED'].includes(status);
  };

  // Calculate total urgent items
  const urgentTasks = productionTasks.filter(task => 
    task.status === 'PENDING' || 
    task.status === 'IN_PROGRESS' || 
    isOverdue(task.deadline, task.status)
  );
  
  const totalUnreadItems = unreadCount + (hasProductionAccess ? urgentTasks.length : 0);

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full transition-colors"
      >
        <Bell className="h-6 w-6" />
        {totalUnreadItems > 0 && (
          <>
            <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {totalUnreadItems > 9 ? '9+' : totalUnreadItems}
            </span>
            {/* Pulse animation for overdue tasks */}
            {taskStats.overdue > 0 && (
              <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 animate-ping"></span>
            )}
          </>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-900 rounded-lg shadow-2xl ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-20 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header with Tabs */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
                {activeTab === 'notifications' && unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'notifications'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Posts {unreadCount > 0 && `(${unreadCount})`}
                </button>
                {hasProductionAccess && (
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'tasks'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Tasks {urgentTasks.length > 0 && `(${urgentTasks.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              {activeTab === 'notifications' ? (
                // Notifications Tab
                loading ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                          !notification.read ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Notification Icon */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                            notification.type === 'POST_REMINDER' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                            notification.type === 'POST_APPROVED' ? 'bg-green-100 dark:bg-green-900/30' :
                            notification.type === 'POST_REJECTED' ? 'bg-red-100 dark:bg-red-900/30' :
                            'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            <span className="text-xl">
                              {notification.type === 'POST_REMINDER' ? '📸' :
                               notification.type === 'POST_APPROVED' ? '✅' :
                               notification.type === 'POST_REJECTED' ? '❌' :
                               '📬'}
                            </span>
                          </div>

                          {/* Notification Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {formatTimeAgo(notification.createdAt)}
                            </p>
                          </div>

                          {/* Unread Indicator */}
                          {!notification.read && (
                            <div className="flex-shrink-0 w-2 h-2 bg-indigo-600 rounded-full mt-2" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // Production Tasks Tab
                <>
                  {/* Task Stats */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{taskStats.pending}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{taskStats.inProgress}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">In Progress</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{taskStats.overdue}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Overdue</div>
                      </div>
                    </div>
                  </div>

                  {/* Tasks List */}
                  {productionTasks.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                      <p>No production tasks assigned</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {productionTasks.map((task) => (
                        <div 
                          key={task.id} 
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{task.influencer}</h4>
                              {getStatusBadge(task.status)}
                            </div>
                            
                            {isOverdue(task.deadline, task.status) && (
                              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Overdue
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(task.deadline).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                {task.imagesGenerated}/{task.imagesTarget}
                              </div>
                              <div className="flex items-center gap-1">
                                <Video className="w-3 h-3" />
                                {task.videosGenerated}/{task.videosTarget}
                              </div>
                            </div>
                            
                            {task.notes && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded p-2">
                                {task.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {((activeTab === 'notifications' && notifications.length > 0) || 
              (activeTab === 'tasks' && productionTasks.length > 0)) && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (activeTab === 'notifications') {
                      router.push('/dashboard/notifications');
                    } else {
                      router.push('/dashboard/admin');
                    }
                  }}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
                >
                  {activeTab === 'notifications' ? 'View all notifications' : 'View production tracker'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
