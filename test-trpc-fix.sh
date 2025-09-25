#!/bin/bash

echo "🧪 Testing tRPC Functionality After Fix"
echo "======================================="

echo "1. Testing basic tRPC endpoint (getTodos):"
response1=$(curl -s -X GET "http://localhost:3000/api/trpc/getTodos")
echo "   Response: $response1"

echo ""
echo "2. Testing protected endpoint without auth (should return Unauthorized):"
response2=$(curl -s -X GET "http://localhost:3000/api/trpc/getUserTrainingJobs")
echo "   Response: $response2"

echo ""
echo "3. Testing tRPC route is accessible:"
response3=$(curl -s -X GET "http://localhost:3000/api/trpc" | head -c 100)
echo "   Response (first 100 chars): $response3..."

echo ""
echo "✅ tRPC endpoint tests completed!"
echo ""
echo "🔧 Issues fixed:"
echo "   - Created missing tRPC API route: /app/api/trpc/[trpc]/route.ts"
echo "   - Created tRPC context: /server/context.ts"
echo "   - Added proper error handling with onError callback"
echo "   - Fixed import paths for server context"
echo ""
echo "🎯 Next steps:"
echo "1. Open your browser and go to: http://localhost:3000"
echo "2. Navigate to the Train LoRA page: /workspace/train-lora"
echo "3. The tRPC 'Unexpected end of JSON input' error should now be resolved"
echo "4. Try uploading images - both upload and training job creation should work"