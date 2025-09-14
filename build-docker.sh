#!/bin/bash
# build-docker.sh - Build and push Docker image for RunPod

set -e

VERSION="v1.0.15"  # Updated version with timeout improvements and step limits
REGISTRY="rfldln01/ai-toolkit-trainer"
PLATFORM=${2:-"linux/amd64"}  # Default to AMD64 for RunPod
BUILD_LOCAL=${3:-"false"}     # Option to build locally without pushing

if [[ "$PLATFORM" == "linux/arm64" ]]; then
    ARCH_SUFFIX="arm64"
    echo "🐳 Building Docker image for local Mac (ARM64 architecture)"
elif [[ "$PLATFORM" == "linux/amd64" ]]; then
    ARCH_SUFFIX="amd64"
    echo "🐳 Building Docker image for RunPod (AMD64 architecture)"
else
    echo "❌ Unsupported platform: $PLATFORM"
    exit 1
fi

echo "📦 Version: $VERSION"
echo "🏷️ Tag: $REGISTRY:$VERSION-$ARCH_SUFFIX"

# Build command
if [[ "$BUILD_LOCAL" == "true" ]]; then
    echo "🏠 Building locally without push..."
    docker buildx build \
      --platform "$PLATFORM" \
      --tag "$REGISTRY:$VERSION-$ARCH_SUFFIX" \
      --load \
      .
    echo "✅ Docker image built locally!"
    echo "🚀 Run locally with: docker run -it $REGISTRY:$VERSION-$ARCH_SUFFIX"
else
    echo "☁️ Building and pushing to registry..."
    docker buildx build \
      --platform "$PLATFORM" \
      --tag "$REGISTRY:$VERSION-$ARCH_SUFFIX" \
      --push \
      .
    echo "✅ Docker image built and pushed successfully!"
    echo "🚀 Use this image in RunPod: $REGISTRY:$VERSION-$ARCH_SUFFIX"
fi

echo "✅ Docker image built and pushed successfully!"
echo "🚀 Use this image in RunPod: $REGISTRY:$VERSION-amd64"
echo ""
echo "📋 Next steps:"
echo "1. Update RunPod template to use: $REGISTRY:$VERSION-amd64"
echo "2. Add environment variable: TRAINING_UPLOAD_KEY=b530fae1035ef1463cda1f8d7299315eadedbcf38e8780d1d9c351850b9c8aa0"
echo "3. Add same TRAINING_UPLOAD_KEY to Vercel environment variables"
echo "4. Redeploy your Next.js app"
