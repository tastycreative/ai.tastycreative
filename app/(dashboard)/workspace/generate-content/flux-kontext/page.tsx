"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { Upload, X, Download, Wand2, Loader2, Image as ImageIcon, AlertCircle, Share2, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { useApiClient } from '@/lib/apiClient';

interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  message?: string;
  resultUrls?: string[];
  createdAt: Date;
  params?: any;
}

interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

// Database image interface for fetching from database
interface DatabaseImage {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string | null;
  dataUrl?: string;
  awsS3Url?: string | null;
  awsS3Key?: string | null;
  s3Key?: string | null;
  networkVolumePath?: string | null;
  createdAt: Date | string;
}

const PROGRESS_STAGES: Array<{ key: 'queued' | 'processing' | 'saving'; label: string; description: string }> = [
  {
    key: 'queued',
    label: 'Queued',
    description: 'Job received and preparing workflow'
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'AI transforming images with Flux Kontext'
  },
  {
    key: 'saving',
    label: 'Saving',
    description: 'Uploading result to your library'
  }
];

const formatDuration = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
};

export default function FluxKontextPage() {
  const { user } = useUser();
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>('');
  const [jobStartTime, setJobStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastJobDuration, setLastJobDuration] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('Transform the scene into nighttime, adding a deep navy blue sky with stars. Illuminate the building with soft, aesthetic lighting, creating a warm glow from the windows and exterior lights.');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useApiClient();

  // Fixed values from workflow
  const FIXED_VALUES = {
    clipName1: 'clip_l.safetensors',
    clipName2: 't5xxl_fp16.safetensors',
    unetName: 'flux1-dev-kontext_fp8_scaled.safetensors',
    vaeName: 'ae.safetensors',
    guidance: 2.5,
    steps: 20,
    cfg: 1,
    sampler: 'euler',
    scheduler: 'simple',
    denoise: 1.0,
    seed: Math.floor(Math.random() * 1000000000000)
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, [selectedImages]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jobStartTime && currentJob?.status === 'PROCESSING') {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - jobStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobStartTime, currentJob]);

  const activeStageIndex = useMemo(() => {
    if (!currentJob) return -1;
    if (currentJob.status === 'PENDING') return 0;
    if (currentJob.status === 'PROCESSING') return 1;
    if (currentJob.status === 'COMPLETED') return 2;
    return -1;
  }, [currentJob]);

  const formattedElapsed = useMemo(() => {
    return formatDuration(elapsedSeconds * 1000);
  }, [elapsedSeconds]);

  const describeImageSource = useCallback((image: DatabaseImage) => {
    if (image.awsS3Url) return 'AWS S3';
    if (image.s3Key) return 'RunPod S3';
    if (image.networkVolumePath) return 'Network Volume';
    if (image.dataUrl) return 'Database';
    return 'Unknown';
  }, []);

  const fetchJobImages = useCallback(async (jobId: string): Promise<DatabaseImage[] | null> => {
    if (!apiClient) return null;
    
    try {
      const response = await apiClient.get(`/api/jobs/${jobId}/images`);
      
      if (!response.ok) {
        console.error('Failed to fetch job images:', response.statusText);
        return null;
      }

      const data = await response.json();
      return data.images || [];
    } catch (error) {
      console.error('Error fetching job images:', error);
      return null;
    }
  }, [apiClient]);

  const downloadDatabaseImage = async (image: DatabaseImage) => {
    try {
      let downloadUrl = image.awsS3Url || image.url;
      
      if (!downloadUrl && image.dataUrl) {
        downloadUrl = image.dataUrl;
      }
      
      if (!downloadUrl) {
        throw new Error('No download URL available');
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.filename || 'flux-kontext-result.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download image. Please try again.');
    }
  };

  const shareImage = (image: DatabaseImage) => {
    const shareUrl = image.awsS3Url || image.url || image.dataUrl;
    if (shareUrl && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Image URL copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy URL');
      });
    }
  };

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      processImageFile(files[0]);
    }
  }, []);

  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    const newImage: ImageFile = {
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substring(7)
    };

    setSelectedImages([newImage]); // Replace with single image
    setError(null);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processImageFile(files[0]);
    }
  }, [processImageFile]);

  const removeImage = useCallback(() => {
    setSelectedImages(prev => {
      prev.forEach(img => URL.revokeObjectURL(img.preview));
      return [];
    });
  }, []);

  const createWorkflowForFluxKontext = useCallback((
    imageBase64: string
  ) => {
    return {
      "37": {
        "inputs": {
          "unet_name": FIXED_VALUES.unetName,
          "weight_dtype": "default"
        },
        "class_type": "UNETLoader"
      },
      "38": {
        "inputs": {
          "clip_name1": FIXED_VALUES.clipName1,
          "clip_name2": FIXED_VALUES.clipName2,
          "type": "flux"
        },
        "class_type": "DualCLIPLoader"
      },
      "39": {
        "inputs": {
          "vae_name": FIXED_VALUES.vaeName
        },
        "class_type": "VAELoader"
      },
      "6": {
        "inputs": {
          "text": prompt,
          "clip": ["38", 0]
        },
        "class_type": "CLIPTextEncode"
      },
      "142": {
        "inputs": {
          "image": imageBase64,
          "upload": "image"
        },
        "class_type": "LoadImage"
      },
      "42": {
        "inputs": {
          "image": ["142", 0]
        },
        "class_type": "FluxKontextImageScale"
      },
      "124": {
        "inputs": {
          "pixels": ["42", 0],
          "vae": ["39", 0]
        },
        "class_type": "VAEEncode"
      },
      "177": {
        "inputs": {
          "conditioning": ["6", 0],
          "latent": ["124", 0]
        },
        "class_type": "ReferenceLatent"
      },
      "35": {
        "inputs": {
          "conditioning": ["177", 0],
          "guidance": FIXED_VALUES.guidance
        },
        "class_type": "FluxGuidance"
      },
      "135": {
        "inputs": {
          "conditioning": ["6", 0]
        },
        "class_type": "ConditioningZeroOut"
      },
      "31": {
        "inputs": {
          "seed": FIXED_VALUES.seed,
          "steps": FIXED_VALUES.steps,
          "cfg": FIXED_VALUES.cfg,
          "sampler_name": FIXED_VALUES.sampler,
          "scheduler": FIXED_VALUES.scheduler,
          "denoise": FIXED_VALUES.denoise,
          "model": ["37", 0],
          "positive": ["35", 0],
          "negative": ["135", 0],
          "latent_image": ["124", 0]
        },
        "class_type": "KSampler"
      },
      "8": {
        "inputs": {
          "samples": ["31", 0],
          "vae": ["39", 0]
        },
        "class_type": "VAEDecode"
      },
      "199": {
        "inputs": {
          "images": ["8", 0],
          "filename_prefix": "FluxKontext"
        },
        "class_type": "SaveImage"
      }
    };
  }, [prompt, FIXED_VALUES]);

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!user?.id) {
      setError('Please sign in to generate images');
      return;
    }

    if (!apiClient) {
      setError('API client not initialized');
      return;
    }

    const image = selectedImages[0];

    if (!image) {
      setError('Please upload an image to transform');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setJobStartTime(Date.now());
      setElapsedSeconds(0);

      const imageBase64 = await convertImageToBase64(image.file);

      const workflow = createWorkflowForFluxKontext(imageBase64);

      const response = await apiClient.post('/api/jobs/flux-kontext', {
        workflow,
        userId: user.id,
        prompt,
        params: FIXED_VALUES
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create job');
      }

      const job = await response.json();
      setCurrentJob(job);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start generation');
      setIsProcessing(false);
      setJobStartTime(null);
    }
  }, [user, selectedImages, createWorkflowForFluxKontext, prompt, FIXED_VALUES, apiClient]);

  // Poll for job updates
  useEffect(() => {
    if (!currentJob?.id || !apiClient) return;

    const pollJob = async () => {
      if (!apiClient) return;
      
      try {
        const response = await apiClient.get(`/api/jobs/${currentJob.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch job status');
        }

        const updatedJob = await response.json();
        setCurrentJob(updatedJob);

        if (updatedJob.status === 'COMPLETED') {
          setIsProcessing(false);
          if (jobStartTime) {
            const duration = Date.now() - jobStartTime;
            setLastJobDuration(formatDuration(duration));
          }
          setJobStartTime(null);

          const images = await fetchJobImages(updatedJob.id);
          if (images && images.length > 0) {
            setJobImages(prev => ({ ...prev, [updatedJob.id]: images }));
          }
        } else if (updatedJob.status === 'FAILED') {
          setIsProcessing(false);
          setError(updatedJob.error || 'Generation failed');
          setJobStartTime(null);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const interval = setInterval(pollJob, 2000);
    return () => clearInterval(interval);
  }, [currentJob?.id, apiClient, jobStartTime, fetchJobImages]);

  const generateRandomSeed = useCallback(() => {
    FIXED_VALUES.seed = Math.floor(Math.random() * 1000000000000);
  }, [FIXED_VALUES]);

  const resetForm = useCallback(() => {
    selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setSelectedImages([]);
    setCurrentJob(null);
    setResultImages([]);
    setError(null);
    setIsProcessing(false);
    setJobStartTime(null);
    setElapsedSeconds(0);
    generateRandomSeed();
  }, [selectedImages, generateRandomSeed]);

  const openLightbox = useCallback((imageUrl: string, title: string) => {
    setLightboxImage(imageUrl);
    setLightboxTitle(title);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Flux Kontext Image Editor
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Transform images with AI-powered scene modifications using Flux Kontext
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-6">
            {/* Image Upload Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Upload Image
              </h2>

              {/* Single Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Image
                </label>
                {selectedImages[0] ? (
                  <div className="relative">
                    <img
                      src={selectedImages[0].preview}
                      alt="Image preview"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <button
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Click or drag image here
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Prompt Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Transformation Prompt
              </h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                rows={6}
                placeholder="Describe how you want to transform the scene..."
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isProcessing || selectedImages.length === 0}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Transform Images
                </>
              )}
            </button>
          </div>

          {/* Right Panel - Progress & Results */}
          <div className="space-y-6">
            {/* Progress Section */}
            {isProcessing && currentJob && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Generation Progress
                </h2>
                
                <div className="space-y-4">
                  {PROGRESS_STAGES.map((stage, index) => {
                    const isActive = index === activeStageIndex;
                    const isComplete = index < activeStageIndex;
                    
                    return (
                      <div key={stage.key} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          isComplete ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                          {isComplete ? (
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-sm font-semibold text-white">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-semibold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                            {stage.label}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{stage.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {jobStartTime && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Elapsed Time:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formattedElapsed}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results Section */}
            {currentJob?.status === 'COMPLETED' && jobImages[currentJob.id] && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Result
                  </h2>
                  {lastJobDuration && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Completed in {lastJobDuration}
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {jobImages[currentJob.id].map((image) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.awsS3Url || image.url || image.dataUrl || ''}
                        alt={image.filename}
                        className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openLightbox(image.awsS3Url || image.url || image.dataUrl || '', image.filename)}
                      />
                      <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => downloadDatabaseImage(image)}
                          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Download className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        </button>
                        <button
                          onClick={() => shareImage(image)}
                          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Share2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={resetForm}
                  className="w-full mt-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Start New Generation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <img
              src={lightboxImage}
              alt={lightboxTitle}
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 bg-white dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
