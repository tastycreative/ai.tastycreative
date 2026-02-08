import { z } from 'zod';
import { router, protectedProcedure } from '../../lib/trpc';
import { prisma } from '../../lib/database';
import {
  fileUploadInputSchema,
  getPresignedUrlInputSchema,
} from '../../lib/validations/content-submission';
import { generatePresignedUploadUrl } from '../../lib/s3-submission-uploads';
import { TRPCError } from '@trpc/server';

export const submissionFilesRouter = router({
  // Generate presigned URL for upload
  getPresignedUrl: protectedProcedure
    .input(getPresignedUrlInputSchema.extend({
      submissionId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get user's organization
        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (!user?.currentOrganizationId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User must belong to an organization',
          });
        }

        // If submissionId provided, verify access
        if (input.submissionId) {
          const submission = await prisma.contentSubmission.findUnique({
            where: { id: input.submissionId },
            select: { organizationId: true },
          });

          if (!submission) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Submission not found',
            });
          }

          if (submission.organizationId !== user.currentOrganizationId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Access denied',
            });
          }
        }

        const presignedData = await generatePresignedUploadUrl(
          input.fileName,
          input.fileType,
          user.currentOrganizationId,
          input.submissionId
        );

        return presignedData;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to generate presigned URL:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate upload URL',
        });
      }
    }),

  // Record uploaded file metadata
  recordUpload: protectedProcedure
    .input(fileUploadInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify submission exists and user has access
        const submission = await prisma.contentSubmission.findUnique({
          where: { id: input.submissionId },
          select: { organizationId: true },
        });

        if (!submission) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }

        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (user?.currentOrganizationId !== submission.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        // Create file record
        const file = await prisma.contentSubmissionFile.create({
          data: {
            ...input,
            uploadStatus: 'completed',
            uploadedBy: ctx.userId,
          },
        });

        return file;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to record file upload:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save file metadata',
        });
      }
    }),

  // List files for a submission
  list: protectedProcedure
    .input(z.object({ submissionId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        // Verify submission access
        const submission = await prisma.contentSubmission.findUnique({
          where: { id: input.submissionId },
          select: { organizationId: true },
        });

        if (!submission) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }

        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (user?.currentOrganizationId !== submission.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const files = await prisma.contentSubmissionFile.findMany({
          where: { submissionId: input.submissionId },
          orderBy: { order: 'asc' },
        });

        return files;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to list files:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch files',
        });
      }
    }),

  // Delete file
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get file and verify access
        const file = await prisma.contentSubmissionFile.findUnique({
          where: { id: input.id },
          include: {
            submission: {
              select: { organizationId: true },
            },
          },
        });

        if (!file) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'File not found',
          });
        }

        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (user?.currentOrganizationId !== file.submission.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        // TODO: Delete from S3 as well
        // await deleteFromS3(file.awsS3Key);

        await prisma.contentSubmissionFile.delete({
          where: { id: input.id },
        });

        return { success: true, message: 'File deleted' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to delete file:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete file',
        });
      }
    }),

  // Update file order
  updateOrder: protectedProcedure
    .input(z.object({
      submissionId: z.string(),
      fileOrders: z.array(z.object({
        id: z.string(),
        order: z.number(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify submission access
        const submission = await prisma.contentSubmission.findUnique({
          where: { id: input.submissionId },
          select: { organizationId: true },
        });

        if (!submission) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }

        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (user?.currentOrganizationId !== submission.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        // Update orders in transaction
        await prisma.$transaction(
          input.fileOrders.map(({ id, order }) =>
            prisma.contentSubmissionFile.update({
              where: { id },
              data: { order },
            })
          )
        );

        return { success: true, message: 'File order updated' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to update file order:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update file order',
        });
      }
    }),
});

export type SubmissionFilesRouter = typeof submissionFilesRouter;
