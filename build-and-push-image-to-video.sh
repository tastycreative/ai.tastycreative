#!/bin/bash

# Build and push RunPod Image-to-Video Handler (WAN 2.2 Video Generation)
# Usage: ./build-and-push-image-to-video.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/image-to-video-handler"
VERSION="v1.0-image-to-video-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🐋 Building Docker image for RunPod Image-to-Video Handler"
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
echo "🔨 Building and pushing multi-platform Docker image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -f Dockerfile.image-to-video \
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
echo "   • 🎬 Image-to-Video generation (WAN 2.2)"
echo "   • 📦 Video processing capabilities"
echo "   • 🔗 Enhanced webhook system with video upload"
echo "   • 📊 Comprehensive progress tracking for video generation"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🌐 Multi-platform support (linux/amd64, linux/arm64)"
echo ""
echo "🎯 Handler Action:"
echo "   • Dedicated image-to-video generation handler"
echo "   • Processes single uploaded image to video conversion"
echo "   • Supports WAN 2.2 video generation model"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎬 Image-to-video handler starting..."
echo "   📥 Processing uploaded image..."
echo "   ✅ Video workflow validation passed..."
echo "   🎞️ Video generation completed..."
echo ""