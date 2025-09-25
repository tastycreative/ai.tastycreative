#!/bin/bash
# test-training-job.sh - Test the updated training pipeline with v1.0.23

set -e

echo "🧪 Testing training job with updated Docker image v1.0.23"
echo "======================================================"

# Check if the website is running
echo "🔍 Checking if Next.js app is accessible..."
if curl -s -f "https://ai.tastycreative.xyz" > /dev/null; then
    echo "✅ Website is accessible"
else
    echo "❌ Website is not accessible - make sure it's deployed"
    exit 1
fi

# Generate a unique job ID
JOB_ID="training-test-$(date +%s)-$(openssl rand -hex 4)"
echo "🆔 Test job ID: $JOB_ID"

echo ""
echo "📋 Instructions to test training job:"
echo "1. Go to https://ai.tastycreative.xyz"
echo "2. Navigate to the training section"
echo "3. Upload 5 training images"
echo "4. Start a training job"
echo "5. Check the logs for:"
echo "   - PyTorch/torchaudio loading without 'undefined symbol' errors"
echo "   - AI-toolkit initialization"
echo "   - FLUX model loading"
echo "   - Training progress updates"
echo ""
echo "🐳 Expected Docker image in logs: rfldln01/ai-toolkit-trainer:v1.0.23-amd64"
echo "🔧 Key improvements in v1.0.23:"
echo "   - Complete PyTorch ecosystem cleanup"
echo "   - CUDA-specific PyTorch installation (torch==2.0.1+cu118)"
echo "   - Compatible torchaudio==2.0.2+cu118"
echo "   - Fixed undefined symbol errors"
echo ""
echo "✅ Ready to test! Start a training job and monitor the logs."