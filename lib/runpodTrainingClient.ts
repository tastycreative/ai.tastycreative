import type { TrainingConfig, DatasetConfig } from '@/lib/validations/training';

const RUNPOD_API_URL = process.env.RUNPOD_API_URL; // Your RunPod endpoint URL
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY; // RunPod API key
// Always use production URL for webhook (ai.tastycreative.xyz) - more reliable than ngrok
const WEBHOOK_BASE_URL = 'https://ai.tastycreative.xyz';

export interface TrainingJobPayload {
  model_name: string;
  training_config: TrainingConfig;
  datasets: DatasetConfig[];
  image_urls: string[];
  webhook_url: string;
  user_id: string;
  job_id: string;
}

export interface RunPodTrainingResponse {
  id: string; // RunPod job ID
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  output?: any;
  error?: string;
}

export interface TrainingProgress {
  current_step: number;
  total_steps: number;
  loss: number;
  learning_rate: number;
  eta: string;
  progress_percentage: number;
  sample_images?: string[]; // URLs to sample images
  checkpoint_url?: string;  // URL to latest checkpoint
}

export class RunPodTrainingClient {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    if (!RUNPOD_API_URL || !RUNPOD_API_KEY) {
      throw new Error('RunPod configuration missing. Please check RUNPOD_API_URL and RUNPOD_API_KEY environment variables.');
    }
    
    // Use the URL directly - it should already include the full endpoint path
    this.apiUrl = RUNPOD_API_URL.replace(/\/$/, ''); // Just remove trailing slash
    this.apiKey = RUNPOD_API_KEY;
    
    console.log('🔧 RunPod client initialized:', {
      endpointUrl: this.apiUrl,
      hasApiKey: !!this.apiKey
    });
  }

  /**
   * Start a new LoRA training job on RunPod
   */
  async startTraining(payload: TrainingJobPayload): Promise<RunPodTrainingResponse> {
    try {
      console.log('🚀 Starting LoRA training on RunPod:', {
        modelName: payload.model_name,
        userId: payload.user_id,
        jobId: payload.job_id,
        imageCount: payload.image_urls.length
      });

      // Generate the ai-toolkit config YAML
      const aiToolkitConfig = this.generateAIToolkitConfig(payload);

      // Instead of base64 encoding (which creates huge payloads), 
      // send image URLs that RunPod can download directly
      console.log('📥 Preparing image URLs for RunPod...');
      
      // Validate that all URLs are accessible
      const validatedUrls = [];
      for (let i = 0; i < payload.image_urls.length; i++) {
        const url = payload.image_urls[i];
        try {
          console.log(`📷 Validating image ${i + 1}: ${url}`);
          
          // Use proper headers for ngrok access
          const headers = {
            'User-Agent': 'RunPod-AI-Toolkit-Handler/1.0',
            'ngrok-skip-browser-warning': 'true',
            'Accept': 'image/*'
          };
          
          const response = await fetch(url, { 
            method: 'HEAD',
            headers: headers
          });
          
          if (!response.ok) {
            throw new Error(`Image not accessible: ${response.status}`);
          }
          validatedUrls.push({
            url: url,
            filename: `image_${i.toString().padStart(4, '0')}.jpg`,
            caption: `Training image ${i + 1}`
          });
          console.log(`✅ Image ${i + 1} is accessible`);
        } catch (error) {
          console.error(`❌ Failed to validate image ${i + 1}:`, error);
          throw new Error(`Failed to validate image ${i + 1}: ${error}`);
        }
      }

      console.log(`✅ Validated ${validatedUrls.length} image URLs`);
      console.log(`📦 Payload will be much smaller using URLs instead of base64`);

      // Fix payload structure to match handler expectations exactly
      const runPodPayload = {
        input: {
          job_id: payload.job_id,
          name: payload.model_name,
          config: payload.training_config,
          datasets: payload.datasets || [],
          imageUrls: validatedUrls,  // Send URLs instead of base64 data
          webhook_url: payload.webhook_url
        }
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(runPodPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`RunPod API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ RunPod training job started:', result.id);

      return result;
    } catch (error) {
      console.error('❌ Failed to start RunPod training:', error);
      throw error;
    }
  }

  /**
   * Check the status of a running training job
   * For serverless endpoints, we typically get status via webhooks
   */
  async getJobStatus(runpodJobId: string): Promise<RunPodTrainingResponse> {
    try {
      // For serverless endpoints, status checking might use a different endpoint
      // This endpoint might not be available - status is typically sent via webhooks
      const statusUrl = this.apiUrl.replace('/run', `/status/${runpodJobId}`);
      
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Failed to get RunPod job status:', error);
      console.log('💡 Note: Serverless endpoints typically use webhooks for status updates');
      throw error;
    }
  }

  /**
   * Cancel a running training job
   * Note: This might not be available for serverless endpoints
   */
  async cancelJob(runpodJobId: string): Promise<boolean> {
    try {
      // For serverless endpoints, cancellation might use a different endpoint
      const cancelUrl = this.apiUrl.replace('/run', `/cancel/${runpodJobId}`);
      
      const response = await fetch(cancelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Failed to cancel RunPod job:', error);
      console.log('💡 Note: Serverless endpoints might not support job cancellation');
      return false;
    }
  }

  /**
   * Get training logs from RunPod
   */
  async getTrainingLogs(runpodJobId: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/logs/${runpodJobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get training logs: ${response.status}`);
      }

      const result = await response.json();
      return result.logs || [];
    } catch (error) {
      console.error('❌ Failed to get training logs:', error);
      return [];
    }
  }

  /**
   * Generate ai-toolkit compatible YAML configuration
   */
  private generateAIToolkitConfig(payload: TrainingJobPayload): string {
    const config = {
      job: "extension",
      config: {
        name: payload.model_name,
        process: [{
          type: "ui_trainer",
          training_folder: "/workspace/ai-toolkit/output",
          sqlite_db_path: "./aitk_db.db",
          device: "cuda",
          trigger_word: payload.training_config.trigger_word,
          performance_log_every: 10,
          network: payload.training_config.network,
          save: payload.training_config.save,
          datasets: payload.datasets.map(dataset => ({
            ...dataset,
            // Convert image URLs to local paths that RunPod will download
            folder_path: "/workspace/training_data/images"
          })),
          train: payload.training_config.train,
          model: payload.training_config.model,
          sample: payload.training_config.sample
        }]
      },
      meta: {
        name: payload.model_name,
        version: "1.0",
        user_id: payload.user_id,
        job_id: payload.job_id,
        webhook_url: payload.webhook_url,
        created_at: new Date().toISOString()
      }
    };

    // Convert to YAML-like format (or return as JSON since RunPod handler can parse it)
    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate webhook URL for training progress updates
   */
  static generateWebhookUrl(jobId: string): string {
    // For development: You can use ngrok to expose localhost
    // For production: Use your actual domain
    const baseUrl = WEBHOOK_BASE_URL;
    
    // If using localhost, warn about webhook limitations
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      console.warn('⚠️ Using localhost for webhooks. RunPod cannot reach localhost URLs.');
      console.warn('💡 For development, consider using ngrok: https://ngrok.com/');
      console.warn('💡 For production, use your actual domain.');
    }
    
    // Use training2 endpoint which is working reliably
    return `${baseUrl}/api/webhooks/training2/${jobId}`;
  }

  /**
   * Map RunPod status to our training status
   */
  static mapRunPodStatus(runpodStatus: string): 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT' {
    switch (runpodStatus) {
      case 'IN_QUEUE':
        return 'QUEUED';
      case 'IN_PROGRESS':
        return 'PROCESSING';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'FAILED':
        return 'FAILED';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'TIMED_OUT':
        return 'TIMEOUT';
      default:
        return 'PENDING';
    }
  }
}

export const runpodTrainingClient = new RunPodTrainingClient();
