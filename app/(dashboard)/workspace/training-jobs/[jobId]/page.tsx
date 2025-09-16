"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RefreshCw,
  Download,
  Eye,
  Clock,
  Zap,
  TrendingUp,
  Activity,
  Image as ImageIcon,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Monitor,
  Cpu,
  HardDrive,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";

interface TrainingMetrics {
  currentStep: number;
  totalSteps: number;
  currentEpoch: number;
  totalEpochs: number;
  loss: number;
  learningRate: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
  samplesGenerated: number;
  currentPhase: string;
  gpuUtilization?: number;
  memoryUsage?: number;
  temperature?: number;
}

interface TrainingLog {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  phase?: string;
}

interface GeneratedSample {
  id: string;
  step: number;
  imageUrl: string;
  prompt: string;
  timestamp: string;
}

export default function TrainingJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.jobId as string;

  // State management
  const [selectedTab, setSelectedTab] = useState<"overview" | "logs" | "samples" | "metrics">("overview");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [samples, setSamples] = useState<GeneratedSample[]>([]);
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);

  // API calls
  const { data: job, isLoading, refetch } = trpc.getTrainingJob.useQuery(
    { jobId },
    { enabled: !!jobId, refetchInterval: autoRefresh ? refreshInterval : false }
  );

  const cancelJobMutation = trpc.cancelTrainingJob.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const syncJobMutation = trpc.syncRunPodJob.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Real-time updates simulation (replace with actual WebSocket/API calls)
  useEffect(() => {
    if (!job || !["PROCESSING", "INITIALIZING", "SAMPLING"].includes(job.status)) return;

    const updateMetrics = () => {
      // Simulate real-time metrics updates
      const progress = job.progress || 0;
      const totalSteps = job.totalSteps || 1500;
      const currentStep = Math.floor((progress / 100) * totalSteps);
      
      setMetrics({
        currentStep,
        totalSteps,
        currentEpoch: Math.floor(currentStep / 100) + 1,
        totalEpochs: Math.ceil(totalSteps / 100),
        loss: 0.5 - (progress / 100) * 0.3 + Math.random() * 0.1,
        learningRate: 0.0001 * Math.exp(-progress / 200),
        timeElapsed: Date.now() - new Date(job.startedAt || job.createdAt).getTime(),
        estimatedTimeRemaining: ((100 - progress) / Math.max(progress, 1)) * (Date.now() - new Date(job.startedAt || job.createdAt).getTime()),
        samplesGenerated: Math.floor(currentStep / 250),
        currentPhase: job.status === "PROCESSING" ? "Training" : job.status === "SAMPLING" ? "Generating Samples" : "Initializing",
        gpuUtilization: 85 + Math.random() * 10,
        memoryUsage: 12.5 + Math.random() * 2,
        temperature: 75 + Math.random() * 5,
      });

      // Simulate log updates
      if (Math.random() > 0.7) {
        const newLog: TrainingLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Training step ${currentStep}/${totalSteps} - Loss: ${(0.5 - (progress / 100) * 0.3).toFixed(4)}`,
          phase: "training",
        };
        setLogs(prev => [newLog, ...prev.slice(0, 99)]);
      }

      // Simulate sample generation
      if (Math.random() > 0.9 && currentStep > 0 && currentStep % 250 === 0) {
        const newSample: GeneratedSample = {
          id: Date.now().toString(),
          step: currentStep,
          imageUrl: `https://picsum.photos/200/200?random=${currentStep}`,
          prompt: `Training sample at step ${currentStep}`,
          timestamp: new Date().toISOString(),
        };
        setSamples(prev => [newSample, ...prev.slice(0, 19)]);
      }
    };

    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, [job]);

  // Helper functions
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    return `${bytes.toFixed(1)}GB`;
  };

  // Status configuration
  const getStatusConfig = (status: string) => {
    const configs = {
      PENDING: { icon: Clock, color: "text-gray-500", bg: "bg-gray-100", label: "Pending" },
      QUEUED: { icon: Clock, color: "text-blue-500", bg: "bg-blue-100", label: "Queued" },
      INITIALIZING: { icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-100", label: "Initializing" },
      PROCESSING: { icon: Cpu, color: "text-yellow-500", bg: "bg-yellow-100", label: "Training" },
      SAMPLING: { icon: ImageIcon, color: "text-purple-500", bg: "bg-purple-100", label: "Sampling" },
      SAVING: { icon: Download, color: "text-indigo-500", bg: "bg-indigo-100", label: "Saving" },
      COMPLETED: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-100", label: "Completed" },
      FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-100", label: "Failed" },
      CANCELLED: { icon: AlertTriangle, color: "text-gray-500", bg: "bg-gray-100", label: "Cancelled" },
      TIMEOUT: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-100", label: "Timeout" },
    };
    return configs[status as keyof typeof configs] || configs.PENDING;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Training job not found</h3>
          <p className="text-gray-600 mb-6">The training job you're looking for doesn't exist or has been deleted.</p>
          <Link
            href="/workspace/training-jobs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Training Jobs
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;
  const isActive = ["PROCESSING", "INITIALIZING", "SAMPLING", "SAVING"].includes(job.status);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/workspace/training-jobs"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig.label}
              </span>
            </div>
            {job.description && (
              <p className="text-gray-600">{job.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-Time Progress Overview */}
      {isActive && metrics && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Training Progress
            </h2>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {job.progress || 0}%
              </div>
              <div className="text-sm text-gray-600">Complete</div>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Step {metrics.currentStep} of {metrics.totalSteps}</span>
              <span>{metrics.currentPhase}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${job.progress || 0}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Live Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/60 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-gray-900">{formatDuration(metrics.timeElapsed)}</div>
              <div className="text-sm text-gray-600">Elapsed</div>
            </div>
            <div className="bg-white/60 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-gray-900">{formatDuration(metrics.estimatedTimeRemaining)}</div>
              <div className="text-sm text-gray-600">Remaining</div>
            </div>
            <div className="bg-white/60 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-gray-900">{metrics.loss.toFixed(4)}</div>
              <div className="text-sm text-gray-600">Loss</div>
            </div>
            <div className="bg-white/60 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-gray-900">{metrics.learningRate.toExponential(2)}</div>
              <div className="text-sm text-gray-600">Learn Rate</div>
            </div>
          </div>

          {/* System Status */}
          <div className="mt-6 pt-6 border-t border-blue-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">System Status</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span>GPU</span>
                </div>
                <span className="font-medium">{metrics.gpuUtilization?.toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-green-600" />
                  <span>Memory</span>
                </div>
                <span className="font-medium">{formatBytes(metrics.memoryUsage || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-orange-600" />
                  <span>Temp</span>
                </div>
                <span className="font-medium">{metrics.temperature?.toFixed(0)}°C</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Logs Section */}
      {isActive && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Live Training Logs
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
              <button
                onClick={() => setLogs([])}
                className="text-sm text-gray-500 hover:text-gray-700 ml-4"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Waiting for training logs...
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className={`flex items-start gap-3 ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warning' ? 'text-yellow-400' :
                    log.level === 'info' ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    <span className="text-gray-500 text-xs mt-0.5 w-16 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sample Gallery */}
      {isActive && samples.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-600" />
            Generated Samples ({samples.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {samples.map((sample) => (
              <div key={sample.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                <img
                  src={sample.imageUrl}
                  alt={`Sample at step ${sample.step}`}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-700">Step {sample.step}</div>
                  <div className="text-xs text-gray-500">{new Date(sample.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Basic Job Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Job Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Created</div>
            <div className="font-medium">{new Date(job.createdAt).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Started</div>
            <div className="font-medium">{job.startedAt ? new Date(job.startedAt).toLocaleString() : 'Not started'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">RunPod Job ID</div>
            <div className="font-medium font-mono text-sm">{job.runpodJobId || 'Not assigned'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Training Images</div>
            <div className="font-medium">{job.trainingImages?.length || 0}</div>
          </div>
        </div>

        {/* Training Configuration */}
        {job.trainingConfig && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Training Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Steps</span>
                <span className="font-medium">{(job.trainingConfig as any)?.train?.steps || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Learning Rate</span>
                <span className="font-medium">{(job.trainingConfig as any)?.train?.lr || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Batch Size</span>
                <span className="font-medium">{(job.trainingConfig as any)?.train?.batch_size || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Network Rank</span>
                <span className="font-medium">{(job.trainingConfig as any)?.network?.linear || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3">
            {isActive && (
              <button
                onClick={() => cancelJobMutation.mutate({ jobId })}
                disabled={cancelJobMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Square className="w-4 h-4" />
                Cancel Training
              </button>
            )}
            {isActive && (
              <button
                onClick={() => syncJobMutation.mutate({ jobId })}
                disabled={syncJobMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Status
              </button>
            )}
            {job.status === "COMPLETED" && (
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                Download Model
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Training Images Preview */}
      {job.trainingImages && job.trainingImages.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Training Images ({job.trainingImages.length})</h3>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {job.trainingImages.slice(0, 8).map((image, index) => (
              <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden group hover:scale-105 transition-transform">
                <img
                  src={image.storageUrl}
                  alt={`Training image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {job.trainingImages.length > 8 && (
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-500 border border-dashed border-gray-300">
                +{job.trainingImages.length - 8}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Coming Soon Features */}
      {!isActive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Advanced Metrics Dashboard</h3>
            </div>
            <p className="text-gray-600 mb-4">Comprehensive training analytics with loss curves, learning rate schedules, and performance insights</p>
            <div className="bg-white/60 rounded p-4">
              <div className="h-32 bg-gradient-to-r from-blue-200 to-indigo-300 rounded flex items-center justify-center">
                <span className="text-blue-700 font-medium">Training Metrics Visualization</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Performance Analytics</h3>
            </div>
            <p className="text-gray-600 mb-4">Historical training data, comparison tools, and optimization suggestions</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Training Efficiency</span>
                <span className="text-purple-600 font-medium">94%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: "94%" }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}