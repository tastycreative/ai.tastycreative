#!/bin/bash

# Build and push RunPod Text-to-Image Handler (FLUX only)
# Usage: ./build-and-push-handler.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/text-to-image-handler"
VERSION="v6.0-network-volume-storage-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🐋 Building Docker image for RunPod Text-to-Image Handler"
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
echo "� Setting up Docker buildx for multi-platform builds..."
docker buildx create --name multiplatform --use --bootstrap 2>/dev/null || docker buildx use multiplatform

# Build and push multi-platform image
echo "� Building and pushing multi-platform Docker image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -f Dockerfile.text-to-image \
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
echo "   • 🖼️  Text-to-Image generation (FLUX)"
echo "   • 📦 LoRA uploads to network volume"
echo "   • 🔗 Enhanced webhook system with retry logic"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🌐 Multi-platform support (linux/amd64, linux/arm64)"
echo "   • 🚀 Lightweight build - no style transfer or video dependencies"
echo "   • 📤 Chunked image uploads for batch generations"
echo "   • 🔄 Progressive image delivery for Vercel compatibility"
echo "   • 📈 Real-time batch progress tracking"
echo "   • 💾 Network volume storage for generated images"
echo "   • 🗂️  User-specific output folders (/runpod-volume/outputs/{userId}/)"
echo "   • 📉 Reduced database storage consumption"
echo "   • 🎨 NEW: Multi-LoRA stacking support (unlimited chained LoRAs)"
echo "   • 🔍 NEW: Enhanced multi-LoRA debugging and logging"
echo ""
echo "🎯 Supported Actions:"
echo "   • action='generate' (text-to-image)"
echo "   • action='upload_lora' (LoRA management)"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎯 Text-to-image handler starting..."
echo "   🎨 Text-to-image generation started..."
echo "   ✅ Workflow validation passed..."
echo "   🎨 LoRA 1 Configuration (Node 14): model.safetensors @ 0.95"
echo "   🎨 LoRA 2 Configuration (Node 15): style.safetensors @ 0.70"
echo "   ✅ Total LoRAs in workflow: 2 (chained)"
echo "   📸 Image processing completed..."
echo "   📤 Sending chunked image X/Y via webhook..."
echo "   🔄 Progressive image delivery enabled..."
echo ""
