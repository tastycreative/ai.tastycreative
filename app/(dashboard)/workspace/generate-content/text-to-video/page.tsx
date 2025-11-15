"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useApiClient } from "@/lib/apiClient";
import { Wand2, Upload, X, Download, Share2, Sparkles, Video, AlertCircle, Loader2, Clock, CheckCircle, RefreshCw, FileVideo, FolderOpen, Layers, Gauge, Zap } from "lucide-react";

interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  resultUrls?: string[];
  createdAt: Date;
  params?: any;
}

interface DatabaseVideo {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  format?: string;
  url?: string | null;
  awsS3Url?: string | null;
  awsS3Key?: string | null;
  s3Key?: string | null;
  networkVolumePath?: string | null;
  createdAt: Date | string;
}

interface AvailableFolderOption {
  name: string;
  prefix: string;
  displayPath: string;
  path: string;
  depth: number;
  isShared?: boolean;
  permission?: 'VIEW' | 'EDIT';
  parentPrefix?: string | null;
}

interface LoRAModel {
  fileName: string;
  displayName: string;
  name: string;
}

const sanitizePrefix = (prefix: string): string => {
  if (!prefix) return '';
  const normalized = prefix.replace(/\\/g, '/').replace(/\/+/g, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const formatSegmentName = (segment: string): string => {
  if (!segment) return '';
  return segment
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const deriveFolderMeta = (prefix: string) => {
  const sanitized = sanitizePrefix(prefix);
  const parts = sanitized.split('/').filter(Boolean);
  const relativeSegments = parts.slice(2);
  const displaySegments = relativeSegments.map(formatSegmentName);
  const depth = Math.max(relativeSegments.length, 1);
  const parentPrefix = relativeSegments.length <= 1 ? null : `${parts.slice(0, -1).join('/')}/`;
  return {
    sanitized,
    relativeSegments,
    displaySegments,
    depth,
    parentPrefix,
    path: relativeSegments.join('/'),
  };
};

const buildFolderOptionLabel = (folder: AvailableFolderOption): string => {
  const indent = folder.depth > 1 ? `${'\u00A0'.repeat((folder.depth - 1) * 2)}↳ ` : '';
  const icon = folder.isShared ? '🤝' : '📁';
  return `${icon} ${indent}${folder.displayPath}`;
};

const PROGRESS_STAGES: Array<{ key: 'queued' | 'processing' | 'saving'; label: string; description: string }> = [
  { key: 'queued', label: 'Queued', description: 'Job received and preparing workflow' },
  { key: 'processing', label: 'Processing', description: 'AI generating video from text' },
  { key: 'saving', label: 'Saving', description: 'Uploading result to your library' }
];

const formatDuration = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
};

export default function TextToVideoPage() {
  const { user } = useUser();
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走,');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [resultVideos, setResultVideos] = useState<string[]>([]);
  const [jobVideos, setJobVideos] = useState<Record<string, DatabaseVideo[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>('');
  const [jobStartTime, setJobStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastJobDuration, setLastJobDuration] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [availableFolders, setAvailableFolders] = useState<AvailableFolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const apiClient = useApiClient();

  // LoRA selection
  const [availableLoRAs, setAvailableLoRAs] = useState<LoRAModel[]>([]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(false);
  const [customHighNoiseLoraList, setCustomHighNoiseLoraList] = useState<Array<{id: number; fileName: string; strength: number}>>([{id: 1, fileName: '', strength: 1.0}]);
  const [customLowNoiseLoraList, setCustomLowNoiseLoraList] = useState<Array<{id: number; fileName: string; strength: number}>>([{id: 1, fileName: '', strength: 1.0}]);
  const [nextLoraId, setNextLoraId] = useState(2);
  const [presetMode, setPresetMode] = useState<string>('');

  // Video parameters
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(640);
  const [videoLength, setVideoLength] = useState(81);
  
  // High Noise Sampler parameters (steps 0-2)
  const [highNoiseSteps, setHighNoiseSteps] = useState(4);
  const [highNoiseCfg, setHighNoiseCfg] = useState(1);
  const [highNoiseSeed, setHighNoiseSeed] = useState(Math.floor(Math.random() * 1000000000000));
  const [highNoiseStartStep, setHighNoiseStartStep] = useState(0);
  const [highNoiseEndStep, setHighNoiseEndStep] = useState(2);
  
  // Low Noise Sampler parameters (steps 2-4)
  const [lowNoiseSteps, setLowNoiseSteps] = useState(4);
  const [lowNoiseCfg, setLowNoiseCfg] = useState(1);
  const [lowNoiseStartStep, setLowNoiseStartStep] = useState(2);
  const [lowNoiseEndStep, setLowNoiseEndStep] = useState(4);

  // Fixed values from workflow
  const FIXED_VALUES = {
    vaeModel: 'wan_2.1_vae.safetensors',
    highNoiseModel: 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors',
    lowNoiseModel: 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors',
    clipModel: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
    highNoiseLora: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors',
    lowNoiseLora: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors',
    deepthroatHighNoiseLora: 'jfj-deepthroat-W22-T2V-HN-v1.safetensors',
    deepthroatLowNoiseLora: 'jfj-deepthroat-W22-T2V-LN-v1.safetensors',
    dildoHighNoiseLora: 'dildo fucking machine\\Wan2.2 - T2V - Fucking Machine - HIGH 14B.safetensors',
    dildoLowNoiseLora: 'dildo fucking machine\\Wan2.2 - T2V - Fucking Machine - LOW 14B.safetensors',
    handjobHighNoiseLora: 'handjob\\Wan2.2 - T2V - POV Hand Job - HIGH 14B.safetensors',
    handjobLowNoiseLora: 'handjob\\Wan2.2 - T2V - POV Hand Job - LOW 14B.safetensors',
    missionaryHighNoiseLora: 'pov missionary\\wan2.2_t2v_highnoise_pov_missionary_v1.0.safetensors',
    missionaryLowNoiseLora: 'pov missionary\\wan2.2_t2v_lownoise_pov_missionary_v1.0.safetensors',
    sampler: 'euler',
    scheduler: 'simple',
    shift: 8,
    fps: 16,
    batchSize: 1
  };

  // Load available folders
  const loadFolders = useCallback(async () => {
    if (!apiClient || !user) return;

    setIsLoadingFolders(true);
    try {
      const userId = user.id;
      const response = await apiClient.get('/api/s3/folders/list-custom');
      
      if (!response.ok) {
        throw new Error('Failed to load folders');
      }

      const data = await response.json();
      
      if (!data.success || !Array.isArray(data.folders)) {
        throw new Error('Invalid folder data received');
      }

      const foldersRaw: any[] = data.folders;

      const mappedOptions = foldersRaw
        .map((folder) => {
          const prefix = folder.prefix;
          if (!prefix || typeof prefix !== 'string') {
            return null;
          }

          const meta = deriveFolderMeta(prefix);
          const displayPath = meta.displaySegments.join(' / ') || folder.name || 'Untitled';

          const option: AvailableFolderOption = {
            name: folder.name || displayPath,
            prefix: meta.sanitized,
            displayPath,
            path: meta.path,
            depth: meta.depth,
            isShared: folder.isShared || false,
            permission: folder.permission || 'EDIT',
            parentPrefix: meta.parentPrefix,
          };

          return option;
        })
        .filter((option): option is AvailableFolderOption => {
          if (!option) return false;
          // Only show folders with EDIT permission (exclude VIEW-only shared folders)
          if (option.isShared && option.permission === 'VIEW') return false;
          return true;
        });

      const dedupedMap = new Map<string, AvailableFolderOption>();
      mappedOptions.forEach((option) => {
        dedupedMap.set(option.prefix, option);
      });

      const deduped = Array.from(dedupedMap.values()).sort((a, b) => a.displayPath.localeCompare(b.displayPath));

      setAvailableFolders(deduped);

      // Auto-select default folder
      const defaultFolder = deduped.find(
        (f) => f.prefix === `generated-content/${userId}/text-to-video/`
      );
      if (defaultFolder && !targetFolder) {
        setTargetFolder(defaultFolder.prefix);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [apiClient, user, targetFolder]);

  const selectedFolderOption = useMemo(
    () => availableFolders.find((folder) => folder.prefix === targetFolder),
    [availableFolders, targetFolder]
  );

  // Load available LoRAs
  const loadLoRAs = useCallback(async () => {
    if (!apiClient) return;

    setLoadingLoRAs(true);
    try {
      const response = await apiClient.get('/api/user/influencers');
      
      if (!response.ok) {
        throw new Error('Failed to load LoRAs');
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        const loraModels: LoRAModel[] = data.map((inf: any) => ({
          fileName: inf.fileName,
          displayName: inf.isShared 
            ? `${inf.displayName} (Shared by ${inf.sharedBy})` 
            : inf.displayName,
          name: inf.name,
        }));
        
        setAvailableLoRAs(loraModels);
      }
    } catch (error) {
      console.error('Failed to load LoRAs:', error);
    } finally {
      setLoadingLoRAs(false);
    }
  }, [apiClient]);

  // Load folders and LoRAs on mount
  useEffect(() => {
    if (apiClient && user) {
      loadFolders();
      loadLoRAs();
    }
  }, [apiClient, user, loadFolders, loadLoRAs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxVideo) {
        setLightboxVideo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxVideo]);

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
    const status = currentJob.status.toUpperCase();
    if (status === 'PENDING') return 0;
    if (status === 'PROCESSING') return 1;
    if (status === 'COMPLETED') return 2;
    return -1;
  }, [currentJob]);

  const formattedElapsed = useMemo(() => {
    return formatDuration(elapsedSeconds * 1000);
  }, [elapsedSeconds]);

  const fetchJobVideos = useCallback(async (jobId: string): Promise<DatabaseVideo[] | null> => {
    if (!apiClient) return null;
    
    try {
      const response = await apiClient.get(`/api/jobs/${jobId}/videos`);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      if (data.success && data.videos) {
        return data.videos;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch job videos:', error);
      return null;
    }
  }, [apiClient]);

  const downloadDatabaseVideo = async (video: DatabaseVideo) => {
    try {
      const videoUrl = video.awsS3Url || video.url;
      if (!videoUrl) {
        alert('Video URL not available');
        return;
      }

      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = video.filename || 'video.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download video:', error);
      alert('Failed to download video');
    }
  };

  const shareVideo = (video: DatabaseVideo) => {
    const videoUrl = video.awsS3Url || video.url;
    if (videoUrl && navigator.share) {
      navigator.share({ url: videoUrl }).catch(console.error);
    } else if (videoUrl) {
      navigator.clipboard.writeText(videoUrl);
      alert('Video URL copied to clipboard!');
    }
  };

  const createWorkflowForTextToVideo = useCallback(() => {
    const workflow: any = {
      "71": {
        "inputs": {
          "clip_name": FIXED_VALUES.clipModel,
          "type": "wan"
        },
        "class_type": "CLIPLoader"
      },
      "72": {
        "inputs": {
          "text": negativePrompt,
          "clip": ["71", 0]
        },
        "class_type": "CLIPTextEncode"
      },
      "73": {
        "inputs": {
          "vae_name": FIXED_VALUES.vaeModel
        },
        "class_type": "VAELoader"
      },
      "74": {
        "inputs": {
          "width": width,
          "height": height,
          "length": videoLength,
          "batch_size": FIXED_VALUES.batchSize
        },
        "class_type": "EmptyHunyuanLatentVideo"
      },
      "75": {
        "inputs": {
          "unet_name": FIXED_VALUES.highNoiseModel,
          "weight_dtype": "default"
        },
        "class_type": "UNETLoader"
      },
      "76": {
        "inputs": {
          "unet_name": FIXED_VALUES.lowNoiseModel,
          "weight_dtype": "default"
        },
        "class_type": "UNETLoader"
      },
      "78": {
        "inputs": {
          "model": ["86", 0],
          "add_noise": "disable",
          "noise_seed": 0,
          "steps": lowNoiseSteps,
          "cfg": lowNoiseCfg,
          "sampler_name": FIXED_VALUES.sampler,
          "scheduler": FIXED_VALUES.scheduler,
          "positive": ["89", 0],
          "negative": ["72", 0],
          "latent_image": ["81", 0],
          "start_at_step": lowNoiseStartStep,
          "end_at_step": lowNoiseEndStep,
          "return_with_leftover_noise": "disable"
        },
        "class_type": "KSamplerAdvanced"
      },
      "80": {
        "inputs": {
          "filename_prefix": targetFolder 
            ? `${targetFolder}video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_` 
            : `video/video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_`,
          "format": "auto",
          "codec": "auto",
          "video": ["88", 0]
        },
        "class_type": "SaveVideo"
      },
      "81": {
        "inputs": {
          "model": ["82", 0],
          "add_noise": "enable",
          "noise_seed": highNoiseSeed,
          "steps": highNoiseSteps,
          "cfg": highNoiseCfg,
          "sampler_name": FIXED_VALUES.sampler,
          "scheduler": FIXED_VALUES.scheduler,
          "positive": ["89", 0],
          "negative": ["72", 0],
          "latent_image": ["74", 0],
          "start_at_step": highNoiseStartStep,
          "end_at_step": highNoiseEndStep,
          "return_with_leftover_noise": "enable"
        },
        "class_type": "KSamplerAdvanced"
      },
      "82": {
        "inputs": {
          "shift": FIXED_VALUES.shift,
          "model": customHighNoiseLoraList.some(l => l.fileName) ? ["114", 0] : (presetMode && presetMode !== 'custom' ? ["116", 0] : ["83", 0])
        },
        "class_type": "ModelSamplingSD3"
      },
      "83": {
        "inputs": {
          "model": ["75", 0],
          "lora_name": FIXED_VALUES.highNoiseLora,
          "strength_model": 1
        },
        "class_type": "LoraLoaderModelOnly"
      },
      "85": {
        "inputs": {
          "model": ["76", 0],
          "lora_name": FIXED_VALUES.lowNoiseLora,
          "strength_model": 1
        },
        "class_type": "LoraLoaderModelOnly"
      },
      "86": {
        "inputs": {
          "shift": FIXED_VALUES.shift,
          "model": customLowNoiseLoraList.some(l => l.fileName) ? ["115", 0] : (presetMode && presetMode !== 'custom' ? ["117", 0] : ["85", 0])
        },
        "class_type": "ModelSamplingSD3"
      },
      "87": {
        "inputs": {
          "samples": ["78", 0],
          "vae": ["73", 0]
        },
        "class_type": "VAEDecode"
      },
      "88": {
        "inputs": {
          "fps": FIXED_VALUES.fps,
          "images": ["87", 0]
        },
        "class_type": "CreateVideo"
      },
      "89": {
        "inputs": {
          "text": prompt,
          "clip": ["71", 0]
        },
        "class_type": "CLIPTextEncode"
      }
    };

    // Add preset LoRA nodes if a preset mode is selected (except custom mode)
    if (presetMode && presetMode !== 'custom') {
      let presetHighNoiseLora, presetLowNoiseLora;
      
      if (presetMode === 'deepthroat') {
        presetHighNoiseLora = FIXED_VALUES.deepthroatHighNoiseLora;
        presetLowNoiseLora = FIXED_VALUES.deepthroatLowNoiseLora;
      } else if (presetMode === 'dildo') {
        presetHighNoiseLora = FIXED_VALUES.dildoHighNoiseLora;
        presetLowNoiseLora = FIXED_VALUES.dildoLowNoiseLora;
      } else if (presetMode === 'handjob') {
        presetHighNoiseLora = FIXED_VALUES.handjobHighNoiseLora;
        presetLowNoiseLora = FIXED_VALUES.handjobLowNoiseLora;
      } else if (presetMode === 'missionary') {
        presetHighNoiseLora = FIXED_VALUES.missionaryHighNoiseLora;
        presetLowNoiseLora = FIXED_VALUES.missionaryLowNoiseLora;
      }

      // Node 116: Preset High Noise LoRA (stacks on 4-step LoRA)
      workflow["116"] = {
        "inputs": {
          "model": ["83", 0],
          "lora_name": presetHighNoiseLora,
          "strength_model": 1
        },
        "class_type": "LoraLoaderModelOnly"
      };
      
      // Node 117: Preset Low Noise LoRA (stacks on 4-step LoRA)
      workflow["117"] = {
        "inputs": {
          "model": ["85", 0],
          "lora_name": presetLowNoiseLora,
          "strength_model": 1
        },
        "class_type": "LoraLoaderModelOnly"
      };
    }

    // Add custom LoRA nodes if selected (stacks on top of preset or 4-step LoRA)
    // Chain multiple custom LoRAs together
    const highNoiseLorasWithFiles = customHighNoiseLoraList.filter(l => l.fileName);
    const lowNoiseLorasWithFiles = customLowNoiseLoraList.filter(l => l.fileName);

    if (highNoiseLorasWithFiles.length > 0) {
      highNoiseLorasWithFiles.forEach((lora, index) => {
        const nodeId = 114 + index;
        const prevNodeId = index === 0 
          ? (presetMode && presetMode !== 'custom' ? "116" : "83")
          : (114 + index - 1).toString();
        
        workflow[nodeId.toString()] = {
          "inputs": {
            "model": [prevNodeId, 0],
            "lora_name": lora.fileName,
            "strength_model": lora.strength
          },
          "class_type": "LoraLoaderModelOnly"
        };
      });
    }

    if (lowNoiseLorasWithFiles.length > 0) {
      lowNoiseLorasWithFiles.forEach((lora, index) => {
        const nodeId = 115 + index * 2;
        const prevNodeId = index === 0 
          ? (presetMode && presetMode !== 'custom' ? "117" : "85")
          : (115 + (index - 1) * 2).toString();
        
        workflow[nodeId.toString()] = {
          "inputs": {
            "model": [prevNodeId, 0],
            "lora_name": lora.fileName,
            "strength_model": lora.strength
          },
          "class_type": "LoraLoaderModelOnly"
        };
      });
    }

    return workflow;
  }, [prompt, negativePrompt, targetFolder, width, height, videoLength, highNoiseSteps, highNoiseCfg, highNoiseSeed, highNoiseStartStep, highNoiseEndStep, lowNoiseSteps, lowNoiseCfg, lowNoiseStartStep, lowNoiseEndStep, FIXED_VALUES, presetMode, customHighNoiseLoraList, customLowNoiseLoraList]);

  const handleGenerate = useCallback(async () => {
    if (!user || !prompt.trim() || !apiClient) {
      setError('Please enter a prompt');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setJobStartTime(Date.now());
      setElapsedSeconds(0);
      
      // Generate random seed for each generation
      const randomSeed = Math.floor(Math.random() * 1000000000000);
      setHighNoiseSeed(randomSeed);

      const workflow = createWorkflowForTextToVideo();

      const response = await apiClient.post('/api/generation/text-to-video', {
        workflow,
        userId: user.id,
        params: {
          prompt,
          negativePrompt,
          width,
          height,
          videoLength,
          highNoiseSteps,
          highNoiseCfg,
          highNoiseSeed: randomSeed,
          highNoiseStartStep,
          highNoiseEndStep,
          lowNoiseSteps,
          lowNoiseCfg,
          lowNoiseStartStep,
          lowNoiseEndStep,
          presetMode,
          targetFolder
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const data = await response.json();

      if (data.success && data.jobId) {
        setCurrentJob({
          id: data.jobId,
          status: 'PENDING',
          progress: 0,
          createdAt: new Date()
        });
      } else {
        throw new Error(data.error || 'Failed to start generation');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      setError(error.message || 'Failed to generate video');
      setIsProcessing(false);
      setJobStartTime(null);
    }
  }, [user, prompt, negativePrompt, width, height, videoLength, highNoiseSteps, highNoiseCfg, highNoiseSeed, highNoiseStartStep, highNoiseEndStep, lowNoiseSteps, lowNoiseCfg, lowNoiseStartStep, lowNoiseEndStep, presetMode, targetFolder, createWorkflowForTextToVideo, apiClient]);

  // Poll for job updates
  useEffect(() => {
    if (!currentJob?.id || !apiClient) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await apiClient.get(`/api/jobs/${currentJob.id}`);
        
        if (!response.ok) {
          return;
        }
        
        const jobData = await response.json();
        console.log('📊 Job status update:', jobData);

        if (jobData) {
          setCurrentJob(jobData);

          if (jobData.status === 'COMPLETED' || jobData.status === 'completed') {
            console.log('✅ Job completed! Fetching videos...');
            clearInterval(pollInterval);
            setIsProcessing(false);
            if (jobStartTime) {
              const duration = Date.now() - jobStartTime;
              setLastJobDuration(formatDuration(duration));
              setJobStartTime(null);
            }

            const videos = await fetchJobVideos(currentJob.id);
            console.log('🎬 Fetched videos:', videos);
            if (videos && videos.length > 0) {
              setJobVideos(prev => ({ ...prev, [currentJob.id]: videos }));
              setResultVideos(videos.map(v => v.awsS3Url || v.url || '').filter(Boolean));
              console.log('✅ Videos set in state:', videos.length);
            } else {
              console.warn('⚠️ No videos returned from API');
            }
          } else if (jobData.status === 'FAILED' || jobData.status === 'failed') {
            clearInterval(pollInterval);
            setIsProcessing(false);
            setError(jobData.error || 'Generation failed');
            setJobStartTime(null);
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [currentJob?.id, apiClient, jobStartTime, fetchJobVideos]);

  const generateRandomSeed = useCallback(() => {
    setHighNoiseSeed(Math.floor(Math.random() * 1000000000000));
  }, []);

  const resetForm = useCallback(() => {
    setPrompt('');
    setCurrentJob(null);
    setResultVideos([]);
    setError(null);
    setJobStartTime(null);
    setElapsedSeconds(0);
    setHighNoiseSeed(Math.floor(Math.random() * 1000000000000));
  }, []);

  const openLightbox = useCallback((videoUrl: string, title: string) => {
    setLightboxVideo(videoUrl);
    setLightboxTitle(title);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-2xl shadow-lg animate-pulse">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
              Text to Video Studio
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Generate stunning videos from text using Wan 2.2 models ⚡ Advanced AI with 4-step LoRA acceleration
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Folder Selection - Moved to top */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <FolderOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Save to Folder</h3>
              </div>
              <select
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                className="w-full px-4 py-3 border border-purple-300 dark:border-purple-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-300"
                disabled={isProcessing || isLoadingFolders}
              >
                <option value="">Select a folder...</option>
                {availableFolders.map((folder) => (
                  <option key={folder.prefix} value={folder.prefix}>
                    {buildFolderOptionLabel(folder)}
                  </option>
                ))}
              </select>
              {!targetFolder && (
                <div className="mt-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                    ⚠️ Please select a folder before generating
                  </p>
                </div>
              )}
            </div>

            {/* Preset Mode Dropdown */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Preset Mode</h3>
              </div>
              <select
                value={presetMode}
                onChange={(e) => setPresetMode(e.target.value)}
                className="w-full px-4 py-3 border border-purple-300 dark:border-purple-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-300"
                disabled={isProcessing}
              >
                <option value="">Select preset mode...</option>
                <option value="custom">Custom Mode</option>
                <option value="deepthroat">Deepthroat Mode</option>
                <option value="dildo">Dildo Fucking Machine Mode</option>
                <option value="handjob">Handjob Mode</option>
                <option value="missionary">Missionary Mode</option>
              </select>
              {presetMode && (
                <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                  <p className="text-xs text-purple-800 dark:text-purple-200 font-medium">
                    {presetMode === 'custom' 
                      ? '✨ Using only 4-step LoRAs. Add your custom LoRAs below.'
                      : `✨ Using ${presetMode === 'deepthroat' ? 'deepthroat' : presetMode === 'dildo' ? 'dildo fucking machine' : presetMode === 'handjob' ? 'handjob' : 'missionary'} LoRAs as base models. You can still add custom LoRAs on top.`}
                  </p>
                </div>
              )}
            </div>

            {/* Custom LoRA Selection */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Custom LoRA Models</h3>
                {loadingLoRAs && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Add your own LoRA models on top of the {presetMode && presetMode !== 'custom' ? `${presetMode} and ` : ''}fixed 4-step acceleration LoRAs. Select separate LoRAs for high noise and low noise stages.
              </p>
              <div className="space-y-6">
                {/* High Noise LoRA Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      🎨 High Noise LoRAs
                    </label>
                    <button
                      onClick={() => {
                        setCustomHighNoiseLoraList([...customHighNoiseLoraList, {id: nextLoraId, fileName: '', strength: 1.0}]);
                        setNextLoraId(nextLoraId + 1);
                      }}
                      className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-1"
                    disabled={isProcessing || loadingLoRAs}
                  >
                    <span>+</span> Add LoRA
                  </button>
                </div>
                <div className="space-y-2">
                    {customHighNoiseLoraList.map((lora, index) => (
                      <div key={lora.id} className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex-1">
                          <select
                            value={lora.fileName}
                            onChange={(e) => {
                              const newList = [...customHighNoiseLoraList];
                              newList[index].fileName = e.target.value;
                              setCustomHighNoiseLoraList(newList);
                            }}
                            className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-all"
                          disabled={isProcessing || loadingLoRAs}
                        >
                          <option value="">None</option>
                          {availableLoRAs.map((loraModel) => (
                            <option key={loraModel.fileName} value={loraModel.fileName}>
                              {loraModel.displayName}
                            </option>
                          ))}
                        </select>
                        {lora.fileName && (
                          <div className="mt-1">
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Strength: {lora.strength.toFixed(2)}
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="1.5"
                              step="0.05"
                              value={lora.strength}
                              onChange={(e) => {
                                const newList = [...customHighNoiseLoraList];
                                newList[index].strength = parseFloat(e.target.value);
                                setCustomHighNoiseLoraList(newList);
                              }}
                              className="w-full"
                              disabled={isProcessing}
                            />
                          </div>
                        )}
                        </div>
                        {customHighNoiseLoraList.length > 1 && (
                          <button
                            onClick={() => {
                              setCustomHighNoiseLoraList(customHighNoiseLoraList.filter(l => l.id !== lora.id));
                            }}
                            className="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
                            disabled={isProcessing}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Low Noise LoRA Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      🌊 Low Noise LoRAs
                    </label>
                    <button
                      onClick={() => {
                        setCustomLowNoiseLoraList([...customLowNoiseLoraList, {id: nextLoraId, fileName: '', strength: 1.0}]);
                        setNextLoraId(nextLoraId + 1);
                      }}
                      className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-1"
                      disabled={isProcessing || loadingLoRAs}
                    >
                      <span className="text-base">+</span> Add LoRA
                    </button>
                  </div>
                  <div className="space-y-3">
                    {customLowNoiseLoraList.map((lora, index) => (
                      <div key={lora.id} className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex-1">
                          <select
                            value={lora.fileName}
                            onChange={(e) => {
                              const newList = [...customLowNoiseLoraList];
                              newList[index].fileName = e.target.value;
                              setCustomLowNoiseLoraList(newList);
                            }}
                            className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                          disabled={isProcessing || loadingLoRAs}
                        >
                          <option value="">None</option>
                          {availableLoRAs.map((loraModel) => (
                            <option key={loraModel.fileName} value={loraModel.fileName}>
                              {loraModel.displayName}
                            </option>
                          ))}
                        </select>
                        {lora.fileName && (
                          <div className="mt-1">
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Strength: {lora.strength.toFixed(2)}
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="1.5"
                              step="0.05"
                              value={lora.strength}
                              onChange={(e) => {
                                const newList = [...customLowNoiseLoraList];
                                newList[index].strength = parseFloat(e.target.value);
                                setCustomLowNoiseLoraList(newList);
                              }}
                              className="w-full"
                              disabled={isProcessing}
                            />
                          </div>
                        )}
                        </div>
                        {customLowNoiseLoraList.length > 1 && (
                          <button
                            onClick={() => {
                              setCustomLowNoiseLoraList(customLowNoiseLoraList.filter(l => l.id !== lora.id));
                            }}
                            className="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
                            disabled={isProcessing}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Video Parameters */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Gauge className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Video Parameters</h3>
              </div>
              <div className="space-y-6">
                {/* Resolution */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">📏 Width</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(parseInt(e.target.value) || 640)}
                      className="w-full px-4 py-3 border border-purple-300 dark:border-purple-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-all"
                      disabled={isProcessing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">📏 Height</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value) || 640)}
                      className="w-full px-4 py-3 border border-purple-300 dark:border-purple-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-all"
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                {/* Video Length */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    🎬 Video Length: {videoLength} frames
                  </label>
                  <input
                    type="range"
                    min="49"
                    max="121"
                    step="8"
                    value={videoLength}
                    onChange={(e) => setVideoLength(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                    disabled={isProcessing}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    ~{(videoLength / FIXED_VALUES.fps).toFixed(1)} seconds @ {FIXED_VALUES.fps} FPS
                  </div>
                </div>

                {/* Two-column layout for High Noise and Low Noise samplers */}
                <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-gradient-to-r from-purple-200 to-pink-200 dark:from-purple-800 dark:to-pink-800">
                  {/* High Noise Sampler (Steps 0-2) */}
                  <div className="space-y-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                      <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300">High Noise Sampler</h4>
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-3">
                      ⚡ add_noise: enable | Steps 0 → 2
                    </div>
                  
                    {/* Step Range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Step</label>
                        <input
                          type="number"
                          value={highNoiseStartStep}
                          onChange={(e) => setHighNoiseStartStep(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                          disabled={isProcessing}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Step</label>
                        <input
                          type="number"
                          value={highNoiseEndStep}
                          onChange={(e) => setHighNoiseEndStep(parseInt(e.target.value) || 2)}
                          className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                  
                    {/* Steps */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        🔥 Steps: {highNoiseSteps}
                      </label>
                      <input
                        type="range"
                        min="4"
                        max="20"
                        value={highNoiseSteps}
                        onChange={(e) => setHighNoiseSteps(parseInt(e.target.value))}
                        className="w-full accent-purple-500"
                        disabled={isProcessing}
                      />
                    </div>

                    {/* CFG */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        🎯 CFG Scale: {highNoiseCfg}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="7"
                        step="0.5"
                        value={highNoiseCfg}
                        onChange={(e) => setHighNoiseCfg(parseFloat(e.target.value))}
                        className="w-full accent-purple-500"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>

                  {/* Low Noise Sampler (Steps 2-4) */}
                  <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse"></div>
                      <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300">Low Noise Sampler</h4>
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-3">
                      ⚡ add_noise: disable | Steps 2 → 4
                    </div>
                  
                    {/* Step Range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Step</label>
                        <input
                          type="number"
                          value={lowNoiseStartStep}
                          onChange={(e) => setLowNoiseStartStep(parseInt(e.target.value) || 2)}
                          className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          disabled={isProcessing}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Step</label>
                        <input
                          type="number"
                          value={lowNoiseEndStep}
                          onChange={(e) => setLowNoiseEndStep(parseInt(e.target.value) || 4)}
                          className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                  
                    {/* Steps */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        🔥 Steps: {lowNoiseSteps}
                      </label>
                      <input
                        type="range"
                        min="4"
                        max="20"
                        value={lowNoiseSteps}
                        onChange={(e) => setLowNoiseSteps(parseInt(e.target.value))}
                        className="w-full accent-blue-500"
                        disabled={isProcessing}
                      />
                    </div>

                    {/* CFG */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        🎯 CFG Scale: {lowNoiseCfg}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="7"
                        step="0.5"
                        value={lowNoiseCfg}
                        onChange={(e) => setLowNoiseCfg(parseFloat(e.target.value))}
                        className="w-full accent-blue-500"
                        disabled={isProcessing}
                      />
                    </div>

                    {/* Info note */}
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        💡 Seed continues from high noise (no noise added)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Wand2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Positive Prompt</h3>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                className="w-full px-4 py-3 border border-purple-300 dark:border-purple-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none transition-all"
                rows={4}
                disabled={isProcessing}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isProcessing || !prompt.trim() || !targetFolder}
              className="group w-full py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-lg rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Generating Video Magic...</span>
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </>
              ) : (
                <>
                  <Video className="w-6 h-6" />
                  <span>Generate Video</span>
                  <Zap className="w-5 h-5" />
                </>
              )}
            </button>
            
            {(!prompt.trim() || !targetFolder) && (
              <div className="text-center py-3 px-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                  ⚠️ {!prompt.trim() ? 'Please enter a prompt' : 'Please select a folder'} to generate
                </p>
              </div>
            )}

            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 animate-pulse" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}
          </div>

        {/* Right Column - Progress & Results */}
        <div className="space-y-6">
          {/* Progress Indicator */}
          {isProcessing && currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Processing</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{formattedElapsed}</span>
                </div>
              </div>

              {/* Progress Stages */}
              <div className="space-y-3">
                {PROGRESS_STAGES.map((stage, index) => {
                  const isActive = index === activeStageIndex;
                  const isCompleted = index < activeStageIndex;

                  return (
                    <div key={stage.key} className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-white text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {stage.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{stage.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results */}
          {resultVideos.length > 0 && currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generated Video</h3>
                {lastJobDuration && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Completed in {lastJobDuration}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {jobVideos[currentJob.id]?.map((video) => (
                  <div key={video.id} className="group relative">
                    <video
                      src={video.awsS3Url || video.url || ''}
                      className="w-full rounded-lg cursor-pointer"
                      controls
                      onClick={() => openLightbox(video.awsS3Url || video.url || '', video.filename)}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{video.filename}</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => downloadDatabaseVideo(video)}
                          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => shareVideo(video)}
                          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={resetForm}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-bold py-4 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Generate Another Video
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightboxVideo(null)}>
          <div className="relative max-w-7xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxVideo(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <video src={lightboxVideo} className="w-full h-full object-contain rounded-lg" controls autoPlay />
            {lightboxTitle && (
              <p className="text-white text-center mt-4 text-sm">{lightboxTitle}</p>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
