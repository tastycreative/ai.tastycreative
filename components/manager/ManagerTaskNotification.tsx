'use client';

import { useState, useEffect } from 'react';
import { Bell, Calendar, User, Image, Video, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

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

interface TasksResponse {
  tasks: ProductionTask[];
  stats: TaskStats;
  manager: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

// Task Notification Modal
function TaskModal({ isOpen, onClose, tasks, stats }: {
  isOpen: boolean;
  onClose: () => void;
  tasks: ProductionTask[];
  stats: TaskStats;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const getStatusBadge = (status: ProductionTask['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
    }
  };

  const isOverdue = (deadline: string, status: string) => {
    return new Date(deadline) < new Date() && !['COMPLETED'].includes(status);
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 10000,
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Assigned Tasks</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Production tasks assigned to you</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.overdue}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Overdue</div>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="overflow-y-auto max-h-96">
          {tasks.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tasks assigned</h3>
              <p className="text-gray-600 dark:text-gray-400">You don't have any production tasks assigned to you right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {tasks.map((task) => (
                <div key={task.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{task.influencer}</h3>
                        {getStatusBadge(task.status)}
                        {isOverdue(task.deadline, task.status) && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Overdue
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <User className="w-4 h-4" />
                          <span>LoRA: {task.loraModel}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <Image className="w-4 h-4" />
                          <span>Images: {task.imagesGenerated}/{task.imagesTarget}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <Video className="w-4 h-4" />
                          <span>Videos: {task.videosGenerated}/{task.videosTarget}</span>
                        </div>
                      </div>

                      {task.notes && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          {task.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ManagerTaskNotification() {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [hasManagerRole, setHasManagerRole] = useState(false);

  useEffect(() => {
    fetchManagerTasks();
    
    // Set up auto-refresh every 60 seconds for notifications
    const interval = setInterval(() => {
      fetchManagerTasks();
    }, 60000); // 1 minute
    
    return () => clearInterval(interval);
  }, []);

  const fetchManagerTasks = async () => {
    try {
      const response = await fetch('/api/manager/tasks');
      if (response.ok) {
        const data: TasksResponse = await response.json();
        setTasks(data.tasks);
        setStats(data.stats);
        setHasManagerRole(true);
      } else if (response.status === 403) {
        // User is not a manager, hide the component
        setHasManagerRole(false);
      }
    } catch (error) {
      console.error('Failed to fetch manager tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if user is not a manager or if loading
  if (loading || !hasManagerRole) {
    return null;
  }

  const urgentTasks = tasks.filter(task => 
    task.status === 'PENDING' || 
    task.status === 'IN_PROGRESS' || 
    stats.overdue > 0
  );

  return (
    <>
      {/* Notification Bell with Badge */}
      <button
        onClick={() => setShowModal(true)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <Bell className="w-6 h-6" />
        
        {/* Badge showing number of urgent tasks */}
        {urgentTasks.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {urgentTasks.length > 99 ? '99+' : urgentTasks.length}
          </span>
        )}
        
        {/* Pulse animation for urgent tasks */}
        {stats.overdue > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 rounded-full h-5 w-5 animate-ping"></span>
        )}
      </button>

      {/* Task Modal */}
      <TaskModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        tasks={tasks}
        stats={stats}
      />
    </>
  );
}