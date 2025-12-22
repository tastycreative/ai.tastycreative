'use client';

import { useState, useEffect } from 'react';
import { Calendar, User, Image as ImageIcon, Video, Clock, AlertCircle, CheckCircle, XCircle, Filter, Search, RefreshCw } from 'lucide-react';

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

export default function ManagerDashboard() {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<ProductionTask[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [manager, setManager] = useState<TasksResponse['manager']>({ firstName: null, lastName: null, email: null });

  useEffect(() => {
    fetchManagerTasks();
    
    // Set up auto-refresh every 30 seconds to catch progress updates
    const interval = setInterval(() => {
      fetchManagerTasks();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, filterStatus, searchTerm]);

  const fetchManagerTasks = async () => {
    try {
      const response = await fetch('/api/manager/tasks');
      if (response.ok) {
        const data: TasksResponse = await response.json();
        setTasks(data.tasks);
        setStats(data.stats);
        setManager(data.manager);
      }
    } catch (error) {
      console.error('Failed to fetch manager tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = tasks;

    // Filter by status
    if (filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        filtered = filtered.filter(task => 
          new Date(task.deadline) < new Date() && 
          !['COMPLETED'].includes(task.status)
        );
      } else {
        filtered = filtered.filter(task => task.status === filterStatus);
      }
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(task => 
        task.influencer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.loraModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.instagramSource.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTasks(filtered);
  };

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

  const isRecentlyUpdated = (updatedAt: string) => {
    const updateTime = new Date(updatedAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - updateTime.getTime()) / (1000 * 60);
    return diffMinutes < 5; // Consider updated if within last 5 minutes
  };

  const getProgressPercentage = (generated: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(Math.round((generated / target) * 100), 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2 xs:space-y-3">
        <div>
          <h1 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Production Manager Dashboard</h1>
          <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Welcome {manager.firstName} {manager.lastName} - Manage your assigned production tasks
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-6 gap-2 xs:gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 xs:p-3 sm:p-4 text-center active:scale-[0.98] transition-transform">
          <div className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 xs:p-3 sm:p-4 text-center active:scale-[0.98] transition-transform">
          <div className="text-lg xs:text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-gray-400">Pending</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 xs:p-3 sm:p-4 text-center active:scale-[0.98] transition-transform">
          <div className="text-lg xs:text-xl sm:text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-gray-400"><span className="hidden xs:inline">In </span>Progress</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 xs:p-3 sm:p-4 text-center active:scale-[0.98] transition-transform">
          <div className="text-lg xs:text-xl sm:text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 xs:p-3 sm:p-4 text-center active:scale-[0.98] transition-transform">
          <div className="text-lg xs:text-xl sm:text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-gray-400">Failed</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 xs:p-3 sm:p-4 text-center active:scale-[0.98] transition-transform">
          <div className="text-lg xs:text-xl sm:text-2xl font-bold text-orange-600">{stats.overdue}</div>
          <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-gray-400">Overdue</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 xs:gap-3 sm:gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 xs:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <input
              type="text"
              placeholder="Search by influencer, LoRA model, or Instagram source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 xs:pl-10 pr-3 xs:pr-4 py-1.5 xs:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-xs xs:text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchManagerTasks}
            disabled={loading}
            className="flex items-center gap-1.5 xs:gap-2 px-2.5 xs:px-3 py-1.5 xs:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors active:scale-95 text-xs xs:text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 xs:w-4 xs:h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Refresh</span>
          </button>
          <Filter className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs xs:text-sm"
          >
            <option value="all">All Tasks</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg sm:rounded-xl shadow-lg overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-4 xs:p-6 sm:p-8 text-center">
            <CheckCircle className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 xs:mb-4" />
            <h3 className="text-base xs:text-lg font-medium text-gray-900 dark:text-white mb-2">
              {filterStatus === 'all' ? 'No tasks assigned' : `No ${filterStatus.toLowerCase()} tasks`}
            </h3>
            <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {filterStatus === 'all' 
                ? "You don't have any production tasks assigned to you right now."
                : `There are no tasks matching the ${filterStatus.toLowerCase()} filter.`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTasks.map((task) => (
              <div key={task.id} className={`p-3 xs:p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isRecentlyUpdated(task.updatedAt) ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''}`}>
                <div className="flex items-start justify-between mb-3 xs:mb-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 xs:gap-3 mb-2">
                      <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{task.influencer}</h3>
                      {getStatusBadge(task.status)}
                      {isOverdue(task.deadline, task.status) && (
                        <span className="inline-flex items-center px-1.5 xs:px-2 py-0.5 xs:py-1 rounded-full text-[10px] xs:text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          <AlertCircle className="w-3 h-3 mr-0.5 xs:mr-1" />
                          Overdue
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 xs:gap-3 sm:gap-4 mb-3 xs:mb-4">
                      <div className="flex items-center space-x-1.5 xs:space-x-2 text-xs xs:text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0" />
                        <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 xs:space-x-2 text-xs xs:text-sm text-gray-600 dark:text-gray-400">
                        <User className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0" />
                        <span className="truncate">LoRA: {task.loraModel}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 xs:space-x-2 text-xs xs:text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0" />
                        <span className="truncate">Updated: {new Date(task.updatedAt).toLocaleString()}</span>
                        {isRecentlyUpdated(task.updatedAt) && (
                          <span className="text-[10px] xs:text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5 xs:px-2 py-0.5 rounded-full whitespace-nowrap">
                            Recently updated
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xs:gap-4 mb-3 xs:mb-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            <ImageIcon className="w-3.5 h-3.5 xs:w-4 xs:h-4 mr-1" />
                            Images
                          </span>
                          <span className="text-xs xs:text-sm font-medium text-gray-900 dark:text-white">
                            {task.imagesGenerated}/{task.imagesTarget}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProgressPercentage(task.imagesGenerated, task.imagesTarget)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            <Video className="w-3.5 h-3.5 xs:w-4 xs:h-4 mr-1" />
                            Videos
                          </span>
                          <span className="text-xs xs:text-sm font-medium text-gray-900 dark:text-white">
                            {task.videosGenerated}/{task.videosTarget}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProgressPercentage(task.videosGenerated, task.videosTarget)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {task.notes && (
                      <div className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 xs:p-3">
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
  );
}