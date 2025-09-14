import { PrismaClient, $Enums } from '@/lib/generated/prisma';
import type { CreateTrainingJobInput } from '@/lib/validations/training';

const prisma = new PrismaClient();

export type TrainingStatus = $Enums.TrainingStatus;

export interface TrainingJobData {
  id: string;
  clerkId: string;
  name: string;
  description?: string;
  status: TrainingStatus;
  progress?: number;
  currentStep?: number;
  totalSteps?: number;
  runpodJobId?: string;
  runpodPodId?: string;
  trainingConfig: any;
  datasetConfig: any;
  modelConfig: any;
  sampleConfig: any;
  error?: string;
  loss?: number;
  learningRate?: number;
  eta?: string;
  sampleUrls: string[];
  checkpointUrls: string[];
  finalModelUrl?: string;
  logUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  trainingImages: Array<{
    id: string;
    filename: string;
    caption?: string;
    storageUrl: string;
    fileSize?: number;
    width?: number;
    height?: number;
    format?: string;
  }>;
}

export class TrainingJobsDB {
  /**
   * Create a new training job
   */
  static async createTrainingJob(
    clerkId: string,
    input: CreateTrainingJobInput
  ): Promise<TrainingJobData> {
    try {
      // Ensure the user exists in the database first
      await prisma.user.upsert({
        where: { clerkId },
        update: { updatedAt: new Date() },
        create: { 
          clerkId,
          // Add more user data if available from Clerk
        }
      });

      const trainingJob = await prisma.trainingJob.create({
        data: {
          clerkId,
          name: input.name,
          description: input.description,
          status: 'PENDING' as TrainingStatus,
          progress: 0,
          currentStep: 0,
          totalSteps: input.config.train.steps,
          trainingConfig: input.config as any,
          datasetConfig: input.datasets as any,
          modelConfig: input.config.model as any,
          sampleConfig: input.config.sample as any,
          trainingImages: {
            create: input.imageFiles.map((file) => ({
              clerkId,
              filename: file.filename,
              caption: file.caption,
              // Use Cloudinary URL from the uploaded file
              storageUrl: (file as any).cloudinaryUrl || (file as any).url,
              cloudinaryUrl: (file as any).cloudinaryUrl,
              cloudinaryPublicId: (file as any).cloudinaryPublicId,
              format: file.filename.split('.').pop()?.toLowerCase(),
            }))
          }
        },
        include: {
          trainingImages: true
        }
      });

      return trainingJob as any;
    } catch (error) {
      console.error('Error creating training job:', error);
      throw error;
    }
  }

  /**
   * Get training job by ID
   */
  static async getTrainingJob(jobId: string, clerkId: string): Promise<TrainingJobData | null> {
    try {
      const job = await prisma.trainingJob.findFirst({
        where: {
          id: jobId,
          clerkId
        },
        include: {
          trainingImages: true
        }
      });

      return job as any;
    } catch (error) {
      console.error('Error getting training job:', error);
      throw error;
    }
  }

  /**
   * Get training job by database ID (not RunPod ID)
   * This is used by the training completion webhook
   * FIXED: Added this method to resolve user ID lookup issue
   */
  static async getTrainingJobById(jobId: string): Promise<TrainingJobData | null> {
    try {
      console.log(`🔍 Looking up training job by database ID: ${jobId}`);
      
      const job = await prisma.trainingJob.findUnique({
        where: { id: jobId },
        include: {
          trainingImages: true
        }
      });

      if (job) {
        console.log(`✅ Found training job: ${job.id} for user ${job.clerkId}`);
      } else {
        console.log(`❌ No training job found with database ID: ${jobId}`);
      }

      return job as any;
    } catch (error) {
      console.error('Error getting training job by database ID:', error);
      throw error;
    }
  }

  /**
   * Get all training jobs for a user
   */
  static async getUserTrainingJobs(clerkId: string): Promise<TrainingJobData[]> {
    try {
      const jobs = await prisma.trainingJob.findMany({
        where: { clerkId },
        include: {
          trainingImages: {
            select: {
              id: true,
              filename: true,
              caption: true,
              storageUrl: true,
              fileSize: true,
              width: true,
              height: true,
              format: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return jobs as any;
    } catch (error) {
      console.error('Error getting user training jobs:', error);
      throw error;
    }
  }

  /**
   * Update training job status and progress
   */
  static async updateTrainingJob(
    jobId: string,
    updates: {
      status?: TrainingStatus;
      progress?: number;
      currentStep?: number;
      runpodJobId?: string;
      runpodPodId?: string;
      error?: string;
      loss?: number;
      learningRate?: number;
      eta?: string;
      sampleUrls?: string[];
      checkpointUrls?: string[];
      finalModelUrl?: string;
      logUrl?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<TrainingJobData | null> {
    try {
      const job = await prisma.trainingJob.update({
        where: { id: jobId },
        data: {
          ...updates,
          updatedAt: new Date()
        } as any, // Temporary type assertion while Prisma types are being fixed
        include: {
          trainingImages: true
        }
      });

      return job as any;
    } catch (error) {
      console.error('Error updating training job:', error);
      throw error;
    }
  }

  /**
   * Get training job by RunPod job ID
   */
  static async getTrainingJobByRunPodId(runpodJobId: string): Promise<TrainingJobData | null> {
    try {
      const job = await prisma.trainingJob.findFirst({
        where: { runpodJobId },
        include: {
          trainingImages: true
        }
      });

      return job as any;
    } catch (error) {
      console.error('Error getting training job by RunPod ID:', error);
      throw error;
    }
  }

  /**
   * Delete training job
   */
  static async deleteTrainingJob(jobId: string, clerkId: string): Promise<boolean> {
    try {
      await prisma.trainingJob.delete({
        where: {
          id: jobId,
          clerkId
        }
      });

      return true;
    } catch (error) {
      console.error('Error deleting training job:', error);
      return false;
    }
  }

  /**
   * Create a LoRA model from completed training job
   */
  static async createLoRAFromTrainingJob(
    trainingJobId: string,
    loraData: {
      name: string;
      displayName: string;
      fileName: string;
      originalFileName: string;
      fileSize: number;
      description?: string;
      thumbnailUrl?: string;
    }
  ): Promise<boolean> {
    try {
      const trainingJob = await prisma.trainingJob.findUnique({
        where: { id: trainingJobId }
      });

      if (!trainingJob) {
        throw new Error('Training job not found');
      }

      // Note: We'll need to add a trainingJobId field to the InfluencerLoRA model
      // For now, create the LoRA without the training job reference
      await prisma.influencerLoRA.create({
        data: {
          ...loraData,
          clerkId: trainingJob.clerkId,
          syncStatus: 'PENDING',
          isActive: true
        }
      });

      return true;
    } catch (error) {
      console.error('Error creating LoRA from training job:', error);
      return false;
    }
  }

  /**
   * Get training statistics for a user
   */
  static async getUserTrainingStats(clerkId: string): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
    totalLoRAs: number;
  }> {
    try {
      const [totalJobs, completedJobs, failedJobs, activeJobs, totalLoRAs] = await Promise.all([
        prisma.trainingJob.count({ where: { clerkId } }),
        prisma.trainingJob.count({ where: { clerkId, status: 'COMPLETED' as TrainingStatus } }),
        prisma.trainingJob.count({ where: { clerkId, status: 'FAILED' as TrainingStatus } }),
        prisma.trainingJob.count({ 
          where: { 
            clerkId, 
            status: { in: ['PENDING', 'QUEUED', 'INITIALIZING', 'PROCESSING', 'SAMPLING', 'SAVING'] as TrainingStatus[] }
          } 
        }),
        prisma.influencerLoRA.count({ 
          where: { 
            clerkId
            // Note: trainingJobId field needs to be added to the InfluencerLoRA model
          } 
        })
      ]);

      return {
        totalJobs,
        completedJobs,
        failedJobs,
        activeJobs,
        totalLoRAs
      };
    } catch (error) {
      console.error('Error getting training stats:', error);
      return {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        activeJobs: 0,
        totalLoRAs: 0
      };
    }
  }
}