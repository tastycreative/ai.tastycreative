# Instagram Staging Tool - Rejection & Real-Time Updates

## ✅ Features Implemented

### 1. Rejection with Reason & Indicator

#### Database Schema Updates
- **Added 3 new fields** to `InstagramPost` model:
  - `rejectedAt`: DateTime when post was rejected
  - `rejectionReason`: String explaining why it was rejected
  - `rejectedBy`: Clerk ID of who rejected it

#### Rejection Flow
```
Admin/Manager clicks "Reject" button
  ↓
Modal dialog appears asking for rejection reason
  ↓
Admin/Manager enters reason (required)
  ↓
Clicks "Reject Post"
  ↓
Post status → DRAFT with rejection metadata saved
  ↓
Content Creator sees rejection notice with reason
```

#### UI Components

**Rejection Dialog:**
- Beautiful modal with red theme
- Required textarea for rejection reason
- Placeholder suggestions (image quality, caption issues, wrong format)
- Cancel / Reject Post buttons
- Disabled state until reason is entered

**Rejection Notice (in Post Editor):**
- Red warning banner with AlertCircle icon
- Shows rejection reason prominently
- Displays rejection date and time
- Only visible on posts with rejection metadata
- Automatically cleared when post is resubmitted or approved

#### API Changes

**Updated PATCH endpoint** (`/api/instagram-posts/[id]`):
- Accepts `rejectionReason` parameter
- Sets rejection metadata when status changes to DRAFT
- Clears rejection metadata when status is REVIEW or APPROVED
- Notifies connected clients via SSE

---

### 2. Real-Time Updates with Server-Sent Events (SSE)

#### SSE Endpoint
- **New endpoint**: `/api/instagram-posts/stream`
- Maintains persistent connections with clients
- Sends events when posts are updated/created/deleted
- Heartbeat every 30 seconds to keep connection alive
- Automatic cleanup on client disconnect

#### SSE Event Format
```json
{
  "postId": "cm321abc...",
  "action": "update" | "create" | "delete",
  "data": { /* updated post data */ },
  "timestamp": 1234567890
}
```

#### Frontend Integration
- Auto-connects to SSE stream on component mount
- Listens for post updates from other users
- Updates local state in real-time without page refresh
- Preserves blob URLs when updating posts
- Reconnects automatically on errors

#### Real-Time Scenarios

**Scenario 1: Content Creator submits post**
1. Content Creator clicks "Submit for Review"
2. Post status changes to REVIEW
3. SSE broadcasts update to all connected clients
4. Admin/Manager sees update instantly without refresh

**Scenario 2: Admin approves post**
1. Admin clicks "Approve" on Content Creator's post
2. Post status changes to APPROVED
3. SSE broadcasts update
4. Content Creator sees approval in real-time

**Scenario 3: Admin rejects with reason**
1. Admin enters rejection reason and clicks "Reject Post"
2. Post reverts to DRAFT with rejection metadata
3. SSE broadcasts update
4. Content Creator immediately sees rejection notice

---

## 🎯 User Experience

### For Content Creators
- ✅ See rejection notices with clear reasons
- ✅ Understand what needs to be fixed
- ✅ Resubmit after making changes (rejection notice clears)
- ✅ Real-time updates when Admin/Manager takes action

### For Admin/Manager
- ✅ Provide helpful feedback with rejection reasons
- ✅ Track who rejected what and when
- ✅ See real-time updates from Content Creators
- ✅ Better collaboration and communication

---

## 🚀 Technical Implementation

### Database Migration
```bash
npx prisma db push
```
Added:
- `rejectedAt DateTime?`
- `rejectionReason String?`
- `rejectedBy String?`

### TypeScript Types Updated
- `InstagramPost` interface in `lib/instagram-posts.ts`
- `Post` interface in `InstagramStagingTool.tsx`
- Proper null handling for optional rejection fields

### API Endpoints

**Updated:**
- `PATCH /api/instagram-posts/[id]` - Handles rejection metadata

**New:**
- `GET /api/instagram-posts/stream` - SSE stream for real-time updates

### Frontend Hooks

**SSE Connection:**
```typescript
useEffect(() => {
  const eventSource = new EventSource('/api/instagram-posts/stream');
  
  eventSource.onmessage = (event) => {
    // Update posts in real-time
  };
  
  return () => eventSource.close();
}, []);
```

---

## 📊 Testing Checklist

### Rejection Feature
- [ ] Admin/Manager can click "Reject" on REVIEW post
- [ ] Rejection dialog appears with required reason field
- [ ] Cannot submit without entering reason
- [ ] Post reverts to DRAFT with rejection metadata
- [ ] Content Creator sees red rejection notice in editor
- [ ] Notice shows reason, date, and time
- [ ] Notice disappears when post is resubmitted
- [ ] Notice disappears if Admin approves

### Real-Time Updates

#### Polling System for Vercel Deployment

Since Vercel's serverless functions don't support persistent connections (WebSocket/SSE), we use a **polling-based approach** that's reliable and scalable:

**How It Works**:
1. Frontend polls `/api/instagram-posts/changes` every 3 seconds
2. Sends `lastCheck` timestamp to detect changes since last poll
3. Server returns updated posts if changes detected
4. Lightweight responses (`{ hasChanges: false }`) when nothing changed

**Benefits**:
- ✅ Works perfectly with Vercel serverless architecture
- ✅ No connection timeouts or limits
- ✅ Simple and reliable
- ✅ 1-3 second latency (good enough for collaboration)

**See [VERCEL_DEPLOYMENT_REALTIME.md](./VERCEL_DEPLOYMENT_REALTIME.md) for detailed architecture.**
- [ ] Open staging tool in 2 browser windows (different users)
- [ ] Content Creator submits post → Admin sees it instantly
- [ ] Admin approves post → Content Creator sees it instantly
- [ ] Admin rejects post → Content Creator sees rejection notice instantly
- [ ] Updates work across different roles
- [ ] Connection survives for extended periods (heartbeat working)
- [ ] Updates don't break blob URLs (images still display)

---

## 🔮 Future Enhancements

### Possible Additions:
1. **Rejection History**: Track all rejections for a post
2. **Email Notifications**: Notify Content Creator when rejected
3. **Rejection Templates**: Quick-select common rejection reasons
4. **Revision Counter**: Show how many times post was rejected
5. **Batch Operations**: Approve/reject multiple posts at once
6. **Audit Log**: Complete history of all status changes

---

## 🐛 Known Limitations

1. **SSE Connection**: Browser limit of 6 SSE connections per domain
2. **Serverless**: SSE not ideal for serverless (use WebSockets or polling for Vercel)
3. **Mobile**: SSE may disconnect on mobile when app backgrounds

### Serverless Alternative (if needed):
Instead of SSE, use **polling** with `setInterval`:
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const posts = await fetchInstagramPosts(selectedUserId);
    setPosts(posts);
  }, 5000); // Poll every 5 seconds
  
  return () => clearInterval(interval);
}, []);
```

---

## 📝 Summary

Both features are fully implemented and ready for local testing:

1. ✅ **Rejection with Reason**: Beautiful modal, clear feedback, automatic notices
2. ✅ **Real-Time Updates (SSE)**: Instant updates across all connected users

Test locally first, then deploy when ready! 🚀
