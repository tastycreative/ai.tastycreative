#!/bin/bash

# Test script to verify webhook handles both "results" and "images" formats
# This will help us test the fix we just implemented

echo "🧪 Testing webhook endpoint formats fix..."

# You'll need to replace with a real job ID from your database for testing
TEST_JOB_ID="txt2img_test_$(date +%s)"

echo "📡 Testing webhook with 'images' format (correct format)..."
curl -X POST "https://ai.tastycreative.com/api/webhooks/generation/$TEST_JOB_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "'"$TEST_JOB_ID"'",
    "status": "COMPLETED",
    "progress": 100,
    "message": "Test completed with images format",
    "images": [
      {
        "filename": "test_image.png",
        "subfolder": "",
        "type": "output",
        "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      }
    ]
  }'

echo ""
echo "📡 Testing webhook with 'results' format (legacy support)..."
curl -X POST "https://ai.tastycreative.com/api/webhooks/generation/$TEST_JOB_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "'"$TEST_JOB_ID"'",
    "status": "COMPLETED", 
    "progress": 100,
    "message": "Test completed with results format",
    "results": [
      {
        "filename": "test_image2.png",
        "subfolder": "",
        "type": "output",
        "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      }
    ]
  }'

echo ""
echo "✅ Webhook format tests completed."