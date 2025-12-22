#!/bin/bash

echo "🧪 Testing Webhook Fix for NGrok Integration"
echo "============================================"

echo "📋 Issue identified:"
echo "   - RunPod was getting 404 errors when calling ngrok webhook"
echo "   - NGrok requires 'ngrok-skip-browser-warning' header"
echo "   - handler.py was not including this header"
echo ""

echo "✅ Fix applied:"
echo "   - Updated send_webhook() function in handler.py"
echo "   - Added 'ngrok-skip-browser-warning: true' header"
echo "   - Added 'User-Agent: RunPod-AI-Toolkit/1.0' for identification"
echo "   - Built new Docker image: v1.0.14"
echo ""

echo "🧪 Testing webhook endpoints:"
echo ""

echo "1. Testing GET request (health check):"
response1=$(curl -s https://87abaec1e191.ngrok-free.app/api/webhooks/training2/test-job)
echo "   Response: $response1"
echo ""

echo "2. Testing POST with ngrok header (simulating fixed RunPod request):"
response2=$(curl -s -X POST https://87abaec1e191.ngrok-free.app/api/webhooks/training2/test-job \
    -H "Content-Type: application/json" \
    -H "ngrok-skip-browser-warning: true" \
    -H "User-Agent: RunPod-AI-Toolkit/1.0" \
    -d '{"id": "test", "status": "IN_PROGRESS", "output": {"progress": 0.5}}')
echo "   Response: $response2"
echo ""

echo "3. Testing POST without ngrok header (old behavior):"
response3=$(curl -s -X POST https://87abaec1e191.ngrok-free.app/api/webhooks/training2/test-job \
    -H "Content-Type: application/json" \
    -d '{"id": "test", "status": "IN_PROGRESS"}')
echo "   Response: $response3"
echo ""

echo "🎯 Next steps:"
echo "1. Update your RunPod template to use the new image:"
echo "   rfldln01/ai-toolkit-trainer:v1.0.14-amd64"
echo ""
echo "2. Test a new training job to verify webhook works"
echo ""
echo "📱 Current ngrok URL: https://87abaec1e191.ngrok-free.app"
echo "🐳 Updated Docker image: rfldln01/ai-toolkit-trainer:v1.0.14-amd64"