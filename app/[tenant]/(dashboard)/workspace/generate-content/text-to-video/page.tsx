"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useApiClient } from "@/lib/apiClient";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { Wand2, X, Download, Share2, Sparkles, Video, AlertCircle, Loader2, Clock, CheckCircle, RefreshCw, Archive, Layers, Gauge, Zap, FolderOpen, ChevronDown, Check, Maximize2, Play, RotateCcw, History } from "lucide-react";

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

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  profileName?: string;
  isDefault?: boolean;
}

interface GeneratedVideoHistory {
  id: string;
  videoUrl: string;
  prompt: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  profileName?: string;
  metadata?: {
    negativePrompt?: string;
    width?: number;
    height?: number;
    videoLength?: number;
    highNoiseSteps?: number;
    highNoiseCfg?: number;
    highNoiseSeed?: number;
    lowNoiseSteps?: number;
    lowNoiseCfg?: number;
    presetMode?: string;
    customHighNoiseLoraList?: Array<{fileName: string; strength: number}>;
    customLowNoiseLoraList?: Array<{fileName: string; strength: number}>;
    profileId?: string | null;
  };
}

interface LoRAModel {
  fileName: string;
  displayName: string;
  name: string;
}

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
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;
  
  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();
  
  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  
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
  
  // Folder dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  
  // Vault Integration State - using global profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);
  
  // Generation history state
  const [generationHistory, setGenerationHistory] = useState<GeneratedVideoHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryVideo, setSelectedHistoryVideo] = useState<GeneratedVideoHistory | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  
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

  // Load vault folders for the selected profile
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !globalProfileId) return;
    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await fetch(`/api/vault/folders?profileId=${globalProfileId}`);
      if (foldersResponse.ok) {
        const data = await foldersResponse.json();
        const folders = Array.isArray(data) ? data : (data.folders || []);
        // Add profileName from response if available (for "all" profiles view)
        setVaultFolders(folders.map((f: any) => ({
          ...f,
          profileName: f.profileName || null
        })));
      }
    } catch (err) {
      console.error("Failed to load vault folders:", err);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  // Get display name for selected folder
  const getSelectedFolderDisplay = useCallback((): string => {
    if (!targetFolder || !globalProfileId) return "Select a vault folder to save videos";
    
    const folder = vaultFolders.find((f) => f.id === targetFolder);
    if (folder) {
      // When viewing all profiles, use folder's profileName
      if (isAllProfiles && folder.profileName) {
        return `Saving to Vault: ${folder.profileName} / ${folder.name}`;
      }
      // When viewing specific profile, use selectedProfile
      if (selectedProfile && selectedProfile.id !== 'all') {
        const profileDisplay = (selectedProfile as any).instagramUsername ? `@${(selectedProfile as any).instagramUsername}` : selectedProfile.name;
        return `Saving to Vault: ${profileDisplay} / ${folder.name}`;
      }
      return `Saving to Vault: ${folder.name}`;
    }
    return "Select a vault folder to save videos";
  }, [targetFolder, globalProfileId, vaultFolders, isAllProfiles, selectedProfile]);

  // Load generation history
  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      // Add profileId to filter by selected profile
      const url = globalProfileId
        ? `/api/generation/text-to-video?history=true&profileId=${globalProfileId}`
        : "/api/generation/text-to-video?history=true";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const videos = data.videos || [];
        setGenerationHistory(videos);
      } else {
        // Handle non-ok response gracefully
        console.warn("Failed to load generation history, status:", response.status);
        setGenerationHistory([]);
      }
    } catch (err) {
      console.error("Failed to load generation history:", err);
      setGenerationHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, globalProfileId]);

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

  // Load LoRAs and vault data on mount
  useEffect(() => {
    if (apiClient && user) {
      loadLoRAs();
      loadVaultData();
      loadGenerationHistory();
      // Clear selected folder when profile changes
      setTargetFolder('');
    }
  }, [apiClient, user, loadLoRAs, loadVaultData, loadGenerationHistory, globalProfileId]);

  // Component mount and reuse data check
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from Vault
    const reuseData = sessionStorage.getItem('wan-t2v-reuse');
    if (reuseData) {
      try {
        const data = JSON.parse(reuseData);
        console.log('Restoring Wan T2V settings from Vault:', data);
        
        // Set prompt and negative prompt
        if (data.prompt) setPrompt(data.prompt);
        if (data.negativePrompt) setNegativePrompt(data.negativePrompt);
        
        // Set video parameters
        if (data.width) setWidth(data.width);
        if (data.height) setHeight(data.height);
        if (data.videoLength) setVideoLength(data.videoLength);
        
        // Set high noise parameters
        if (data.highNoiseSteps) setHighNoiseSteps(data.highNoiseSteps);
        if (typeof data.highNoiseCfg === 'number') setHighNoiseCfg(data.highNoiseCfg);
        if (data.highNoiseSeed) setHighNoiseSeed(data.highNoiseSeed);
        
        // Set low noise parameters
        if (data.lowNoiseSteps) setLowNoiseSteps(data.lowNoiseSteps);
        if (typeof data.lowNoiseCfg === 'number') setLowNoiseCfg(data.lowNoiseCfg);
        
        // Set preset mode
        if (data.presetMode) setPresetMode(data.presetMode);
        
        // Set custom LoRAs
        if (data.customHighNoiseLoraList && data.customHighNoiseLoraList.length > 0) {
          setCustomHighNoiseLoraList(data.customHighNoiseLoraList.map((l: any, i: number) => ({
            id: i + 1,
            fileName: l.fileName,
            strength: l.strength
          })));
          setNextLoraId(data.customHighNoiseLoraList.length + 1);
        }
        if (data.customLowNoiseLoraList && data.customLowNoiseLoraList.length > 0) {
          setCustomLowNoiseLoraList(data.customLowNoiseLoraList.map((l: any, i: number) => ({
            id: i + 1,
            fileName: l.fileName,
            strength: l.strength
          })));
        }
        
        // Clear the sessionStorage after reading
        sessionStorage.removeItem('wan-t2v-reuse');
      } catch (err) {
        console.error('Error parsing Wan T2V reuse data:', err);
        sessionStorage.removeItem('wan-t2v-reuse');
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

      // Build params object
      const params: any = {
        source: 'wan-t2v', // Identify source for history filtering
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
        customHighNoiseLoraList: customHighNoiseLoraList.filter(l => l.fileName).map(l => ({ fileName: l.fileName, strength: l.strength })),
        customLowNoiseLoraList: customLowNoiseLoraList.filter(l => l.fileName).map(l => ({ fileName: l.fileName, strength: l.strength })),
      };

      // Handle vault folder selection (using folder ID directly now)
      if (targetFolder && globalProfileId) {
        params.saveToVault = true;
        // Use folder's profileId for proper association (works for both single and all profiles views)
        params.vaultProfileId = vaultFolders.find(f => f.id === targetFolder)?.profileId || globalProfileId;
        params.vaultFolderId = targetFolder;
      }

      const response = await apiClient.post('/api/generation/text-to-video', {
        workflow,
        userId: user.id,
        params
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
    setTargetFolder('');
  }, []);

  const openLightbox = useCallback((videoUrl: string, title: string) => {
    setLightboxVideo(videoUrl);
    setLightboxTitle(title);
  }, []);

  // Handle reuse settings from a selected history video
  const handleReuseSettings = useCallback((video: GeneratedVideoHistory) => {
    // Set prompt
    setPrompt(video.prompt || '');
    
    // Set negative prompt from metadata
    if (video.metadata?.negativePrompt) {
      setNegativePrompt(video.metadata.negativePrompt);
    }
    
    // Set video parameters
    if (video.metadata?.width) setWidth(video.metadata.width);
    if (video.metadata?.height) setHeight(video.metadata.height);
    if (video.metadata?.videoLength) setVideoLength(video.metadata.videoLength);
    
    // Set high noise parameters
    if (video.metadata?.highNoiseSteps) setHighNoiseSteps(video.metadata.highNoiseSteps);
    if (typeof video.metadata?.highNoiseCfg === 'number') setHighNoiseCfg(video.metadata.highNoiseCfg);
    if (video.metadata?.highNoiseSeed) setHighNoiseSeed(video.metadata.highNoiseSeed);
    
    // Set low noise parameters
    if (video.metadata?.lowNoiseSteps) setLowNoiseSteps(video.metadata.lowNoiseSteps);
    if (typeof video.metadata?.lowNoiseCfg === 'number') setLowNoiseCfg(video.metadata.lowNoiseCfg);
    
    // Set preset mode
    if (video.metadata?.presetMode) setPresetMode(video.metadata.presetMode);
    
    // Set custom LoRAs
    if (video.metadata?.customHighNoiseLoraList && video.metadata.customHighNoiseLoraList.length > 0) {
      setCustomHighNoiseLoraList(video.metadata.customHighNoiseLoraList.map((l, i) => ({
        id: i + 1,
        fileName: l.fileName,
        strength: l.strength
      })));
    }
    if (video.metadata?.customLowNoiseLoraList && video.metadata.customLowNoiseLoraList.length > 0) {
      setCustomLowNoiseLoraList(video.metadata.customLowNoiseLoraList.map((l, i) => ({
        id: i + 1,
        fileName: l.fileName,
        strength: l.strength
      })));
    }
    
    // Close modal
    setShowVideoModal(false);
    setShowHistoryModal(false);
  }, []);

  const openHistoryVideoModal = useCallback((video: GeneratedVideoHistory) => {
    setSelectedHistoryVideo(video);
    setShowVideoModal(true);
  }, []);

  // Handle escape key for modals
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowVideoModal(false);
        setShowHistoryModal(false);
        setLightboxVideo(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-2xl shadow-lg animate-pulse">
              <Video className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
              Text to Video Studio
            </h1>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto px-4">
            Generate stunning videos from text using Wan 2.2 models ⚡ Advanced AI with 4-step LoRA acceleration
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {/* Left Column - Input */}
          <div className="space-y-4 sm:space-y-6">
            {/* Folder Selection - Modern Dropdown */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">Save to Vault</h3>
                {isLoadingVaultData && (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-purple-500" />
                )}
              </div>
              
              {/* Modern Custom Dropdown */}
              <div ref={folderDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => !(!mounted || isProcessing || isLoadingVaultData || !globalProfileId) && setFolderDropdownOpen(!folderDropdownOpen)}
                  disabled={!mounted || isProcessing || isLoadingVaultData || !globalProfileId}
                  className={`
                    w-full flex items-center justify-between gap-3 px-4 py-3.5
                    rounded-2xl border transition-all duration-200
                    ${folderDropdownOpen 
                      ? 'border-purple-400 bg-purple-500/10 ring-2 ring-purple-400/30' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-purple-400/50 hover:bg-purple-50 dark:hover:bg-gray-600'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`
                      flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                      ${targetFolder 
                        ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-400/30' 
                        : 'bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      }
                    `}>
                      <FolderOpen className={`w-4 h-4 ${targetFolder ? 'text-purple-500 dark:text-purple-300' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className={`text-sm font-medium truncate ${targetFolder ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                        {targetFolder 
                          ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                          : 'Select a folder...'
                        }
                      </p>
                      {targetFolder && (
                        <p className="text-[11px] text-purple-500 dark:text-purple-300/70 truncate">
                          {isAllProfiles 
                            ? vaultFolders.find(f => f.id === targetFolder)?.profileName || ''
                            : selectedProfile && selectedProfile.id !== 'all' 
                              ? ((selectedProfile as any).instagramUsername ? `@${(selectedProfile as any).instagramUsername}` : selectedProfile.name)
                              : ''
                          }
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {folderDropdownOpen && mounted && (
                  <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/95 backdrop-blur-xl shadow-2xl shadow-black/20 dark:shadow-black/40 overflow-hidden">
                    {/* Clear Selection Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setTargetFolder('');
                        setFolderDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
                        <X className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">No folder selected</span>
                      {!targetFolder && <Check className="w-4 h-4 text-purple-500 dark:text-purple-400 ml-auto" />}
                    </button>

                    {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                      <div className="my-2 mx-3 h-px bg-gray-200 dark:bg-white/5" />
                    )}

                    {/* Folder Options - Grouped by profile when viewing all profiles */}
                    <div className="max-h-[200px] overflow-y-auto">
                      {isAllProfiles ? (
                        // Group folders by profile
                        Object.entries(
                          vaultFolders.filter(f => !f.isDefault).reduce((acc, folder) => {
                            const profileKey = folder.profileName || 'Unknown Profile';
                            if (!acc[profileKey]) acc[profileKey] = [];
                            acc[profileKey].push(folder);
                            return acc;
                          }, {} as Record<string, VaultFolder[]>)
                        ).map(([profileName, folders]) => (
                          <div key={profileName}>
                            <div className="px-4 py-2 text-xs font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wider bg-purple-50 dark:bg-purple-500/10 sticky top-0">
                              {profileName}
                            </div>
                            {folders.map((folder) => (
                              <button
                                key={folder.id}
                                type="button"
                                onClick={() => {
                                  setTargetFolder(folder.id);
                                  setFolderDropdownOpen(false);
                                }}
                                className={`
                                  w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150
                                  ${targetFolder === folder.id 
                                    ? 'bg-purple-50 dark:bg-purple-500/15' 
                                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                  }
                                `}
                              >
                                <div className={`
                                  w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                  ${targetFolder === folder.id 
                                    ? 'bg-gradient-to-br from-purple-500/40 to-pink-500/40 border border-purple-400/40' 
                                    : 'bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                                  }
                                `}>
                                  <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-purple-500 dark:text-purple-300' : 'text-gray-400'}`} />
                                </div>
                                <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-200'}`}>
                                  {folder.name}
                                </span>
                                {targetFolder === folder.id && (
                                  <Check className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        ))
                      ) : (
                        // Single profile view - flat list
                        vaultFolders.filter(f => !f.isDefault).map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              setTargetFolder(folder.id);
                              setFolderDropdownOpen(false);
                            }}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150
                              ${targetFolder === folder.id 
                                ? 'bg-purple-50 dark:bg-purple-500/15' 
                                : 'hover:bg-gray-50 dark:hover:bg-white/5'
                              }
                            `}
                          >
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                              ${targetFolder === folder.id 
                                ? 'bg-gradient-to-br from-purple-500/40 to-pink-500/40 border border-purple-400/40' 
                                : 'bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                              }
                            `}>
                              <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-purple-500 dark:text-purple-300' : 'text-gray-400'}`} />
                            </div>
                            <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-200'}`}>
                              {folder.name}
                            </span>
                            {targetFolder === folder.id && (
                              <Check className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>

                    {vaultFolders.filter(f => !f.isDefault).length === 0 && (
                      <div className="px-4 py-6 text-center">
                        <FolderOpen className="w-8 h-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No folders available</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create folders in the Vault tab</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              {targetFolder && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                  <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse" />
                  <p className="text-xs text-purple-600 dark:text-purple-200 flex-1 truncate">
                    {getSelectedFolderDisplay()}
                  </p>
                </div>
              )}
              
              {!targetFolder && (
                <div className="mt-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                    ⚠️ Please select a vault folder before generating
                  </p>
                </div>
              )}
            </div>

            {/* Preset Mode Dropdown */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">Preset Mode</h3>
              </div>
              <select
                value={presetMode}
                onChange={(e) => setPresetMode(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-purple-300 dark:border-purple-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-300"
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
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">Custom LoRA Models</h3>
                {loadingLoRAs && <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-purple-500" />}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
                Add your own LoRA models on top of the {presetMode && presetMode !== 'custom' ? `${presetMode} and ` : ''}fixed 4-step acceleration LoRAs. Select separate LoRAs for high noise and low noise stages.
              </p>
              <div className="space-y-4 sm:space-y-6">
                {/* High Noise LoRA Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      🎨 High Noise LoRAs
                    </label>
                    <button
                      onClick={() => {
                        setCustomHighNoiseLoraList([...customHighNoiseLoraList, {id: nextLoraId, fileName: '', strength: 1.0}]);
                        setNextLoraId(nextLoraId + 1);
                      }}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-1 active:scale-95"
                    disabled={isProcessing || loadingLoRAs}
                  >
                    <span>+</span> Add LoRA
                  </button>
                </div>
                <div className="space-y-2">
                    {customHighNoiseLoraList.map((lora, index) => (
                      <div key={lora.id} className="flex gap-2 sm:gap-3 p-2.5 sm:p-3 md:p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
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
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">Video Parameters</h3>
              </div>
              <div className="space-y-4 sm:space-y-6">
                {/* Resolution */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">📏 Width</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(parseInt(e.target.value) || 640)}
                      className="w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border border-purple-300 dark:border-purple-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-all"
                      disabled={isProcessing}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">📏 Height</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value) || 640)}
                      className="w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border border-purple-300 dark:border-purple-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-all"
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                {/* Video Length */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 pt-4 sm:pt-6 border-t-2 border-gradient-to-r from-purple-200 to-pink-200 dark:from-purple-800 dark:to-pink-800">
                  {/* High Noise Sampler (Steps 0-2) */}
                  <div className="space-y-3 sm:space-y-4 p-2.5 sm:p-3 md:p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                      <h4 className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300">High Noise Sampler</h4>
                    </div>
                    <div className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 font-medium mb-2 sm:mb-3">
                      ⚡ add_noise: enable | Steps 0 → 2
                    </div>
                  
                    {/* Step Range */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">Positive Prompt</h3>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-purple-300 dark:border-purple-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none transition-all"
                rows={4}
                disabled={isProcessing}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isProcessing || !prompt.trim() || !targetFolder}
              className="group w-full py-3 sm:py-4 md:py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-sm sm:text-base md:text-lg rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  <span>Generating Video Magic...</span>
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                </>
              ) : (
                <>
                  <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Generate Video</span>
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
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
        <div className="space-y-4 sm:space-y-6">
          {/* Progress Indicator */}
          {isProcessing && currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Processing</h3>
                <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{formattedElapsed}</span>
                </div>
              </div>

              {/* Progress Stages */}
              <div className="space-y-2 sm:space-y-3">
                {PROGRESS_STAGES.map((stage, index) => {
                  const isActive = index === activeStageIndex;
                  const isCompleted = index < activeStageIndex;

                  return (
                    <div key={stage.key} className="flex items-start space-x-2 sm:space-x-3">
                      <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                        ) : (
                          <span className="text-white text-xs sm:text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs sm:text-sm font-medium ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {stage.label}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{stage.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results */}
          {resultVideos.length > 0 && currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Generated Video</h3>
                {lastJobDuration && (
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Completed in {lastJobDuration}
                  </div>
                )}
              </div>

              <div className="space-y-3 sm:space-y-4">
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
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <button
                          onClick={() => downloadDatabaseVideo(video)}
                          className="p-1.5 sm:p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => shareVideo(video)}
                          className="p-1.5 sm:p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors active:scale-95"
                        >
                          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={resetForm}
                className="w-full mt-3 sm:mt-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-bold py-3 sm:py-4 px-3 sm:px-4 text-sm sm:text-base rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                Generate Another Video
              </button>
            </div>
          )}

          {/* Generation History */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <History className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Recent Generations</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your generated videos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-xs text-gray-700 dark:text-white transition hover:-translate-y-0.5 hover:shadow"
                >
                  <Maximize2 className="w-3 h-3" />
                  View All
                </button>
                <button
                  type="button"
                  onClick={loadGenerationHistory}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-xs text-gray-700 dark:text-white transition hover:-translate-y-0.5 hover:shadow"
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>
            </div>

            {generationHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-6 text-center text-gray-500 dark:text-gray-400">
                <Clock className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No generation history yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto pr-1">
                {generationHistory.slice(0, 8).map((video) => (
                  <div
                    key={video.id}
                    role="button"
                    aria-label="Open video"
                    tabIndex={0}
                    onClick={() => video.videoUrl && openHistoryVideoModal(video)}
                    className="group overflow-hidden rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 cursor-pointer hover:shadow-lg transition-all"
                  >
                    {video.videoUrl ? (
                      <video
                        data-role="preview"
                        preload="metadata"
                        src={video.videoUrl}
                        className="w-full h-24 object-cover pointer-events-none"
                        controlsList="nodownload noplaybackrate noremoteplayback"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-800/50">
                        <div className="text-center text-gray-400">
                          <Video className="w-5 h-5 mx-auto mb-1 opacity-50" />
                          <span className="text-[10px]">Unavailable</span>
                        </div>
                      </div>
                    )}
                    <div className="px-2 py-2 text-[10px] text-gray-600 dark:text-gray-200">
                      <p className="font-medium text-gray-900 dark:text-white truncate text-xs">{video.prompt}</p>
                      <p className="text-gray-500 dark:text-gray-400 truncate">
                        {video.metadata?.width}x{video.metadata?.height} · {video.metadata?.presetMode || 'Custom'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Detail Modal */}
      {showVideoModal && selectedHistoryVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVideoModal(false);
          }}
        >
          <div
            className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              onClick={() => setShowVideoModal(false)}
            >
              <span className="sr-only">Close</span>
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col lg:flex-row max-h-[85vh] overflow-hidden">
              {/* Video Section */}
              <div className="lg:w-2/3 bg-black flex items-center justify-center">
                {selectedHistoryVideo.videoUrl ? (
                  <video
                    controls
                    autoPlay
                    src={selectedHistoryVideo.videoUrl}
                    className="max-w-full max-h-[60vh] lg:max-h-[85vh]"
                  />
                ) : (
                  <div className="text-center text-gray-400 py-12">
                    <Video className="w-12 h-12 mx-auto mb-2" />
                    <p>Video unavailable</p>
                  </div>
                )}
              </div>

              {/* Details Section */}
              <div className="lg:w-1/3 p-4 sm:p-6 overflow-y-auto border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Video Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Prompt</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedHistoryVideo.prompt}</p>
                  </div>
                  
                  {selectedHistoryVideo.metadata?.negativePrompt && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Negative Prompt</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{selectedHistoryVideo.metadata.negativePrompt}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Resolution</p>
                      <p className="text-gray-900 dark:text-white">{selectedHistoryVideo.metadata?.width}x{selectedHistoryVideo.metadata?.height}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Video Length</p>
                      <p className="text-gray-900 dark:text-white">{selectedHistoryVideo.metadata?.videoLength} frames</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Preset Mode</p>
                      <p className="text-gray-900 dark:text-white capitalize">{selectedHistoryVideo.metadata?.presetMode || 'Custom'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">High Noise Steps</p>
                      <p className="text-gray-900 dark:text-white">{selectedHistoryVideo.metadata?.highNoiseSteps}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-4">
                    <button
                      onClick={() => handleReuseSettings(selectedHistoryVideo)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reuse Settings
                    </button>
                    {selectedHistoryVideo.videoUrl && (
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = selectedHistoryVideo.videoUrl;
                          a.download = `wan-t2v-${selectedHistoryVideo.id}.mp4`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-white transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <Download className="w-4 h-4" />
                        Download Video
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHistoryModal(false);
          }}
        >
          <div
            className="relative w-full max-w-6xl max-h-[90vh] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generation History</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">All your Wan T2V generations</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full bg-gray-100 dark:bg-gray-700 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => setShowHistoryModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {generationHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No generation history</p>
                  <p className="text-sm">Your generated videos will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => {
                        setShowHistoryModal(false);
                        setTimeout(() => openHistoryVideoModal(video), 100);
                      }}
                      className="group overflow-hidden rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 cursor-pointer hover:shadow-lg transition-all"
                    >
                      {video.videoUrl ? (
                        <video
                          preload="metadata"
                          src={video.videoUrl}
                          className="w-full h-32 object-cover pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-800/50">
                          <div className="text-center text-gray-400">
                            <Video className="w-6 h-6 mx-auto mb-1" />
                            <span className="text-xs">Unavailable</span>
                          </div>
                        </div>
                      )}
                      <div className="p-3">
                        <p className="font-medium text-gray-900 dark:text-white truncate text-sm mb-1">{video.prompt}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{video.metadata?.width}x{video.metadata?.height}</span>
                          <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
