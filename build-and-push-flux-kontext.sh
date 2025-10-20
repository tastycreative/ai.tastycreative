#!/bin/bash

# Build and push RunPod Flux Kontext Handler
# Usage: ./build-and-push-flux-kontext.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/flux-kontext-handler"
VERSION="v1.0-flux-kontext-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🐋 Building Docker image for RunPod Flux Kontext Handler"
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
    -f Dockerfile.flux-kontext \
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
echo "   • 🎨 Flux Kontext Image Transformation"
echo "   • 🖼️  Dual image input (left and right)"
echo "   • 🎭 AI-powered scene modification"
echo "   • 📝 Custom prompt support"
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
echo "   • action='transform_flux_kontext' (Flux Kontext transformation)"
echo "   • action='health_check' (Check handler health)"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎯 Flux Kontext handler starting..."
echo "   🎨 Models loaded successfully..."
echo "   📸 Processing left and right images..."
echo "   ✨ Image transformation started..."
echo "   ✅ Workflow validation passed..."
echo "   📸 Output image processing completed..."
echo "   📤 AWS S3 upload completed..."
echo ""
echo "📋 Required Environment Variables:"
echo "   • AWS_ACCESS_KEY_ID (for S3 uploads)"
echo "   • AWS_SECRET_ACCESS_KEY (for S3 uploads)"
echo "   • AWS_S3_BUCKET (default: tastycreative)"
echo "   • AWS_REGION (default: us-east-1)"
echo ""
echo "🎓 Required Models (should be in network volume):"
echo "   • unet/flux1-dev-kontext_fp8_scaled.safetensors"
echo "   • clip/clip_l.safetensors"
echo "   • clip/t5xxl_fp16.safetensors"
echo "   • vae/ae.safetensors"
echo ""
