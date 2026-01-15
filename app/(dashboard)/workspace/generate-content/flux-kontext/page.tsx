"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { Upload, X, Download, Wand2, Loader2, Image as ImageIcon, AlertCircle, Share2, ChevronLeft, ChevronRight, ZoomIn, MessageCircle, Send, Sparkles, Brain, Copy, Check, Folder, ChevronDown, Archive } from 'lucide-react';
import { useApiClient } from '@/lib/apiClient';

interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'pending' | 'processing' | 'completed' | 'failed';
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

// Vault interfaces
interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername: string | null;
  isDefault: boolean;
}

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault: boolean;
}

type FolderType = 's3' | 'vault';

const sanitizePrefix = (prefix: string): string => {
  if (!prefix) {
    return '';
  }
  const normalized = prefix.replace(/\\/g, '/').replace(/\/+/g, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const formatSegmentName = (segment: string): string => {
  if (!segment) {
    return '';
  }
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
  const [prompt, setPrompt] = useState<string>('');
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [availableFolders, setAvailableFolders] = useState<AvailableFolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useApiClient();

  // Vault folder states
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Chat assistant states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string, image?: string, timestamp: Date}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatUploadedImage, setChatUploadedImage] = useState<string | null>(null);
  const [isChatGenerating, setIsChatGenerating] = useState(false);
  const [chatLoadingStep, setChatLoadingStep] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

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

  // Load available folders
  const loadFolders = useCallback(async () => {
    if (!apiClient || !user) return;

    setIsLoadingFolders(true);
    try {
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
      console.log('📁 Loaded editable folders with subfolder support:', deduped);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [apiClient, user]);

  const selectedFolderOption = useMemo(
    () => availableFolders.find((folder) => folder.prefix === targetFolder),
    [availableFolders, targetFolder]
  );

  // Parse target folder to determine type (s3 or vault)
  const parseTargetFolder = (value: string): { type: FolderType; folderId: string; profileId?: string; profileName?: string } => {
    if (value.startsWith('vault:')) {
      const parts = value.replace('vault:', '').split(':');
      const profileId = parts[0];
      const folderId = parts[1];
      const profile = vaultProfiles.find(p => p.id === profileId);
      return { type: 'vault', folderId, profileId, profileName: profile?.name };
    }
    return { type: 's3', folderId: value };
  };

  // Get display text for the selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder) return 'Saving to your root outputs folder';
    
    const parsed = parseTargetFolder(targetFolder);
    
    if (parsed.type === 'vault') {
      const folders = vaultFoldersByProfile[parsed.profileId || ''] || [];
      const folder = folders.find(f => f.id === parsed.folderId);
      return `Saving to Vault: ${parsed.profileName || 'Profile'} / ${folder?.name || 'Folder'}`;
    }
    
    const s3Folder = availableFolders.find(f => f.prefix === parsed.folderId);
    return `Saving to ${s3Folder?.displayPath || 'selected folder'}`;
  };

  // Load vault data (profiles and folders)
  useEffect(() => {
    const loadVaultData = async () => {
      if (!apiClient || !user) return;
      
      setIsLoadingVaultData(true);
      try {
        // Load profiles - use /api/instagram/profiles which returns array directly
        const profilesResponse = await fetch('/api/instagram/profiles');
        if (profilesResponse.ok) {
          const profilesData = await profilesResponse.json();
          // API returns array directly, not { profiles: [...] }
          const profileList: InstagramProfile[] = Array.isArray(profilesData) 
            ? profilesData 
            : profilesData.profiles || [];
          
          // Sort profiles alphabetically
          const sortedProfiles = [...profileList].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          );
          
          setVaultProfiles(sortedProfiles);
          
          // Load folders for each profile
          const foldersByProfile: Record<string, VaultFolder[]> = {};
          await Promise.all(
            sortedProfiles.map(async (profile) => {
              try {
                const foldersResponse = await fetch(`/api/vault/folders?profileId=${profile.id}`);
                if (foldersResponse.ok) {
                  // API returns array directly, not { folders: [...] }
                  const foldersData = await foldersResponse.json();
                  foldersByProfile[profile.id] = Array.isArray(foldersData) ? foldersData : [];
                }
              } catch (error) {
                console.error(`Failed to load folders for profile ${profile.id}:`, error);
                foldersByProfile[profile.id] = [];
              }
            })
          );
          setVaultFoldersByProfile(foldersByProfile);
        }
      } catch (error) {
        console.error('Error loading vault data:', error);
      } finally {
        setIsLoadingVaultData(false);
      }
    };
    
    loadVaultData();
  }, [apiClient, user]);

  // Load folders on mount
  useEffect(() => {
    if (apiClient && user) {
      loadFolders();
    }
  }, [apiClient, user, loadFolders]);

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
    const status = currentJob.status.toUpperCase();
    if (status === 'PENDING') return 0;
    if (status === 'PROCESSING') return 1;
    if (status === 'COMPLETED') return 2;
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
      console.log('🖼️ Fetching images for job:', jobId);
      const response = await apiClient.get(`/api/jobs/${jobId}/images`);
      
      if (!response.ok) {
        console.error('❌ Failed to fetch job images:', response.statusText);
        return null;
      }

      const data = await response.json();
      console.log('✅ Fetched images:', data.images);
      console.log('📊 Image count:', data.images?.length || 0);
      return data.images || [];
    } catch (error) {
      console.error('❌ Error fetching job images:', error);
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
    // Check if this is a vault folder - if so, use temporary path
    let normalizedTargetFolder: string;
    if (targetFolder.startsWith('vault:')) {
      // For vault folders, use user ID prefix only - vault path handled by webhook
      normalizedTargetFolder = `outputs/${user?.id}/`;
      console.log("💾 Using temporary path for vault storage:", normalizedTargetFolder);
    } else {
      normalizedTargetFolder = sanitizePrefix(targetFolder);
      console.log("📁 Using S3 folder prefix:", normalizedTargetFolder);
    }
    
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
          "filename_prefix": `${normalizedTargetFolder}FluxKontext_${Date.now()}_${FIXED_VALUES.seed}`
        },
        "class_type": "SaveImage"
      }
    };
  }, [prompt, targetFolder, FIXED_VALUES]);

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

    if (!targetFolder) {
      setError('Please select a folder to save the output');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setJobStartTime(Date.now());
      setElapsedSeconds(0);

      const imageBase64 = await convertImageToBase64(image.file);

      const workflow = createWorkflowForFluxKontext(imageBase64);

      // Parse target folder to check if it's a vault folder
      const parsed = parseTargetFolder(targetFolder);
      const saveToVault = parsed.type === 'vault';
      
      console.log('📁 Folder info:', {
        targetFolder,
        folderType: parsed.type,
        saveToVault,
        profileId: parsed.profileId,
        folderId: parsed.folderId
      });

      const response = await apiClient.post('/api/jobs/flux-kontext', {
        workflow,
        userId: user.id,
        prompt,
        params: FIXED_VALUES,
        // Vault parameters
        saveToVault: saveToVault,
        vaultProfileId: saveToVault ? parsed.profileId : undefined,
        vaultFolderId: saveToVault ? parsed.folderId : undefined,
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
  }, [user, selectedImages, createWorkflowForFluxKontext, prompt, FIXED_VALUES, apiClient, targetFolder, vaultProfiles]);

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

        if (updatedJob.status === 'completed' || updatedJob.status === 'COMPLETED') {
          console.log('✅ Job completed, fetching images...');
          setIsProcessing(false);
          if (jobStartTime) {
            const duration = Date.now() - jobStartTime;
            setLastJobDuration(formatDuration(duration));
          }
          setJobStartTime(null);

          const images = await fetchJobImages(updatedJob.id);
          console.log('📸 Images received:', images);
          if (images && images.length > 0) {
            console.log('💾 Storing images in state for job:', updatedJob.id);
            setJobImages(prev => ({ ...prev, [updatedJob.id]: images }));
          } else {
            console.warn('⚠️ No images returned for completed job');
          }
        } else if (updatedJob.status === 'failed' || updatedJob.status === 'FAILED') {
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

  // Debug: Log jobImages state changes
  useEffect(() => {
    console.log('🎨 JobImages state updated:', jobImages);
    console.log('🎯 Current job ID:', currentJob?.id);
    console.log('📦 Images for current job:', currentJob?.id ? jobImages[currentJob.id] : 'No current job');
  }, [jobImages, currentJob?.id]);

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

  // Chat assistant functions
  useEffect(() => {
    if (isChatOpen) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (isChatOpen && chatMessages.length === 0) {
      setChatMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "👋 Hi! I'm your AI assistant for Flux Kontext. I can help you:\n\n• **Generate better prompts** for your image transformations\n• **Explain techniques** and best practices\n• **Troubleshoot issues** with your generations\n• **Suggest improvements** to your current prompt\n\nHow can I help you today?",
        timestamp: new Date()
      }]);
    }
  }, [isChatOpen, chatMessages.length]);

  const generateChatResponse = async (userMessage: string): Promise<string> => {
    try {
      const response = await fetch("/api/flux-kontext-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: chatMessages.slice(-6),
          currentPrompt: prompt || undefined
        }),
      });

      if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
      const data = await response.json();
      return data.response || "I apologize, but I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error("Chat error:", error);
      throw new Error("Failed to generate response. Please try again.");
    }
  };

  const generateChatResponseWithImage = async (userMessage: string, imageBase64?: string): Promise<string> => {
    try {
      const response = await fetch("/api/flux-kontext-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          image: imageBase64,
          conversationHistory: chatMessages.slice(-6),
          currentPrompt: prompt || undefined
        }),
      });

      if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
      const data = await response.json();
      return data.response || "I apologize, but I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error("Chat error:", error);
      throw new Error("Failed to generate response. Please try again.");
    }
  };

  const handleChatImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setChatUploadedImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveChatImage = () => {
    setChatUploadedImage(null);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = "";
    }
  };

  const handleSendChat = async () => {
    const messageText = chatInput.trim();
    if (!messageText && !chatUploadedImage) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: messageText || "Analyze this image and generate a Flux Kontext prompt",
      image: chatUploadedImage || undefined,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    const currentImage = chatUploadedImage;
    setChatUploadedImage(null);
    setIsChatGenerating(true);

    try {
      setChatLoadingStep("Thinking...");
      
      if (currentImage) {
        setChatLoadingStep("Analyzing image...");
        const imageBase64 = currentImage.split(",")[1];
        const aiResponse = await generateChatResponseWithImage(userMessage.content, imageBase64);
        
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: aiResponse,
          timestamp: new Date()
        };
        
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        const aiResponse = await generateChatResponse(messageText);

        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: aiResponse,
          timestamp: new Date()
        };

        setChatMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsChatGenerating(false);
      setChatLoadingStep('');
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 md:mb-10 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl sm:rounded-2xl shadow-lg animate-pulse">
              <Wand2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
            </div>
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
              Flux Kontext Studio
            </h1>
          </div>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto px-2">
            Transform your images with AI-powered magic ✨ Create stunning scene modifications with advanced Flux Kontext technology
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 border-2 border-red-300 dark:border-red-700 rounded-xl sm:rounded-2xl flex items-start gap-2 sm:gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-900 dark:text-red-100 text-sm sm:text-base md:text-lg">Oops! Something went wrong</h3>
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-0.5 sm:mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 transition-colors p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg active:scale-95"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Image Upload Section */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  Upload Your Image
                </h2>
              </div>

              {/* Single Image Upload */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
                  Source Image to Transform ✨
                </label>
                {selectedImages[0] ? (
                  <div className="relative group">
                    <div className="relative w-full h-48 xs:h-56 sm:h-64 md:h-80 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                      <img
                        src={selectedImages[0].preview}
                        alt="Image preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      onClick={removeImage}
                      className="absolute top-2 sm:top-3 right-2 sm:right-3 p-1.5 sm:p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg hover:scale-110 transform duration-200 active:scale-95"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 px-2 xs:px-3 py-0.5 xs:py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] xs:text-xs rounded-full">
                      {selectedImages[0].file.name}
                    </div>
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 xs:p-10 sm:p-12 md:p-16 text-center cursor-pointer transition-all duration-300 ${
                      isDragging
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-105 shadow-xl'
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3 sm:gap-4">
                      <div className={`p-3 sm:p-4 rounded-full ${isDragging ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-gray-100 dark:bg-gray-800'} transition-colors`}>
                        <Upload className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 ${isDragging ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'} transition-colors`} />
                      </div>
                      <div>
                        <p className="text-sm sm:text-base md:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          {isDragging ? 'Drop it here! 🎯' : 'Click or drag image here'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          PNG, JPG, WEBP up to 10MB
                        </p>
                      </div>
                    </div>
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

            {/* Folder Selection */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  Save Destination
                </h2>
                {(isLoadingFolders || isLoadingVaultData) && (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-purple-400" />
                )}
              </div>
              <div className="relative">
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  disabled={isProcessing || isLoadingFolders || isLoadingVaultData}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:text-white shadow-inner text-sm sm:text-base"
                >
                  <option value="">📁 Default Output Folder</option>
                  
                  {/* S3 Folders Group */}
                  {availableFolders.length > 0 && (
                    <optgroup label="📂 Your Output Folders">
                      {availableFolders.map((folder) => (
                        <option key={folder.prefix} value={folder.prefix}>
                          {'  '.repeat(folder.depth)}{folder.name}
                          {folder.isShared && ' (Shared)'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  
                  {/* Vault Folders by Profile - Each profile as its own optgroup */}
                  {vaultProfiles.map((profile) => {
                    const folders = vaultFoldersByProfile[profile.id] || [];
                    if (folders.length === 0) return null;
                    
                    return (
                      <optgroup 
                        key={profile.id} 
                        label={`📸 Vault - ${profile.name}${profile.instagramUsername ? ` (@${profile.instagramUsername})` : ''}`}
                      >
                        {folders.map((folder) => (
                          <option 
                            key={folder.id} 
                            value={`vault:${profile.id}:${folder.id}`}
                          >
                            {folder.name}{folder.isDefault ? ' (Default)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              </div>
              
              {/* Folder type indicator */}
              <div className="flex items-center gap-2 mt-2">
                {targetFolder && targetFolder.startsWith('vault:') ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-purple-500/20 px-2.5 py-1 text-[11px] text-purple-600 dark:text-purple-300">
                    <Archive className="w-3 h-3" />
                    <span>Vault Storage</span>
                  </div>
                ) : targetFolder ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-1 text-[11px] text-blue-600 dark:text-blue-300">
                    <Folder className="w-3 h-3" />
                    <span>S3 Storage</span>
                  </div>
                ) : null}
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex-1">
                  {getSelectedFolderDisplay()}
                </p>
              </div>
            </div>

            {/* Prompt Section */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  Transformation Magic ✨
                </h2>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-900/50 dark:text-white resize-none transition-all shadow-inner text-sm sm:text-base"
                rows={5}
                placeholder="Describe your vision... (e.g., 'Transform into a magical nighttime scene with stars and soft lighting')"
              />
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 Tip: Be specific and descriptive for best results!
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isProcessing || selectedImages.length === 0 || !targetFolder}
              className="group w-full py-3 sm:py-4 md:py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-sm sm:text-base md:text-lg rounded-xl sm:rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 animate-spin" />
                  <span>Creating Magic...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform duration-300" />
                  <span>Transform Image ✨</span>
                </>
              )}
            </button>
            
            {(selectedImages.length === 0 || !targetFolder) && (
              <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 -mt-1 sm:-mt-2">
                {selectedImages.length === 0 && "Please upload an image first"}
                {selectedImages.length > 0 && !targetFolder && "Please select a folder"}
              </p>
            )}
          </div>

          {/* Right Panel - Progress & Results */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Progress Section */}
            {isProcessing && currentJob && (
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-right">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                  <div className="relative">
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400 animate-spin" />
                    <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping"></div>
                  </div>
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                    AI is Working Magic 🎨
                  </h2>
                </div>
                
                <div className="space-y-4 sm:space-y-6">
                  {PROGRESS_STAGES.map((stage, index) => {
                    const isActive = index === activeStageIndex;
                    const isComplete = index < activeStageIndex;
                    
                    return (
                      <div key={stage.key} className="relative">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className={`relative flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-500 transform ${
                            isComplete ? 'bg-gradient-to-br from-green-400 to-green-600 scale-110 shadow-lg' : 
                            isActive ? 'bg-gradient-to-br from-purple-500 to-pink-600 scale-110 shadow-lg animate-pulse' : 
                            'bg-gray-300 dark:bg-gray-600 scale-100'
                          }`}>
                            {isComplete ? (
                              <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : isActive ? (
                              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin" />
                            ) : (
                              <span className="text-xs sm:text-sm font-bold text-white">{index + 1}</span>
                            )}
                            {isActive && (
                              <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-75"></div>
                            )}
                          </div>
                          <div className="flex-1 pt-0.5 sm:pt-1">
                            <h3 className={`font-bold text-sm sm:text-base md:text-lg transition-colors ${
                              isActive ? 'text-purple-600 dark:text-purple-400' : 
                              isComplete ? 'text-green-600 dark:text-green-400' :
                              'text-gray-500 dark:text-gray-400'
                            }`}>
                              {stage.label}
                              {isActive && ' 🚀'}
                              {isComplete && ' ✓'}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">{stage.description}</p>
                          </div>
                        </div>
                        {index < PROGRESS_STAGES.length - 1 && (
                          <div className={`absolute left-4 sm:left-4.5 md:left-5 top-10 sm:top-11 md:top-12 w-0.5 h-4 sm:h-5 md:h-6 transition-colors duration-500 ${
                            isComplete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {jobStartTime && (
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">⏱️ Elapsed Time:</span>
                      <span className="text-lg xs:text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{formattedElapsed}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results Section */}
            {(currentJob?.status === 'completed' || currentJob?.status === 'COMPLETED') && jobImages[currentJob.id] && (
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300 animate-in fade-in zoom-in">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="p-1.5 sm:p-2 bg-gradient-to-br from-green-400 to-green-600 rounded-lg sm:rounded-xl shadow-lg">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                      Your Masterpiece is Ready! 🎉
                    </h2>
                  </div>
                  {lastJobDuration && (
                    <div className="px-2 xs:px-3 sm:px-4 py-1 xs:py-1.5 sm:py-2 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-full border border-green-200 dark:border-green-700">
                      <span className="text-[10px] xs:text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300">
                        ⚡ {lastJobDuration}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {jobImages[currentJob.id].map((image) => (
                    <div key={image.id} className="relative group">
                      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-1.5 sm:p-2">
                        <div className="relative w-full h-64 xs:h-72 sm:h-80 md:h-96 bg-gray-100 dark:bg-gray-900 rounded-lg sm:rounded-xl overflow-hidden">
                          <img
                            src={image.awsS3Url || image.url || image.dataUrl || ''}
                            alt={image.filename}
                            className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform duration-500"
                            onClick={() => openLightbox(image.awsS3Url || image.url || image.dataUrl || '', image.filename)}
                          />
                        </div>
                      </div>
                      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex gap-1.5 sm:gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                          onClick={() => downloadDatabaseImage(image)}
                          className="p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-lg hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-600 hover:text-white transition-all hover:scale-110 transform duration-200 border border-gray-200 dark:border-gray-700 active:scale-95"
                          title="Download"
                        >
                          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => shareImage(image)}
                          className="p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-lg hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-600 hover:text-white transition-all hover:scale-110 transform duration-200 border border-gray-200 dark:border-gray-700 active:scale-95"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => openLightbox(image.awsS3Url || image.url || image.dataUrl || '', image.filename)}
                          className="p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-lg hover:bg-gradient-to-br hover:from-green-500 hover:to-green-600 hover:text-white transition-all hover:scale-110 transform duration-200 border border-gray-200 dark:border-gray-700 active:scale-95"
                          title="View Full Size"
                        >
                          <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                      <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 px-2 xs:px-3 sm:px-4 py-1 xs:py-1.5 sm:py-2 bg-black/70 backdrop-blur-md text-white text-[10px] xs:text-xs sm:text-sm rounded-lg sm:rounded-xl border border-white/20 shadow-lg">
                        <span className="font-semibold">📁 {image.filename}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={resetForm}
                  className="group w-full mt-4 sm:mt-6 py-3 sm:py-4 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 dark:from-gray-600 dark:via-gray-700 dark:to-gray-800 text-white font-bold text-sm sm:text-base rounded-xl hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 sm:gap-2 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform duration-300" />
                  <span>Create Another Masterpiece ✨</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-300"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[95vw] sm:max-w-7xl max-h-full w-full">
            <div className="relative bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 rounded-2xl sm:rounded-3xl p-2 xs:p-3 sm:p-4 border border-white/10 shadow-2xl">
              <img
                src={lightboxImage}
                alt={lightboxTitle}
                className="max-w-full max-h-[80vh] sm:max-h-[85vh] object-contain mx-auto rounded-xl sm:rounded-2xl shadow-2xl"
              />
              <div className="absolute bottom-4 xs:bottom-6 sm:bottom-8 left-1/2 transform -translate-x-1/2 px-3 xs:px-4 sm:px-6 py-1.5 xs:py-2 sm:py-3 bg-black/80 backdrop-blur-md text-white rounded-full border border-white/20 shadow-xl">
                <span className="font-semibold text-[10px] xs:text-xs sm:text-sm">📁 {lightboxTitle}</span>
              </div>
            </div>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 xs:top-6 sm:top-8 right-4 xs:right-6 sm:right-8 p-2 xs:p-2.5 sm:p-3 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-xl hover:scale-110 transform duration-200 active:scale-95"
              title="Close (ESC)"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="absolute top-4 xs:top-6 sm:top-8 left-4 xs:left-6 sm:left-8 px-2 xs:px-3 sm:px-4 py-1 xs:py-1.5 sm:py-2 bg-black/80 backdrop-blur-md text-white rounded-full border border-white/20 shadow-xl hidden xs:block">
              <span className="text-[10px] xs:text-xs sm:text-sm font-semibold">Press ESC to close</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Assistant */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
        {/* Chat Bubble Button */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="group relative p-3 sm:p-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-full shadow-2xl hover:shadow-purple-500/50 hover:scale-110 transition-all duration-300 animate-bounce active:scale-95"
          >
            <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
            <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold animate-pulse">
              AI
            </div>
            <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-black/80 backdrop-blur-md text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Ask AI Assistant ✨
            </div>
          </button>
        )}

        {/* Chat Window */}
        {isChatOpen && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[calc(100vw-2rem)] xs:w-80 sm:w-96 h-[500px] xs:h-[550px] sm:h-[600px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">AI Assistant</h3>
                  <p className="text-[10px] sm:text-xs text-purple-100">Flux Kontext Helper</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors active:scale-95"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-gray-900/50">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] xs:max-w-[88%] sm:max-w-[90%] rounded-xl sm:rounded-2xl px-2 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 mb-1 xs:mb-1.5 sm:mb-2">
                        <Brain className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-[10px] xs:text-xs font-semibold text-purple-600 dark:text-purple-400">AI Assistant</span>
                      </div>
                    )}
                    {message.image && (
                      <div className="mb-1 xs:mb-1.5 sm:mb-2">
                        <img
                          src={message.image}
                          alt="Uploaded"
                          className="max-w-full h-24 xs:h-28 sm:h-32 object-cover rounded-md sm:rounded-lg border-2 border-white/20"
                        />
                      </div>
                    )}
                    <div className="text-xs xs:text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content.split(/(\*\*.*?\*\*|```[\s\S]*?```)/g).map((part, idx) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={idx} className="font-bold">{part.slice(2, -2)}</strong>;
                        } else if (part.startsWith('```') && part.endsWith('```')) {
                          const code = part.slice(3, -3).trim();
                          return (
                            <div key={idx} className="my-1 xs:my-1.5 sm:my-2 relative group">
                              <pre className="bg-gray-900 text-gray-100 p-2 xs:p-2.5 sm:p-3 rounded-md sm:rounded-lg text-[10px] xs:text-xs overflow-x-auto">
                                {code}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(code)}
                                className="absolute top-1 xs:top-1.5 sm:top-2 right-1 xs:right-1.5 sm:right-2 p-0.5 xs:p-1 bg-gray-700 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
                              >
                                <Copy className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-white" />
                              </button>
                            </div>
                          );
                        }
                        return <span key={idx}>{part}</span>;
                      })}
                    </div>
                    {message.role === 'user' && (
                      <div className="text-[10px] xs:text-xs text-purple-100 mt-0.5 xs:mt-1 text-right">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isChatGenerating && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl px-2 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 max-w-[85%]">
                    <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 mb-1 xs:mb-1.5 sm:mb-2">
                      <Brain className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                      <span className="text-[10px] xs:text-xs font-semibold text-purple-600 dark:text-purple-400">{chatLoadingStep}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Loader2 className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 animate-spin text-purple-600 dark:text-purple-400" />
                      <span className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">Generating response...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-2 xs:p-3 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {chatUploadedImage && (
                <div className="mb-2 xs:mb-2.5 sm:mb-3 relative inline-block group">
                  <img
                    src={chatUploadedImage}
                    alt="Preview"
                    className="h-16 xs:h-18 sm:h-20 w-16 xs:w-18 sm:w-20 object-cover rounded-md sm:rounded-lg border-2 border-purple-300 dark:border-purple-600 shadow-md"
                  />
                  <button
                    onClick={handleRemoveChatImage}
                    className="absolute -top-1 xs:-top-1.5 sm:-top-2 -right-1 xs:-right-1.5 sm:-right-2 p-0.5 xs:p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg opacity-100 group-hover:scale-110 active:scale-95"
                  >
                    <X className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-1.5 sm:gap-2">
                <button
                  onClick={() => chatFileInputRef.current?.click()}
                  className="p-1.5 xs:p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md sm:rounded-lg transition-colors active:scale-95"
                  title="Upload image"
                >
                  <ImageIcon className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyPress}
                  placeholder="Ask me anything..."
                  className="flex-1 px-2 xs:px-3 py-1.5 xs:py-2 border border-gray-300 dark:border-gray-600 rounded-md sm:rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-900 dark:text-white resize-none text-xs xs:text-sm"
                  rows={2}
                  disabled={isChatGenerating}
                />
                <button
                  onClick={handleSendChat}
                  disabled={(!chatInput.trim() && !chatUploadedImage) || isChatGenerating}
                  className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md sm:rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  <Send className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5" />
                </button>
              </div>
              <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 mt-1 xs:mt-1.5 sm:mt-2">
                💡 Press Enter to send, Shift+Enter for new line
              </p>
              <input
                ref={chatFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleChatImageUpload}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
