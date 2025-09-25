#!/bin/bash

# Build and push minimal handler for testing
echo "🐋 Building Minimal Docker image for RunPod Multi-Modal AI Handler"

# Version with timestamp
VERSION="v4.0-minimal-$(date +%Y%m%d-%H%M%S)"
IMAGE_NAME="rfldln01/text-to-image-handler"
PLATFORMS="linux/amd64,linux/arm64"

echo "📦 Image: $IMAGE_NAME"
echo "🏷️  Version: $VERSION"
echo "🏗️  Platforms: $PLATFORMS"
echo ""

# Set up buildx for multi-platform builds
echo "⚙️ Setting up Docker buildx for multi-platform builds..."
docker buildx create --use --name multiplatform --driver docker-container 2>/dev/null || docker buildx use multiplatform

# Build and push multi-platform image
echo "🛠️ Building and pushing multi-platform Docker image..."
docker buildx build \
    --platform $PLATFORMS \
    --tag $IMAGE_NAME:$VERSION \
    --tag $IMAGE_NAME:latest \
    --file Dockerfile.minimal \
    --push \
    .

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Successfully built and pushed multi-platform Docker image!"
    echo ""
    echo "📋 USE THIS IN RUNPOD:"
    echo "   Container Image: $IMAGE_NAME:$VERSION"
    echo "   Or Latest: $IMAGE_NAME:latest"
    echo ""
    echo "✨ This is a minimal version for testing ComfyUI startup issues"
else
    echo "❌ Build failed!"
    exit 1
fi
