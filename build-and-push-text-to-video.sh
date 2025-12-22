#!/bin/bash

# Build and push RunPod Text to Video (Wan 2.2) Handler
# Usage: ./build-and-push-text-to-video.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/text-to-video-wan22-handler"
VERSION="v1.0-text-to-video-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🐋 Building Docker image for RunPod Text to Video (Wan 2.2) Handler"
echo "📦 Image: $DOCKER_IMAGE"
echo "🏷️  Version: $VERSION"
echo "🏗️  Platform: linux/amd64"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Ensure buildx is available and create builder if needed
echo "🔧 Setting up Docker buildx for multi-platform builds..."
docker buildx create --name multiplatform --use --bootstrap 2>/dev/null || docker buildx use multiplatform

# Build and push amd64 image
echo "🔨 Building and pushing Docker image for linux/amd64..."
docker buildx build \
    --platform linux/amd64 \
    -f Dockerfile.text-to-video \
    -t $DOCKER_IMAGE:$VERSION \
    -t $DOCKER_IMAGE:$LATEST_TAG \
    --push \
    .

echo ""
echo "🎉 Successfully built and pushed Docker image for linux/amd64!"
echo ""
echo "📋 USE THIS IN RUNPOD:"
echo "   Container Image: $DOCKER_IMAGE:$VERSION"
echo "   Or Latest: $DOCKER_IMAGE:$LATEST_TAG"
echo ""
echo "✨ This version includes:"
echo "   • 🎬 Wan 2.2 Text to Video Generation"
echo "   • ⚡ 4-step LoRA acceleration (high & low noise)"
echo "   • 🎨 High-quality video synthesis from text prompts"
echo "   • 📝 Custom prompt & negative prompt support"
echo "   • 🔗 Enhanced webhook system with retry logic"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🖥️  Platform: linux/amd64"
echo "   • 📤 AWS S3 direct uploads for bandwidth optimization"
echo "   • 📈 Real-time progress tracking"
echo "   • 💾 Network volume storage for models and outputs"
echo "   • 🗂️  User-specific output folders (/runpod-volume/outputs/{userId}/)"
echo ""
echo "🎯 Supported Actions:"
echo "   • action='generate_text_to_video' (Text to Video generation)"
echo "   • action='health_check' (Check handler health)"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎯 Text to Video handler starting..."
echo "   🎨 Models loaded successfully..."
echo "   📝 Processing text prompt..."
echo "   ✨ Video generation started..."
echo "   ✅ Workflow validation passed..."
echo "   🎬 Output video processing completed..."
echo "   📤 AWS S3 upload completed..."
echo ""
echo "📋 Required Environment Variables:"
echo "   • AWS_ACCESS_KEY_ID (for S3 uploads)"
echo "   • AWS_SECRET_ACCESS_KEY (for S3 uploads)"
echo "   • AWS_S3_BUCKET (default: tastycreative)"
echo "   • AWS_REGION (default: us-east-1)"
echo ""
echo "🎓 Required Models (should be in network volume):"
echo "   • diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors"
echo "   • diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"
echo "   • text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"
echo "   • vae/Wan2.1_VAE.safetensors"
echo "   • loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors"
echo "   • loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors"
echo ""
