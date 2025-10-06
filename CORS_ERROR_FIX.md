# 🔍 CORS Error Fix Guide

## The Problem

You're seeing these errors in the browser console:
```
TypeError: Failed to fetch
    at uploadChunk
    at uploadDirectToS3WithPresignedUrls
```

**This is a CORS (Cross-Origin Resource Sharing) error!**

## Why This Happens

When your browser tries to upload directly to RunPod S3 using presigned URLs:
1. Browser makes a PUT request to `https://s3api-us-ks-2.runpod.io/...`
2. RunPod S3 checks: "Is `localhost:3000` allowed to upload?"
3. RunPod S3 says: "No CORS policy found!" ❌
4. Browser blocks the request → "Failed to fetch" error

The upload might still work because the request was sent before being blocked, but the browser can't read the response.

## The Solution

Configure RunPod S3 bucket to allow direct browser uploads.

### Step 1: Run CORS Configuration Script

```bash
python configure-runpod-s3-cors.py
```

This script will:
- ✅ Connect to your RunPod S3 bucket
- ✅ Set up CORS rules to allow browser uploads
- ✅ Allow PUT, GET, POST, DELETE, HEAD methods
- ✅ Allow all necessary headers (Content-Type, ETag, etc.)
- ✅ Set 1 hour cache for CORS preflight requests

### Step 2: Verify Configuration

After running the script, you should see:
```
✅ CORS configuration applied successfully!
✅ Current CORS rules:
  Rule 1:
    Allowed Origins: ['*']
    Allowed Methods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD']
    Allowed Headers: ['*', 'Content-Type', ...]
    Max Age: 3600 seconds
```

### Step 3: Test Upload Again

Refresh your browser and try uploading again. The "Failed to fetch" errors should be gone!

## Alternative: Manual CORS Configuration

If the Python script doesn't work, you can configure CORS manually using AWS CLI:

```bash
# Create a CORS configuration file
cat > cors-config.json << EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket 83cljmpqfd \
  --cors-configuration file://cors-config.json \
  --endpoint-url https://s3api-us-ks-2.runpod.io
```

## How to Verify CORS is Working

### Before CORS Fix:
```javascript
// Browser console shows:
❌ Part 1 failed (attempt 1): TypeError: Failed to fetch
🚨 CORS ERROR DETECTED!
   This usually means the S3 bucket CORS is not configured correctly.
   Run: python configure-runpod-s3-cors.py
```

### After CORS Fix:
```javascript
// Browser console shows:
📤 Uploading part 1/20 directly to S3 (512KB) - attempt 1
✅ Part 1 uploaded successfully (ETag: "abc123...")
📤 Uploading part 2/20 directly to S3 (512KB) - attempt 1
✅ Part 2 uploaded successfully (ETag: "def456...")
```

## Understanding CORS

### What is CORS?

CORS is a security feature in browsers that blocks requests to different domains unless explicitly allowed.

### Why Do We Need CORS for S3?

- **Your app**: `localhost:3000` (or `tastycreative.ai`)
- **RunPod S3**: `s3api-us-ks-2.runpod.io`
- These are **different domains**!

Without CORS:
```
localhost:3000 → PUT to s3api-us-ks-2.runpod.io
                 ❌ BLOCKED by browser
```

With CORS configured:
```
localhost:3000 → PUT to s3api-us-ks-2.runpod.io
                 ✅ ALLOWED by browser
```

## CORS Configuration Details

The script configures:

### Allowed Origins
```
'http://localhost:3000'       # Local development
'https://*.vercel.app'        # Vercel preview deployments
'https://tastycreative.ai'    # Production domain
'*'                           # Fallback for all origins
```

### Allowed Methods
```
GET     - Download files
PUT     - Upload chunks (presigned URL)
POST    - Create uploads
DELETE  - Delete files
HEAD    - Check file existence
```

### Allowed Headers
```
Content-Type           # File type
Content-Length         # File size
Authorization          # Auth credentials
x-amz-*               # AWS-specific headers
ETag                  # File checksum
```

### Exposed Headers
```
ETag                  # Needed to get upload confirmation
x-amz-request-id      # For debugging
```

## Troubleshooting

### Error: "AccessDenied"
**Problem**: Your RunPod S3 credentials don't have permission to change CORS settings.

**Solution**: Check your RunPod S3 credentials have these permissions:
- `s3:PutBucketCors`
- `s3:GetBucketCors`

### Error: "NoSuchBucket"
**Problem**: The bucket name is incorrect.

**Solution**: Verify bucket name in `.env.local`:
```
RUNPOD_S3_BUCKET=83cljmpqfd
```

### Error: "Connection Refused"
**Problem**: RunPod S3 endpoint is unreachable.

**Solution**: Verify endpoint in script:
```python
RUNPOD_S3_ENDPOINT = 'https://s3api-us-ks-2.runpod.io'
```

### CORS Still Not Working
**Problem**: Browser cache might have old CORS policy.

**Solution**:
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Close and reopen browser
4. Try in incognito mode

## Testing CORS Manually

You can test if CORS is working using `curl`:

```bash
# Test preflight request (OPTIONS)
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  "https://s3api-us-ks-2.runpod.io/83cljmpqfd/test.txt"

# Should return:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, PUT, POST, DELETE, HEAD
# Access-Control-Allow-Headers: *
```

## Why Uploads Still Work Despite Errors

You mentioned **"the upload works but why does it have errors?"**

Here's what's happening:

1. ✅ **Request is sent** - Browser sends PUT to S3
2. ✅ **S3 receives and processes** - File chunk is uploaded
3. ❌ **Browser blocks response** - CORS error prevents reading response
4. ❌ **JavaScript sees "Failed to fetch"** - Can't get ETag or status

So the file IS uploading, but your code can't verify success!

### Without CORS Fix:
```javascript
// File uploads ✅
// But browser can't read response ❌
// Code thinks upload failed
// Retries unnecessarily
// ETags might be missing
```

### With CORS Fix:
```javascript
// File uploads ✅
// Browser reads response ✅
// Code gets ETag confirmation ✅
// No unnecessary retries ✅
// Clean success messages ✅
```

## Summary

**Quick Fix:**
```bash
# Run this command:
python configure-runpod-s3-cors.py

# Then refresh browser and test upload again
```

**What This Fixes:**
- ❌ Before: "TypeError: Failed to fetch" errors
- ✅ After: Clean uploads with proper status messages

**Why It's Important:**
- Ensures reliable uploads
- Proper error handling
- Better user experience
- Eliminates console errors

---

## Need Help?

If you're still seeing CORS errors after running the script:

1. Check the script output for errors
2. Verify your `.env.local` has correct RunPod credentials
3. Try the manual AWS CLI method
4. Check RunPod dashboard for CORS settings
5. Clear browser cache and try in incognito mode

The uploads work but with CORS configured, they'll work **properly** without browser errors! 🚀
