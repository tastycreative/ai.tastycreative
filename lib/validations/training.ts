import { z } from 'zod';

// Base schema for training configuration matching ai-toolkit format
export const trainingConfigSchema = z.object({
  // Job configuration
  name: z.string().min(1, 'Model name is required').max(50, 'Model name too long'),
  trigger_word: z.string().optional().nullable(),
  
  // Network configuration
  network: z.object({
    type: z.enum(['lora', 'lycoris', 'lokr']).default('lora'),
    linear: z.number().min(1).max(512).default(32),
    linear_alpha: z.number().min(1).max(512).default(32),
    conv: z.number().min(1).max(512).default(16),
    conv_alpha: z.number().min(1).max(512).default(16),
    lokr_full_rank: z.boolean().default(true),
    lokr_factor: z.number().default(-1),
    network_kwargs: z.object({
      ignore_if_contains: z.array(z.string()).default([])
    }).default({ ignore_if_contains: [] })
  }).default({
    type: 'lora',
    linear: 32,
    linear_alpha: 32,
    conv: 16,
    conv_alpha: 16,
    lokr_full_rank: true,
    lokr_factor: -1,
    network_kwargs: { ignore_if_contains: [] }
  }),

  // Save configuration
  save: z.object({
    dtype: z.enum(['bf16', 'fp16', 'fp32']).default('bf16'),
    save_every: z.number().min(50).max(5000).default(250),
    max_step_saves_to_keep: z.number().min(1).max(20).default(4),
    save_format: z.enum(['diffusers', 'safetensors', 'ckpt']).default('diffusers'),
    push_to_hub: z.boolean().default(false)
  }).default({
    dtype: 'bf16',
    save_every: 250,
    max_step_saves_to_keep: 4,
    save_format: 'diffusers',
    push_to_hub: false
  }),

  // Training parameters
  train: z.object({
    batch_size: z.number().min(1).max(32).default(1),
    steps: z.number().min(100).max(2000).default(1500),  // Limited to max 2000 steps
    gradient_accumulation: z.number().min(1).max(32).default(1), // Fixed name to match ai-toolkit exactly
    train_unet: z.boolean().default(true),
    train_text_encoder: z.boolean().default(false),
    gradient_checkpointing: z.boolean().default(true),
    noise_scheduler: z.enum(['flowmatch', 'ddpm', 'ddim']).default('flowmatch'),
    optimizer: z.enum(['adamw8bit', 'adamw', 'lion', 'prodigy']).default('adamw8bit'),
    timestep_type: z.enum(['sigmoid', 'uniform', 'linear']).default('sigmoid'),
    content_or_style: z.enum(['balanced', 'content', 'style']).default('balanced'),
    lr: z.number().min(0.00001).max(0.01).default(0.0001),
    optimizer_params: z.object({
      weight_decay: z.number().min(0).max(0.01).default(0.0001)
    }).default({ weight_decay: 0.0001 }),
    unload_text_encoder: z.boolean().default(false),
    cache_text_embeddings: z.boolean().default(false),
    skip_first_sample: z.boolean().default(false),
    disable_sampling: z.boolean().default(false),
    linear_timesteps: z.boolean().default(false), // Added from ai-toolkit
    dtype: z.enum(['bf16', 'fp16', 'fp32']).default('bf16'),
    diff_output_preservation: z.boolean().default(false),
    diff_output_preservation_multiplier: z.number().default(1),
    diff_output_preservation_class: z.string().default('person'),
    ema_config: z.object({
      use_ema: z.boolean().default(true), // Changed to true to match ai-toolkit
      ema_decay: z.number().min(0.9).max(0.999).default(0.99)
    }).default({ use_ema: true, ema_decay: 0.99 })
  }),

  // Model configuration
  model: z.object({
    name_or_path: z.string().default('black-forest-labs/FLUX.1-dev'),
    quantize: z.boolean().default(true),
    qtype: z.enum(['qfloat8', 'qint8', 'qint4']).default('qfloat8'),
    quantize_te: z.boolean().default(true),
    qtype_te: z.enum(['qfloat8', 'qint8', 'qint4']).default('qfloat8'),
    arch: z.enum(['flux', 'sd15', 'sdxl', 'sd3']).default('flux'),
    low_vram: z.boolean().default(false),
    model_kwargs: z.record(z.string(), z.any()).default({})
  }).default({
    name_or_path: 'black-forest-labs/FLUX.1-dev',
    quantize: true,
    qtype: 'qfloat8',
    quantize_te: true,
    qtype_te: 'qfloat8',
    arch: 'flux',
    low_vram: false,
    model_kwargs: {}
  }),

  // Sample configuration
  sample: z.object({
    sampler: z.enum(['flowmatch', 'ddpm', 'ddim', 'euler']).default('flowmatch'),
    sample_every: z.number().min(50).max(5000).default(250),
    width: z.number().min(256).max(2048).default(1024),
    height: z.number().min(256).max(2048).default(1024),
    samples: z.array(z.object({
      prompt: z.string().min(1, 'Prompt is required')
    })).min(1, 'At least one sample prompt is required'),
    neg: z.string().default(''),
    seed: z.number().min(1).default(42),
    walk_seed: z.boolean().default(true),
    guidance_scale: z.number().min(1).max(30).default(4),
    sample_steps: z.number().min(1).max(150).default(25),
    num_frames: z.number().min(1).max(16).default(1),
    fps: z.number().min(1).max(60).default(1)
  })
});

// Dataset configuration schema
export const datasetSchema = z.object({
  folder_path: z.string().min(1, 'Dataset folder path is required'),
  control_path: z.string().optional().nullable(),
  mask_path: z.string().optional().nullable(),
  mask_min_value: z.number().min(0).max(1).default(0.1),
  default_caption: z.string().default(''),
  caption_ext: z.string().default('txt'),
  caption_dropout_rate: z.number().min(0).max(1).default(0.05),
  cache_latents_to_disk: z.boolean().default(false),
  is_reg: z.boolean().default(false),
  network_weight: z.number().min(0.1).max(2).default(1),
  resolution: z.array(z.number().min(256).max(2048)).length(3).default([512, 768, 1024]),
  controls: z.array(z.any()).default([]),
  shrink_video_to_frames: z.boolean().default(true),
  num_frames: z.number().min(1).max(32).default(1),
  do_i2v: z.boolean().default(true)
});

// Training job creation schema
export const createTrainingJobSchema = z.object({
  name: z.string().min(1, 'Job name is required').max(100, 'Job name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  config: trainingConfigSchema,
  datasets: z.array(datasetSchema).min(1, 'At least one dataset is required'),
  imageFiles: z.array(z.object({
    filename: z.string(),
    caption: z.string().optional(),
    subfolder: z.string().default(''),
    url: z.string().optional() // Added URL field for uploaded images
  })).min(1, 'At least one image is required')
});

// Training status update schema
export const trainingStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  progress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
  step: z.number().optional(),
  loss: z.number().optional(),
  learning_rate: z.number().optional(),
  eta: z.string().optional(), // estimated time remaining
  samples: z.array(z.string()).optional(), // URLs to sample images
  checkpoint_urls: z.array(z.string()).optional() // URLs to saved checkpoints
});

// RunPod webhook payload schema
export const runpodWebhookSchema = z.object({
  id: z.string(),
  status: z.enum(['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']),
  output: z.any().optional(),
  error: z.string().optional()
});

// Training presets for different use cases
export const trainingPresets = {
  character: {
    name: 'Character Training',
    description: 'Optimized for training characters and people',
    config: {
      train: {
        steps: 1500,
        lr: 0.0001,
        batch_size: 1,
        content_or_style: 'balanced' as const
      },
      network: {
        linear: 32,
        linear_alpha: 32,
        conv: 16,
        conv_alpha: 16
      }
    }
  },
  style: {
    name: 'Art Style Training',
    description: 'Optimized for training artistic styles',
    config: {
      train: {
        steps: 2000,  // Maximum steps allowed
        lr: 0.00008,
        batch_size: 1,
        content_or_style: 'style' as const
      },
      network: {
        linear: 64,
        linear_alpha: 64,
        conv: 32,
        conv_alpha: 32
      }
    }
  },
  object: {
    name: 'Object Training',
    description: 'Optimized for training specific objects',
    config: {
      train: {
        steps: 1200,
        lr: 0.00012,
        batch_size: 1,
        content_or_style: 'content' as const
      },
      network: {
        linear: 24,
        linear_alpha: 24,
        conv: 12,
        conv_alpha: 12
      }
    }
  },
  concept: {
    name: 'Concept Training',
    description: 'Optimized for training abstract concepts',
    config: {
      train: {
        steps: 2000,  // Reduced from 2500 to maximum allowed
        lr: 0.00006,
        batch_size: 1,
        content_or_style: 'balanced' as const
      },
      network: {
        linear: 48,
        linear_alpha: 48,
        conv: 24,
        conv_alpha: 24
      }
    }
  }
} as const;

export type TrainingConfig = z.infer<typeof trainingConfigSchema>;
export type DatasetConfig = z.infer<typeof datasetSchema>;
export type CreateTrainingJobInput = z.infer<typeof createTrainingJobSchema>;
export type TrainingStatus = z.infer<typeof trainingStatusSchema>;
export type RunPodWebhookPayload = z.infer<typeof runpodWebhookSchema>;
export type TrainingPreset = keyof typeof trainingPresets;
