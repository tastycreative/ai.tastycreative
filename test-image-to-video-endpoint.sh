#!/bin/bash

# Test Image-to-Video RunPod Handler
# Usage: ./test-image-to-video-endpoint.sh

set -e

# Configuration - Replace with your actual RunPod endpoint
ENDPOINT_ID="YOUR_IMAGE_TO_VIDEO_ENDPOINT_ID"
ENDPOINT_URL="https://api.runpod.ai/v2/$ENDPOINT_ID/runsync"

# Test image (base64 encoded sample)
TEST_IMAGE_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

# Test payload for image-to-video generation
TEST_PAYLOAD='{
  "input": {
    "job_id": "test_video_'$(date +%s)'",
    "webhook_url": "https://your-website.com/webhook/video-status",
    "params": {
      "uploadedImage": "test_image.jpg"
    },
    "workflow": {
      "6": {
        "inputs": {
          "text": "A beautiful woman smiling",
          "clip": ["39", 0]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": "",
          "clip": ["39", 0]
        },
        "class_type": "CLIPTextEncode"
      },
      "37": {
        "inputs": {
          "width": 512,
          "height": 512,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "38": {
        "inputs": {
          "samples": ["37", 0],
          "vae": ["40", 0]
        },
        "class_type": "VAEDecode"
      },
      "39": {
        "inputs": {
          "clip_name": "clip_l.safetensors"
        },
        "class_type": "CLIPLoader"
      },
      "40": {
        "inputs": {
          "vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"
        },
        "class_type": "VAELoader"
      },
      "48": {
        "inputs": {
          "model_name": "wan_v22.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "56": {
        "inputs": {
          "image": "test_image.jpg"
        },
        "class_type": "LoadImage"
      },
      "65": {
        "inputs": {
          "conditioning": ["6", 0],
          "control_net": ["89", 0],
          "image": ["56", 0],
          "strength": 1.0
        },
        "class_type": "ControlNetApply"
      },
      "81": {
        "inputs": {
          "seed": 12345,
          "steps": 25,
          "cfg": 7.5,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1.0,
          "model": ["48", 0],
          "positive": ["65", 0],
          "negative": ["7", 0],
          "latent_image": ["37", 0]
        },
        "class_type": "KSampler"
      },
      "89": {
        "inputs": {
          "control_net_name": "control_v11p_sd15_openpose.pth"
        },
        "class_type": "ControlNetLoader"
      },
      "90": {
        "inputs": {
          "samples": ["81", 0],
          "vae": ["40", 0]
        },
        "class_type": "VAEDecode"
      },
      "91": {
        "inputs": {
          "images": ["90", 0]
        },
        "class_type": "PreviewImage"
      },
      "92": {
        "inputs": {
          "images": ["90", 0],
          "frame_rate": 8,
          "loop_count": 0,
          "filename_prefix": "video/ComfyUI/wan2_video"
        },
        "class_type": "VHS_VideoCombine"
      },
      "93": {
        "inputs": {
          "model": ["48", 0]
        },
        "class_type": "ModelSamplingDiscrete"
      },
      "94": {
        "inputs": {
          "conditioning": ["6", 0]
        },
        "class_type": "ConditioningSetTimestepRange"
      },
      "8": {
        "inputs": {
          "images": ["38", 0],
          "filename_prefix": "ComfyUI"
        },
        "class_type": "SaveImage"
      },
      "57": {
        "inputs": {
          "images": ["56", 0]
        },
        "class_type": "PreviewImage"
      },
      "131": {
        "inputs": {
          "images": ["90", 0],
          "filename_prefix": "video/ComfyUI/wan2_video",
          "format": "video/h264-mp4",
          "pix_fmt": "yuv420p",
          "crf": 20,
          "save_metadata": true,
          "pingpong": false,
          "save_output": false,
          "videopreview": {"filename": "wan2_video.mp4", "subfolder": "video/ComfyUI", "type": "output"}
        },
        "class_type": "SaveVideo"
      }
    },
    "originalImageData": "'$TEST_IMAGE_B64'",
    "referenceImageData": "'$TEST_IMAGE_B64'",
    "imageData": "'$TEST_IMAGE_B64'"
  }
}'

echo "🎬 Testing Image-to-Video RunPod Handler"
echo "📡 Endpoint: $ENDPOINT_URL"
echo "🔑 Endpoint ID: $ENDPOINT_ID"
echo ""

# Check if endpoint ID is set
if [ "$ENDPOINT_ID" = "YOUR_IMAGE_TO_VIDEO_ENDPOINT_ID" ]; then
    echo "❌ Please set your actual RunPod endpoint ID in this script"
    echo "   Edit the ENDPOINT_ID variable at the top of this file"
    echo ""
    echo "📋 TO SET UP:"
    echo "   1. Create a new RunPod serverless endpoint"
    echo "   2. Use container: rfldln01/image-to-video-handler:latest"
    echo "   3. Set appropriate GPU (A100 recommended for video generation)"
    echo "   4. Copy the endpoint ID and update this script"
    echo ""
    exit 1
fi

# Check if RunPod API key is set
if [ -z "$RUNPOD_API_KEY" ]; then
    echo "❌ RUNPOD_API_KEY environment variable not set"
    echo "   Please set your RunPod API key:"
    echo "   export RUNPOD_API_KEY='your-api-key-here'"
    echo ""
    exit 1
fi

echo "🚀 Sending test request..."
echo ""

# Send the request
RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $RUNPOD_API_KEY" \
    -d "$TEST_PAYLOAD" \
    "$ENDPOINT_URL")

echo "📋 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if response contains success
if echo "$RESPONSE" | grep -q '"success".*true'; then
    echo "✅ Image-to-video generation request successful!"
    echo ""
    echo "🎬 Expected workflow:"
    echo "   1. Handler processes the uploaded image"
    echo "   2. Validates the video generation workflow"
    echo "   3. Starts ComfyUI and WAN 2.2 model"
    echo "   4. Generates video frames from the image"
    echo "   5. Encodes final MP4 video"
    echo "   6. Returns video as base64 data"
    echo ""
    echo "📊 Monitor progress through webhook updates"
else
    echo "❌ Request failed. Check the response above for error details."
    echo ""
    echo "🔍 Common issues:"
    echo "   • Endpoint ID incorrect"
    echo "   • API key invalid"
    echo "   • Insufficient GPU resources"
    echo "   • Model files not available on network volume"
    echo ""
fi