import { z } from 'zod';

// Submission type enum
export const submissionTypeSchema = z.enum(['otp', 'ptr']);

// Content style enum
export const contentStyleSchema = z.enum(['normal', 'poll', 'game', 'ppv', 'bundle']);

// Priority enum
export const prioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

// Content type - accepts any string value (dynamic from ContentTypeOption database)
export const contentTypeSchema = z.string();

// Component module enum
export const componentModuleSchema = z.enum(['pricing', 'release', 'upload']);
export type ComponentModule = z.infer<typeof componentModuleSchema>;

// Platform enum
export const platformSchema = z.enum(['onlyfans', 'fansly']);

// Pricing category enum
export const pricingCategorySchema = z.enum([
  'PORN_ACCURATE',
  'PORN_SCAM',
  'GF_ACCURATE',
  'GF_SCAM',
]);

// Base submission input
export const createSubmissionInputSchema = z.object({
  // Required fields
  submissionType: submissionTypeSchema,
  contentStyle: contentStyleSchema,

  // Platform selection (multi-select)
  platform: z.array(platformSchema).min(1, 'Select at least one platform').default(['onlyfans']),

  // Component modules selection
  selectedComponents: z.array(componentModuleSchema).default([]),

  // Optional content details
  modelId: z.string().optional(),
  modelName: z.string().optional(),
  priority: prioritySchema.default('normal'),
  caption: z.string().optional(),
  driveLink: z.string().url().optional().or(z.literal('')),

  // Enhanced content metadata
  contentType: contentTypeSchema.optional(),
  contentTypeOptionId: z.string().optional(), // FK to ContentTypeOption
  contentCount: z.string().optional(), // Changed to string: "1 Video", "3 Photos"
  contentLength: z.string().optional(), // Duration: "8:43" or "8 mins 43 secs"

  // Tags
  contentTags: z.array(z.string()).default([]),
  externalCreatorTags: z.string().optional(), // "@username @username2"
  internalModelTags: z.array(z.string()).default([]),

  // Pricing category
  pricingCategory: pricingCategorySchema.default('PORN_ACCURATE'),

  // Metadata
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionInputSchema>;

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

// Complete submission with component validation
export const createSubmissionWithComponentsSchema = createSubmissionWithPricingSchema
  .refine(
    (data) => {
      // PTR submissions must have release component
      if (data.submissionType === 'ptr' && !data.selectedComponents.includes('release')) {
        return false;
      }
      return true;
    },
    {
      message: 'PTR submissions require Release Schedule component',
      path: ['selectedComponents'],
    }
  )
  .refine(
    (data) => {
      // If release component is selected for PTR, must have release date
      if (
        data.selectedComponents.includes('release') &&
        data.submissionType === 'ptr' &&
        !data.releaseSchedule?.releaseDate
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Release date required when Release component is enabled for PTR',
      path: ['releaseSchedule', 'releaseDate'],
    }
  );

export type CreateSubmissionWithComponents = z.infer<typeof createSubmissionWithComponentsSchema>;

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
