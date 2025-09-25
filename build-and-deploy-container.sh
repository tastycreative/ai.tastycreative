#!/bin/bash
# build-and-deploy-container.sh - Build and deploy text-to-image container to RunPod

set -e

echo "🐳 RunPod Text-to-Image Container Deployment"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"docker.io"}
DOCKER_USERNAME=${DOCKER_USERNAME:-""}
IMAGE_NAME=${IMAGE_NAME:-"text-to-image-handler"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
FULL_IMAGE_NAME="$DOCKER_REGISTRY/$DOCKER_USERNAME/$IMAGE_NAME:$IMAGE_TAG"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Registry: $DOCKER_REGISTRY"
echo "  Username: $DOCKER_USERNAME"
echo "  Image: $IMAGE_NAME:$IMAGE_TAG"
echo "  Full name: $FULL_IMAGE_NAME"
echo ""

# Prompt for Docker username if not set
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${YELLOW}⚠️  DOCKER_USERNAME not set.${NC}"
    read -p "Enter your Docker Hub username: " DOCKER_USERNAME
    FULL_IMAGE_NAME="$DOCKER_REGISTRY/$DOCKER_USERNAME/$IMAGE_NAME:$IMAGE_TAG"
    echo "Updated image name: $FULL_IMAGE_NAME"
fi

# Check required files
echo -e "${BLUE}📁 Checking required files...${NC}"
REQUIRED_FILES=("Dockerfile.text-to-image" "text_to_image_handler.py" "requirements-handler.txt")

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Required file not found: $file${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Found: $file${NC}"
done

# Build the Docker image
echo -e "${BLUE}🔨 Building Docker image...${NC}"
docker build -f Dockerfile.text-to-image -t "$FULL_IMAGE_NAME" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully!${NC}"
else
    echo -e "${RED}❌ Docker build failed!${NC}"
    exit 1
fi

# Show image info
echo -e "${BLUE}📊 Image information:${NC}"
docker images "$FULL_IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Ask if user wants to test locally
echo ""
read -p "🧪 Do you want to test the container locally? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🧪 Testing container locally...${NC}"
    echo "Starting container with test environment..."
    
    # Create a test payload file
    cat > test_payload.json << 'EOF'
{
  "input": {
    "job_id": "test_local_123",
    "workflow": {
      "1": {
        "inputs": {"width": 512, "height": 512, "batch_size": 1},
        "class_type": "EmptyLatentImage"
      },
      "2": {
        "inputs": {"text": "a simple test image", "clip": ["5", 0]},
        "class_type": "CLIPTextEncode"
      },
      "3": {
        "inputs": {"samples": ["12", 0], "vae": ["4", 0]},
        "class_type": "VAEDecode"
      },
      "4": {
        "inputs": {"vae_name": "ae.safetensors"},
        "class_type": "VAELoader"
      },
      "5": {
        "inputs": {"clip_name1": "t5xxl_fp16.safetensors", "clip_name2": "clip_l.safetensors", "type": "flux"},
        "class_type": "DualCLIPLoader"
      },
      "6": {
        "inputs": {"unet_name": "flux1-dev.safetensors", "weight_dtype": "fp8_e4m3fn"},
        "class_type": "UNETLoader"
      },
      "7": {
        "inputs": {"conditioning": ["2", 0], "guidance": 4},
        "class_type": "FluxGuidance"
      },
      "9": {
        "inputs": {"model": ["6", 0], "max_shift": 1.15, "base_shift": 0.3, "width": 512, "height": 512},
        "class_type": "ModelSamplingFlux"
      },
      "10": {
        "inputs": {"conditioning": ["2", 0]},
        "class_type": "ConditioningZeroOut"
      },
      "12": {
        "inputs": {"seed": 42, "steps": 10, "cfg": 1, "sampler_name": "euler", "scheduler": "beta", "denoise": 1, "model": ["9", 0], "positive": ["7", 0], "negative": ["10", 0], "latent_image": ["1", 0]},
        "class_type": "KSampler"
      },
      "13": {
        "inputs": {"filename_prefix": "test", "images": ["3", 0]},
        "class_type": "SaveImage"
      }
    },
    "params": {
      "prompt": "a simple test image",
      "width": 512,
      "height": 512,
      "steps": 10
    },
    "webhook_url": "https://ai.tastycreative.xyz/api/webhooks/generation/test_local_123",
    "user_id": "test_user"
  }
}
EOF

    echo "Created test_payload.json"
    echo "Note: This will only test the container startup and validation logic."
    echo "Full ComfyUI testing requires the actual RunPod environment with models."
    
    # Run container interactively for testing
    docker run --rm -it \
        -e COMFYUI_URL=http://localhost:8188 \
        -e PYTHONPATH=/app \
        "$FULL_IMAGE_NAME" python -c "
import sys
sys.path.append('/app')
from handler import validate_workflow, prepare_comfyui_environment
import json

print('🧪 Testing handler functions...')

# Test workflow validation
with open('/dev/stdin') as f:
    test_data = json.load(f)
    workflow = test_data['input']['workflow']
    
print('✅ Container started successfully')
print('✅ Handler imported successfully')
print('🔄 Testing workflow validation...')

if validate_workflow(workflow):
    print('✅ Workflow validation passed')
else:
    print('❌ Workflow validation failed')

print('🎉 Container test completed!')
" < test_payload.json

    rm test_payload.json
fi

# Ask if user wants to push to registry
echo ""
read -p "🚀 Do you want to push to Docker registry? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔐 Logging into Docker registry...${NC}"
    docker login "$DOCKER_REGISTRY"
    
    echo -e "${BLUE}📤 Pushing image to registry...${NC}"
    docker push "$FULL_IMAGE_NAME"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Image pushed successfully!${NC}"
    else
        echo -e "${RED}❌ Push failed!${NC}"
        exit 1
    fi
fi

# Generate RunPod deployment instructions
echo -e "${BLUE}📋 RunPod Deployment Instructions:${NC}"
echo ""
echo "1. Go to RunPod Console: https://www.runpod.io/console/serverless"
echo "2. Create new endpoint or edit existing one"
echo "3. In 'Container Image' field, enter:"
echo "   ${GREEN}$FULL_IMAGE_NAME${NC}"
echo ""
echo "4. Configure these settings:"
echo "   - Container Disk: 10-20 GB"
echo "   - GPU: RTX A5000 or A100 (recommended)"
echo "   - Max Workers: 3-5"
echo "   - Idle Timeout: 10 seconds"
echo ""
echo "5. Set environment variables:"
echo "   - COMFYUI_URL = http://localhost:8188"
echo "   - (Add any custom variables you need)"
echo ""
echo "6. Attach your network volume with models:"
echo "   - Mount path: /workspace"
echo "   - Ensure models are in /workspace/models/"
echo ""
echo "7. Deploy and test!"
echo ""
echo -e "${GREEN}🎉 Container build and deployment guide complete!${NC}"
echo ""
echo "Next steps:"
echo "- Deploy the container image in RunPod console"
echo "- Update your .env.local with the endpoint ID"
echo "- Test with your Next.js application"
