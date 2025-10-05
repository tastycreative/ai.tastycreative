# Production Content Linking Feature

## Overview
This feature allows users to select generated images/videos from the Generated Content page and link them to production tasks. The task progress (imagesGenerated/videosGenerated) is automatically updated when content is linked.

## Database Changes

### New Junction Tables
1. **ProductionEntryImage** - Links images to production entries
   - `id`: Primary key
   - `productionEntryId`: Foreign key to ProductionEntry
   - `imageId`: Foreign key to GeneratedImage
   - `createdAt`: Timestamp
   - Unique constraint on (productionEntryId, imageId)

2. **ProductionEntryVideo** - Links videos to production entries
   - `id`: Primary key
   - `productionEntryId`: Foreign key to ProductionEntry
   - `videoId`: Foreign key to GeneratedVideo
   - `createdAt`: Timestamp
   - Unique constraint on (productionEntryId, videoId)

### Schema Updates
- **ProductionEntry** now has relations:
  - `linkedImages`: ProductionEntryImage[]
  - `linkedVideos`: ProductionEntryVideo[]

- **GeneratedImage** now has relation:
  - `productionLinks`: ProductionEntryImage[]

- **GeneratedVideo** now has relation:
  - `productionLinks`: ProductionEntryVideo[]

## API Endpoints

### 1. GET /api/production/my-tasks
**Purpose**: Fetch production tasks for the current user

**Access**:
- Content creators see only tasks assigned to them
- Admins/Managers see all tasks

**Response**:
```json
[
  {
    "id": "task_id",
    "deadline": "2025-10-15T00:00:00Z",
    "assignee": "John Doe",
    "influencer": "InfluencerName",
    "instagramSource": "instagram_handle",
    "loraModel": "model_name",
    "status": "IN_PROGRESS",
    "imagesTarget": 10,
    "imagesGenerated": 5,
    "videosTarget": 3,
    "videosGenerated": 1,
    "notes": "Optional notes",
    "linkedImages": [{ "imageId": "..." }],
    "linkedVideos": [{ "videoId": "..." }]
  }
]
```

### 2. POST /api/production/link-content
**Purpose**: Link selected images/videos to a production task

**Request Body**:
```json
{
  "productionEntryId": "task_id",
  "imageIds": ["image1_id", "image2_id"],
  "videoIds": ["video1_id"]
}
```

**Features**:
- Prevents duplicate links (skips already linked content)
- Updates imagesGenerated/videosGenerated counts
- Auto-updates status:
  - `PENDING` → `IN_PROGRESS` when content is added
  - `IN_PROGRESS` → `COMPLETED` when targets are met
- Returns count of new and already linked items

**Response**:
```json
{
  "success": true,
  "message": "Successfully linked 2 image(s) and 1 video(s)",
  "productionEntry": { /* updated entry */ },
  "alreadyLinked": {
    "images": 0,
    "videos": 0
  }
}
```

### 3. DELETE /api/production/link-content
**Purpose**: Unlink images/videos from a production task

**Request Body**:
```json
{
  "productionEntryId": "task_id",
  "imageIds": ["image1_id"],
  "videoIds": ["video1_id"]
}
```

**Features**:
- Decrements imagesGenerated/videosGenerated counts
- Useful for correcting mistakes

## UI Components

### Generated Content Page Updates

#### 1. Selection Checkboxes
- Added checkbox to top-left of each grid item
- Click checkbox to select/deselect items
- Visual indication with border highlight when selected

#### 2. Selection Toolbar
Shows when items are selected with:
- Count of selected items
- "Clear selection" button
- "Select all on page" button
- "Add to Production Task" button

#### 3. Task Selection Modal
Opens when "Add to Production Task" is clicked:

**Features**:
- Lists all available production tasks
- Shows for each task:
  - Influencer name
  - Instagram source
  - LoRA model
  - Status badge (PENDING, IN_PROGRESS, COMPLETED, FAILED)
  - Deadline
  - Progress bars for images and videos
  - How many items still needed
  - Notes (if any)
- Disables completed tasks
- Click any task to link selected content
- Shows loading state while fetching tasks

**Modal Sections**:
- **Header**: Title, selected items count, close button
- **Body**: Scrollable list of tasks with progress indicators
- **Footer**: Help text and cancel button

## User Workflow

### For Content Creators:
1. Navigate to "Generated Content" page
2. Check the boxes next to images/videos to select them
3. Click "Add to Production Task" button
4. Modal opens showing only tasks assigned to you
5. Click on a task to link the selected content
6. Success message shows how many items were linked
7. Selection is cleared automatically

### For Admins/Managers:
- Same workflow but can see and link to all tasks
- Can manage any production task from the Master Production Tracker

## Features & Benefits

### Automatic Progress Tracking
- No manual counting needed
- Real-time updates to task progress
- Visual progress bars show completion status
- Auto-status updates when targets are met

### Duplicate Prevention
- System tracks which content is already linked to each task
- Prevents double-counting
- Shows count of already linked items in response

### Permission-Based Access
- Content creators only see their assigned tasks
- Admins/Managers have full visibility
- Security checks on all API endpoints

### Smart Filtering
- Only shows relevant tasks in modal
- Hides completed tasks (disabled)
- Shows how many items are still needed

### Bulk Operations
- Select multiple items at once
- Link many images/videos in a single action
- "Select all on page" for quick selection

## Testing Checklist

- [ ] Select individual items via checkbox
- [ ] Select all items on page
- [ ] Clear selection
- [ ] Open task modal and see tasks
- [ ] Link content to a task
- [ ] Verify progress updated in admin panel
- [ ] Try linking same content twice (should skip duplicates)
- [ ] Verify content creator only sees their tasks
- [ ] Verify admin/manager sees all tasks
- [ ] Check completed tasks are disabled
- [ ] Verify status changes from PENDING to IN_PROGRESS
- [ ] Verify status changes to COMPLETED when targets met
- [ ] Test with images only
- [ ] Test with videos only
- [ ] Test with mixed images and videos

## Future Enhancements (Optional)

1. **Unlink Functionality**: Add ability to remove linked content from UI
2. **Linked Content View**: Show which content is linked to each task
3. **Preview Mode**: Preview linked content before confirming
4. **Batch Upload**: Upload directly to a task from generation pages
5. **Task Suggestions**: Auto-suggest tasks based on LoRA model or influencer
6. **Notification**: Notify assignee when content is added to their task
7. **Analytics**: Track which content types complete tasks faster

## Technical Notes

- Uses React Set for efficient selection tracking
- Modal uses portal pattern for proper z-index stacking
- All operations use transactions to maintain data consistency
- Optimistic UI updates for better UX
- Proper error handling with user-friendly messages
- Dark mode support throughout

## Files Modified/Created

### Database
- `prisma/schema.prisma` - Added junction tables and relations

### API Routes
- `app/api/production/my-tasks/route.ts` - Fetch user tasks
- `app/api/production/link-content/route.ts` - Link/unlink content

### UI Components
- `app/(dashboard)/workspace/generated-content/page.tsx` - Main updates
  - Added selection state management
  - Added checkboxes to grid items
  - Added selection toolbar
  - Added task modal
  - Added link/unlink functions

### Documentation
- `PRODUCTION_CONTENT_LINKING_FEATURE.md` - This file
