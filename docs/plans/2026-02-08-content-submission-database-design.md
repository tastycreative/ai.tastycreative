# Content Submission Database Design

**Date**: 2026-02-08
**Status**: ✅ Design Complete - Ready for Implementation
**Type**: New Feature - Forms System Database Schema

---

## Overview

Database schema design for the **ContentSubmission Forms System** - a comprehensive content submission platform supporting OTP (One-Time Post) and PTR (Pay-to-Release) workflows with file uploads, release scheduling, and pricing management.

### Key Features

- ✅ **Organization-scoped** - Submissions belong to organizations, created by team members
- ✅ **Dual submission types** - OTP (immediate) and PTR (scheduled release)
- ✅ **5 content styles** - Normal, Poll, Game, PPV, Bundle
- ✅ **File upload support** - S3-based file storage with metadata tracking
- ✅ **Release scheduling** - Date/time/timezone management for PTR content
- ✅ **Pricing management** - Flexible pricing for PTR/PPV content
- ✅ **Rich metadata** - Tags, platform info, notes, custom JSON fields

---

## Database Architecture

### Tables Overview

| Table | Purpose | Relationship | Records |
|-------|---------|--------------|---------|
| `ContentSubmission` | Main submission data | Parent | Many per org |
| `ContentSubmissionReleaseSchedule` | Release date/time for PTR | 1:1 with submission | Optional |
| `ContentSubmissionPricing` | Pricing for PTR/PPV | 1:1 with submission | Optional |
| `ContentSubmissionFile` | Uploaded files metadata | 1:Many with submission | 0+ per submission |

### Entity Relationships

```
Organization (1) ──< (Many) ContentSubmission
User (1) ──< (Many) ContentSubmission

ContentSubmission (1) ──? (0-1) ContentSubmissionReleaseSchedule
ContentSubmission (1) ──? (0-1) ContentSubmissionPricing
ContentSubmission (1) ──< (0-Many) ContentSubmissionFile
```

---

## Complete Schema

### 1. ContentSubmission (Main Table)

Primary table storing all submission data.

```prisma
model ContentSubmission {
  id             String   @id @default(cuid())
  organizationId String   // Submission belongs to organization
  clerkId        String   // User who created the submission

  // Submission Basics
  submissionType String  // "otp" | "ptr"
  contentStyle   String  // "normal" | "poll" | "game" | "ppv" | "bundle"
  status         SubmissionStatus @default(DRAFT)

  // Content Details
  modelId         String?  // Reference to InfluencerLoRA or InstagramProfile
  modelName       String?  // Fallback if not using modelId
  priority        String   @default("normal") // "low" | "normal" | "high" | "urgent"
  caption         String?  @db.Text
  driveLink       String?
  contentType     String?  // "photo" | "video" | "carousel" | "story"
  contentCount    Int?     // Number of items
  contentLength   String?  // Duration for videos, or "short" | "medium" | "long"

  // Tags & Categorization
  contentTags          String[]  @default([])
  externalCreatorTags  String?
  internalModelTags    String[]  @default([])

  // Additional Metadata
  platform    String?  @default("onlyfans") // "onlyfans" | "fansly" | "instagram" | etc.
  notes       String?  @db.Text
  metadata    Json?    // Flexible JSON for custom fields

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  organization      Organization                       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user              User                               @relation(fields: [clerkId], references: [clerkId], onDelete: Cascade)
  releaseSchedule   ContentSubmissionReleaseSchedule?
  pricing           ContentSubmissionPricing?
  files             ContentSubmissionFile[]

  @@index([organizationId])
  @@index([clerkId])
  @@index([organizationId, clerkId])
  @@index([organizationId, status])
  @@index([submissionType])
  @@index([contentStyle])
  @@index([status])
  @@index([createdAt])
  @@map("content_submissions")
}
```

**Field Explanations:**

| Field | Type | Purpose | Required | Default |
|-------|------|---------|----------|---------|
| `organizationId` | String | Organization ownership | ✅ | - |
| `clerkId` | String | Creator/submitter | ✅ | - |
| `submissionType` | String | OTP or PTR | ✅ | - |
| `contentStyle` | String | Content category | ✅ | - |
| `status` | Enum | Workflow state | ✅ | DRAFT |
| `modelId` | String? | Link to model/influencer | ❌ | - |
| `modelName` | String? | Manual model name | ❌ | - |
| `priority` | String | Urgency level | ✅ | "normal" |
| `caption` | Text? | Content description | ❌ | - |
| `driveLink` | String? | External file link | ❌ | - |
| `contentType` | String? | Media type | ❌ | - |
| `contentCount` | Int? | Number of items | ❌ | - |
| `contentLength` | String? | Duration/length | ❌ | - |
| `contentTags` | String[] | Content tags | ✅ | [] |
| `externalCreatorTags` | String? | External tags | ❌ | - |
| `internalModelTags` | String[] | Model tags | ✅ | [] |
| `platform` | String? | Publishing platform | ❌ | "onlyfans" |
| `notes` | Text? | Additional notes | ❌ | - |
| `metadata` | Json? | Custom data | ❌ | - |

---

### 2. ContentSubmissionReleaseSchedule (Optional - PTR only)

Stores release scheduling information for PTR submissions.

```prisma
model ContentSubmissionReleaseSchedule {
  id           String   @id @default(cuid())
  submissionId String   @unique

  // Release date/time
  releaseDate     DateTime
  releaseTime     String?   // "14:30" format or null for all-day
  timezone        String    @default("UTC")

  // Computed timestamp
  releaseDateTime DateTime?

  // Metadata
  isScheduled     Boolean  @default(true)
  scheduledBy     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  submission ContentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([releaseDate])
  @@index([releaseDateTime])
  @@index([submissionId])
  @@map("content_submission_release_schedules")
}
```

**Field Explanations:**

| Field | Type | Purpose | Required | Default |
|-------|------|---------|----------|---------|
| `submissionId` | String | Parent submission | ✅ | - |
| `releaseDate` | DateTime | Scheduled date | ✅ | - |
| `releaseTime` | String? | Time in "HH:MM" | ❌ | - |
| `timezone` | String | Timezone identifier | ✅ | "UTC" |
| `releaseDateTime` | DateTime? | Computed full timestamp | ❌ | - |
| `isScheduled` | Boolean | Active schedule flag | ✅ | true |
| `scheduledBy` | String? | Who scheduled it | ❌ | - |

---

### 3. ContentSubmissionPricing (Optional - PTR/PPV)

Stores pricing information for monetized content.

```prisma
model ContentSubmissionPricing {
  id           String   @id @default(cuid())
  submissionId String   @unique

  // Pricing details
  minimumPrice    Float?
  suggestedPrice  Float?
  finalPrice      Float?
  currency        String    @default("usd")

  // Pricing type
  pricingType     String?   // "fixed" | "range" | "negotiable"
  priceRangeMin   Float?
  priceRangeMax   Float?

  // Metadata
  pricingNotes    String?   @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  submission ContentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([submissionId])
  @@index([minimumPrice])
  @@map("content_submission_pricing")
}
```

**Field Explanations:**

| Field | Type | Purpose | Required | Default |
|-------|------|---------|----------|---------|
| `submissionId` | String | Parent submission | ✅ | - |
| `minimumPrice` | Float? | Base price | ❌ | - |
| `suggestedPrice` | Float? | Recommended price | ❌ | - |
| `finalPrice` | Float? | Actual used price | ❌ | - |
| `currency` | String | Currency code | ✅ | "usd" |
| `pricingType` | String? | Pricing model | ❌ | - |
| `priceRangeMin` | Float? | Min for range | ❌ | - |
| `priceRangeMax` | Float? | Max for range | ❌ | - |
| `pricingNotes` | Text? | Pricing context | ❌ | - |

---

### 4. ContentSubmissionFile (Multiple per submission)

Stores metadata for uploaded files.

```prisma
model ContentSubmissionFile {
  id           String   @id @default(cuid())
  submissionId String

  // S3 Storage
  awsS3Key     String
  awsS3Url     String
  awsS3Bucket  String?

  // File metadata
  fileName     String
  fileSize     Int
  fileType     String
  fileCategory String   // "image" | "video" | "document" | "other"

  // Media-specific
  width        Int?
  height       Int?
  duration     Float?
  thumbnailUrl String?

  // Upload tracking
  uploadStatus String   @default("pending") // "pending" | "uploading" | "completed" | "failed"
  uploadError  String?  @db.Text

  // Organization
  order        Int      @default(0)

  // Metadata
  uploadedBy   String?
  uploadedAt   DateTime @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  submission ContentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([submissionId])
  @@index([submissionId, order])
  @@index([fileCategory])
  @@index([uploadStatus])
  @@index([awsS3Key])
  @@map("content_submission_files")
}
```

**Field Explanations:**

| Field | Type | Purpose | Required | Default |
|-------|------|---------|----------|---------|
| `submissionId` | String | Parent submission | ✅ | - |
| `awsS3Key` | String | S3 object key | ✅ | - |
| `awsS3Url` | String | File URL | ✅ | - |
| `awsS3Bucket` | String? | Bucket name | ❌ | - |
| `fileName` | String | Original filename | ✅ | - |
| `fileSize` | Int | Size in bytes | ✅ | - |
| `fileType` | String | MIME type | ✅ | - |
| `fileCategory` | String | Type category | ✅ | - |
| `width` | Int? | Image/video width | ❌ | - |
| `height` | Int? | Image/video height | ❌ | - |
| `duration` | Float? | Video duration (sec) | ❌ | - |
| `thumbnailUrl` | String? | Video thumbnail | ❌ | - |
| `uploadStatus` | String | Upload state | ✅ | "pending" |
| `uploadError` | Text? | Error message | ❌ | - |
| `order` | Int | Display order | ✅ | 0 |
| `uploadedBy` | String? | Uploader ID | ❌ | - |
| `uploadedAt` | DateTime | Upload timestamp | ✅ | now() |

---

### 5. SubmissionStatus Enum

Lifecycle states for submissions.

```prisma
enum SubmissionStatus {
  DRAFT          // Initial state, being edited
  SUBMITTED      // Submitted for review
  IN_REVIEW      // Under review
  APPROVED       // Approved for publication
  REJECTED       // Rejected, needs changes
  PUBLISHED      // Published/deployed
}
```

---

## Existing Model Updates

Add relations to existing models:

```prisma
// In User model:
model User {
  // ... existing fields ...
  contentSubmissions ContentSubmission[]
}

// In Organization model:
model Organization {
  // ... existing fields ...
  contentSubmissions ContentSubmission[]
}
```

---

## Indexes Strategy

### Performance Indexes

**ContentSubmission:**
- `organizationId` - Fast org filtering
- `organizationId + clerkId` - User submissions per org
- `organizationId + status` - Status filtering per org
- `submissionType` - Filter by OTP/PTR
- `contentStyle` - Filter by style
- `status` - Global status queries
- `createdAt` - Time-based sorting

**ContentSubmissionFile:**
- `submissionId + order` - Ordered file lists
- `fileCategory` - Filter by type
- `uploadStatus` - Track upload progress
- `awsS3Key` - Fast S3 key lookups

**ContentSubmissionReleaseSchedule:**
- `releaseDate` - Upcoming releases
- `releaseDateTime` - Precise scheduling

**ContentSubmissionPricing:**
- `minimumPrice` - Price range queries

---

## Data Constraints

### Required Fields
- `organizationId`, `clerkId` - Ownership
- `submissionType`, `contentStyle`, `status` - Core workflow

### Optional Fields
- `modelId`, `modelName` - Either can be used
- All release schedule fields - PTR only
- All pricing fields - PTR/PPV only
- Most content detail fields - Flexible form

### Cascade Deletes
- Delete organization → Delete all submissions
- Delete user → Delete all submissions
- Delete submission → Delete schedule, pricing, files

---

## Migration Plan

### Step 1: Create Migration
```bash
npx prisma migrate dev --name add_content_submission_system
```

### Step 2: Verify Tables
```sql
-- Check tables created
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename LIKE 'content_submission%';
```

### Step 3: Generate Client
```bash
npx prisma generate
```

### Step 4: Test Queries
```typescript
// Test create submission
const submission = await prisma.contentSubmission.create({
  data: {
    organizationId: "org_xxx",
    clerkId: "user_xxx",
    submissionType: "otp",
    contentStyle: "normal",
    platform: "onlyfans"
  }
});
```

---

## Usage Examples

### Create OTP Submission
```typescript
const otpSubmission = await prisma.contentSubmission.create({
  data: {
    organizationId: "org_123",
    clerkId: "user_456",
    submissionType: "otp",
    contentStyle: "normal",
    priority: "high",
    caption: "New content drop!",
    contentTags: ["trending", "exclusive"],
    platform: "onlyfans",
  }
});
```

### Create PTR Submission with Schedule
```typescript
const ptrSubmission = await prisma.contentSubmission.create({
  data: {
    organizationId: "org_123",
    clerkId: "user_456",
    submissionType: "ptr",
    contentStyle: "ppv",
    priority: "normal",
    releaseSchedule: {
      create: {
        releaseDate: new Date("2026-02-15"),
        releaseTime: "14:00",
        timezone: "America/New_York",
        scheduledBy: "user_456"
      }
    },
    pricing: {
      create: {
        minimumPrice: 19.99,
        pricingType: "fixed",
        currency: "usd"
      }
    }
  },
  include: {
    releaseSchedule: true,
    pricing: true
  }
});
```

### Add Files to Submission
```typescript
await prisma.contentSubmissionFile.createMany({
  data: [
    {
      submissionId: submission.id,
      awsS3Key: "uploads/photo1.jpg",
      awsS3Url: "https://...",
      fileName: "photo1.jpg",
      fileSize: 2048000,
      fileType: "image/jpeg",
      fileCategory: "image",
      width: 1920,
      height: 1080,
      uploadStatus: "completed",
      order: 0
    }
  ]
});
```

### Query Submissions by Organization
```typescript
const submissions = await prisma.contentSubmission.findMany({
  where: {
    organizationId: "org_123",
    status: "SUBMITTED"
  },
  include: {
    user: true,
    files: {
      orderBy: { order: 'asc' }
    },
    releaseSchedule: true,
    pricing: true
  },
  orderBy: {
    createdAt: 'desc'
  }
});
```

---

## Next Steps

1. ✅ **Design complete** - Schema validated
2. ⏳ **Create migration** - Add tables to database
3. ⏳ **Build tRPC routers** - API endpoints for CRUD
4. ⏳ **Build UI components** - Forms system frontend
5. ⏳ **Implement file uploads** - S3 integration
6. ⏳ **Add validation** - Zod schemas
7. ⏳ **Testing** - Integration tests

---

## Design Decisions Log

### Organization-Scoped (Not User-Scoped)
**Decision:** Submissions belong to organizations, not individual users
**Rationale:** Team collaboration workflow where multiple members work on content
**Impact:** Better for agencies, content teams, multi-user workflows

### Separate Tables for Schedule/Pricing
**Decision:** 1:1 related tables instead of columns on main table
**Rationale:** Only needed for PTR/PPV, keeps main table cleaner, easier to extend
**Impact:** Slightly more complex queries, but better data normalization

### Array Fields for Tags
**Decision:** Use Prisma's String[] instead of separate tag tables
**Rationale:** Simpler queries, faster reads, tags are simple strings
**Impact:** Can't do complex tag relations, but sufficient for this use case

### File Upload Metadata
**Decision:** Separate ContentSubmissionFile table with rich metadata
**Rationale:** Multiple files per submission, track upload status, support pagination
**Impact:** Better file management, easier to track upload progress

### Flexible Metadata JSON
**Decision:** Include metadata Json field on main table
**Rationale:** Future-proof for custom fields without schema changes
**Impact:** Less type safety, but maximum flexibility

---

**Document Version:** 1.0
**Last Updated:** 2026-02-08
**Status:** ✅ Ready for Implementation
