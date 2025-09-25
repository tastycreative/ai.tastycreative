#!/bin/bash

echo "🌐 Setting up ngrok for local face swap testing..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   brew install ngrok"
    echo "   Or download from: https://ngrok.com/download"
    exit 1
fi

# Start ngrok tunnel
echo "🚀 Starting ngrok tunnel for localhost:3000..."
echo "📋 This will make your local server accessible from RunPod"
echo ""
echo "⚠️  Make sure your Next.js dev server is running on http://localhost:3000"
echo "⚠️  Update your environment variables to use the ngrok URL"
echo ""
echo "🔄 Starting ngrok..."

ngrok http 3000
