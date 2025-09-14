import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../lib/trpc';
import { createTrainingJobSchema, trainingStatusSchema } from '../lib/validations/training';
import { TrainingJobsDB } from '../lib/trainingJobsDB';
import { runpodTrainingClient, RunPodTrainingClient } from '../lib/runpodTrainingClient';

export const appRouter = router({
  // Public procedures
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name}!`,
      };
    }),
  
  getTodos: publicProcedure.query(() => {
    return [
      { id: 1, text: 'Learn tRPC', completed: false },
      { id: 2, text: 'Build awesome app', completed: false },
    ];
  }),

  // Protected procedures
  getProfile: protectedProcedure.query(({ ctx }) => {
    return {
      userId: ctx.userId,
      message: 'This is a protected route!',
      timestamp: new Date().toISOString(),
    };
  }),

  getUserTodos: protectedProcedure.query(({ ctx }) => {
    return [
      { id: 1, text: `${ctx.userId}'s personal todo`, completed: false },
      { id: 2, text: 'Secret authenticated task', completed: true },
    ];
  }),

  createTodo: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(({ input, ctx }) => {
      return {
        id: Math.random(),
        text: input.text,
        userId: ctx.userId,
        completed: false,
        createdAt: new Date().toISOString(),
      };
    }),

  // Training procedures
  createTrainingJob: protectedProcedure
    .input(createTrainingJobSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Create training job in database
        const trainingJob = await TrainingJobsDB.createTrainingJob(ctx.userId, input);

        // Generate webhook URL for progress updates
        const webhookUrl = RunPodTrainingClient.generateWebhookUrl(trainingJob.id);

        // Prepare training payload using Cloudinary URLs from uploaded images
        const payload = {
          model_name: input.name,
          training_config: input.config,
          datasets: input.datasets,
          image_urls: input.imageFiles.map((file: any) => file.cloudinaryUrl || file.url),
          webhook_url: webhookUrl,
          user_id: ctx.userId,
          job_id: trainingJob.id,
        };

        // Start training on RunPod
        const runpodResponse = await runpodTrainingClient.startTraining(payload);

        // Update job with RunPod ID
        await TrainingJobsDB.updateTrainingJob(trainingJob.id, {
          runpodJobId: runpodResponse.id,
          status: RunPodTrainingClient.mapRunPodStatus(runpodResponse.status),
          startedAt: new Date(),
        });

        return {
          success: true,
          trainingJobId: trainingJob.id,
          runpodJobId: runpodResponse.id,
          message: 'Training job started successfully',
        };
      } catch (error) {
        console.error('Failed to create training job:', error);
        throw new Error(`Failed to start training: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  getUserTrainingJobs: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        return await TrainingJobsDB.getUserTrainingJobs(ctx.userId);
      } catch (error) {
        console.error('Failed to get training jobs:', error);
        throw new Error('Failed to fetch training jobs');
      }
    }),

  getTrainingJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        return await TrainingJobsDB.getTrainingJob(input.jobId, ctx.userId);
      } catch (error) {
        console.error('Failed to get training job:', error);
        throw new Error('Failed to fetch training job');
      }
    }),

  updateTrainingJobStatus: protectedProcedure
    .input(z.object({ 
      jobId: z.string(),
      updates: trainingStatusSchema.partial()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify the job belongs to the user
        const existingJob = await TrainingJobsDB.getTrainingJob(input.jobId, ctx.userId);
        if (!existingJob) {
          throw new Error('Training job not found');
        }

        return await TrainingJobsDB.updateTrainingJob(input.jobId, {
          status: input.updates.status,
          progress: input.updates.progress,
          error: input.updates.error,
          currentStep: input.updates.step,
          loss: input.updates.loss,
          learningRate: input.updates.learning_rate,
          eta: input.updates.eta,
          sampleUrls: input.updates.samples,
          checkpointUrls: input.updates.checkpoint_urls,
        });
      } catch (error) {
        console.error('Failed to update training job:', error);
        throw new Error('Failed to update training job status');
      }
    }),

  cancelTrainingJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify the job belongs to the user
        const trainingJob = await TrainingJobsDB.getTrainingJob(input.jobId, ctx.userId);
        if (!trainingJob) {
          throw new Error('Training job not found');
        }

        // Cancel on RunPod if it has a RunPod job ID
        if (trainingJob.runpodJobId) {
          const cancelled = await runpodTrainingClient.cancelJob(trainingJob.runpodJobId);
          if (!cancelled) {
            console.warn(`Failed to cancel RunPod job ${trainingJob.runpodJobId}`);
          }
        }

        // Update status in database
        await TrainingJobsDB.updateTrainingJob(input.jobId, {
          status: 'CANCELLED',
          completedAt: new Date(),
        });

        return { success: true, message: 'Training job cancelled' };
      } catch (error) {
        console.error('Failed to cancel training job:', error);
        throw new Error('Failed to cancel training job');
      }
    }),

  deleteTrainingJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const success = await TrainingJobsDB.deleteTrainingJob(input.jobId, ctx.userId);
        if (!success) {
          throw new Error('Failed to delete training job');
        }
        return { success: true, message: 'Training job deleted' };
      } catch (error) {
        console.error('Failed to delete training job:', error);
        throw new Error('Failed to delete training job');
      }
    }),

  getTrainingStats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        return await TrainingJobsDB.getUserTrainingStats(ctx.userId);
      } catch (error) {
        console.error('Failed to get training stats:', error);
        throw new Error('Failed to fetch training statistics');
      }
    }),

  syncRunPodJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const trainingJob = await TrainingJobsDB.getTrainingJob(input.jobId, ctx.userId);
        if (!trainingJob || !trainingJob.runpodJobId) {
          throw new Error('Training job or RunPod job ID not found');
        }

        // Get status from RunPod
        const runpodStatus = await runpodTrainingClient.getJobStatus(trainingJob.runpodJobId);

        // Update local status
        await TrainingJobsDB.updateTrainingJob(input.jobId, {
          status: RunPodTrainingClient.mapRunPodStatus(runpodStatus.status),
          error: runpodStatus.error,
          // Add more fields as needed based on RunPod response
        });

        return { 
          success: true, 
          status: runpodStatus.status,
          message: 'Job status synced with RunPod'
        };
      } catch (error) {
        console.error('Failed to sync RunPod job:', error);
        throw new Error('Failed to sync with RunPod');
      }
    }),
});

export type AppRouter = typeof appRouter;