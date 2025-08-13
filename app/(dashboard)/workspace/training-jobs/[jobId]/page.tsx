'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import { 
  ArrowLeft,
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Download,
  RefreshCw,
  BarChart3,
  Calendar,
  Cpu,
  Eye,
  Image as ImageIcon,
  FileText,
  Settings,
  Zap,
  ExternalLink,
  Copy,
  Play
} from 'lucide-react';

const statusConfig = {
  PENDING: { 
    icon: Clock, 
    color: 'text-gray-500', 
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    label: 'Pending' 
  },
  QUEUED: { 
    icon: Clock, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Queued' 
  },
  INITIALIZING: { 
    icon: RefreshCw, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Initializing' 
  },
  PROCESSING: { 
    icon: Cpu, 
    color: 'text-yellow-500', 
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Training' 
  },
  SAMPLING: { 
    icon: RefreshCw, 
    color: 'text-purple-500', 
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'Sampling' 
  },
  SAVING: { 
    icon: Download, 
    color: 'text-indigo-500', 
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    label: 'Saving' 
  },
  COMPLETED: { 
    icon: CheckCircle, 
    color: 'text-green-500', 
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Completed' 
  },
  FAILED: { 
    icon: XCircle, 
    color: 'text-red-500', 
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Failed' 
  },
  CANCELLED: { 
    icon: AlertCircle, 
    color: 'text-gray-500', 
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    label: 'Cancelled' 
  },
  TIMEOUT: { 
    icon: AlertCircle, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Timeout' 
  }
} as const;

export default function TrainingJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [selectedTab, setSelectedTab] = useState<'overview' | 'config' | 'images' | 'samples' | 'logs'>('overview');

  const { data: job, isLoading, error, refetch } = trpc.getTrainingJob.useQuery({ jobId });
  
  const cancelJobMutation = trpc.cancelTrainingJob.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  const syncJobMutation = trpc.syncRunPodJob.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-600 dark:text-gray-400">Loading training job...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Training Job Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The training job you're looking for doesn't exist or you don't have access to it.
          </p>
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

  const config = statusConfig[job.status as keyof typeof statusConfig];
  const StatusIcon = config.icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startDate?: string, endDate?: string) => {
    if (!startDate) return 'Not started';
    
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/workspace/training-jobs"
            className="mt-1 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {job.name}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
                <StatusIcon className="w-4 h-4" />
                {config.label}
              </span>
            </div>
            {job.description && (
              <p className="text-gray-600 dark:text-gray-400">
                {job.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {job.runpodJobId && ['PROCESSING', 'QUEUED', 'INITIALIZING', 'SAMPLING', 'SAVING'].includes(job.status) && (
            <button
              onClick={() => syncJobMutation.mutate({ jobId })}
              disabled={syncJobMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${syncJobMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Status
            </button>
          )}

          {['PENDING', 'QUEUED', 'INITIALIZING', 'PROCESSING', 'SAMPLING', 'SAVING'].includes(job.status) && (
            <button
              onClick={() => cancelJobMutation.mutate({ jobId })}
              disabled={cancelJobMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <XCircle className="w-4 h-4" />
              Cancel Training
            </button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      {job.status === 'PROCESSING' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Training Progress</h3>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {job.progress || 0}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {job.currentStep && job.totalSteps && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Step</span>
                <p className="font-medium">{job.currentStep} / {job.totalSteps}</p>
              </div>
            )}
            
            {job.loss && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Loss</span>
                <p className="font-medium">{job.loss.toFixed(4)}</p>
              </div>
            )}

            {job.learningRate && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Learning Rate</span>
                <p className="font-medium">{job.learningRate}</p>
              </div>
            )}

            {job.eta && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">ETA</span>
                <p className="font-medium">{job.eta}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Card */}
      {job.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800 dark:text-red-200">Training Error</h3>
              <p className="text-red-700 dark:text-red-300 mt-1">{job.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'config', 'images', 'samples', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                selectedTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {selectedTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Job Information */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>
                  <span>{formatDate(job.createdAt)}</span>
                </div>
                {job.startedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Started:</span>
                    <span>{formatDate(job.startedAt)}</span>
                  </div>
                )}
                {job.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Completed:</span>
                    <span>{formatDate(job.completedAt)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                  <span>{formatDuration(job.startedAt || undefined, job.completedAt || undefined)}</span>
                </div>
                {job.runpodJobId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">RunPod Job ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {job.runpodJobId.substring(0, 8)}...
                      </span>
                      <button
                        onClick={() => copyToClipboard(job.runpodJobId!)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Training Images */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Training Dataset</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Images:</span>
                  <span>{job.trainingImages?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">With Captions:</span>
                  <span>{job.trainingImages?.filter(img => img.caption).length || 0}</span>
                </div>
                {job.trainingImages && job.trainingImages.length > 0 && (
                  <div className="mt-4">
                    <div className="grid grid-cols-4 gap-2">
                      {job.trainingImages.slice(0, 4).map((image, index) => (
                        <div key={index} className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                          <img
                            src={image.storageUrl}
                            alt={`Training image ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/placeholder-image.jpg'; // Add a placeholder image
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {job.trainingImages.length > 4 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        +{job.trainingImages.length - 4} more images
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'config' && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Training Configuration</h3>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(job.trainingConfig, null, 2)}
            </pre>
          </div>
        )}

        {selectedTab === 'images' && (
          <div className="space-y-6">
            {job.trainingImages && job.trainingImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {job.trainingImages.map((image, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden mb-3">
                      <img
                        src={image.storageUrl}
                        alt={`Training image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {image.filename}
                      </p>
                      {image.caption && (
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                          {image.caption}
                        </p>
                      )}
                      {image.fileSize && (
                        <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
                          {(image.fileSize / 1024).toFixed(1)}KB
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No training images found</p>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'samples' && (
          <div className="space-y-6">
            {job.sampleUrls && job.sampleUrls.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {job.sampleUrls.map((url, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <img
                      src={url}
                      alt={`Sample ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg mb-3"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Sample {index + 1}
                      </span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {job.status === 'COMPLETED' ? 'No sample images generated' : 'Sample images will appear here during training'}
                </p>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'logs' && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Training Logs</h3>
              {job.logUrl && (
                <a
                  href={job.logUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                >
                  View Full Logs
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            
            {job.logUrl ? (
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                <p>Training logs are available at the link above.</p>
                <p className="text-gray-400 mt-2">Real-time log streaming coming soon...</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Training logs not available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Download Section */}
      {job.status === 'COMPLETED' && (job.finalModelUrl || job.checkpointUrls.length > 0) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Download Results</h3>
          <div className="space-y-3">
            {job.finalModelUrl && (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Final LoRA Model</p>
                    <p className="text-sm text-green-600 dark:text-green-400">Ready to use in your generations</p>
                  </div>
                </div>
                <a
                  href={job.finalModelUrl}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            )}

            {job.checkpointUrls.map((url, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">Checkpoint {index + 1}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Intermediate training state</p>
                  </div>
                </div>
                <a
                  href={url}
                  className="flex items-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
