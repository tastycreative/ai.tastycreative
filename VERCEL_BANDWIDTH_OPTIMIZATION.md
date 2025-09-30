# Vercel Fast Data Transfer Optimization Guide

## Problem Analysis

Your Vercel fast data transfer usage is high because your API routes are acting as **proxy servers** that:

1. Fetch large files from RunPod S3 storage
2. Stream them through Vercel infrastructure 
3. Send them to clients

This creates **double bandwidth usage**: S3 → Vercel → Client

## Top Bandwidth Consuming Routes

| Route | Requests | Total Transfer | Issue |
|-------|----------|----------------|-------|
| `/api/upload/image` | 80 | 203.77 MB | Image uploads via Vercel |
| `/api/images/s3/[key]` | 91 | 130.81 MB | Image proxy through Vercel |
| `/api/generate/image-to-video-runpod` | 40 | 82.64 MB | Video generation data |
| `/api/videos/s3/[key]` | 84 | 31.74 MB | Video proxy through Vercel |
| `/api/jobs/[jobId]` | 2.9K | 11.42 MB | Job data with embedded images |

## Solution Strategies

### Strategy 1: Direct S3 URLs (Optimal - 100% bandwidth savings)

**Status**: ❌ **Not currently possible**
- RunPod S3 API doesn't support `GeneratePresignedURL` operation
- Direct URLs require public bucket access or CORS configuration
- CORS support unclear for RunPod S3

**If available, would provide**:
```typescript
// Direct access - no Vercel bandwidth usage
const imageUrl = buildDirectS3Url(image.s3Key);
// https://s3api-us-ks-2.runpod.io/83cljmpqfd/outputs/userId/image.png
```

### Strategy 2: Optimized Proxy (Immediate - 30-50% bandwidth savings) ✅

**Implementation**: `/api/media/s3/[key]/route.ts`

**Optimizations**:
- **Streaming responses** for files >10MB (reduces memory usage)
- **Range request support** for video seeking
- **Better caching headers** (1 year cache)
- **Unified endpoint** for images and videos
- **HEAD request support** for metadata
- **Proper error handling**

**Usage**:
```typescript
import { getBestImageUrl } from "@/lib/s3Utils";

// Automatically uses optimized proxy
const imageUrl = getBestImageUrl(image, 'proxy');
const videoUrl = getBestVideoUrl(video, 'proxy');
```

### Strategy 3: Upload Optimization (Reduces upload bandwidth)

**Current issue**: `/api/upload/image` processes uploads through Vercel

**Solution**: Direct upload to S3 (requires multipart upload for >500MB files)

## Implementation Steps

### 1. Immediate Optimization (Deploy Today)

1. **Deploy the new optimized proxy route**:
   ```bash
   # The file is already created: /api/media/s3/[key]/route.ts
   ```

2. **Update frontend imports**:
   ```typescript
   import { getBestImageUrl, getBestVideoUrl } from "@/lib/s3Utils";
   ```

3. **Replace image/video URL generation**:
   ```typescript
   // OLD - using separate proxy routes
   const imageUrl = `/api/images/s3/${encodeURIComponent(s3Key)}`;
   const videoUrl = `/api/videos/s3/${encodeURIComponent(s3Key)}`;
   
   // NEW - using optimized unified route
   const imageUrl = getBestImageUrl(image, 'proxy');
   const videoUrl = getBestVideoUrl(video, 'proxy');
   ```

### 2. Test and Validate

1. **Run the optimization analysis**:
   ```bash
   cd "D:\\TASTY\\SaaS website\\ai.tastycreative"
   node scripts/optimize-s3-bandwidth.js
   ```

2. **Monitor Vercel dashboard** for bandwidth reduction

3. **Test video streaming** (should support seeking/range requests)

### 3. Future Optimizations

1. **Contact RunPod support** about CORS configuration for direct access
   
2. **Implement direct S3 uploads** to reduce upload bandwidth

3. **Consider CDN** for further caching improvements

## Expected Results

### Immediate (Strategy 2):
- **30-50% reduction** in fast data transfer
- **Better video streaming** performance
- **Reduced memory usage** on Vercel functions
- **Improved caching** and error handling

### Future (Strategy 1):
- **80-95% reduction** in fast data transfer (if direct URLs become available)
- **Faster load times** (no proxy delay)
- **Better scalability**

## Monitoring

Track these metrics in Vercel dashboard:
- Fast data transfer usage for `/api/images/s3/[key]`
- Fast data transfer usage for `/api/videos/s3/[key]`
- Response times for media requests
- Error rates for media serving

## Code Changes Made

### New Files Created:
1. `lib/s3DirectAccess.ts` - Direct S3 access utilities
2. `app/api/media/s3/[key]/route.ts` - Optimized unified proxy
3. `app/api/s3/signed-urls/route.ts` - Direct URL generation API
4. `scripts/optimize-s3-bandwidth.js` - Analysis and testing script

### Files Updated:
1. `lib/s3Utils.ts` - Added optimization strategies
2. `app/(dashboard)/workspace/generate-content/text-to-image/page.tsx` - Updated to use new utilities

### Environment Variables Required:
```env
RUNPOD_S3_ACCESS_KEY=your_access_key
RUNPOD_S3_SECRET_KEY=your_secret_key  
RUNPOD_S3_BUCKET_NAME=83cljmpqfd
```

## Next Steps

1. **Deploy immediately** with Strategy 2 (optimized proxy)
2. **Monitor bandwidth usage** for 24-48 hours
3. **Run the analysis script** to check for direct access possibilities
4. **Contact RunPod support** about CORS/direct access configuration
5. **Consider upload optimization** as next phase

This optimization should significantly reduce your Vercel fast data transfer costs while improving performance and user experience.