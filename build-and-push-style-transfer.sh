#!/bin/bash

# Build and push RunPod Style Trecho "✨ This version includes:"
echo "   • 🎨 Style Transfer (FLUX Redux)"
echo "   • � S3 Storage Integration with automatic upload"
echo "   • 💾 Network Volume Path tracking"
echo "   • �🔗 Enhanced webhook system with S3 metadata"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🌐 Multi-platform support (linux/amd64, linux/arm64)"
echo "   • � Real-time batch progress tracking"
echo "   • �️  Database space optimization via S3 priority"Handler
# Usage: ./build-and-push-style-transfer.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/style-transfer-handler"
VERSION="v2.0-aws-s3-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🐋 Building Docker image for RunPod Style Transfer Handler with AWS S3 Integration"
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
echo "📋 Setting up Docker buildx for multi-platform builds..."
docker buildx create --name multiplatform --use --bootstrap 2>/dev/null || docker buildx use multiplatform

# Build and push multi-platform image
echo "🏗️ Building and pushing multi-platform Docker image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -f Dockerfile.style-transfer \
    -t $DOCKER_IMAGE:$VERSION \
    -t $DOCKER_IMAGE:$LATEST_TAG \
    --push \
    .

echo ""
echo "🎉 Successfully built and pushed multi-platform Docker image!"
echo ""
echo "� USE THIS IN RUNPOD:"
echo "   Container Image: $DOCKER_IMAGE:$VERSION"
echo "   Or Latest: $DOCKER_IMAGE:$LATEST_TAG"
echo ""
echo "✨ This version includes:"
echo "   • 🎨 Style Transfer (FLUX Redux)"
echo "   • ☁️ AWS S3 Storage Integration with automatic upload"
echo "   • 🚀 Direct S3 URLs (eliminates Vercel bandwidth usage)"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🌐 Multi-platform support (linux/amd64, linux/arm64)"
echo ""
echo "🎯 Supported Actions:"
echo "   • action='generate_style_transfer' (style transfer)"
echo "   • generation_type='style_transfer' (alternative trigger)"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎨 Starting RunPod Style Transfer handler..."
echo "   🎨 Starting style transfer generation job..."
echo "   ✅ Style transfer workflow validation passed..."
echo "   📥 Processing reference image..."
echo "   📤 Sending chunked style transfer image X/Y via webhook..."
echo "   🔄 Progressive image delivery enabled..."
echo ""