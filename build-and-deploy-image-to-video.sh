#!/bin/bash

# Build and deploy RunPod Image-to-Video Serverless Handler
# Usage: ./build-and-deploy-image-to-video.sh

echo "🎬 Building RunPod Image-to-Video Serverless Handler..."

# Set variables
IMAGE_NAME="comfyui-image-to-video-serverless"
REGISTRY="your-registry"  # Replace with your Docker registry
TAG="latest"

# Build the Docker image
echo "🔨 Building Docker image..."
cd runpod-image-to-video-deploy
docker build -t ${REGISTRY}/${IMAGE_NAME}:${TAG} .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully"
    
    # Push to registry
    echo "📤 Pushing to registry..."
    docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}
    
    if [ $? -eq 0 ]; then
        echo "✅ Image pushed successfully"
        echo ""
        echo "🚀 Next steps:"
        echo "1. Create a new RunPod serverless endpoint"
        echo "2. Use container image: ${REGISTRY}/${IMAGE_NAME}:${TAG}"
        echo "3. Set GPU: RTX 4090 or A100 (recommended)"
        echo "4. Attach network volume with WAN 2.2 models"
        echo "5. Update RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID in .env.local"
        echo ""
        echo "Required models in network volume:"
        echo "- wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors (in unet/)"
        echo "- wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors (in unet/)"
        echo "- wan_2.1_vae.safetensors (in vae/)"
        echo "- umt5_xxl_fp8_e4m3fn_scaled.safetensors (in clip/)"
    else
        echo "❌ Failed to push image"
        exit 1
    fi
else
    echo "❌ Failed to build Docker image"
    exit 1
fi

cd ..
echo "🎬 Image-to-Video serverless deployment build complete!"
