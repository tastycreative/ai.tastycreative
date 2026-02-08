import { z } from 'zod';
import { router, protectedProcedure } from '../../lib/trpc';
import { prisma } from '../../lib/database';
import {
  createSubmissionWithPricingSchema,
  updateSubmissionInputSchema,
  listSubmissionsInputSchema,
  getSubmissionInputSchema,
  deleteSubmissionInputSchema,
} from '../../lib/validations/content-submission';
import { TRPCError } from '@trpc/server';

export const contentSubmissionRouter = router({
  create: protectedProcedure
    .input(createSubmissionWithPricingSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get user's current organization
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

        const { releaseSchedule, pricing, ...submissionData } = input;

        // Create submission with optional relations
        const submission = await prisma.contentSubmission.create({
          data: {
            ...submissionData,
            organizationId: user.currentOrganizationId,
            clerkId: ctx.userId,
            status: 'DRAFT',
            // Create release schedule if provided (PTR only)
            ...(releaseSchedule && {
              releaseSchedule: {
                create: {
                  ...releaseSchedule,
                  releaseDate: new Date(releaseSchedule.releaseDate),
                  scheduledBy: ctx.userId,
                },
              },
            }),
            // Create pricing if provided (PTR/PPV only)
            ...(pricing && {
              pricing: {
                create: pricing,
              },
            }),
          },
          include: {
            releaseSchedule: true,
            pricing: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        return submission;
      } catch (error) {
        console.error('Failed to create submission:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create submission',
        });
      }
    }),

  list: protectedProcedure
    .input(listSubmissionsInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Get user's organization
        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (!user?.currentOrganizationId) {
          return { submissions: [], nextCursor: null };
        }

        const {
          organizationId,
          status,
          submissionType,
          contentStyle,
          limit,
          cursor,
        } = input;

        // Build where clause
        const where: any = {
          organizationId: organizationId || user.currentOrganizationId,
        };

        if (status) where.status = status;
        if (submissionType) where.submissionType = submissionType;
        if (contentStyle) where.contentStyle = contentStyle;

        // Fetch submissions with pagination
        const submissions = await prisma.contentSubmission.findMany({
          where,
          take: limit + 1, // Fetch one extra to determine if there's a next page
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { createdAt: 'desc' },
          include: {
            releaseSchedule: true,
            pricing: true,
            files: {
              orderBy: { order: 'asc' },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        });

        let nextCursor: string | null = null;
        if (submissions.length > limit) {
          const nextItem = submissions.pop(); // Remove extra item
          nextCursor = nextItem!.id;
        }

        return {
          submissions,
          nextCursor,
        };
      } catch (error) {
        console.error('Failed to list submissions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch submissions',
        });
      }
    }),

  getById: protectedProcedure
    .input(getSubmissionInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const submission = await prisma.contentSubmission.findUnique({
          where: { id: input.id },
          include: {
            releaseSchedule: true,
            pricing: true,
            files: {
              orderBy: { order: 'asc' },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                imageUrl: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        if (!submission) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }

        // Verify user has access (same organization)
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

        return submission;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to get submission:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch submission',
        });
      }
    }),

  update: protectedProcedure
    .input(updateSubmissionInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updateData } = input;

        // Verify submission exists and user has access
        const existing = await prisma.contentSubmission.findUnique({
          where: { id },
          select: { organizationId: true },
        });

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }

        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (user?.currentOrganizationId !== existing.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        // Update submission
        const submission = await prisma.contentSubmission.update({
          where: { id },
          data: updateData,
          include: {
            releaseSchedule: true,
            pricing: true,
            files: {
              orderBy: { order: 'asc' },
            },
          },
        });

        return submission;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to update submission:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update submission',
        });
      }
    }),

  delete: protectedProcedure
    .input(deleteSubmissionInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify submission exists and user has access
        const existing = await prisma.contentSubmission.findUnique({
          where: { id: input.id },
          select: { organizationId: true, clerkId: true },
        });

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }

        const user = await prisma.user.findUnique({
          where: { clerkId: ctx.userId },
          select: { currentOrganizationId: true },
        });

        if (user?.currentOrganizationId !== existing.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        // Delete submission (cascade will handle related records)
        await prisma.contentSubmission.delete({
          where: { id: input.id },
        });

        return { success: true, message: 'Submission deleted' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to delete submission:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete submission',
        });
      }
    }),
});

export type ContentSubmissionRouter = typeof contentSubmissionRouter;
