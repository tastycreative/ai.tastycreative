'use client';

import { useState, useEffect } from 'react';
import { Calendar, User, Image as ImageIcon, Video, Clock, AlertCircle, CheckCircle, XCircle, Filter, Search, RefreshCw } from 'lucide-react';
import { getBestMediaUrl } from '@/lib/directUrlUtils';

interface LinkedMedia {
  id: string;
  filename: string;
  subfolder: string;
  networkVolumePath?: string | null;
  s3Key?: string | null;
  awsS3Key?: string | null;
  awsS3Url?: string | null;
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
  linkedImages?: { image: LinkedMedia }[];
  linkedVideos?: { video: LinkedMedia }[];
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

interface ProductionDashboardProps {
  title?: string;
}

export default function ProductionDashboard({ title = "Production Dashboard" }: ProductionDashboardProps) {
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
  const [user, setUser] = useState<TasksResponse['manager']>({ firstName: null, lastName: null, email: null });
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTasks();
    
    // Set up auto-refresh every 30 seconds to catch progress updates
    const interval = setInterval(() => {
      fetchTasks();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, filterStatus, searchTerm]);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/manager/tasks');
      if (response.ok) {
        const data: TasksResponse = await response.json();
        setTasks(data.tasks);
        setStats(data.stats);
        setUser(data.manager);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
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

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Welcome {user.firstName} {user.lastName} - Manage your assigned production tasks
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">In Progress</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.overdue}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Overdue</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by influencer, LoRA model, or Instagram source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {filterStatus === 'all' ? 'No tasks assigned' : `No ${filterStatus.toLowerCase()} tasks`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filterStatus === 'all' 
                ? "You don't have any production tasks assigned to you right now."
                : `There are no tasks matching the ${filterStatus.toLowerCase()} filter.`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTasks.map((task) => (
              <div key={task.id} className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isRecentlyUpdated(task.updatedAt) ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''}`}>
                <div className="flex items-start justify-between mb-4">
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <User className="w-4 h-4" />
                        <span>LoRA: {task.loraModel}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>Updated: {new Date(task.updatedAt).toLocaleString()}</span>
                        {isRecentlyUpdated(task.updatedAt) && (
                          <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
                            Recently updated
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            <ImageIcon className="w-4 h-4 mr-1" />
                            Images
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
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
                          <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            <Video className="w-4 h-4 mr-1" />
                            Videos
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
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
                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        {task.notes}
                      </div>
                    )}

                    {/* Linked Content Section */}
                    {(task.linkedImages?.length || task.linkedVideos?.length) ? (
                      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <button
                          onClick={() => toggleTaskExpansion(task.id)}
                          className="flex items-center space-x-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          <span>
                            {expandedTasks.has(task.id) ? '▼' : '▶'} Linked Content 
                            ({(task.linkedImages?.length || 0) + (task.linkedVideos?.length || 0)} items)
                          </span>
                        </button>

                        {expandedTasks.has(task.id) && (
                          <div className="mt-3 space-y-4">
                            {/* Linked Images */}
                            {task.linkedImages && task.linkedImages.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                                  <ImageIcon className="w-4 h-4 mr-1" />
                                  Images ({task.linkedImages.length})
                                </h4>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                  {task.linkedImages.map((link) => (
                                    <div key={link.image.id} className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-500 transition-all">
                                      <img
                                        src={getBestMediaUrl(link.image)}
                                        alt="Linked content"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Linked Videos */}
                            {task.linkedVideos && task.linkedVideos.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                                  <Video className="w-4 h-4 mr-1" />
                                  Videos ({task.linkedVideos.length})
                                </h4>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                  {task.linkedVideos.map((link) => (
                                    <div key={link.video.id} className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-purple-500 transition-all relative">
                                      <img
                                        src={getBestMediaUrl(link.video)}
                                        alt="Linked video thumbnail"
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <Video className="w-6 h-6 text-white" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
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
