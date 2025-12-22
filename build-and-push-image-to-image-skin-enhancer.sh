#!/bin/bash

# Build and push RunPod Image-to-Image Skin Enhancer Handler
# Usage: ./build-and-push-image-to-image-skin-enhancer.sh

set -e

# Configuration
DOCKER_IMAGE="rfldln01/image-to-image-skin-enhancer-handler"
VERSION="v1.0-image-to-image-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "🐋 Building Docker image for RunPod Image-to-Image Skin Enhancer Handler"
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
    -f Dockerfile.image-to-image-skin-enhancer \
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
echo "   • 🖼️  Image-to-Image Skin Enhancement"
echo "   • 🎭 Advanced Face Parsing with BiSeNet"
echo "   • 👤 Person Mask Ultra V2 for precise skin detection"
echo "   • 🔍 Face Boundary Analysis with InsightFace"
echo "   • 🎨 Multi-LoRA support with rgthree stack loader"
echo "   • 📦 LoRA uploads to network volume"
echo "   • 🔗 Enhanced webhook system with retry logic"
echo "   • 📊 Comprehensive progress tracking"
echo "   • 🛡️  Robust error handling and recovery"
echo "   • ⚡ Optimized for serverless RunPod deployments"
echo "   • 🖥️  Platform: linux/amd64"
echo "   • 📤 AWS S3 direct uploads for bandwidth optimization"
echo "   • 📈 Real-time progress tracking with face parsing stages"
echo "   • 💾 Network volume storage for models and outputs"
echo "   • 🗂️  User-specific output folders (/runpod-volume/outputs/{userId}/)"
echo "   • 🎯 Specialized for portrait and face enhancement"
echo "   • 🔬 Advanced skin texture analysis and enhancement"
echo "   • 🖌️  Precise facial feature masking and preservation"
echo ""
echo "🎯 Supported Actions:"
echo "   • action='enhance_skin_image_to_image' (image-to-image skin enhancement)"
echo ""
echo "🔍 After deploying, check RunPod logs for debug messages like:"
echo "   🎯 Image-to-image skin enhancement handler starting..."
echo "   🎨 Face parsing model loaded successfully..."
echo "   👤 Person mask generated for skin detection..."
echo "   🔍 Face boundary analysis completed..."
echo "   🎭 Face parsing completed with X facial regions..."
echo "   ✨ Skin enhancement generation started..."
echo "   ✅ Workflow validation passed..."
echo "   📸 Enhanced image processing completed..."
echo "   📤 AWS S3 upload completed..."
echo ""
echo "📋 Required Environment Variables:"
echo "   • AWS_ACCESS_KEY_ID (for S3 uploads)"
echo "   • AWS_SECRET_ACCESS_KEY (for S3 uploads)"
echo "   • AWS_S3_BUCKET (default: tastycreative)"
echo "   • AWS_REGION (default: us-east-1)"
echo ""