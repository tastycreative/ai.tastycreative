#!/bin/bash

# Build and push RunPod FPS Boost Handler (RIFE Frame Interpolation)
# Usage: ./build-and-push-fps-boost.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/fps-boost-handler"
VERSION="v1.0-rife-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🐋 Building Docker image for RunPod FPS Boost Handler"
echo "📦 Image: $DOCKER_IMAGE"
echo "🏷️  Version: $VERSION"
echo "🏗️  Platforms: linux/amd64,linux/arm64"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Ensure buildx is available and create builder if needed
echo "🔧 Setting up Docker buildx for multi-platform builds..."
docker buildx create --name multiplatform --use --bootstrap 2>/dev/null || docker buildx use multiplatform

# Build and push multi-platform image
echo "🚀 Building and pushing multi-platform Docker image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -f Dockerfile.fps-boost \
    -t $DOCKER_IMAGE:$VERSION \
    -t $DOCKER_IMAGE:$LATEST_TAG \
    --push \
    .

echo ""
echo "🎉 Successfully built and pushed multi-platform Docker image!"
echo ""
echo "📋 USE THIS IN RUNPOD:"
echo "   Container Image: $DOCKER_IMAGE:$VERSION"
echo "   Or Latest: $DOCKER_IMAGE:$LATEST_TAG"
echo ""
echo "✨ This version includes:"
echo "   • 🎬 FPS Boost using RIFE AI"
echo "   • 📹 2x, 3x, 4x, 5x frame interpolation"
echo "   • 🔗 Enhanced webhook system with retry logic"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🌐 Multi-platform support (linux/amd64, linux/arm64)"
echo "   • 💾 AWS S3 storage for output videos"
echo "   • 🎨 ComfyUI with Video Helper Suite"
echo "   • 🚀 RIFE 4.7 model for high-quality interpolation"
echo ""
echo "🎯 Workflow:"
echo "   1. Upload video"
echo "   2. Select FPS multiplier (2x-5x)"
echo "   3. AI generates intermediate frames"
echo "   4. Output smooth high-FPS video"
echo ""
echo "🔍 After deploying, check RunPod logs for:"
echo "   🎯 FPS Boost handler starting..."
echo "   📹 Video processing started..."
echo "   ✅ Frame interpolation completed..."
echo "   📤 Uploading to AWS S3..."
echo ""
