#!/bin/bash

echo "🚀 Testing Production Webhook Integration"
echo "========================================"

echo "📋 Configuration Update:"
echo "   - Switched from ngrok to production URL"
echo "   - Webhook Base URL: https://ai.tastycreative.xyz"
echo "   - This avoids ngrok browser warning issues"
echo ""

echo "🧪 Testing production webhook endpoints:"
echo ""

echo "1. Testing GET request (health check):"
response1=$(curl -s "https://ai.tastycreative.xyz/api/webhooks/training2/test-job")
echo "   Response: $response1"
echo ""

echo "2. Testing POST request (simulating RunPod webhook):"
response2=$(curl -s -X POST "https://ai.tastycreative.xyz/api/webhooks/training2/test-job" \
    -H "Content-Type: application/json" \
    -d '{"id": "test", "status": "IN_PROGRESS", "output": {"progress": 0.5}}')
echo "   Response: $response2"
echo ""

echo "3. Testing with valid RunPod payload format:"
response3=$(curl -s -X POST "https://ai.tastycreative.xyz/api/webhooks/training2/cmfjl85v1000guji5ww0901t1" \
    -H "Content-Type: application/json" \
    -d '{"id": "runpod-job-123", "status": "IN_PROGRESS", "output": {"progress": 0.25, "current_step": 100, "total_steps": 400}}')
echo "   Response: $response3"
echo ""

echo "✅ Benefits of using production URL:"
echo "   - No ngrok browser warning page issues"
echo "   - More reliable and faster webhook delivery"
echo "   - No dependency on local ngrok tunnel"
echo "   - SSL certificate properly configured"
echo ""

echo "🎯 Next steps:"
echo "1. Start a new training job from the web interface"
echo "2. Webhook should now work with production URL"
echo "3. Monitor training progress in real-time"
echo ""

echo "📱 Production webhook URL pattern:"
echo "   https://ai.tastycreative.xyz/api/webhooks/training2/{jobId}"