#!/bin/bash
# deploy-runpod-handler.sh - Deploy text-to-image handler to RunPod

set -e

echo "🚀 RunPod Text-to-Image Handler Deployment Script"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required files exist
echo -e "${BLUE}📁 Checking required files...${NC}"

if [ ! -f "text_to_image_handler.py" ]; then
    echo -e "${RED}❌ text_to_image_handler.py not found!${NC}"
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    echo -e "${YELLOW}⚠️  requirements.txt not found. Creating one...${NC}"
    cat > requirements.txt << EOF
runpod
requests
pillow
EOF
fi

echo -e "${GREEN}✅ Required files found${NC}"

# Check environment variables
echo -e "${BLUE}🔧 Checking environment variables...${NC}"

if [ -z "$RUNPOD_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  RUNPOD_API_KEY not set in environment${NC}"
    echo "You'll need to set this in your RunPod console"
fi

echo -e "${GREEN}✅ Environment check complete${NC}"

# Create a deployment package
echo -e "${BLUE}📦 Creating deployment package...${NC}"

# Create temp directory for deployment
DEPLOY_DIR="runpod-text-to-image-deploy"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy handler and requirements
cp text_to_image_handler.py $DEPLOY_DIR/
cp requirements.txt $DEPLOY_DIR/

# Create Docker file for custom deployment (optional)
cat > $DEPLOY_DIR/Dockerfile << 'EOF'
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy handler
COPY text_to_image_handler.py /app/
WORKDIR /app

# Set the handler
CMD ["python", "-u", "text_to_image_handler.py"]
EOF

# Create deployment info file
cat > $DEPLOY_DIR/DEPLOYMENT_INFO.md << 'EOF'
# RunPod Text-to-Image Handler Deployment

## Files in this package:
- `text_to_image_handler.py` - Main handler code
- `requirements.txt` - Python dependencies  
- `Dockerfile` - Optional custom container
- `DEPLOYMENT_INFO.md` - This file

## Deployment Options:

### Option 1: Direct Upload (Easiest)
1. Go to RunPod Console > Serverless > Your Endpoint
2. Upload `text_to_image_handler.py` in the "Handler" section
3. Set handler function name: `handler`
4. Deploy

### Option 2: GitHub Integration
1. Push this code to GitHub
2. Connect GitHub repo in RunPod Console
3. Set file path to `text_to_image_handler.py`
4. Deploy

### Option 3: Custom Container
1. Build Docker image: `docker build -t your-registry/text-to-image .`
2. Push to registry: `docker push your-registry/text-to-image`
3. Use custom image in RunPod endpoint configuration

## Required Environment Variables in RunPod:
- `COMFYUI_URL` - URL of your ComfyUI instance (e.g., http://localhost:8188)

## Testing:
After deployment, test with a sample payload to your endpoint.
EOF

echo -e "${GREEN}✅ Deployment package created in: $DEPLOY_DIR${NC}"

# Create a test payload for the deployed endpoint
cat > $DEPLOY_DIR/test_payload.json << 'EOF'
{
  "input": {
    "job_id": "test_deploy_123",
    "workflow": {
      "1": {
        "inputs": {
          "width": 1024,
          "height": 1024,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "2": {
        "inputs": {
          "text": "a beautiful landscape",
          "clip": ["5", 0]
        },
        "class_type": "CLIPTextEncode"
      },
      "3": {
        "inputs": {
          "samples": ["12", 0],
          "vae": ["4", 0]
        },
        "class_type": "VAEDecode"
      },
      "4": {
        "inputs": {
          "vae_name": "ae.safetensors"
        },
        "class_type": "VAELoader"
      },
      "5": {
        "inputs": {
          "clip_name1": "t5xxl_fp16.safetensors",
          "clip_name2": "clip_l.safetensors",
          "type": "flux"
        },
        "class_type": "DualCLIPLoader"
      },
      "6": {
        "inputs": {
          "unet_name": "flux1-dev.safetensors",
          "weight_dtype": "fp8_e4m3fn"
        },
        "class_type": "UNETLoader"
      },
      "7": {
        "inputs": {
          "conditioning": ["2", 0],
          "guidance": 4
        },
        "class_type": "FluxGuidance"
      },
      "9": {
        "inputs": {
          "model": ["6", 0],
          "max_shift": 1.15,
          "base_shift": 0.3,
          "width": 1024,
          "height": 1024
        },
        "class_type": "ModelSamplingFlux"
      },
      "10": {
        "inputs": {
          "conditioning": ["2", 0]
        },
        "class_type": "ConditioningZeroOut"
      },
      "12": {
        "inputs": {
          "seed": 42,
          "steps": 20,
          "cfg": 1,
          "sampler_name": "euler",
          "scheduler": "beta",
          "denoise": 1,
          "model": ["9", 0],
          "positive": ["7", 0],
          "negative": ["10", 0],
          "latent_image": ["1", 0]
        },
        "class_type": "KSampler"
      },
      "13": {
        "inputs": {
          "filename_prefix": "test_deploy",
          "images": ["3", 0]
        },
        "class_type": "SaveImage"
      }
    },
    "params": {
      "prompt": "a beautiful landscape",
      "width": 1024,
      "height": 1024,
      "steps": 20
    },
    "webhook_url": "https://your-app.vercel.app/api/webhooks/generation/test_deploy_123",
    "user_id": "test_user"
  }
}
EOF

echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. 📁 Navigate to: $DEPLOY_DIR"
echo "2. 🌐 Go to RunPod Console: https://www.runpod.io/console/serverless"
echo "3. 🔧 Create/configure your serverless endpoint"
echo "4. 📤 Upload text_to_image_handler.py"
echo "5. ⚙️  Set handler function: 'handler'"
echo "6. 🌍 Set environment variables in RunPod console"
echo "7. 🚀 Deploy and test!"

echo ""
echo -e "${GREEN}🎉 Deployment package ready!${NC}"
echo -e "${YELLOW}💡 Tip: Check DEPLOYMENT_INFO.md for detailed instructions${NC}"
