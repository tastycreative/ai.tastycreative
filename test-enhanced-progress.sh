#!/bin/bash

# Test script for enhanced style transfer progress monitoring
# This demonstrates the improved user experience with detailed progress tracking

echo "🎨 Testing Enhanced Style Transfer Progress Monitoring"
echo "======================================================="
echo ""
echo "✨ New Progress Features:"
echo "• 📊 Real-time step tracking (e.g., 15/40 steps)"
echo "• ⏱️  Accurate time remaining estimates"
echo "• 🎯 Detailed stage information"
echo "• 📈 Percentage-based progress (0-100%)"
echo "• 🔄 Dynamic progress stages based on actual workflow state"
echo ""

# Set the RunPod endpoint
ENDPOINT_URL="https://api.runpod.ai/v2/6ghwjnvjxr5e16/runsync"
WEBHOOK_URL="https://hook.eu2.make.com/7c41n9j3h4s5h5nqw42s0j8sj9j8m73c"

echo "📡 Testing style transfer with enhanced progress..."
echo "Endpoint: $ENDPOINT_URL"
echo "Progress monitoring via webhook: $WEBHOOK_URL"
echo ""

# Sample image data (base64 - this is a small test image)
SAMPLE_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

# Test payload with style transfer parameters
curl -X POST "$ENDPOINT_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $RUNPOD_API_KEY" \
    -d '{
        "input": {
            "action": "generate_style_transfer",
            "webhook_url": "'$WEBHOOK_URL'",
            "params": {
                "prompt": "a beautiful landscape painting",
                "selectedLora": "user_31ES2FrA077MVrkOXsGrUbiCXKX_1757666092064_AI MODEL 3.safetensors",
                "width": 832,
                "height": 1216,
                "steps": 20,
                "guidance": 3.5,
                "weight": 0.8,
                "loraStrength": 0.95
            },
            "referenceImageData": "'$SAMPLE_IMAGE'",
            "maskImageData": "'$SAMPLE_IMAGE'"
        }
    }' | jq '.'

echo ""
echo "🎯 Expected Progress Stages:"
echo "1. 🚀 Initializing style transfer workflow... (0-5%)"
echo "2. ⏳ Waiting in processing queue... (5-15%)"
echo "3. 📦 Loading FLUX and style models... (15-35%)"
echo "4. 📝 Encoding text prompt and style reference... (35-45%)"
echo "5. 🎨 Generating style transfer (step X/20)... (45-85%)"
echo "   • Real-time step updates: 1/20, 2/20, ..., 20/20"
echo "   • Time remaining estimates based on ~1.8 steps/second"
echo "   • Progress updates every 2 steps or 3 seconds"
echo "6. 🖼️  Decoding and finalizing image... (85-95%)"
echo "7. 💾 Saving and preparing results... (95-100%)"
echo ""
echo "📊 Enhanced Webhook Data:"
echo "• progress: 0-100 (percentage)"
echo "• currentStep: X (current generation step)"
echo "• totalSteps: 20 (total steps for this job)"
echo "• estimatedTimeRemaining: X seconds"
echo "• stepsPerSecond: 1.8 (average rate)"
echo "• stage: current workflow stage"
echo "• message: detailed status message"
echo ""
echo "🌟 Benefits:"
echo "• Users see exactly which step is being processed"
echo "• Accurate time estimates improve user experience"
echo "• Clear stages help users understand the workflow"
echo "• Frequent updates keep users engaged"
echo ""

echo "Check your webhook endpoint for detailed progress updates!"