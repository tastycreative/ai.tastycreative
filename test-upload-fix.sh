#!/bin/bash

# Test script for training image upload functionality
echo "🧪 Testing Training Image Upload Functionality"
echo "=============================================="

# Check if the development server is running
echo "📋 Testing server endpoints..."

echo "1. Testing upload endpoint (should return 401 Unauthorized):"
response1=$(curl -s -X GET http://localhost:3000/api/upload/training-images)
echo "   Response: $response1"

echo ""
echo "2. Testing webhook endpoint (should return 200 OK):"
response2=$(curl -s -X GET http://localhost:3000/api/webhooks/training2/test-job-id)
echo "   Response: $response2"

echo ""
echo "3. Testing ngrok webhook endpoint (should return 200 OK):"
response3=$(curl -s -X GET https://87abaec1e191.ngrok-free.app/api/webhooks/training2/test-job-id)
echo "   Response: $response3"

echo ""
echo "✅ Basic endpoint tests completed!"
echo ""
echo "🎯 Next steps:"
echo "1. Open your browser and go to: http://localhost:3000"
echo "2. Navigate to the Train LoRA page: /workspace/train-lora"
echo "3. Try uploading a few test images"
echo "4. Check the browser console for detailed upload logs"
echo ""
echo "📱 Webhook URL configured for local testing:"
echo "   https://87abaec1e191.ngrok-free.app/api/webhooks/training2/{jobId}"
echo ""
echo "🔧 Upload improvements made:"
echo "   - Reduced chunk size from 5 to 3 images per batch"
echo "   - Added proper field names for images and captions"
echo "   - Integrated Cloudinary for reliable image storage"
echo "   - Added better error handling and logging"
echo "   - Increased delay between chunks to avoid rate limits"