# Real-Time Updates for Vercel Deployment

## Overview

This document explains how real-time updates work in production on Vercel using a **polling-based approach** instead of WebSockets or Server-Sent Events (SSE).

## Why Polling Instead of WebSockets/SSE?

### Vercel Limitations
- **Serverless functions have time limits**: 10-60 seconds max execution time
- **No persistent connections**: Functions terminate after response
- **No WebSocket support**: In serverless API routes
- **SSE doesn't work**: Connection closes when function terminates

### Polling Benefits for Vercel
✅ **Works perfectly with serverless architecture**
✅ **No connection timeouts or limits**
✅ **Simple implementation and debugging**
✅ **Scalable and cost-effective**
✅ **No special infrastructure needed**

## Architecture

### API Endpoint: `/api/instagram-posts/changes`

**Purpose**: Check for post updates since last poll

**Request Parameters**:
```typescript
GET /api/instagram-posts/changes?lastCheck=1696348800000&userId=user_xyz
```

- `lastCheck` (number): Timestamp of last check in milliseconds
- `userId` (optional): For Admin/Manager viewing specific user's posts

**Response Format**:
```typescript
{
  hasChanges: boolean,
  posts?: InstagramPost[],  // Full post data if changes detected
  timestamp: number          // Server timestamp for next poll
}
```

### Change Tracking Mechanism

```typescript
// In-memory change tracking (resets on deployment)
const lastChanges = new Map<string, { timestamp: number; postIds: string[] }>();

// Called by other API routes when changes occur
export function recordPostChange(postId: string) {
  const now = Date.now();
  
  lastChanges.forEach((value, userId) => {
    if (!value.postIds.includes(postId)) {
      value.postIds.push(postId);
    }
    value.timestamp = now;
  });
}
```

### Frontend Polling

```typescript
// Poll every 3 seconds
useEffect(() => {
  let lastCheck = Date.now();
  
  const checkForChanges = async () => {
    const response = await fetch(
      `/api/instagram-posts/changes?lastCheck=${lastCheck}`
    );
    const data = await response.json();
    
    if (data.hasChanges && data.posts) {
      // Update local state with new data
      setPosts(data.posts);
    }
    
    lastCheck = data.timestamp;
  };
  
  const interval = setInterval(checkForChanges, 3000);
  return () => clearInterval(interval);
}, []);
```

## Integration Points

### API Routes That Record Changes

1. **Create Post** - `POST /api/instagram-posts`
   ```typescript
   const post = await prisma.instagramPost.create({ data });
   recordPostChange(post.id);
   ```

2. **Update Post** - `PATCH /api/instagram-posts/[id]`
   ```typescript
   const updatedPost = await prisma.instagramPost.update({ ... });
   recordPostChange(id);
   ```

3. **Delete Post** - `DELETE /api/instagram-posts/[id]`
   ```typescript
   await prisma.instagramPost.delete({ where: { id } });
   recordPostChange(id);
   ```

## Performance Considerations

### Polling Frequency
- **3 seconds**: Good balance between responsiveness and server load
- **Adjust based on needs**: Can increase to 5s for less active workspaces

### Bandwidth Optimization
- Only sends full post data when changes detected
- Lightweight responses when no changes: `{ hasChanges: false, timestamp: 123 }`
- Client preserves blob URLs to avoid re-downloading images

### Server Load
- Minimal database queries (only when changes detected)
- In-memory change tracking is very fast
- No persistent connections to maintain

## Known Limitations

### 1. Deployment Resets Change Tracking
**Issue**: In-memory `lastChanges` Map is cleared on each deployment

**Impact**: 
- After deployment, first poll might miss changes that happened during deployment
- Next change will be detected normally

**Mitigation**:
- Could use Redis/database for persistent tracking (overkill for most cases)
- Changes are rare during deployment windows

### 2. Multi-Instance Considerations
**Issue**: Vercel may run multiple serverless instances

**Impact**:
- Each instance has its own `lastChanges` Map
- Changes recorded in one instance won't be visible to others

**Current Solution**:
- Always fetch from database on changes, not from memory
- `lastChanges` only tracks "something changed" flag
- Actual data comes from single source of truth (database)

**Future Enhancement** (if needed):
- Use Redis for distributed change tracking
- Or use database trigger timestamps

### 3. Delay Between Actions
**Typical Latency**: ~1.5-3 seconds

**User Experience**:
- User A approves a post → change recorded
- User B's next poll (≤3s) → sees the approval
- Still feels "real-time" for most workflows

## Testing

### Local Testing
1. Open two browser windows
2. Window 1: Make a change (approve/reject post)
3. Window 2: Should update within 3 seconds
4. Check browser console for poll logs

### Production Testing
1. Deploy to Vercel
2. Open staging tool on two devices/browsers
3. Make changes on one → verify appears on other
4. Check Vercel logs for API calls

### Performance Monitoring
```bash
# Check Vercel function logs
vercel logs [deployment-url]

# Look for:
- Polling frequency (should be ~every 3s per user)
- Response times (should be <100ms for no-change responses)
- Error rates
```

## Comparison: SSE vs Polling

| Feature | SSE (Local Dev) | Polling (Production) |
|---------|----------------|----------------------|
| Latency | Instant | 1-3 seconds |
| Server Load | Low (persistent connection) | Very Low (short requests) |
| Vercel Compatible | ❌ No | ✅ Yes |
| Scalability | Limited by connection count | Excellent |
| Complexity | Medium | Simple |
| Debugging | Harder | Easier |

## Future Enhancements

### 1. Adaptive Polling
```typescript
// Poll faster when user is active
let pollInterval = 3000;

document.addEventListener('mousemove', () => {
  pollInterval = 2000; // Faster when active
  setTimeout(() => { pollInterval = 5000; }, 10000); // Slower when idle
});
```

### 2. Delta Updates (Bandwidth Optimization)
```typescript
// Only send changed fields, not full posts
{
  hasChanges: true,
  deltas: [
    { id: 'post1', status: 'APPROVED', updatedAt: '...' },
    { id: 'post2', caption: 'Updated caption' }
  ]
}
```

### 3. Webhook-Triggered Invalidation
```typescript
// Use Vercel Edge Config or Redis Pub/Sub
// to notify all instances of changes instantly
```

## Troubleshooting

### Posts Not Updating
1. Check browser console for polling errors
2. Verify `/api/instagram-posts/changes` is being called
3. Check Vercel logs for server errors
4. Confirm `recordPostChange()` is called in API routes

### High Server Load
1. Increase polling interval (3s → 5s)
2. Add user activity detection
3. Implement rate limiting

### Missed Updates
1. Check if change happened during deployment
2. Verify `recordPostChange()` is called in all write operations
3. Ensure database queries include proper where clauses

## Migration from SSE

### What Changed
- ❌ Removed: `/api/instagram-posts/stream` SSE endpoint
- ✅ Added: `/api/instagram-posts/changes` polling endpoint
- ✅ Added: `recordPostChange()` function
- ✅ Updated: All write API routes to call `recordPostChange()`
- ✅ Updated: Frontend to use `setInterval` instead of `EventSource`

### Rollback Instructions
If needed to revert to SSE (local development):
1. Restore `/api/instagram-posts/stream/route.ts`
2. Change imports back to `notifyPostChange`
3. Replace polling useEffect with EventSource

## Summary

**For Production (Vercel)**: Polling is the right choice
- ✅ Reliable and scalable
- ✅ No infrastructure complexity
- ✅ Works within serverless constraints
- ✅ Good enough latency for collaboration workflows

**Best Practices**:
1. Keep polling interval ≥3 seconds
2. Always record changes in write operations
3. Preserve blob URLs to minimize bandwidth
4. Monitor Vercel function execution times
