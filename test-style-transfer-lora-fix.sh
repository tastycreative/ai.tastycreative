#!/bin/bash

# Test script for style transfer LoRA fix
# This tests that the LoRA path transformation is working correctly

echo "🧪 Testing Style Transfer Handler with LoRA Fix"
echo "📡 Endpoint: 6ghwjnvjxr5e16"
echo "🎯 Testing LoRA: user_31ES2FrA077MVrkOXsGrUbiCXKX_1757666092064_AI MODEL 3.safetensors"
echo ""

# Get API key from .env.local
API_KEY=$(grep "RUNPOD_API_KEY=" .env.local | cut -d'=' -f2)

if [ -z "$API_KEY" ]; then
    echo "❌ RUNPOD_API_KEY not found in .env.local"
    exit 1
fi

echo "🔑 Using API Key: ${API_KEY:0:10}..."
echo ""

# Simple test payload with LoRA that was failing
PAYLOAD='{
    "input": {
        "action": "generate_style_transfer",
        "workflow": {
            "51": {
                "class_type": "LoraLoader",
                "inputs": {
                    "lora_name": "user_31ES2FrA077MVrkOXsGrUbiCXKX_1757666092064_AI MODEL 3.safetensors",
                    "strength_model": 0.95,
                    "strength_clip": 1,
                    "model": ["40", 0],
                    "clip": ["12", 0]
                }
            },
            "155": {
                "class_type": "LoadImage",
                "inputs": {
                    "image": "test-image.jpg"
                }
            }
        },
        "params": {
            "selectedLora": "user_31ES2FrA077MVrkOXsGrUbiCXKX_1757666092064_AI MODEL 3.safetensors",
            "prompt": "ohwx woman",
            "steps": 40,
            "cfg": 1,
            "seed": null,
            "width": 832,
            "height": 1216
        },
        "referenceImage": "test-image.jpg",
        "referenceImageData": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "webhookUrl": "https://webhook.site/test"
    }
}'

echo "📤 Sending test request..."
echo ""

RESPONSE=$(curl -s -X POST \
    "https://api.runpod.ai/v2/6ghwjnvjxr5e16/runsync" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "$PAYLOAD")

echo "📥 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if the response contains success or error indicators
if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Error detected in response"
    exit 1
elif echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Success indicated in response"
elif echo "$RESPONSE" | grep -q "PROCESSING\|QUEUED"; then
    echo "⏳ Job queued/processing successfully"
else
    echo "⚠️  Response unclear - check manually"
fi