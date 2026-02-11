"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { createPortal } from 'react-dom';
import {
  Upload,
  Loader2,
  X,
  Download,
  Image as ImageIcon,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Send,
  Settings,
  FolderOpen,
  ChevronDown,
  Check,
  RefreshCw,
  RotateCcw,
  Library,
  Zap,
  Wand2
} from 'lucide-react';
import { useApiClient } from '@/lib/apiClient';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';
import { ReferenceSelector } from '@/components/reference-bank/ReferenceSelector';
import { ReferenceItem } from '@/hooks/useReferenceBank';
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from '@/components/credits/CreditCalculator';

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
  file?: File;
  preview: string;
  id: string;
  fromReferenceBank?: boolean;
  referenceId?: string;
  url?: string;
}

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

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault: boolean;
  profileName?: string;
}

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  profileId?: string;
  profileName?: string;
  metadata?: {
    seed?: number;
    steps?: number;
    guidance?: number;
    referenceImageUrl?: string;
    referenceImageUrls?: string[];
  };
}

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
  const { refreshCredits } = useCredits();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useApiClient();

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();

  // Vault folder states
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // Reference Bank Selector State
  const [showReferenceBankSelector, setShowReferenceBankSelector] = useState(false);

  // Generation History State
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Modal states
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Hydration fix
  const [mounted, setMounted] = useState(false);

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
  const FIXED_VALUES = useMemo(() => ({
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
  }), []);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close folder dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get display text for the selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder || !globalProfileId) return 'Please select a vault folder to save your images';
    
    const folder = vaultFolders.find(f => f.id === targetFolder);
    if (folder) {
      if (isAllProfiles && folder.profileName) {
        return `Saving to: ${folder.profileName} / ${folder.name}`;
      }
      if (selectedProfile) {
        const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
        return `Saving to: ${profileDisplay} / ${folder.name}`;
      }
    }
    return 'Please select a vault folder';
  };

  // Load vault folders for the selected profile
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !globalProfileId) return;

    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await fetch(`/api/vault/folders?profileId=${globalProfileId}`);
      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        setVaultFolders(folders);
      }
    } catch (error) {
      console.error('Failed to load vault folders:', error);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  // Load vault data when profile changes
  useEffect(() => {
    loadVaultData();
    setTargetFolder("");
  }, [loadVaultData]);

  // Load generation history
  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      const url = globalProfileId 
        ? `/api/generate/flux-kontext?profileId=${globalProfileId}`
        : "/api/generate/flux-kontext";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const images = data.images || [];
        console.log('📋 Loaded Flux Kontext history:', images.length, 'images');
        setGenerationHistory(images);
      } else {
        console.error('Failed to load history:', response.status);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, globalProfileId]);

  // Load history when apiClient or profile changes
  useEffect(() => {
    if (apiClient) {
      loadGenerationHistory();
    }
  }, [apiClient, globalProfileId, loadGenerationHistory]);

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

  const formattedElapsed = useMemo(() => {
    return formatDuration(elapsedSeconds * 1000);
  }, [elapsedSeconds]);

  const fetchJobImages = useCallback(async (jobId: string): Promise<DatabaseImage[] | null> => {
    if (!apiClient) return null;
    
    try {
      const response = await apiClient.get(`/api/jobs/${jobId}/images`);
      
      if (!response.ok) {
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

  // Handle selection from Reference Bank
  const handleReferenceBankSelect = async (item: ReferenceItem) => {
    try {
      const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
      
      if (!proxyResponse.ok) {
        const newImage: ImageFile = {
          id: `ref-${item.id}-${Date.now()}`,
          preview: item.awsS3Url,
          fromReferenceBank: true,
          referenceId: item.id,
          url: item.awsS3Url,
        };
        
        setSelectedImages([newImage]);
        fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
        setShowReferenceBankSelector(false);
        return;
      }
      
      const blob = await proxyResponse.blob();
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        
        const newImage: ImageFile = {
          id: `ref-${item.id}-${Date.now()}`,
          preview: base64,
          fromReferenceBank: true,
          referenceId: item.id,
          url: item.awsS3Url,
        };
        
        setSelectedImages([newImage]);
        fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error loading reference image:', err);
      setError('Failed to load reference image. Please try again.');
    }

    setShowReferenceBankSelector(false);
  };

  // Handle reusing generation parameters
  const handleReuseGeneration = async (image: GeneratedImage) => {
    if (image.prompt) {
      setPrompt(image.prompt);
    }

    const referenceUrl = image.metadata?.referenceImageUrl || 
                         (image.metadata?.referenceImageUrls && image.metadata.referenceImageUrls[0]);
    
    if (referenceUrl) {
      try {
        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(referenceUrl)}`);
        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const base64 = await base64Promise;

          const newImage: ImageFile = {
            id: `reuse-${Date.now()}`,
            preview: base64,
            fromReferenceBank: true,
            url: referenceUrl,
          };
          setSelectedImages([newImage]);
        }
      } catch (err) {
        console.warn('Failed to load reference image:', referenceUrl, err);
      }
    }

    setShowImageModal(false);
    setSelectedImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    setSelectedImages([newImage]);
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

  const createWorkflowForFluxKontext = useCallback((imageBase64: string) => {
    const normalizedTargetFolder = `outputs/${user?.id}/`;
    
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
  }, [prompt, FIXED_VALUES, user?.id]);

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
      setError('Please select a vault folder to save the output');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setJobStartTime(Date.now());
      setElapsedSeconds(0);

      let imageBase64: string;
      if (image.file) {
        imageBase64 = await convertImageToBase64(image.file);
      } else if (image.preview) {
        imageBase64 = image.preview;
      } else {
        throw new Error('No image data available');
      }

      const workflow = createWorkflowForFluxKontext(imageBase64);

      const selectedFolder = vaultFolders.find(f => f.id === targetFolder);
      const folderProfileId = selectedFolder?.profileId || globalProfileId;

      const referenceImageUrl = image.url || image.preview;

      const response = await apiClient.post('/api/jobs/flux-kontext', {
        workflow,
        userId: user.id,
        prompt,
        params: FIXED_VALUES,
        saveToVault: true,
        vaultProfileId: folderProfileId,
        vaultFolderId: targetFolder,
        referenceImageUrl: referenceImageUrl,
        referenceImageUrls: referenceImageUrl ? [referenceImageUrl] : [],
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
  }, [user, selectedImages, createWorkflowForFluxKontext, prompt, FIXED_VALUES, apiClient, targetFolder, vaultFolders, globalProfileId]);

  // Poll for job updates
  useEffect(() => {
    if (!currentJob?.id || !apiClient) return;

    const pollJob = async () => {
      if (!apiClient) return;
      
      try {
        const response = await apiClient.get(`/api/jobs/${currentJob.id}`);
        
        if (!response.ok) {
          console.error('Failed to fetch job status');
          return;
        }

        const job = await response.json();
        setCurrentJob(job);

        const status = job.status.toUpperCase();
        
        if (status === 'COMPLETED') {
          const duration = jobStartTime ? formatDuration(Date.now() - jobStartTime) : null;
          setLastJobDuration(duration);
          setIsProcessing(false);
          setJobStartTime(null);

          // Refresh credits after successful completion
          refreshCredits();

          if (job.resultUrls && job.resultUrls.length > 0) {
            setResultImages(job.resultUrls);
          }

          const images = await fetchJobImages(job.id);
          if (images && images.length > 0) {
            setJobImages(prev => ({ ...prev, [job.id]: images }));
          }

          // Reload history
          loadGenerationHistory();
        } else if (status === 'FAILED') {
          setError(job.error || 'Generation failed');
          setIsProcessing(false);
          setJobStartTime(null);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    const interval = setInterval(pollJob, 2000);
    return () => clearInterval(interval);
  }, [currentJob?.id, apiClient, jobStartTime, fetchJobImages, loadGenerationHistory]);

  const resetForm = useCallback(() => {
    selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setSelectedImages([]);
    setCurrentJob(null);
    setResultImages([]);
    setError(null);
    setIsProcessing(false);
    setJobStartTime(null);
    setElapsedSeconds(0);
  }, [selectedImages]);

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      if (!imageUrl) {
        throw new Error('No image URL');
      }
      
      let blobUrl: string;
      
      if (imageUrl.startsWith('data:')) {
        blobUrl = imageUrl;
      } else {
        const proxyUrl = `/api/download/image?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.status}`);
        }
        
        const blob = await response.blob();
        blobUrl = window.URL.createObjectURL(blob);
      }
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        if (!imageUrl.startsWith('data:')) {
          window.URL.revokeObjectURL(blobUrl);
        }
      }, 100);
    } catch (error) {
      console.error("Download failed:", error);
      setError("Failed to download image. Please try again.");
    }
  };

  // Chat functions
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
      
      const response = await fetch("/api/flux-kontext-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          image: currentImage,
          conversationHistory: chatMessages.slice(-6),
          currentPrompt: prompt || undefined
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');
      const data = await response.json();
      
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: data.response || "I couldn't generate a response. Please try again.",
        timestamp: new Date()
      }]);
    } catch (error: unknown) {
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

  const handleChatImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setChatUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-center">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-900/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-600 shadow-lg shadow-purple-900/50">
                <Wand2 className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-purple-200">Live Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">Flux Kontext</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Transform your images with AI-powered editing. Upload an image and describe your changes using natural language.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-200"><Upload className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Input</p>
                  <p className="text-sm font-semibold text-white">1 image</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200"><Settings className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Model</p>
                  <p className="text-sm font-semibold text-white">FLUX Dev</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200"><Download className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Output</p>
                  <p className="text-sm font-semibold text-white">High Quality</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Steps</p>
                <p className="text-lg font-semibold text-white">{FIXED_VALUES.steps}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Guidance</p>
                <p className="text-lg font-semibold text-white">{FIXED_VALUES.guidance}</p>
              </div>
            </div>
            {isProcessing && (
              <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 px-4 py-3">
                <p className="text-xs text-purple-300">Processing Time</p>
                <p className="text-lg font-semibold text-white">{formattedElapsed}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Generation Controls */}
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-purple-900/30 backdrop-blur space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Reference Image</label>
                  <div className="flex items-center gap-2">
                    {mounted && (
                      <button
                        type="button"
                        onClick={() => setShowReferenceBankSelector(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all"
                        disabled={isProcessing}
                      >
                        <Library className="w-3.5 h-3.5" />
                        Reference Bank
                      </button>
                    )}
                    {selectedImages.length > 0 && (
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-[11px] font-semibold text-purple-100">1 added</span>
                    )}
                  </div>
                </div>

                {/* Uploaded Image Preview */}
                {selectedImages.length > 0 && (
                  <div className="relative group">
                    <div className={`relative overflow-hidden rounded-xl border ${selectedImages[0].fromReferenceBank ? 'border-violet-500/30' : 'border-white/10'} bg-white/5 shadow-lg shadow-purple-900/30 transition hover:-translate-y-1 hover:shadow-2xl`}>
                      <img
                        src={selectedImages[0].preview}
                        alt="Reference"
                        className="w-full h-48 object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <button
                        onClick={removeImage}
                        disabled={isProcessing}
                        className="absolute top-2 right-2 rounded-full bg-white/10 p-1.5 text-white opacity-0 transition hover:bg-red-500/80 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {selectedImages[0].fromReferenceBank && (
                        <div className="absolute top-2 left-2">
                          <span className="rounded-full bg-violet-500/90 p-1.5 shadow" title="From Reference Bank">
                            <Library className="w-3 h-3 text-white" />
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2">
                        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow">
                          Source Image
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload New Image Button */}
                {selectedImages.length === 0 && (
                  <label 
                    className={`group flex flex-col items-center justify-center w-full h-40 rounded-xl border border-dashed border-white/20 bg-slate-950/60 transition hover:border-purple-200/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-900/30 ${isDragging ? 'border-purple-400 bg-purple-500/10' : ''} ${isProcessing ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="relative mb-2">
                        <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Upload className="relative w-8 h-8 text-purple-200 group-hover:scale-110 transition-transform" />
                      </div>
                      <p className="text-sm text-white">
                        <span className="font-semibold text-purple-100">Upload your image</span>
                      </p>
                      <p className="text-[11px] text-slate-300 mt-1">
                        PNG, JPG, WEBP • Drag & drop
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isProcessing}
                    />
                  </label>
                )}
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Prompt</label>
                  <span className="rounded-full bg-purple-500/20 px-3 py-1 text-[11px] font-semibold text-purple-100">Required</span>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the changes you want to make to the image..."
                    className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-white placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                    rows={4}
                    disabled={isProcessing}
                  />
                </div>
                <p className="text-xs text-slate-300">Be specific about what should change vs. stay the same.</p>
              </div>

              {/* Folder Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-purple-300" />
                  <p className="text-sm font-semibold text-white">Save to Vault</p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
                  )}
                </div>
                
                {/* Modern Custom Dropdown */}
                <div ref={folderDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => !(!mounted || isLoadingVaultData || isProcessing || !globalProfileId) && setFolderDropdownOpen(!folderDropdownOpen)}
                    disabled={!mounted || isLoadingVaultData || isProcessing || !globalProfileId}
                    className={`
                      w-full flex items-center justify-between gap-3 px-4 py-3.5
                      rounded-2xl border transition-all duration-200
                      ${folderDropdownOpen 
                        ? 'border-purple-400 bg-purple-500/10 ring-2 ring-purple-400/30' 
                        : 'border-white/10 bg-slate-800/80 hover:border-purple-400/50 hover:bg-slate-800'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                        ${targetFolder 
                          ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-400/30' 
                          : 'bg-slate-700/50 border border-white/5'
                        }
                      `}>
                        <FolderOpen className={`w-4 h-4 ${targetFolder ? 'text-purple-300' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${targetFolder ? 'text-white' : 'text-slate-400'}`}>
                          {targetFolder 
                            ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                            : 'Select a folder...'
                          }
                        </p>
                        {targetFolder && selectedProfile && (
                          <p className="text-[11px] text-purple-300/70 truncate">
                            {selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {folderDropdownOpen && mounted && (
                    <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetFolder('');
                          setFolderDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                          <X className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm text-slate-400">No folder selected</span>
                        {!targetFolder && <Check className="w-4 h-4 text-purple-400 ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-white/5" />
                      )}

                      <div className="max-h-[200px] overflow-y-auto">
                        {isAllProfiles ? (
                          Object.entries(
                            vaultFolders.filter(f => !f.isDefault).reduce((acc, folder) => {
                              const profileName = folder.profileName || 'Unknown Profile';
                              if (!acc[profileName]) acc[profileName] = [];
                              acc[profileName].push(folder);
                              return acc;
                            }, {} as Record<string, VaultFolder[]>)
                          ).map(([profileName, folders]) => (
                            <div key={profileName}>
                              <div className="px-4 py-2 text-xs font-medium text-purple-300 bg-purple-500/10 border-b border-purple-500/20">
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
                                    ${targetFolder === folder.id ? 'bg-purple-500/15' : 'hover:bg-white/5'}
                                  `}
                                >
                                  <div className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                    ${targetFolder === folder.id 
                                      ? 'bg-gradient-to-br from-purple-500/40 to-pink-500/40 border border-purple-400/40' 
                                      : 'bg-slate-700/50 border border-white/5'
                                    }
                                  `}>
                                    <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-purple-300' : 'text-slate-400'}`} />
                                  </div>
                                  <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                                    {folder.name}
                                  </span>
                                  {targetFolder === folder.id && (
                                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          ))
                        ) : (
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
                                ${targetFolder === folder.id ? 'bg-purple-500/15' : 'hover:bg-white/5'}
                              `}
                            >
                              <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                ${targetFolder === folder.id 
                                  ? 'bg-gradient-to-br from-purple-500/40 to-pink-500/40 border border-purple-400/40' 
                                  : 'bg-slate-700/50 border border-white/5'
                                }
                              `}>
                                <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-purple-300' : 'text-slate-400'}`} />
                              </div>
                              <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                                {folder.name}
                              </span>
                              {targetFolder === folder.id && (
                                <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>

                      {vaultFolders.filter(f => !f.isDefault).length === 0 && (
                        <div className="px-4 py-6 text-center">
                          <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">No folders available</p>
                          <p className="text-xs text-slate-500 mt-1">Create folders in the Vault tab</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                {targetFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <p className="text-xs text-purple-200 flex-1 truncate">
                      {getSelectedFolderDisplay()}
                    </p>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                  <AlertCircle className="h-5 w-5 text-red-200" />
                  <p className="text-sm text-red-50">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-[1.6fr_0.4fr] gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing || !prompt.trim() || selectedImages.length === 0 || !targetFolder}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-400 via-pink-500 to-rose-600 px-6 py-3 font-semibold text-white shadow-xl shadow-purple-900/40 transition hover:-translate-y-0.5 disabled:from-slate-500 disabled:to-slate-500 disabled:shadow-none"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-10" />
                  <div className="relative flex items-center justify-center gap-2">
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Generate</span>
                      </>
                    )}
                  </div>
                </button>
                <button
                  onClick={resetForm}
                  disabled={isProcessing}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-purple-200/40 disabled:opacity-60"
                  title="Reset form"
                >
                  <RotateCcw className="w-4 h-4 inline mr-2" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-purple-900/30 backdrop-blur">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
                  <ImageIcon className="w-4 h-4" />
                  Generated Images
                </div>
                {currentJob?.id && jobImages[currentJob.id]?.length > 0 && (
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                    {jobImages[currentJob.id].length} {jobImages[currentJob.id].length === 1 ? 'image' : 'images'} ready
                  </div>
                )}
                {lastJobDuration && (
                  <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
                    Completed in {lastJobDuration}
                  </div>
                )}
              </div>

              {/* Generated Images Grid */}
              {currentJob?.id && jobImages[currentJob.id]?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {jobImages[currentJob.id].map((image) => (
                    <div
                      key={image.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-purple-900/30 transition hover:-translate-y-1 hover:shadow-2xl"
                    >
                      <div className="relative">
                        <img
                          src={image.awsS3Url || image.url || image.dataUrl || ''}
                          alt={image.filename}
                          className="w-full h-full object-cover transition duration-700 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                          <div className="mb-3 text-xs text-slate-200 line-clamp-2">{prompt}</div>
                          <button
                            onClick={() => downloadDatabaseImage(image)}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/5 py-16">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-30 animate-pulse" />
                    <Loader2 className="relative w-12 h-12 text-purple-300 animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">Generating your image...</p>
                    <p className="text-xs text-slate-400 mt-1">{formattedElapsed} elapsed</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                    <ImageIcon className="w-7 h-7 text-purple-200" />
                  </div>
                  <p className="text-sm text-slate-200/80">
                    Your outputs will land here.
                  </p>
                </div>
              )}

              {/* Generation History */}
              <div className="mt-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <h3 className="text-sm font-semibold">Recent Generations</h3>
                    {generationHistory.length > 0 && (
                      <span className="text-xs text-slate-400">({generationHistory.length})</span>
                    )}
                  </div>
                  {generationHistory.length > 8 && (
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs text-purple-300 hover:text-purple-200 transition flex items-center gap-1"
                    >
                      View All
                      <span className="bg-purple-500/20 rounded-full px-2 py-0.5">{generationHistory.length}</span>
                    </button>
                  )}
                </div>
                {generationHistory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {generationHistory.slice(0, 8).map((image) => (
                      <button
                        key={image.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md shadow-purple-900/20 transition hover:-translate-y-1 hover:border-purple-200/40"
                        onClick={() => {
                          setSelectedImage(image);
                          setShowImageModal(true);
                        }}
                      >
                        {image.imageUrl ? (
                          <img
                            src={image.imageUrl}
                            alt={image.prompt}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-800/50 ${image.imageUrl ? 'hidden' : 'flex'}`}
                        >
                          <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-xs text-slate-400 px-2 text-center line-clamp-2">{image.prompt?.slice(0, 50) || 'Image'}</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-2 left-2 right-2 text-left text-[11px] text-slate-100 line-clamp-2 opacity-0 transition group-hover:opacity-100">
                          {image.prompt}
                        </div>
                        {isAllProfiles && image.profileName && (
                          <div className="absolute top-2 left-2 text-[9px] text-purple-200 bg-purple-600/60 rounded px-1.5 py-0.5">
                            {image.profileName}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <span>{isLoadingHistory ? 'Loading history...' : 'No previous generations yet'}</span>
                    {isLoadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={lightboxImage}
            alt={lightboxTitle}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Floating Chat Assistant */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-600 shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105"
          >
            <MessageSquare className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-slate-900">
              AI
            </span>
          </button>
        )}

        {isChatOpen && (
          <div className="flex flex-col w-[350px] sm:w-[400px] h-[500px] rounded-3xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-500/20 to-pink-500/20">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Flux Kontext Assistant</p>
                  <p className="text-[10px] text-slate-300">Powered by AI</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="rounded-full p-1.5 hover:bg-white/10 transition"
              >
                <X className="w-5 h-5 text-slate-300" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-slate-100'
                    }`}
                  >
                    {msg.image && (
                      <img src={msg.image} alt="Uploaded" className="w-full max-h-32 object-contain rounded-lg mb-2" />
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isChatGenerating && (
                <div className="flex justify-start">
                  <div className="bg-white/10 rounded-2xl px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                  </div>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-white/10">
              {chatUploadedImage && (
                <div className="relative mb-2 inline-block">
                  <img src={chatUploadedImage} alt="Upload" className="h-16 w-16 object-cover rounded-lg" />
                  <button
                    onClick={() => setChatUploadedImage(null)}
                    className="absolute -top-1 -right-1 rounded-full bg-red-500 p-0.5"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="flex-shrink-0 p-2 rounded-xl hover:bg-white/10 cursor-pointer transition">
                  <Upload className="w-5 h-5 text-slate-300" />
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleChatImageUpload}
                    className="hidden"
                  />
                </label>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyPress}
                  placeholder="Ask me anything..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 resize-none"
                  rows={1}
                  disabled={isChatGenerating}
                />
                <button
                  onClick={handleSendChat}
                  disabled={isChatGenerating || (!chatInput.trim() && !chatUploadedImage)}
                  className="flex-shrink-0 p-2 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                💡 Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {showImageModal && selectedImage && mounted && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <div 
            className="relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 space-y-4 text-slate-100">
              <div className="rounded-2xl border border-white/10 bg-slate-800 overflow-hidden max-h-[50vh] flex items-center justify-center">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-purple-300">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-base font-semibold">Image Details</h3>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-800/50 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-1">Prompt</p>
                    <p className="text-sm text-slate-100 leading-relaxed">{selectedImage.prompt}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full bg-white/10 px-3 py-1">Flux Kontext</span>
                    {selectedImage.metadata?.steps && (
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-200">
                        Steps: {selectedImage.metadata.steps}
                      </span>
                    )}
                    {selectedImage.metadata?.guidance && (
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-200">
                        Guidance: {selectedImage.metadata.guidance}
                      </span>
                    )}
                  </div>

                  {(selectedImage.metadata?.referenceImageUrl || selectedImage.metadata?.referenceImageUrls?.[0]) && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Reference Image</p>
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                        <img 
                          src={selectedImage.metadata.referenceImageUrl || selectedImage.metadata.referenceImageUrls?.[0]} 
                          alt="Reference"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><rect width="24" height="24"/></svg>';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400">
                    Created: {new Date(selectedImage.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleReuseGeneration(selectedImage)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-purple-400/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20 hover:-translate-y-0.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reuse Settings
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedImage.imageUrl, `flux-kontext-${selectedImage.id}.png`)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View All History Modal */}
      {showHistoryModal && mounted && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <RefreshCw className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Generation History</h2>
                  <p className="text-xs text-slate-400">{generationHistory.length} images generated</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {generationHistory.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {generationHistory.map((image) => (
                    <button
                      key={image.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md transition hover:-translate-y-1 hover:border-purple-400/40"
                      onClick={() => {
                        setShowHistoryModal(false);
                        setSelectedImage(image);
                        setShowImageModal(true);
                      }}
                    >
                      {image.imageUrl ? (
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/50">
                          <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 transition group-hover:opacity-100">
                        <p className="text-[11px] text-white line-clamp-2 mb-1">{image.prompt}</p>
                      </div>
                      {isAllProfiles && image.profileName && (
                        <div className="absolute top-2 left-2 text-[9px] text-purple-200 bg-purple-600/60 rounded px-1.5 py-0.5">
                          {image.profileName}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 text-[9px] text-slate-300 bg-black/50 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                        {new Date(image.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                  <p>No generation history yet</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reference Bank Selector */}
      {showReferenceBankSelector && globalProfileId && (
        <ReferenceSelector
          profileId={globalProfileId}
          onSelect={handleReferenceBankSelect}
          onClose={() => setShowReferenceBankSelector(false)}
          filterType="image"
          isOpen={true}
        />
      )}

      {/* Credit Calculator */}
      <CreditCalculator
        path="flux-kontext"
        modifiers={[]}
        position="bottom-right"
      />
    </div>
  );
}
