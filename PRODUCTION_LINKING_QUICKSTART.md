# Quick Start Guide: Production Content Linking

## What This Feature Does
Allows you to select generated images/videos and link them to production tasks. When you link content, the task's progress automatically updates!

## Visual Guide

### Step 1: Select Content
```
┌─────────────────────────────────────────────────────────┐
│ Generated Content                                       │
│                                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                  │
│  │ ☑️  │  │ ☑️  │  │ ☐  │  │ ☐  │                  │
│  │img1 │  │img2 │  │img3 │  │img4 │                  │
│  └─────┘  └─────┘  └─────┘  └─────┘                  │
│                                                         │
│  2 items selected  [Clear] [Select All]                │
│  [Add to Production Task →]                            │
└─────────────────────────────────────────────────────────┘
```

### Step 2: Choose Task
```
┌─────────────────────────────────────────────────────────┐
│ 📋 Select Production Task                               │
│ Choose a task to link 2 selected items                 │
│                                       ━━━━━━━━━━━━━━━━ │
│                                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │ Influencer A                    [IN PROGRESS]  │   │
│  │ 📸 @instagram  🎨 model.safetensors            │   │
│  │                                                 │   │
│  │ Images: 3/10  ████████░░░░░░░░  7 needed      │   │
│  │ Videos: 0/5   ░░░░░░░░░░░░░░░░  5 needed      │   │
│  └────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │ Influencer B                    [PENDING]      │   │
│  │ 📸 @instagram  🎨 model2.safetensors           │   │
│  │                                                 │   │
│  │ Images: 0/15  ░░░░░░░░░░░░░░░░  15 needed     │   │
│  │ Videos: 0/3   ░░░░░░░░░░░░░░░░  3 needed      │   │
│  └────────────────────────────────────────────────┘   │
│                                                         │
│                                         [Cancel]        │
└─────────────────────────────────────────────────────────┘
```

### Step 3: Success!
```
┌─────────────────────────────────────────────────────────┐
│ ✅ Success!                                             │
│                                                         │
│ Successfully linked 2 image(s) and 0 video(s)          │
│                                                         │
│ Already linked: 0 image(s), 0 video(s)                 │
│                                                         │
│                                            [OK]         │
└─────────────────────────────────────────────────────────┘
```

### Step 4: Check Progress
Go to Admin → Master Production Tracker:
```
┌─────────────────────────────────────────────────────────┐
│ Master Production Tracker                               │
│                                                         │
│  Influencer A                                           │
│  Images: 5/10  ██████████░░░░░░░░  5 needed           │
│  Videos: 0/5   ░░░░░░░░░░░░░░░░    5 needed           │
│  Status: IN PROGRESS ⚙️                                 │
└─────────────────────────────────────────────────────────┘
   ↑ Updated from 3/10 to 5/10 automatically!
```

## How It Works

### For Content Creators:
1. Generate images/videos using any AI tool
2. Go to "Generated Content" page
3. Check boxes next to content you want to use
4. Click "Add to Production Task"
5. Modal shows ONLY YOUR assigned tasks
6. Click a task → Content linked + Progress updated!

### For Admins/Managers:
- Same workflow but see ALL tasks
- Can link content to any task
- Monitor progress in Master Production Tracker
- Filter by content creator to see their progress

## Smart Features

### 🎯 Automatic Progress Tracking
- Counts update automatically when you link content
- Status changes automatically:
  - **PENDING** → **IN_PROGRESS** (when content added)
  - **IN_PROGRESS** → **COMPLETED** (when targets met)

### 🛡️ Duplicate Prevention
- Can't link same content twice to same task
- System skips duplicates automatically
- Shows how many were skipped

### 📊 Real-Time Progress
- Progress bars update immediately
- Shows "X needed" for remaining items
- Color-coded status badges

### ✅ Smart Selection
- Check individual items
- "Select all on page" for bulk selection
- "Clear selection" to start over
- Checkboxes only appear on hover

### 🔒 Permission-Based
- Content creators see only their tasks
- Admins/Managers see all tasks
- Can't link to completed tasks (disabled)

## Common Workflows

### Scenario 1: Bulk Image Generation
```
1. Generate 20 images for Influencer A
2. Select all 20 images
3. Link to "Influencer A" task (needs 15 images)
4. Progress: 0/15 → 15/15 ✅
5. Task status: PENDING → COMPLETED 🎉
```

### Scenario 2: Mixed Content
```
1. Select 5 images + 2 videos
2. Link to task needing 10 images, 5 videos
3. Images: 0/10 → 5/10
4. Videos: 0/5 → 2/5
5. Task status: PENDING → IN PROGRESS ⚙️
```

### Scenario 3: Multiple Tasks
```
1. Select 3 images
2. Link to Task A → Progress updated
3. Select 5 more images
4. Link to Task B → Progress updated
5. Both tasks track independently!
```

## Tips & Tricks

### 💡 Productivity Tips:
- Use **filters** to find specific content types
- Sort by **"newest"** to see recent generations
- **Select all on page** for bulk linking
- Check **Master Production Tracker** for task deadlines

### ⚠️ Important Notes:
- Can't unlink content from UI yet (use database if needed)
- Completed tasks are disabled (can't add more)
- Linking doesn't move/copy files (just tracks them)
- Same content can be linked to multiple tasks

### 🐛 Troubleshooting:
- **Modal empty?** → No tasks created yet (create in admin panel)
- **Task grayed out?** → Already completed or you lack permissions
- **Progress not updating?** → Refresh page or check admin panel
- **Can't see tasks?** → Make sure you're assigned (content creators)

## Example Use Cases

### Use Case 1: Instagram Campaign
```
Goal: Create 30 posts for @fashioninfluencer
1. Generate 35 images (some extras for selection)
2. Select best 30 images from gallery
3. Link to "Fashion Campaign" task
4. Progress: 0/30 → 30/30 ✅
5. Team sees task completed in tracker
```

### Use Case 2: Mixed Content Creator
```
Content Creator generates daily content:
Monday: 5 images → Link to "Weekly Content" task
Tuesday: 3 videos → Link to same task
Wednesday: 10 images → Link to same task
Progress automatically tracked all week!
```

### Use Case 3: Multiple Influencers
```
Admin creates 3 tasks:
- Influencer A: 20 images, 5 videos
- Influencer B: 15 images, 3 videos
- Influencer C: 10 images, 10 videos

Content creator generates and links content to correct tasks.
Admin monitors all progress from single dashboard!
```

## API Reference (For Developers)

### Fetch My Tasks
```javascript
GET /api/production/my-tasks

Response:
[
  {
    id: "task_123",
    influencer: "Influencer Name",
    imagesTarget: 10,
    imagesGenerated: 5,
    videosTarget: 5,
    videosGenerated: 2,
    status: "IN_PROGRESS",
    deadline: "2025-10-15T00:00:00Z",
    linkedImages: [{ imageId: "img_1" }],
    linkedVideos: [{ videoId: "vid_1" }]
  }
]
```

### Link Content
```javascript
POST /api/production/link-content

Body:
{
  productionEntryId: "task_123",
  imageIds: ["img_1", "img_2"],
  videoIds: ["vid_1"]
}

Response:
{
  success: true,
  message: "Successfully linked 2 image(s) and 1 video(s)",
  alreadyLinked: { images: 0, videos: 0 }
}
```

## Need Help?

1. **Check documentation**: PRODUCTION_CONTENT_LINKING_FEATURE.md
2. **View code**: 
   - UI: `app/(dashboard)/workspace/generated-content/page.tsx`
   - API: `app/api/production/*`
3. **Database**: `prisma/schema.prisma` (junction tables)
4. **Issues?**: Check browser console for errors

---

🎉 **Happy Content Linking!** 🎉
```
