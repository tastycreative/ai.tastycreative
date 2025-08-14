#!/bin/bash
# build-docker.sh - Build and push Docker image for RunPod

set -e

VERSION=${1:-"v1.0.1"}
REGISTRY="rfldln01/ai-toolkit-trainer"

echo "🐳 Building Docker image for RunPod (AMD64 architecture)"
echo "📦 Version: $VERSION"
echo "🏷️ Tag: $REGISTRY:$VERSION-amd64"

# Build for Linux AMD64 (RunPod architecture) and push
docker buildx build \
  --platform linux/amd64 \
  --tag "$REGISTRY:$VERSION-amd64" \
  --push \
  .

echo "✅ Docker image built and pushed successfully!"
echo "🚀 Use this image in RunPod: $REGISTRY:$VERSION-amd64"
echo ""
echo "📋 Next steps:"
echo "1. Update RunPod template to use: $REGISTRY:$VERSION-amd64"
echo "2. Add environment variable: TRAINING_UPLOAD_KEY=b530fae1035ef1463cda1f8d7299315eadedbcf38e8780d1d9c351850b9c8aa0"
echo "3. Add same TRAINING_UPLOAD_KEY to Vercel environment variables"
echo "4. Redeploy your Next.js app"
