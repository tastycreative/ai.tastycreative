// app/(dashboard)/workspace/generate-content/face-swapping/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { 
  Upload, 
  Play, 
  Download, 
  RefreshCw, 
  Image as ImageIcon,
  Users,
  Zap,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react';
import Image from 'next/image';

interface GenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  resultUrls?: string[];
  error?: string;
  createdAt: Date | string;
}

interface LoRAModel {
  fileName: string;
  displayName: string;
  name: string;
}

interface UploadedImage {
  filename: string;
  originalName: string;
  size: number;
  preview?: string;
}

// Simple UI Components
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-6 py-4 border-b border-gray-200">
    {children}
  </div>
);

const CardTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
);

const CardContent = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-6 py-4 ${className}`}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'default',
  size = 'default',
  className = "",
  type = 'button'
}: { 
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  type?: 'button' | 'submit';
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200"
  };
  
  const sizeClasses = {
    default: "px-4 py-2 text-sm",
    sm: "px-3 py-1.5 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ 
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  min,
  max,
  step,
  ...props
}: {
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: string;
  max?: string;
  step?: string;
  [key: string]: any;
}) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    min={min}
    max={max}
    step={step}
    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
    {...props}
  />
);

const Label = ({ children, htmlFor, className = "" }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-700 mb-1 ${className}`}>
    {children}
  </label>
);

const Select = ({ 
  value, 
  onValueChange, 
  disabled = false, 
  children 
}: { 
  value: string; 
  onValueChange: (value: string) => void; 
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <select
    value={value}
    onChange={(e) => onValueChange(e.target.value)}
    disabled={disabled}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
  >
    {children}
  </select>
);

const SelectOption = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <option value={value}>{children}</option>
);

const Textarea = ({ 
  value,
  onChange,
  placeholder,
  rows = 3,
  className = ""
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical ${className}`}
  />
);

const Progress = ({ value }: { value: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const Alert = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'destructive' }) => (
  <div className={`p-4 rounded-lg border ${variant === 'destructive' ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-300 bg-gray-50 text-gray-800'}`}>
    {children}
  </div>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center">
    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
    <span>{children}</span>
  </div>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'outline' | 'destructive' | 'secondary' }) => {
  const variantClasses = {
    default: "bg-blue-600 text-white",
    outline: "border border-gray-300 bg-white text-gray-700",
    destructive: "bg-red-600 text-white",
    secondary: "bg-gray-200 text-gray-800"
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ml-2 ${variantClasses[variant]}`}>
      {children}
    </span>
  );
};

const Separator = () => <hr className="my-6 border-gray-200" />;

const FaceSwappingPage: React.FC = () => {
  const { isSignedIn, isLoaded } = useAuth();
  
  // State management
  const [targetImage, setTargetImage] = useState<UploadedImage | null>(null);
  const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
  const [selectedLora, setSelectedLora] = useState<string>('None');
  const [loraModels, setLoraModels] = useState<LoRAModel[]>([]);
  const [prompt, setPrompt] = useState<string>('Retain face. fit the face perfectly to the body. natural realistic eyes, match the skin tone of the body to the face');
  
  // Generation parameters
  const [guidance, setGuidance] = useState<number>(100);
  const [steps, setSteps] = useState<number>(40);
  const [cfg, setCfg] = useState<number>(1);
  const [seed, setSeed] = useState<number>(-1);
  const [denoise, setDenoise] = useState<number>(1);
  const [contextExpandPixels, setContextExpandPixels] = useState<number>(200);
  const [gaussianBlurKernel, setGaussianBlurKernel] = useState<number>(30);
  const [gaussianBlurSigma, setGaussianBlurSigma] = useState<number>(10);
  
  // TeaCache settings
  const [useTeaCache, setUseTeaCache] = useState<boolean>(true);
  const [cacheThreshold, setCacheThreshold] = useState<number>(0.4);
  
  // Job management
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  
  // UI state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('upload');

  // Load LoRA models
  useEffect(() => {
    if (isSignedIn) {
      loadLoRAModels();
    }
  }, [isSignedIn]);

  // Poll job status
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    if (currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing')) {
      pollInterval = setInterval(checkJobStatus, 2000);
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentJob]);

  const loadLoRAModels = async () => {
    try {
      setIsLoadingModels(true);
      
      const response = await fetch('/api/models/loras', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load LoRA models: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.models)) {
        setLoraModels(data.models);
      } else {
        setLoraModels([{ fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' }]);
      }
    } catch (error) {
      console.error('Error loading LoRA models:', error);
      setError('Failed to load LoRA models: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setLoraModels([{ fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' }]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'source' | 'target') => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const result = await response.json();

      const uploadedImage: UploadedImage = {
        filename: result.filename,
        originalName: result.originalName,
        size: result.size,
        preview: URL.createObjectURL(file)
      };

      if (type === 'source') {
        setSourceImage(uploadedImage);
      } else {
        setTargetImage(uploadedImage);
      }

    } catch (error) {
      console.error(`${type} image upload error:`, error);
      setError(`Failed to upload ${type} image: ` + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const buildWorkflow = () => {
    if (!sourceImage || !targetImage) {
      throw new Error('Both source and target images are required');
    }

    const finalSeed = seed === -1 ? Math.floor(Math.random() * 1000000000) : seed;

    const loraConfig = [];
    
    // Always include portrait and turbo LoRAs
    loraConfig.push({
      "on": true,
      "lora": "comfyui_portrait_lora64.safetensors",
      "strength": 1,
      "strengthTwo": null
    });
    
    loraConfig.push({
      "on": true,
      "lora": "FLUX.1-Turbo-Alpha.safetensors",
      "strength": 1,
      "strengthTwo": null
    });
    
    if (selectedLora !== 'None') {
      loraConfig.push({
        "on": true,
        "lora": selectedLora,
        "strength": 1,
        "strengthTwo": null
      });
    }

    // Build exact workflow structure
    const workflow = {
      "345": {
        "inputs": { "conditioning": ["343", 0], "guidance": guidance },
        "class_type": "FluxGuidance"
      },
      "338": {
        "inputs": { "vae_name": "ae.safetensors" },
        "class_type": "VAELoader"
      },
      "341": {
        "inputs": {
          "clip_name1": "clip_l.safetensors",
          "clip_name2": "t5xxl_fp16.safetensors",
          "type": "flux",
          "device": "default"
        },
        "class_type": "DualCLIPLoader"
      },
      "340": {
        "inputs": {
          "unet_name": "Flux-FillDevFP8.safetensors",
          "weight_dtype": "default"
        },
        "class_type": "UNETLoader"
      },
      "337": {
        "inputs": { "model": ["340", 0], "clip": ["341", 0] },
        "class_type": "Power Lora Loader (rgthree)",
        "widgets_values": [{}, {"type": "PowerLoraLoaderHeaderWidget"}, ...loraConfig, {}, ""]
      },
      "343": {
        "inputs": { "text": prompt, "clip": ["341", 0] },
        "class_type": "CLIPTextEncode"
      },
      "404": {
        "inputs": { "conditioning": ["343", 0] },
        "class_type": "ConditioningZeroOut"
      },
      "239": {
        "inputs": { "image": targetImage.filename, "upload": "image" },
        "class_type": "LoadImage"
      },
      "240": {
        "inputs": { "image": sourceImage.filename, "upload": "image" },
        "class_type": "LoadImage"
      },
      "411": {
        "inputs": {
          "image": ["239", 0], "mask": ["239", 1],
          "context_expand_pixels": contextExpandPixels, "context_expand_factor": 1,
          "fill_mask_holes": true, "blur_mask_pixels": 16, "invert_mask": false,
          "blend_pixels": 16, "rescale_algorithm": "bicubic", "mode": "forced size",
          "force_width": 832, "force_height": 1216, "rescale_factor": 1,
          "min_width": 1024, "min_height": 1024, "max_width": 768, "max_height": 768, "padding": 32
        },
        "class_type": "InpaintCrop"
      },
      "399": {
        "inputs": {
          "image": ["411", 1], "width": 832, "height": 1216,
          "interpolation": "lanczos", "method": "keep proportion",
          "condition": "downscale if bigger", "multiple_of": 0
        },
        "class_type": "ImageResize+"
      },
      "175": {
        "inputs": {
          "image": ["240", 0], "width": 0, "height": 512,
          "interpolation": "lanczos", "method": "keep proportion",
          "condition": "always", "multiple_of": 0
        },
        "class_type": "ImageResize+"
      },
      "323": {
        "inputs": {
          "image1": ["399", 0], "image2": ["175", 0],
          "direction": "right", "match_image_size": true
        },
        "class_type": "ImageConcanate"
      },
      "402": {
        "inputs": {
          "mask": ["411", 2], "width": ["399", 1], "height": ["399", 2],
          "keep_proportions": true, "upscale_method": "nearest-exact", "crop": "disabled"
        },
        "class_type": "ResizeMask"
      },
      "184": {
        "inputs": {
          "width": ["175", 1], "height": ["175", 2], "batch_size": 1, "color": 0
        },
        "class_type": "EmptyImage"
      },
      "182": {
        "inputs": { "mask": ["402", 0] },
        "class_type": "MaskToImage"
      },
      "181": {
        "inputs": {
          "image1": ["182", 0], "image2": ["184", 0],
          "direction": "right", "match_image_size": true
        },
        "class_type": "ImageConcanate"
      },
      "185": {
        "inputs": { "image": ["181", 0], "channel": "red" },
        "class_type": "ImageToMask"
      },
      "403": {
        "inputs": {
          "mask": ["185", 0], "kernel_size": gaussianBlurKernel, "sigma": gaussianBlurSigma
        },
        "class_type": "ImpactGaussianBlurMask"
      },
      "221": {
        "inputs": {
          "positive": ["345", 0], "negative": ["404", 0], "vae": ["338", 0],
          "pixels": ["323", 0], "mask": ["403", 0], "noise_mask": true
        },
        "class_type": "InpaintModelConditioning"
      },
      ...(useTeaCache ? {
        "416": {
          "inputs": {
            "model": ["337", 0], "model_type": "flux", "rel_l1_thresh": cacheThreshold,
            "start_percent": 0, "end_percent": 1, "cache_device": "cuda"
          },
          "class_type": "TeaCache"
        }
      } : {}),
      "346": {
        "inputs": {
          "seed": finalSeed, "steps": steps, "cfg": cfg,
          "sampler_name": "euler", "scheduler": "normal", "denoise": denoise,
          "model": useTeaCache ? ["416", 0] : ["337", 0],
          "positive": ["221", 0], "negative": ["221", 1], "latent_image": ["221", 2]
        },
        "class_type": "KSampler"
      },
      "214": {
        "inputs": { "samples": ["346", 0], "vae": ["338", 0] },
        "class_type": "VAEDecode"
      },
      "228": {
        "inputs": {
          "image": ["214", 0], "width": ["399", 1], "height": ["399", 2], "x": 0, "y": 0
        },
        "class_type": "ImageCrop"
      },
      "412": {
        "inputs": {
          "stitch": ["411", 0], "inpainted_image": ["228", 0], "rescale_algorithm": "bislerp"
        },
        "class_type": "InpaintStitch"
      },
      "413": {
        "inputs": {
          "filename_prefix": "AceFaceSwap/Faceswap", "images": ["412", 0]
        },
        "class_type": "SaveImage"
      }
    };
    
    return workflow;
  };

  const startFaceSwap = async () => {
    if (!sourceImage || !targetImage) {
      setError('Please upload both source and target images');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentJob(null);
    setGeneratedImages([]);

    try {
      const workflow = buildWorkflow();
      
      const params = {
        targetImage: targetImage.filename,
        sourceImage: sourceImage.filename,
        selectedLora, prompt, guidance, steps, cfg, seed, denoise,
        contextExpandPixels, gaussianBlurKernel, gaussianBlurSigma,
        useTeaCache, cacheThreshold
      };

      const response = await fetch('/api/generate/face-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow, params, type: 'face-swap' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Generation failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.jobId) {
        setCurrentJob({
          id: result.jobId,
          status: 'pending',
          progress: 0,
          createdAt: new Date()
        });
        setActiveTab('progress');
      } else {
        throw new Error('Invalid response from generation API');
      }

    } catch (error) {
      console.error('Face swap generation error:', error);
      setError('Generation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsGenerating(false);
    }
  };

  const checkJobStatus = async () => {
    if (!currentJob) return;

    try {
      const response = await fetch(`/api/jobs/${currentJob.id}`);

      if (response.ok) {
        const jobData = await response.json();

        setCurrentJob(prev => prev ? {
          ...prev,
          status: jobData.status,
          progress: jobData.progress,
          resultUrls: jobData.resultUrls,
          error: jobData.error
        } : null);

        if (jobData.status === 'completed' && jobData.resultUrls) {
          setGeneratedImages(jobData.resultUrls);
          setIsGenerating(false);
          setActiveTab('results');
        } else if (jobData.status === 'failed') {
          setError(jobData.error || 'Generation failed');
          setIsGenerating(false);
        }
      }
    } catch (error) {
      console.error('Error checking job status:', error);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetGeneration = () => {
    setCurrentJob(null);
    setIsGenerating(false);
    setGeneratedImages([]);
    setError(null);
    setActiveTab('upload');
  };

  // Tab Navigation
  const TabButton = ({ tabId, icon: Icon, label }: { tabId: string; icon: any; label: string }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === tabId 
          ? 'bg-blue-600 text-white' 
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
              <p className="text-gray-600">Please sign in to access face swapping.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">AI Face Swapping</h1>
        <p className="text-gray-600">
          Swap faces between images using FLUX Fill + ACE++ Pipeline
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg w-fit mx-auto">
        <TabButton tabId="upload" icon={Upload} label="Upload" />
        <TabButton tabId="settings" icon={Settings} label="Settings" />
        <TabButton tabId="progress" icon={Clock} label="Progress" />
        <TabButton tabId="results" icon={ImageIcon} label="Results" />
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Target Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2" />
                  Target Image
                  <Badge variant="outline">Node 239</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  The image where you want to place the new face
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {targetImage?.preview ? (
                    <div className="space-y-2">
                      <Image
                        src={targetImage.preview}
                        alt="Target image"
                        width={200}
                        height={200}
                        className="mx-auto rounded-lg object-cover"
                      />
                      <p className="text-sm text-gray-600">{targetImage.originalName}</p>
                      <Badge variant="outline">
                        {(targetImage.size / 1024 / 1024).toFixed(1)} MB
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
                      <p className="text-gray-600">Upload target image</p>
                    </div>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'target');
                  }}
                  disabled={isUploading}
                />
              </CardContent>
            </Card>

            {/* Source Face */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Source Face
                  <Badge variant="outline">Node 240</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  The face you want to swap into the target image
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {sourceImage?.preview ? (
                    <div className="space-y-2">
                      <Image
                        src={sourceImage.preview}
                        alt="Source face"
                        width={200}
                        height={200}
                        className="mx-auto rounded-lg object-cover"
                      />
                      <p className="text-sm text-gray-600">{sourceImage.originalName}</p>
                      <Badge variant="outline">
                        {(sourceImage.size / 1024 / 1024).toFixed(1)} MB
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
                      <p className="text-gray-600">Upload source face image</p>
                    </div>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'source');
                  }}
                  disabled={isUploading}
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => setActiveTab('settings')}
              disabled={!sourceImage || !targetImage || isUploading}
              size="lg"
            >
              Configure Settings
              <Settings className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* LoRA Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Additional LoRA Model
                  <Badge variant="outline">Node 337</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Portrait & Turbo LoRAs are always included
                </p>
                <Label>Additional LoRA (Optional)</Label>
                <Select 
                  value={selectedLora} 
                  onValueChange={setSelectedLora}
                  disabled={isLoadingModels}
                >
                  {loraModels.map((model) => (
                    <SelectOption key={model.fileName} value={model.fileName}>
                      {model.displayName}
                    </SelectOption>
                  ))}
                </Select>
                {isLoadingModels && (
                  <p className="text-sm text-gray-500 flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading models...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Prompt */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Prompt
                  <Badge variant="outline">Node 343</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Label>Generation Instructions</Label>
                <Textarea
                  placeholder="Retain face. fit the face perfectly to the body. natural realistic eyes, match the skin tone of the body to the face"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Generation Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Guidance: {guidance}</Label>
                  <Input
                    type="range"
                    min="1"
                    max="100"
                    value={guidance}
                    onChange={(e) => setGuidance(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Node 345</p>
                </div>
                <div className="space-y-2">
                  <Label>Steps: {steps}</Label>
                  <Input
                    type="range"
                    min="1"
                    max="50"
                    value={steps}
                    onChange={(e) => setSteps(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Node 346</p>
                </div>
                <div className="space-y-2">
                  <Label>CFG: {cfg}</Label>
                  <Input
                    type="range"
                    min="1"
                    max="20"
                    step="0.1"
                    value={cfg}
                    onChange={(e) => setCfg(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Node 346</p>
                </div>
                <div className="space-y-2">
                  <Label>Denoise: {denoise}</Label>
                  <Input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={denoise}
                    onChange={(e) => setDenoise(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Node 346</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Seed (-1 for random)</Label>
                <Input
                  type="number"
                  placeholder="Random (-1)"
                  value={seed === -1 ? '' : seed}
                  onChange={(e) => setSeed(Number(e.target.value) || -1)}
                />
                <p className="text-xs text-gray-500">Node 346</p>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Context Expand: {contextExpandPixels}px</Label>
                  <Input
                    type="range"
                    min="16"
                    max="64"
                    value={contextExpandPixels}
                    onChange={(e) => setContextExpandPixels(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Node 411</p>
                </div>
                <div className="space-y-2">
                  <Label>Blur Kernel: {gaussianBlurKernel}</Label>
                  <Input
                    type="range"
                    min="10"
                    max="50"
                    value={gaussianBlurKernel}
                    onChange={(e) => setGaussianBlurKernel(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Node 403</p>
                </div>
                <div className="space-y-2">
                  <Label>Blur Sigma: {gaussianBlurSigma}</Label>
                  <Input
                    type="range"
                    min="1"
                    max="20"
                    value={gaussianBlurSigma}
                    onChange={(e) => setGaussianBlurSigma(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Node 403</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="tea-cache"
                    checked={useTeaCache}
                    onChange={(e) => setUseTeaCache(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="tea-cache">
                    Enable TeaCache (Node 416) - Faster generation
                  </Label>
                </div>
                {useTeaCache && (
                  <div className="space-y-2">
                    <Label>Cache Threshold: {cacheThreshold}</Label>
                    <Input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={cacheThreshold}
                      onChange={(e) => setCacheThreshold(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button
              onClick={startFaceSwap}
              disabled={!sourceImage || !targetImage || isGenerating}
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Face Swap
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Face Swap Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentJob && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <Badge variant={
                    currentJob.status === 'completed' ? 'default' :
                    currentJob.status === 'failed' ? 'destructive' :
                    currentJob.status === 'processing' ? 'secondary' : 'outline'
                  }>
                    {currentJob.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Progress:</span>
                    <span>{currentJob.progress || 0}%</span>
                  </div>
                  <Progress value={currentJob.progress || 0} />
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Job ID: {currentJob.id}</span>
                  <span>Started: {new Date(currentJob.createdAt).toLocaleTimeString()}</span>
                </div>

                {currentJob.status === 'failed' && currentJob.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{currentJob.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            <div className="flex justify-center space-x-4">
              <Button 
                onClick={checkJobStatus} 
                variant="outline"
                disabled={!currentJob}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button 
                onClick={resetGeneration} 
                variant="outline"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
              Face Swap Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generatedImages.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedImages.map((url, index) => (
                  <div key={index} className="space-y-2">
                    <div className="relative group">
                      <Image
                        src={url}
                        alt={`Face swap result ${index + 1}`}
                        width={300}
                        height={300}
                        className="w-full h-auto rounded-lg object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <Button
                          onClick={() => downloadImage(url, `faceswap_${index + 1}.png`)}
                          variant="secondary"
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge variant="outline">Result {index + 1}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No results available yet</p>
              </div>
            )}
            
            <Separator />
            
            <div className="flex justify-center">
              <Button onClick={resetGeneration} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start New Generation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FaceSwappingPage;