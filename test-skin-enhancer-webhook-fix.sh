#!/bin/bash

# Test script for skin enhancement with webhook payload optimization
echo "🧪 Testing Skin Enhancement with Webhook Payload Fix"
echo "=================================================="

# Check if required environment variables are set
if [ -z "$RUNPOD_API_KEY" ]; then
    echo "❌ Error: RUNPOD_API_KEY environment variable is required"
    exit 1
fi

if [ -z "$RUNPOD_SKIN_ENHANCER_ENDPOINT_ID" ]; then
    echo "❌ Error: RUNPOD_SKIN_ENHANCER_ENDPOINT_ID environment variable is required"
    exit 1
fi

# Get webhook URL from our Next.js app
echo "🔗 Getting webhook URL..."
WEBHOOK_RESPONSE=$(curl -s "http://localhost:3000/api/debug/webhook-url")
WEBHOOK_URL=$(echo $WEBHOOK_RESPONSE | jq -r '.webhookUrl // empty')

if [ -z "$WEBHOOK_URL" ]; then
    echo "❌ Error: Could not get webhook URL. Is your Next.js app running?"
    echo "Response: $WEBHOOK_RESPONSE"
    exit 1
fi

echo "✅ Webhook URL: $WEBHOOK_URL"

# Create test payload with base64 image
echo "📸 Creating test payload..."

# Use a small test image (base64 encoded 1x1 pixel PNG)
TEST_IMAGE_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

# Generate unique job ID
JOB_ID="skin-test-$(date +%s)-$(openssl rand -hex 4)"

echo "🆔 Job ID: $JOB_ID"

# Create test payload
cat > /tmp/skin_test_payload.json << EOF
{
    "input": {
        "job_id": "$JOB_ID",
        "webhook_url": "$WEBHOOK_URL",
        "base64_image": "$TEST_IMAGE_BASE64",
        "enhancement_strength": 0.7,
        "face_enhance": true,
        "eye_enhance": true,
        "skin_smooth": true,
        "detail_enhance": true
    }
}
EOF

echo "📤 Sending request to RunPod..."

# Send request to RunPod
RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $RUNPOD_API_KEY" \
    -H "Content-Type: application/json" \
    -d @/tmp/skin_test_payload.json \
    "https://api.runpod.ai/v2/${RUNPOD_SKIN_ENHANCER_ENDPOINT_ID}/runsync")

echo "📥 RunPod Response:"
echo "$RESPONSE" | jq '.'

# Extract RunPod job ID
RUNPOD_JOB_ID=$(echo "$RESPONSE" | jq -r '.id // empty')

if [ -z "$RUNPOD_JOB_ID" ]; then
    echo "❌ Error: No RunPod job ID received"
    exit 1
fi

echo "✅ RunPod Job ID: $RUNPOD_JOB_ID"

# Monitor the job status
echo "👀 Monitoring job progress..."
echo "Check your browser console for webhook updates at: http://localhost:3000"
echo "Or check RunPod logs for job: $RUNPOD_JOB_ID"

# Wait a bit and check for any immediate errors
sleep 5

# Check job status
echo "🔍 Checking initial job status..."
STATUS_RESPONSE=$(curl -s -X GET \
    -H "Authorization: Bearer $RUNPOD_API_KEY" \
    "https://api.runpod.ai/v2/${RUNPOD_SKIN_ENHANCER_ENDPOINT_ID}/status/${RUNPOD_JOB_ID}")

echo "📊 Job Status:"
echo "$STATUS_RESPONSE" | jq '.'

echo ""
echo "🎯 Test Summary:"
echo "- Job ID: $JOB_ID"
echo "- RunPod Job ID: $RUNPOD_JOB_ID"
echo "- Webhook URL: $WEBHOOK_URL"
echo ""
echo "📋 What to watch for:"
echo "1. Check RunPod logs for webhook success (should see multiple smaller webhooks instead of one large one)"
echo "2. Verify no 413 Request Entity Too Large errors"
echo "3. Confirm job completes successfully"
echo ""
echo "🔗 Monitor at: https://www.runpod.io/console/serverless"

# Clean up
rm -f /tmp/skin_test_payload.json
