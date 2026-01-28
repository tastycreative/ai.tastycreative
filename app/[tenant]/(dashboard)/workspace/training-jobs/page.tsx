"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  BarChart3,
  Calendar,
  Cpu,
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  Zap,
  Package,
} from "lucide-react";

const statusConfig = {
  PENDING: {
    icon: Clock,
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    label: "Pending",
  },
  QUEUED: {
    icon: Clock,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "Queued",
  },
  INITIALIZING: {
    icon: RefreshCw,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "Initializing",
  },
  PROCESSING: {
    icon: Cpu,
    color: "text-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    label: "Training",
  },
  SAMPLING: {
    icon: RefreshCw,
    color: "text-purple-500",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "Sampling",
  },
  SAVING: {
    icon: Download,
    color: "text-indigo-500",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "Saving",
  },
  COMPLETED: {
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "Completed",
  },
  FAILED: {
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "Failed",
  },
  CANCELLED: {
    icon: AlertCircle,
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    label: "Cancelled",
  },
  TIMEOUT: {
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    label: "Timeout",
  },
} as const;

export default function TrainingJobsPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [selectedTab, setSelectedTab] = useState<
    "all" | "active" | "completed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "progress" | "name">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    data: trainingJobs = [],
    isLoading,
    refetch,
  } = trpc.getUserTrainingJobs.useQuery();
  const { data: trainingStats } = trpc.getTrainingStats.useQuery();

  const cancelJobMutation = trpc.cancelTrainingJob.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const deleteJobMutation = trpc.deleteTrainingJob.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const syncJobMutation = trpc.syncRunPodJob.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const filteredJobs = trainingJobs
    .filter((job) => {
      // Filter by tab
      if (selectedTab === "active") {
        if (
          ![
            "PENDING",
            "QUEUED",
            "INITIALIZING",
            "PROCESSING",
            "SAMPLING",
            "SAVING",
          ].includes(job.status)
        )
          return false;
      }
      if (selectedTab === "completed") {
        if (
          !["COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"].includes(job.status)
        )
          return false;
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          job.name.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query) ||
          job.status.toLowerCase().includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      // Sort jobs
      let comparison = 0;

      if (sortBy === "date") {
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "progress") {
        comparison = (a.progress || 0) - (b.progress || 0);
      } else if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const handleCancelJob = async (jobId: string) => {
    if (window.confirm("Are you sure you want to cancel this training job?")) {
      await cancelJobMutation.mutateAsync({ jobId });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this training job? This action cannot be undone."
      )
    ) {
      await deleteJobMutation.mutateAsync({ jobId });
    }
  };

  const handleSyncJob = async (jobId: string) => {
    await syncJobMutation.mutateAsync({ jobId });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (startDate?: string, endDate?: string) => {
    if (!startDate) return "Not started";

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-600 dark:text-gray-400">
              Loading training jobs...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl shadow-2xl border border-blue-200 dark:border-blue-800 p-8 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-lg">
              <div className="relative">
                <BarChart3 className="w-10 h-10 text-white drop-shadow-sm" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center">
                  <Cpu className="w-3 h-3 text-cyan-800" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 drop-shadow-sm flex items-center space-x-3">
                <span>Training Jobs</span>
                <span className="text-2xl">🚀</span>
              </h1>
              <p className="text-blue-100 text-lg font-medium opacity-90 mb-2">
                Monitor and manage your AI model training jobs
              </p>
              <div className="flex items-center space-x-4 text-sm text-blue-100">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Real-time Status</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-purple-300 rounded-full"></div>
                  <span>GPU Training</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                  <span>Progress Tracking</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href={`/${tenant}/workspace/train-lora`}
              className="group flex items-center space-x-3 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-2xl hover:bg-white/20 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl border border-white/20"
            >
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>New Training Job</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      {trainingStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trainingStats.totalJobs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Jobs
                </p>
              </div>
            </div>
          </div>

          <div className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-yellow-300 dark:hover:border-yellow-600 transition-all duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trainingStats.activeJobs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Active
                </p>
              </div>
            </div>
          </div>

          <div className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-green-300 dark:hover:border-green-600 transition-all duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trainingStats.completedJobs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Completed
                </p>
              </div>
            </div>
          </div>

          <div className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-red-300 dark:hover:border-red-600 transition-all duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg group-hover:scale-110 transition-transform">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trainingStats.failedJobs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Failed
                </p>
              </div>
            </div>
          </div>

          <div className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trainingStats.totalLoRAs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  LoRAs
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search, Filter & Sort Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs by name, description, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "date" | "progress" | "name")
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="date">Sort by Date</option>
              <option value="progress">Sort by Progress</option>
              <option value="name">Sort by Name</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              <ArrowUpDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Active Filters */}
        {searchQuery && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Searching:
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
              {searchQuery}
              <button
                onClick={() => setSearchQuery("")}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                ×
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {(["all", "active", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                selectedTab === tab
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab} Jobs
              <span className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                {tab === "all"
                  ? trainingJobs.length
                  : tab === "active"
                  ? trainingStats?.activeJobs || 0
                  : (trainingStats?.completedJobs || 0) +
                    (trainingStats?.failedJobs || 0)}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Training Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="max-w-md mx-auto px-6">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative bg-white dark:bg-gray-800 p-6 rounded-full shadow-lg">
                <Cpu className="w-16 h-16 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {searchQuery
                ? "No matching jobs found"
                : selectedTab === "all"
                ? "No training jobs yet"
                : `No ${selectedTab} jobs`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
              {searchQuery
                ? `Try adjusting your search terms or filters`
                : selectedTab === "all"
                ? "Start training your first LoRA model and bring your AI vision to life"
                : `You don't have any ${selectedTab} training jobs`}
            </p>
            {selectedTab === "all" && !searchQuery && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/${tenant}/workspace/train-lora`}
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
                >
                  <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Start Training
                </Link>
                <Link
                  href="/docs/training"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-semibold border-2 border-gray-300 dark:border-gray-600"
                >
                  <Package className="w-5 h-5" />
                  Learn More
                </Link>
              </div>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const config =
              statusConfig[job.status as keyof typeof statusConfig];
            const StatusIcon = config.icon;

            return (
              <div
                key={job.id}
                className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {job.name}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </div>

                        {job.description && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                            {job.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Created {formatDate(job.createdAt)}
                          </div>

                          {job.startedAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Duration:{" "}
                              {formatDuration(
                                job.startedAt,
                                job.completedAt || undefined
                              )}
                            </div>
                          )}

                          {job.currentStep && job.totalSteps && (
                            <div className="flex items-center gap-1">
                              <BarChart3 className="w-4 h-4" />
                              Step {job.currentStep}/{job.totalSteps}
                            </div>
                          )}

                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {job.trainingImages?.length || 0} images
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {job.progress !== null &&
                          job.progress !== undefined &&
                          job.status === "PROCESSING" && (
                            <div className="mt-3">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  Training Progress
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {job.progress}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${job.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                        {/* Error Message */}
                        {job.error && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-700 dark:text-red-300 text-sm">
                              <strong>Error:</strong> {job.error}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {job.runpodJobId &&
                      [
                        "PROCESSING",
                        "QUEUED",
                        "INITIALIZING",
                        "SAMPLING",
                        "SAVING",
                      ].includes(job.status) && (
                        <button
                          onClick={() => handleSyncJob(job.id)}
                          disabled={syncJobMutation.isPending}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-all duration-200"
                          title="Sync with RunPod"
                        >
                          <RefreshCw
                            className={`w-5 h-5 ${
                              syncJobMutation.isPending ? "animate-spin" : ""
                            }`}
                          />
                        </button>
                      )}

                    <Link
                      href={`/workspace/training-jobs/${job.id}`}
                      className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-all duration-200 group-hover:scale-110"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>

                    {[
                      "PENDING",
                      "QUEUED",
                      "INITIALIZING",
                      "PROCESSING",
                      "SAMPLING",
                      "SAVING",
                    ].includes(job.status) && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        disabled={cancelJobMutation.isPending}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-all duration-200"
                        title="Cancel Job"
                      >
                        <Pause className="w-5 h-5" />
                      </button>
                    )}

                    {["COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"].includes(
                      job.status
                    ) && (
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        disabled={deleteJobMutation.isPending}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-all duration-200"
                        title="Delete Job"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
