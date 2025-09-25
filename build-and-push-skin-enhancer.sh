#!/bin/bash

# Build and Push Script for RunPod Skin Enhancement Handler
set -e

echo "🎨 Building Docker image for RunPod Skin Enhancement Handler"

# Configuration
IMAGE_NAME="rfldln01/skin-enhancement-handler"
VERSION="v1.0-skin-enhancement-$(date +%Y%m%d-%H%M%S)"
PLATFORMS="linux/amd64,linux/arm64"

echo "📦 Image: $IMAGE_NAME"
echo "🏷️  Version: $VERSION"
echo "🏗️  Platforms: $PLATFORMS"
echo ""

# Check if required files exist
if [ ! -f "skin_enhancer_handler.py" ]; then
    echo "❌ Error: skin_enhancer_handler.py not found!"
    exit 1
fi

if [ ! -f "Dockerfile.skin-enhancer" ]; then
    echo "❌ Error: Dockerfile.skin-enhancer not found!"
    exit 1
fi

if [ ! -f "requirements-handler.txt" ]; then
    echo "❌ Error: requirements-handler.txt not found!"
    exit 1
fi

if [ ! -f "extra_model_paths.yaml" ]; then
    echo "❌ Error: extra_model_paths.yaml not found!"
    exit 1
fi

echo "📋 Setting up Docker buildx for multi-platform builds..."
docker buildx create --use --name multiplatform --node multiplatform0 --driver docker-container || true

echo "🏗️ Building and pushing multi-platform Docker image..."
docker buildx build \
    --file Dockerfile.skin-enhancer \
    --platform $PLATFORMS \
    --tag $IMAGE_NAME:$VERSION \
    --tag $IMAGE_NAME:latest \
    --push \
    .

echo ""
echo "🎉 Successfully built and pushed multi-platform Docker image!"
echo ""
echo "📋 USE THIS IN RUNPOD:"
echo "   Container Image: $IMAGE_NAME:$VERSION"
echo "   Or Latest: $IMAGE_NAME:latest"
echo ""
echo "✨ This version includes:"
echo "   • 🎨 Skin enhancement with FLUX + realistic LoRAs"
echo "   • 👤 Face-focused enhancement using PersonMaskUltra"
echo "   • 👁️  Eye enhancement with face parsing"
echo "   • 🔄 Multiple enhancement passes"
echo "   • 📦 LoRA support for realistic humans"
echo "   • 🔗 Enhanced webhook system with retry logic"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🌐 Multi-platform support (linux/amd64, linux/arm64)"
echo "   • 📤 Chunked image uploads with progressive delivery"
echo "   • 🔄 IMAGE_READY webhooks for batch processing"
echo "   • 📋 Enhanced batch progress tracking"
echo ""
echo "🎯 Supported Actions:"
echo "   • action='enhance_skin' (skin enhancement)"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎨 Skin enhancement handler starting..."
echo "   🎭 Found enhancement LoRA..."
echo "   ✅ Workflow validation passed..."
echo "   📸 Enhanced image processed..."
