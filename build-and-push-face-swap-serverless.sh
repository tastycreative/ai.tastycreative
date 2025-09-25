#!/bin/bash

# Build and push RunPod Face Swap Serverless Handler
# Usage: ./build-and-push-face-swap-serverless.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/face-swap-serverless-handler"
VERSION="v1.0-serverless-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🎭 Building Docker image for RunPod Face Swap Serverless Handler"
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

# Build and push single-platform image for linux/amd64
echo "🚀 Building and pushing Docker image for linux/amd64..."
docker buildx build \
    --platform linux/amd64 \
    -f Dockerfile.face-swap-serverless \
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
echo "   • 🎭 Advanced Face Swapping with ComfyUI"
echo "   • 🤖 InsightFace integration for face detection"
echo "   • 🎯 Mask-based inpainting for seamless blending"
echo "   • 🔗 Enhanced webhook system with retry logic"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🌐 Linux/amd64 platform support"
echo ""
echo "🎯 Supported Actions:"
echo "   • action='generate_face_swap' (face swapping)"
echo ""
echo "📋 Required Input Parameters:"
echo "   • workflow: ComfyUI workflow JSON"
echo "   • originalImageUrl: URL of image with face to replace"
echo "   • newFaceImageUrl: URL of new face image"
echo "   • originalFilename: Filename for original image"
echo "   • newFaceFilename: Filename for new face image"
echo "   • maskFilename: (optional) Filename for mask image"
echo "   • maskImageUrl: (optional) URL of mask image"
echo "   • webhookUrl: (optional) Webhook URL for progress updates"
echo ""
echo "🎭 Sebastian Kamph ACE++ Workflow Notes:"
echo "   • Requires MANUAL FACE MASKING for proper face swapping"
echo "   • Paint RED areas over faces you want to replace"
echo "   • Without a mask, workflow returns original image unchanged"
echo "   • Provide masked image as originalImageUrl OR separate maskImageUrl"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎭 Face Swap Handler starting..."
echo "   👤 Face detection in progress..."
echo "   ✅ Face swap workflow validation passed..."
echo "   📸 Database image processing completed..."
echo ""
