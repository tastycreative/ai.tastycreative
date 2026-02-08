# ContentSubmission Forms System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build complete content submission forms system with tRPC API, wizard/classic UI modes, and S3 file uploads.

**Architecture:** Three-layer implementation: (1) tRPC backend with Prisma ORM for CRUD operations, (2) React forms using react-hook-form with TanStack Query for state management, (3) S3 presigned URL uploads with progress tracking. Organization-scoped submissions with Clerk authentication.

**Tech Stack:** Next.js 16, tRPC, Prisma, Clerk auth, TanStack Query, react-hook-form, zod, S3 SDK, Tailwind CSS, Radix UI

---

## Phase 1: Validation Schemas (Foundation)

### Task 1: Create Zod Validation Schemas

**Files:**
- Create: `lib/validations/content-submission.ts`

**Step 1: Write ContentSubmission input schema**

```typescript
import { z } from 'zod';

// Submission type enum
export const submissionTypeSchema = z.enum(['otp', 'ptr']);

// Content style enum
export const contentStyleSchema = z.enum(['normal', 'poll', 'game', 'ppv', 'bundle']);

// Priority enum
export const prioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

// Content type enum
export const contentTypeSchema = z.enum(['photo', 'video', 'carousel', 'story']);

// Base submission input
export const createSubmissionInputSchema = z.object({
  // Required fields
  submissionType: submissionTypeSchema,
  contentStyle: contentStyleSchema,

  // Optional content details
  modelId: z.string().optional(),
  modelName: z.string().optional(),
  priority: prioritySchema.default('normal'),
  caption: z.string().optional(),
  driveLink: z.string().url().optional().or(z.literal('')),
  contentType: contentTypeSchema.optional(),
  contentCount: z.number().int().positive().optional(),
  contentLength: z.string().optional(),

  // Tags
  contentTags: z.array(z.string()).default([]),
  externalCreatorTags: z.string().optional(),
  internalModelTags: z.array(z.string()).default([]),

  // Metadata
  platform: z.string().default('onlyfans'),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionInputSchema>;
```

**Step 2: Write release schedule schema**

```typescript
// Release schedule (for PTR submissions)
export const releaseScheduleInputSchema = z.object({
  releaseDate: z.date().or(z.string().pipe(z.coerce.date())),
  releaseTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM format
  timezone: z.string().default('UTC'),
  scheduledBy: z.string().optional(),
});

export type ReleaseScheduleInput = z.infer<typeof releaseScheduleInputSchema>;

// Complete submission with schedule
export const createSubmissionWithScheduleSchema = createSubmissionInputSchema.extend({
  releaseSchedule: releaseScheduleInputSchema.optional(),
});
```

**Step 3: Write pricing schema**

```typescript
// Pricing type enum
export const pricingTypeSchema = z.enum(['fixed', 'range', 'negotiable']);

// Pricing input (for PTR/PPV submissions)
export const pricingInputSchema = z.object({
  minimumPrice: z.number().positive().optional(),
  suggestedPrice: z.number().positive().optional(),
  finalPrice: z.number().positive().optional(),
  currency: z.string().default('usd'),
  pricingType: pricingTypeSchema.optional(),
  priceRangeMin: z.number().positive().optional(),
  priceRangeMax: z.number().positive().optional(),
  pricingNotes: z.string().optional(),
});

export type PricingInput = z.infer<typeof pricingInputSchema>;

// Complete submission with pricing
export const createSubmissionWithPricingSchema = createSubmissionWithScheduleSchema.extend({
  pricing: pricingInputSchema.optional(),
});
```

**Step 4: Write file upload schemas**

```typescript
// File category enum
export const fileCategorySchema = z.enum(['image', 'video', 'document', 'other']);

// File upload status
export const uploadStatusSchema = z.enum(['pending', 'uploading', 'completed', 'failed']);

// File metadata
export const fileUploadInputSchema = z.object({
  submissionId: z.string(),
  awsS3Key: z.string(),
  awsS3Url: z.string().url(),
  awsS3Bucket: z.string().optional(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  fileType: z.string(), // MIME type
  fileCategory: fileCategorySchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
  thumbnailUrl: z.string().url().optional(),
  order: z.number().int().default(0),
});

export type FileUploadInput = z.infer<typeof fileUploadInputSchema>;

// Presigned URL request
export const getPresignedUrlInputSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().int().positive(),
});

export type GetPresignedUrlInput = z.infer<typeof getPresignedUrlInputSchema>;
```

**Step 5: Write update and query schemas**

```typescript
// Update submission
export const updateSubmissionInputSchema = createSubmissionInputSchema.partial().extend({
  id: z.string(),
});

export type UpdateSubmissionInput = z.infer<typeof updateSubmissionInputSchema>;

// List submissions query
export const listSubmissionsInputSchema = z.object({
  organizationId: z.string().optional(),
  status: z.string().optional(),
  submissionType: submissionTypeSchema.optional(),
  contentStyle: contentStyleSchema.optional(),
  limit: z.number().int().positive().default(50),
  cursor: z.string().optional(), // For pagination
});

export type ListSubmissionsInput = z.infer<typeof listSubmissionsInputSchema>;

// Get single submission
export const getSubmissionInputSchema = z.object({
  id: z.string(),
});

export type GetSubmissionInput = z.infer<typeof getSubmissionInputSchema>;

// Delete submission
export const deleteSubmissionInputSchema = z.object({
  id: z.string(),
});

export type DeleteSubmissionInput = z.infer<typeof deleteSubmissionInputSchema>;
```

**Step 6: Export all schemas and types**

```typescript
// Export all schemas
export {
  submissionTypeSchema,
  contentStyleSchema,
  prioritySchema,
  contentTypeSchema,
  pricingTypeSchema,
  fileCategorySchema,
  uploadStatusSchema,
};

// Export input schemas
export {
  createSubmissionInputSchema,
  createSubmissionWithScheduleSchema,
  createSubmissionWithPricingSchema,
  releaseScheduleInputSchema,
  pricingInputSchema,
  fileUploadInputSchema,
  getPresignedUrlInputSchema,
  updateSubmissionInputSchema,
  listSubmissionsInputSchema,
  getSubmissionInputSchema,
  deleteSubmissionInputSchema,
};

// Export types
export type {
  CreateSubmissionInput,
  ReleaseScheduleInput,
  PricingInput,
  FileUploadInput,
  GetPresignedUrlInput,
  UpdateSubmissionInput,
  ListSubmissionsInput,
  GetSubmissionInput,
  DeleteSubmissionInput,
};
```

**Step 7: Commit validation schemas**

```bash
git add lib/validations/content-submission.ts
git commit -m "feat: add ContentSubmission validation schemas

- Add zod schemas for submission CRUD operations
- Add release schedule and pricing schemas
- Add file upload validation
- Export all types for type safety

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: tRPC Backend API

### Task 2: Create ContentSubmission tRPC Router

**Files:**
- Create: `server/routers/content-submission.ts`
- Modify: `server/router.ts` (add new router)

**Step 1: Create router file with imports**

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../lib/trpc';
import { prisma } from '../../lib/prisma';
import {
  createSubmissionWithPricingSchema,
  updateSubmissionInputSchema,
  listSubmissionsInputSchema,
  getSubmissionInputSchema,
  deleteSubmissionInputSchema,
} from '../../lib/validations/content-submission';
import { TRPCError } from '@trpc/server';
```

**Step 2: Implement createSubmission mutation**

```typescript
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
});
```

**Step 3: Implement list query**

```typescript
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
```

**Step 4: Implement getById query**

```typescript
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
```

**Step 5: Implement update mutation**

```typescript
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
```

**Step 6: Implement delete mutation**

```typescript
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
```

**Step 7: Export router type**

```typescript
export type ContentSubmissionRouter = typeof contentSubmissionRouter;
```

**Step 8: Add router to main appRouter**

Modify `server/router.ts`:

```typescript
// Add import at top
import { contentSubmissionRouter } from './routers/content-submission';

// Add to router definition
export const appRouter = router({
  // ... existing routes ...

  // Content Submission routes
  contentSubmission: contentSubmissionRouter,
});
```

**Step 9: Commit tRPC router**

```bash
git add server/routers/content-submission.ts server/router.ts
git commit -m "feat: add ContentSubmission tRPC router

- Implement CRUD operations (create, list, getById, update, delete)
- Add organization-based access control
- Include relations (schedule, pricing, files, user)
- Add cursor-based pagination for list query

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Create File Upload tRPC Router

**Files:**
- Create: `server/routers/submission-files.ts`
- Create: `lib/s3-submission-uploads.ts`
- Modify: `server/router.ts`

**Step 1: Create S3 helper for submission uploads**

File: `lib/s3-submission-uploads.ts`

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative-uploads';
const UPLOAD_PREFIX = 'content-submissions/';

export interface PresignedUrlData {
  uploadUrl: string;
  fileUrl: string;
  s3Key: string;
  expiresIn: number;
}

/**
 * Generate presigned URL for direct S3 upload
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  fileType: string,
  organizationId: string,
  submissionId?: string
): Promise<PresignedUrlData> {
  try {
    // Generate unique file key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Structure: content-submissions/{organizationId}/{submissionId}/{timestamp}-{random}-{filename}
    const s3Key = submissionId
      ? `${UPLOAD_PREFIX}${organizationId}/${submissionId}/${timestamp}-${randomString}-${sanitizedFileName}`
      : `${UPLOAD_PREFIX}${organizationId}/temp/${timestamp}-${randomString}-${sanitizedFileName}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${s3Key}`;

    return {
      uploadUrl,
      fileUrl,
      s3Key,
      expiresIn: 3600,
    };
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Extract file info from S3 key
 */
export function parseS3Key(s3Key: string) {
  const parts = s3Key.split('/');
  return {
    organizationId: parts[1],
    submissionId: parts[2] !== 'temp' ? parts[2] : null,
    fileName: parts[parts.length - 1],
  };
}
```

**Step 2: Create submission files router**

File: `server/routers/submission-files.ts`

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../lib/trpc';
import { prisma } from '../../lib/prisma';
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
```

**Step 3: Add files router to main router**

Modify `server/router.ts`:

```typescript
// Add import
import { submissionFilesRouter } from './routers/submission-files';

// Add to router
export const appRouter = router({
  // ... existing routes ...
  contentSubmission: contentSubmissionRouter,
  submissionFiles: submissionFilesRouter,
});
```

**Step 4: Commit file upload router**

```bash
git add server/routers/submission-files.ts lib/s3-submission-uploads.ts server/router.ts
git commit -m "feat: add file upload tRPC router

- Add presigned URL generation for S3 uploads
- Implement file metadata recording
- Add file list, delete, and reorder operations
- Add organization-based access control

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: React Query Hooks

### Task 4: Create TanStack Query Hooks

**Files:**
- Create: `lib/hooks/useContentSubmission.query.ts`

**Step 1: Write submission query hooks**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { trpc } from '../trpc-client';
import type {
  CreateSubmissionInput,
  UpdateSubmissionInput,
  ListSubmissionsInput,
} from '../validations/content-submission';

/**
 * List submissions with optional filters
 */
export function useContentSubmissions(input?: ListSubmissionsInput) {
  const { user } = useUser();

  return trpc.contentSubmission.list.useQuery(input || {}, {
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get single submission by ID
 */
export function useContentSubmission(id: string) {
  const { user } = useUser();

  return trpc.contentSubmission.getById.useQuery(
    { id },
    {
      enabled: !!user && !!id,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
    }
  );
}

/**
 * Create new submission
 */
export function useCreateSubmission() {
  const queryClient = useQueryClient();

  return trpc.contentSubmission.create.useMutation({
    onSuccess: () => {
      // Invalidate submission list
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'list'] });
    },
  });
}

/**
 * Update existing submission
 */
export function useUpdateSubmission() {
  const queryClient = useQueryClient();

  return trpc.contentSubmission.update.useMutation({
    onSuccess: (data) => {
      // Invalidate submission list
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'list'] });
      // Update single submission cache
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'getById', { id: data.id }] });
    },
  });
}

/**
 * Delete submission
 */
export function useDeleteSubmission() {
  const queryClient = useQueryClient();

  return trpc.contentSubmission.delete.useMutation({
    onSuccess: () => {
      // Invalidate submission list
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'list'] });
    },
  });
}
```

**Step 2: Write file upload hooks**

```typescript
/**
 * Get presigned URL for file upload
 */
export function useGetPresignedUrl() {
  return trpc.submissionFiles.getPresignedUrl.useMutation();
}

/**
 * Record uploaded file
 */
export function useRecordFileUpload() {
  const queryClient = useQueryClient();

  return trpc.submissionFiles.recordUpload.useMutation({
    onSuccess: (data) => {
      // Invalidate file list for this submission
      queryClient.invalidateQueries({
        queryKey: ['submissionFiles', 'list', { submissionId: data.submissionId }],
      });
    },
  });
}

/**
 * List files for a submission
 */
export function useSubmissionFiles(submissionId: string) {
  const { user } = useUser();

  return trpc.submissionFiles.list.useQuery(
    { submissionId },
    {
      enabled: !!user && !!submissionId,
      staleTime: 1000 * 60 * 2,
    }
  );
}

/**
 * Delete file
 */
export function useDeleteFile() {
  const queryClient = useQueryClient();

  return trpc.submissionFiles.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionFiles', 'list'] });
    },
  });
}

/**
 * Update file order
 */
export function useUpdateFileOrder() {
  const queryClient = useQueryClient();

  return trpc.submissionFiles.updateOrder.useMutation({
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['submissionFiles', 'list', { submissionId: variables.submissionId }],
      });
    },
  });
}
```

**Step 3: Add utility hook for file uploads**

```typescript
/**
 * Complete file upload flow (presigned URL + upload + record)
 */
export function useFileUpload() {
  const getPresignedUrl = useGetPresignedUrl();
  const recordUpload = useRecordFileUpload();

  const uploadFile = async (
    file: File,
    submissionId: string,
    options?: {
      onProgress?: (progress: number) => void;
    }
  ) => {
    try {
      // Step 1: Get presigned URL
      const presignedData = await getPresignedUrl.mutateAsync({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        submissionId,
      });

      // Step 2: Upload to S3
      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && options?.onProgress) {
            const progress = (e.loaded / e.total) * 100;
            options.onProgress(progress);
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            // Step 3: Record file metadata
            try {
              // Determine file category
              let fileCategory: 'image' | 'video' | 'document' | 'other' = 'other';
              if (file.type.startsWith('image/')) fileCategory = 'image';
              else if (file.type.startsWith('video/')) fileCategory = 'video';
              else if (file.type.includes('pdf') || file.type.includes('document')) fileCategory = 'document';

              const fileRecord = await recordUpload.mutateAsync({
                submissionId,
                awsS3Key: presignedData.s3Key,
                awsS3Url: presignedData.fileUrl,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                fileCategory,
              });

              resolve(fileRecord);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', presignedData.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  };

  return {
    uploadFile,
    isUploading: getPresignedUrl.isPending || recordUpload.isPending,
  };
}
```

**Step 4: Export all hooks**

```typescript
export {
  useContentSubmissions,
  useContentSubmission,
  useCreateSubmission,
  useUpdateSubmission,
  useDeleteSubmission,
  useGetPresignedUrl,
  useRecordFileUpload,
  useSubmissionFiles,
  useDeleteFile,
  useUpdateFileOrder,
  useFileUpload,
};
```

**Step 5: Commit query hooks**

```bash
git add lib/hooks/useContentSubmission.query.ts
git commit -m "feat: add ContentSubmission React Query hooks

- Add CRUD hooks with TanStack Query
- Add file upload hooks with progress tracking
- Implement cache invalidation on mutations
- Add complete upload flow utility hook

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: UI Components - File Upload

### Task 5: Create File Upload Component

**Files:**
- Create: `components/content-submission/FileUploadZone.tsx`

**Step 1: Write file upload component**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Upload, X, File as FileIcon, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { useFileUpload, useSubmissionFiles, useDeleteFile } from '@/lib/hooks/useContentSubmission.query';

interface FileUploadZoneProps {
  submissionId: string;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxFileSizeMB?: number;
}

export function FileUploadZone({
  submissionId,
  maxFiles = 10,
  acceptedTypes = ['image/*', 'video/*'],
  maxFileSizeMB = 100,
}: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const { uploadFile, isUploading } = useFileUpload();
  const { data: files = [], refetch } = useSubmissionFiles(submissionId);
  const deleteFile = useDeleteFile();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await handleFiles(droppedFiles);
  }, [submissionId]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      await handleFiles(selectedFiles);
    }
  }, [submissionId]);

  const handleFiles = async (selectedFiles: File[]) => {
    // Validate file count
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file sizes
    const maxBytes = maxFileSizeMB * 1024 * 1024;
    const invalidFiles = selectedFiles.filter(f => f.size > maxBytes);
    if (invalidFiles.length > 0) {
      alert(`Files must be under ${maxFileSizeMB}MB`);
      return;
    }

    // Upload files
    for (const file of selectedFiles) {
      const fileId = `${file.name}-${Date.now()}`;

      try {
        await uploadFile(file, submissionId, {
          onProgress: (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: progress,
            }));
          },
        });

        // Remove progress after completion
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });

        refetch();
      } catch (error) {
        console.error('Upload failed:', file.name, error);
        alert(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Delete this file?')) return;

    try {
      await deleteFile.mutateAsync({ id: fileId });
      refetch();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (fileType.startsWith('video/')) return <VideoIcon className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-colors
          ${dragActive
            ? 'border-brand-light-pink bg-brand-light-pink/10'
            : 'border-gray-300 dark:border-gray-700 hover:border-brand-light-pink'
          }
          ${files.length >= maxFiles ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          disabled={files.length >= maxFiles}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-brand-light-pink/20 flex items-center justify-center">
            <Upload className="w-8 h-8 text-brand-light-pink" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {acceptedTypes.join(', ')} • Max {maxFileSizeMB}MB • {files.length}/{maxFiles} files
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Uploading...
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-brand-light-pink h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="relative group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-shadow"
            >
              {/* Delete Button */}
              <button
                onClick={() => handleDelete(file.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>

              {/* File Preview */}
              <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                {file.fileCategory === 'image' ? (
                  <img
                    src={file.awsS3Url}
                    alt={file.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : file.fileCategory === 'video' ? (
                  file.thumbnailUrl ? (
                    <img
                      src={file.thumbnailUrl}
                      alt={file.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <VideoIcon className="w-12 h-12 text-gray-400" />
                  )
                ) : (
                  <FileIcon className="w-12 h-12 text-gray-400" />
                )}
              </div>

              {/* File Info */}
              <div className="flex items-start space-x-2">
                {getFileIcon(file.fileType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit file upload component**

```bash
git add components/content-submission/FileUploadZone.tsx
git commit -m "feat: add file upload component

- Implement drag and drop file upload
- Add upload progress tracking
- Show uploaded file previews
- Add file deletion capability

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: UI Components - Forms

### Task 6: Create Submission Form Component

**Files:**
- Create: `components/content-submission/SubmissionForm.tsx`
- Create: `components/content-submission/SubmissionTypeSelector.tsx`
- Create: `components/content-submission/ContentStyleSelector.tsx`

**Step 1: Create SubmissionTypeSelector**

File: `components/content-submission/SubmissionTypeSelector.tsx`

```typescript
'use client';

import { FileText, Calendar } from 'lucide-react';

interface SubmissionTypeSelectorProps {
  value: 'otp' | 'ptr';
  onChange: (value: 'otp' | 'ptr') => void;
}

export function SubmissionTypeSelector({ value, onChange }: SubmissionTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* OTP Card */}
      <button
        type="button"
        onClick={() => onChange('otp')}
        className={`
          relative p-6 rounded-xl border-2 transition-all
          ${value === 'otp'
            ? 'border-brand-light-pink bg-brand-light-pink/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-light-pink/50'
          }
        `}
      >
        <div className="flex flex-col items-start space-y-3">
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            ${value === 'otp' ? 'bg-brand-light-pink' : 'bg-gray-100 dark:bg-gray-800'}
          `}>
            <FileText className={`w-6 h-6 ${value === 'otp' ? 'text-white' : 'text-gray-600'}`} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              One-Time Post (OTP)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Single post content for immediate publication
            </p>
          </div>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>✓ Quick submission</li>
            <li>✓ Immediate publishing</li>
            <li>✓ Standard workflow</li>
          </ul>
        </div>
      </button>

      {/* PTR Card */}
      <button
        type="button"
        onClick={() => onChange('ptr')}
        className={`
          relative p-6 rounded-xl border-2 transition-all
          ${value === 'ptr'
            ? 'border-brand-light-pink bg-brand-light-pink/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-light-pink/50'
          }
        `}
      >
        <div className="flex flex-col items-start space-y-3">
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            ${value === 'ptr' ? 'bg-brand-light-pink' : 'bg-gray-100 dark:bg-gray-800'}
          `}>
            <Calendar className={`w-6 h-6 ${value === 'ptr' ? 'text-white' : 'text-gray-600'}`} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pay-to-Release (PTR)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Premium content with scheduled release
            </p>
          </div>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>✓ Scheduled release date</li>
            <li>✓ Minimum pricing</li>
            <li>✓ Premium positioning</li>
          </ul>
        </div>
      </button>
    </div>
  );
}
```

**Step 2: Create ContentStyleSelector**

File: `components/content-submission/ContentStyleSelector.tsx`

```typescript
'use client';

import { FileText, BarChart3, Gamepad2, DollarSign, Package } from 'lucide-react';

const CONTENT_STYLES = [
  {
    id: 'normal',
    name: 'Normal Content',
    description: 'Standard content posting',
    icon: FileText,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'poll',
    name: 'Poll Content',
    description: 'Interactive audience polls',
    icon: BarChart3,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'game',
    name: 'Game Content',
    description: 'Interactive gaming content',
    icon: Gamepad2,
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'ppv',
    name: 'PPV Content',
    description: 'Pay-per-view exclusive content',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'bundle',
    name: 'Bundle Content',
    description: 'Multi-content bundle packages',
    icon: Package,
    color: 'from-indigo-500 to-purple-500',
  },
] as const;

interface ContentStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  submissionType: 'otp' | 'ptr';
}

export function ContentStyleSelector({ value, onChange, submissionType }: ContentStyleSelectorProps) {
  // Filter styles based on submission type (optional filtering)
  const availableStyles = CONTENT_STYLES; // Show all for now

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {availableStyles.map((style) => {
        const Icon = style.icon;
        const isSelected = value === style.id;

        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            className={`
              relative p-4 rounded-xl border-2 transition-all text-left
              ${isSelected
                ? 'border-brand-light-pink bg-brand-light-pink/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-brand-light-pink/50'
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <div className={`
                w-10 h-10 rounded-lg bg-gradient-to-br ${style.color} flex items-center justify-center flex-shrink-0
              `}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {style.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {style.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 3: Commit selector components**

```bash
git add components/content-submission/SubmissionTypeSelector.tsx components/content-submission/ContentStyleSelector.tsx
git commit -m "feat: add submission type and content style selectors

- Create visual submission type selector (OTP/PTR)
- Create content style selector (5 styles)
- Add responsive grid layouts
- Use brand colors for selection states

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Create Main Submission Form

**Files:**
- Create: `components/content-submission/SubmissionForm.tsx`

**Step 1: Write form component (Part 1 - Setup)**

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createSubmissionWithPricingSchema } from '@/lib/validations/content-submission';
import { useCreateSubmission, useUpdateSubmission } from '@/lib/hooks/useContentSubmission.query';
import { SubmissionTypeSelector } from './SubmissionTypeSelector';
import { ContentStyleSelector } from './ContentStyleSelector';
import { FileUploadZone } from './FileUploadZone';
import { Loader2 } from 'lucide-react';

type FormData = z.infer<typeof createSubmissionWithPricingSchema>;

interface SubmissionFormProps {
  submissionId?: string;
  initialData?: Partial<FormData>;
  onSuccess?: (submissionId: string) => void;
  onCancel?: () => void;
}

export function SubmissionForm({
  submissionId,
  initialData,
  onSuccess,
  onCancel,
}: SubmissionFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isEditMode = !!submissionId;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createSubmissionWithPricingSchema),
    defaultValues: initialData || {
      submissionType: 'otp',
      contentStyle: 'normal',
      priority: 'normal',
      platform: 'onlyfans',
      contentTags: [],
      internalModelTags: [],
    },
  });

  const createSubmission = useCreateSubmission();
  const updateSubmission = useUpdateSubmission();

  const submissionType = watch('submissionType');
  const contentStyle = watch('contentStyle');
  const isPTR = submissionType === 'ptr';

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditMode) {
        await updateSubmission.mutateAsync({
          id: submissionId,
          ...data,
        });
        onSuccess?.(submissionId);
      } else {
        const result = await createSubmission.mutateAsync(data);
        onSuccess?.(result.id);
      }
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Failed to save submission');
    }
  };

  const steps = [
    { id: 'type', title: 'Submission Type' },
    { id: 'style', title: 'Content Style' },
    { id: 'details', title: 'Content Details' },
    ...(isPTR ? [{ id: 'schedule', title: 'Release Schedule' }] : []),
    ...(isPTR || contentStyle === 'ppv' ? [{ id: 'pricing', title: 'Pricing' }] : []),
    { id: 'files', title: 'File Uploads' },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold
              ${index <= currentStep
                ? 'border-brand-light-pink bg-brand-light-pink text-white'
                : 'border-gray-300 dark:border-gray-700 text-gray-400'
              }
            `}>
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={`
                h-0.5 w-16 mx-2
                ${index < currentStep ? 'bg-brand-light-pink' : 'bg-gray-300 dark:bg-gray-700'}
              `} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Select Submission Type
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Choose between one-time post or pay-to-release content
          </p>
          <SubmissionTypeSelector
            value={submissionType}
            onChange={(value) => setValue('submissionType', value)}
          />
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Select Content Style
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            What type of content are you submitting?
          </p>
          <ContentStyleSelector
            value={contentStyle}
            onChange={(value) => setValue('contentStyle', value)}
            submissionType={submissionType}
          />
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Cancel
        </button>

        <div className="flex space-x-3">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Back
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-6 py-2 bg-brand-light-pink hover:bg-brand-dark-pink text-white rounded-lg transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-brand-light-pink hover:bg-brand-dark-pink text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditMode ? 'Update' : 'Submit'}</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
```

**Step 2: Add content details step (Part 2)**

Add after step 1 in the component:

```typescript
      {currentStep === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Content Details
          </h2>

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model/Influencer Name
            </label>
            <input
              {...register('modelName')}
              type="text"
              placeholder="Enter model name"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
            {errors.modelName && (
              <p className="text-sm text-red-500 mt-1">{errors.modelName.message}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <select
              {...register('priority')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Caption
            </label>
            <textarea
              {...register('caption')}
              rows={4}
              placeholder="Enter your caption..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>

          {/* Drive Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Drive Link (Optional)
            </label>
            <input
              {...register('driveLink')}
              type="url"
              placeholder="https://drive.google.com/..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Platform
            </label>
            <select
              {...register('platform')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="onlyfans">OnlyFans</option>
              <option value="fansly">Fansly</option>
              <option value="instagram">Instagram</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Any additional notes or instructions..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>
        </div>
      )}
```

**Step 3: Add PTR schedule step (Part 3)**

```typescript
      {currentStep === 3 && isPTR && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Release Schedule
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Set when this content should be released
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Release Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Release Date *
              </label>
              <input
                {...register('releaseSchedule.releaseDate')}
                type="date"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
              />
            </div>

            {/* Release Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Release Time
              </label>
              <input
                {...register('releaseSchedule.releaseTime')}
                type="time"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              {...register('releaseSchedule.timezone')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
        </div>
      )}
```

**Step 4: Add pricing step (Part 4)**

```typescript
      {currentStep === (isPTR ? 4 : 3) && (isPTR || contentStyle === 'ppv') && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Pricing
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Set pricing for this content
          </p>

          {/* Minimum Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Price ($)
            </label>
            <input
              {...register('pricing.minimumPrice', { valueAsNumber: true })}
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>

          {/* Pricing Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pricing Type
            </label>
            <select
              {...register('pricing.pricingType')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="fixed">Fixed Price</option>
              <option value="range">Price Range</option>
              <option value="negotiable">Negotiable</option>
            </select>
          </div>

          {/* Pricing Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pricing Notes (Optional)
            </label>
            <textarea
              {...register('pricing.pricingNotes')}
              rows={3}
              placeholder="Any pricing details or notes..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>
        </div>
      )}
```

**Step 5: Add file upload step (Part 5)**

```typescript
      {currentStep === steps.length - 1 && submissionId && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Upload Files
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload images, videos, or other files for this submission
          </p>
          <FileUploadZone submissionId={submissionId} />
        </div>
      )}

      {currentStep === steps.length - 1 && !submissionId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Save the submission first to upload files
          </p>
        </div>
      )}
```

**Step 6: Commit form component**

```bash
git add components/content-submission/SubmissionForm.tsx
git commit -m "feat: add multi-step submission form component

- Implement wizard-style form with progress indicator
- Add submission type and content style selection
- Add content details fields
- Add PTR release scheduling step
- Add pricing configuration step
- Integrate file upload component
- Add form validation with react-hook-form

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Page Integration

### Task 8: Create Submission Pages

**Files:**
- Create: `app/[tenant]/submissions/page.tsx` (list page)
- Create: `app/[tenant]/submissions/new/page.tsx` (create page)
- Create: `app/[tenant]/submissions/[id]/page.tsx` (detail/edit page)

**Step 1: Create submissions list page**

File: `app/[tenant]/submissions/page.tsx`

```typescript
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function SubmissionsPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Content Submissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your OTP and PTR content submissions
          </p>
        </div>

        <Link
          href="submissions/new"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-light-pink hover:bg-brand-dark-pink text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New Submission</span>
        </Link>
      </div>

      {/* Client component for the list will go here */}
      <p className="text-center text-gray-500 dark:text-gray-400 py-12">
        Submissions list coming soon...
      </p>
    </div>
  );
}
```

**Step 2: Create new submission page**

File: `app/[tenant]/submissions/new/page.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { SubmissionForm } from '@/components/content-submission/SubmissionForm';

export default function NewSubmissionPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          New Content Submission
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create a new OTP or PTR content submission
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
        <SubmissionForm
          onSuccess={(id) => {
            router.push(`/submissions/${id}`);
          }}
          onCancel={() => {
            router.push('/submissions');
          }}
        />
      </div>
    </div>
  );
}
```

**Step 3: Commit submission pages**

```bash
git add app/[tenant]/submissions/page.tsx app/[tenant]/submissions/new/page.tsx
git commit -m "feat: add submission pages

- Create submissions list page
- Create new submission page
- Add navigation between pages
- Use tenant-based routing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary & Next Steps

### Completed
✅ Phase 1: Validation schemas with zod
✅ Phase 2: tRPC routers (submissions + files)
✅ Phase 3: React Query hooks
✅ Phase 4: File upload component
✅ Phase 5: Form components (selectors + main form)
✅ Phase 6: Pages (list + create)

### Remaining Work

**High Priority:**
1. Submissions list component (filtering, pagination)
2. Submission detail/edit page
3. Classic form mode (alternative to wizard)
4. Status management UI

**Medium Priority:**
5. Search and filtering
6. Bulk actions
7. Export functionality
8. Notifications integration

**Low Priority:**
9. Templates system
10. Analytics dashboard
11. Team workflow routing
12. Advanced scheduling

---

**Plan complete and saved to `docs/plans/2026-02-08-content-submission-forms-implementation.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
