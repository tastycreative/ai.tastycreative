# Model Caption Bank Implementation

## Overview

The Model Caption Bank is a comprehensive caption management system integrated into the Model Profile section. It allows users to create, organize, and track captions with detailed analytics for each model.

---

## Features Implemented

### ✅ Core Functionality

1. **Caption Management**
   - Create, edit, and delete captions
   - Copy captions to clipboard
   - View all captions for a specific model

2. **Two-Axis Tagging System**
   - **Content Type Tags**: Fully Nude, Dick Rating, JOI, Solo, Squirting, Anal, etc.
   - **Message Type Tags**: Mass DM, Tip Me, Renew, PPV, Welcome Message, etc.
   - Both tag systems are extensible (users can add custom types)

3. **Analytics Per Caption**
   - Times Used
   - Total Revenue Generated
   - Average Revenue Per Use (auto-calculated)
   - Original Model Name (attribution)

4. **Filtering & Search**
   - Filter by Content Type
   - Filter by Message Type
   - Search captions by keyword
   - Combine multiple filters

5. **Dashboard Analytics**
   - Total Captions count
   - Total Usage across all captions
   - Total Revenue generated
   - Average Revenue per Caption

---

## Database Schema

### New Tables

#### `caption_content_types`

```sql
CREATE TABLE caption_content_types (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

#### `caption_message_types`

```sql
CREATE TABLE caption_message_types (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

### Updated Table

#### `captions`

```sql
-- New fields added:
total_revenue         DECIMAL(10, 2) DEFAULT 0,
original_model_name   TEXT,
content_type_id       TEXT REFERENCES caption_content_types(id),
message_type_id       TEXT REFERENCES caption_message_types(id)
```

---

## API Endpoints

### Captions

- `GET /api/model-captions?profileId={id}` - Get captions for a model
  - Query params: `contentTypeId`, `messageTypeId`, `search`
- `POST /api/model-captions` - Create a caption
- `PATCH /api/model-captions` - Update a caption
- `DELETE /api/model-captions?id={id}` - Delete a caption

### Content Types

- `GET /api/model-captions/content-types` - List all content types
- `POST /api/model-captions/content-types` - Create a content type
- `DELETE /api/model-captions/content-types?id={id}` - Delete a content type

### Message Types

- `GET /api/model-captions/message-types` - List all message types
- `POST /api/model-captions/message-types` - Create a message type
- `DELETE /api/model-captions/message-types?id={id}` - Delete a message type

---

## Frontend Components

### Main Component

**Location**: `components/model-profile/ModelCaptionBank.tsx`

**Features**:

- Analytics dashboard with 4 summary cards
- Search bar with instant filtering
- Filter dropdowns for Content Type and Message Type
- Caption cards with full analytics display
- Modals for adding/editing captions and types
- Dark mode support with brand colors

### React Query Hooks

**Location**: `lib/hooks/useModelCaptions.query.ts`

**Hooks**:

- `useModelCaptions()` - Fetch captions with filters
- `useContentTypes()` - Fetch content types
- `useMessageTypes()` - Fetch message types
- `useCreateCaption()` - Create mutation
- `useUpdateCaption()` - Update mutation
- `useDeleteCaption()` - Delete mutation
- `useCreateContentType()` - Create content type
- `useCreateMessageType()` - Create message type

---

## Integration

### Model Profile Page

**Location**: `app/[tenant]/(dashboard)/workspace/my-influencers/[profileId]/page.tsx`

The Captions tab is integrated into the existing Model Profile tabs:

- Overview
- Pricing
- Content & Restrictions
- **Captions** ← New tab
- Gallery
- Settings

---

## Default Data Seeded

### Content Types (14 types)

- Fully Nude
- Dick Rating
- JOI
- Solo
- Squirting
- Anal
- Cream Pie
- BG, BGG, GG, GGG, BBG
- Orgy
- Livestream

### Message Types (10 types)

- Mass DM
- Tip Me
- Renew
- Bundle Unlock
- Wall Post
- Wall Post Campaign
- PPV
- Welcome Message
- Expired Fan
- Sexting Script

---

## Usage Example

### Creating a Caption

```typescript
const createCaption = useCreateCaption();

await createCaption.mutateAsync({
  profileId: "profile_123",
  caption: "You miss this body, don't you?",
  contentTypeId: "solo_id",
  messageTypeId: "ppv_id",
  originalModelName: "Sophia",
  notes: "High performer for renewal campaigns",
});
```

### Filtering Captions

```typescript
const { data: captions } = useModelCaptions(
  profileId,
  contentTypeId, // "solo_id"
  messageTypeId, // "ppv_id"
  search, // "miss this"
);
```

### Tracking Revenue

```typescript
const updateCaption = useUpdateCaption();

await updateCaption.mutateAsync({
  id: "caption_123",
  profileId: "profile_123",
  usageCount: 4,
  totalRevenue: 3200, // $3,200
  // Average will be auto-calculated: $800 per use
});
```

---

## Future Enhancements (Not Implemented)

- Bulk import/export captions
- Caption templates
- A/B testing comparison
- Performance trends over time
- Suggested captions based on model attributes
- Integration with actual messaging platforms

---

## Files Created/Modified

### Created

1. `app/api/model-captions/route.ts`
2. `app/api/model-captions/content-types/route.ts`
3. `app/api/model-captions/message-types/route.ts`
4. `lib/hooks/useModelCaptions.query.ts`
5. `components/model-profile/ModelCaptionBank.tsx`
6. `scripts/seed-caption-types.ts`

### Modified

1. `prisma/schema.prisma` - Added caption analytics fields and type tables
2. `app/[tenant]/(dashboard)/workspace/my-influencers/[profileId]/page.tsx` - Integrated Captions tab

---

## Development Commands

```bash
# Update database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed default types
npx tsx scripts/seed-caption-types.ts

# Re-seed if needed (won't duplicate)
npx tsx scripts/seed-caption-types.ts
```

---

## Testing Checklist

- [x] View captions for a model
- [x] Create a new caption
- [x] Edit an existing caption
- [x] Delete a caption
- [x] Filter by Content Type
- [x] Filter by Message Type
- [x] Search captions by text
- [x] View analytics dashboard
- [x] Add custom Content Type
- [x] Add custom Message Type
- [x] Copy caption to clipboard
- [x] Track usage and revenue
- [x] View average revenue per use
- [x] Dark mode support
- [x] Responsive design

---

## Support

For questions or issues, refer to:

- API routes in `app/api/model-captions/`
- React Query hooks in `lib/hooks/useModelCaptions.query.ts`
- Main component in `components/model-profile/ModelCaptionBank.tsx`
