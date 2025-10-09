# 🎬 FPS Boost Feature

AI-powered video frame interpolation using **RIFE** (Real-Time Intermediate Flow Estimation) for ultra-smooth motion.

## ✨ Features

- **AI Frame Interpolation**: Generate intermediate frames between existing frames
- **2x to 5x FPS Boost**: Increase video frame rate from 30 FPS to 60, 90, 120, or 150 FPS
- **RIFE 4.7 Model**: State-of-the-art frame interpolation AI
- **Fast & Ensemble Modes**: Balance between speed and quality
- **AWS S3 Storage**: Direct upload to cloud storage
- **Real-time Progress**: Live updates during processing

## 📁 Files Created

### Frontend
- `app/(dashboard)/workspace/generate-content/fps-boost/page.tsx` - UI page for FPS boost

### Backend
- `fps_boost_handler.py` - RunPod serverless handler
- `Dockerfile.fps-boost` - Docker container configuration
- `build-and-push-fps-boost.sh` - Build and deployment script

### API Routes
- `app/api/generate/fps-boost/route.ts` - Generation endpoint
- `app/api/webhook/fps-boost/route.ts` - Webhook handler for status updates

### Database
- Updated `prisma/schema.prisma` - Added `VIDEO_FPS_BOOST` generation type

## 🚀 Deployment Steps

### 1. Build Docker Image

```bash
chmod +x build-and-push-fps-boost.sh
./build-and-push-fps-boost.sh
```

This will:
- Build a multi-platform Docker image (linux/amd64, linux/arm64)
- Install ComfyUI with Video Helper Suite
- Install RIFE frame interpolation custom nodes
- Push to Docker Hub: `rfldln01/fps-boost-handler:latest`

### 2. Create RunPod Serverless Endpoint

1. Go to [RunPod Serverless](https://www.runpod.io/console/serverless)
2. Click **"New Endpoint"**
3. Configure:
   - **Name**: FPS Boost Handler
   - **Container Image**: `rfldln01/fps-boost-handler:latest`
   - **Container Disk**: 20 GB (for ComfyUI + RIFE models)
   - **GPU**: RTX 3090 or better (24GB VRAM recommended)
   - **Min Workers**: 0 (serverless)
   - **Max Workers**: 3
   - **Idle Timeout**: 60 seconds

4. Add Environment Variables:
   ```
   AWS_ACCESS_KEY_ID=<your-aws-key>
   AWS_SECRET_ACCESS_KEY=<your-aws-secret>
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=tastycreative
   ```

5. Click **"Deploy"**
6. Copy the **Endpoint ID** (e.g., `abc123xyz`)

### 3. Update Environment Variables

Update `.env.local`:

```env
RUNPOD_FPS_BOOST_ENDPOINT_ID=abc123xyz
RUNPOD_FPS_BOOST_ENDPOINT_URL=https://api.runpod.ai/v2/abc123xyz
```

### 4. Deploy to Vercel

```bash
git add .
git commit -m "feat: Add FPS Boost feature with RIFE frame interpolation"
git push origin main
```

Vercel will automatically deploy your changes.

## 🎯 Usage

1. Navigate to **Workspace → Generate Content → FPS Boost**
2. Upload a video (MP4, MOV, AVI)
3. Select FPS multiplier (2x, 3x, 4x, or 5x)
4. Adjust advanced settings (optional):
   - **Clear Cache**: How often to clear memory during processing
   - **Fast Mode**: Faster processing with slightly lower quality
   - **Ensemble Mode**: Better quality but slower processing
5. Click **"Boost FPS"**
6. Wait for processing (typically 2-5 minutes depending on video length)
7. Download the high-FPS video

## 🔧 Technical Details

### Workflow Components

1. **VHS_LoadVideo** (Node 1):
   - Loads the uploaded video
   - Extracts frames for processing

2. **RIFE VFI** (Node 2):
   - AI-powered frame interpolation
   - Generates intermediate frames
   - Supports multiple FPS multipliers

3. **VHS_VideoCombine** (Node 3):
   - Combines interpolated frames
   - Exports as H.264 MP4
   - Applies specified frame rate

### Processing Pipeline

```
Upload Video → Save to ComfyUI input → Load frames → RIFE interpolation → Combine frames → Upload to AWS S3 → Save to database
```

### Performance

- **30 FPS → 60 FPS (2x)**: ~2-3 minutes for 10-second video
- **30 FPS → 120 FPS (4x)**: ~4-6 minutes for 10-second video
- **GPU Memory**: ~8-12 GB VRAM usage
- **Output Quality**: Maintains original resolution

## 🐛 Troubleshooting

### Issue: "Failed to prepare ComfyUI environment"
**Solution**: Check RunPod logs for startup errors. Increase container disk size if needed.

### Issue: "RIFE model not found"
**Solution**: The model will auto-download on first run. Wait for initialization to complete.

### Issue: "Processing timeout"
**Solution**: Increase the `max_wait_time` in `fps_boost_handler.py` or split long videos into shorter clips.

### Issue: "Out of memory"
**Solution**: 
- Enable Fast Mode to reduce memory usage
- Lower the Clear Cache value (e.g., from 10 to 5)
- Use a GPU with more VRAM (24GB+ recommended)

## 📊 Cost Estimation

RunPod Serverless (RTX 3090):
- **Idle**: $0/hour
- **Active**: ~$0.50/hour
- **Per video** (30s clip, 2x FPS): ~$0.02-0.05

## 🎨 Use Cases

- **Slow Motion**: Create smooth slow-motion effects
- **Gaming Clips**: Increase FPS for smoother gameplay videos
- **Animation**: Make animations buttery smooth
- **Social Media**: Create eye-catching high-FPS content
- **Film Production**: Increase frame rate for better motion quality

## 📚 Additional Resources

- [RIFE GitHub](https://github.com/hzwer/Practical-RIFE)
- [ComfyUI Frame Interpolation](https://github.com/Fannovel16/ComfyUI-Frame-Interpolation)
- [Video Helper Suite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite)

## 🎉 Success!

Your FPS Boost feature is now live! Users can transform their videos into ultra-smooth high-FPS masterpieces using AI-powered frame interpolation.
