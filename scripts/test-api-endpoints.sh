#!/bin/bash

# Script to test API endpoints on deployed Vercel site
echo "🧪 Testing API endpoints on deployed site..."

# Replace with your actual Vercel deployment URL
SITE_URL="https://ai.tastycreative.xyz"

echo "1. Testing debug endpoint..."
curl -X GET "$SITE_URL/api/debug/content" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo "2. Testing images endpoint..."
curl -X GET "$SITE_URL/api/images" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo "3. Testing videos endpoint..."
curl -X GET "$SITE_URL/api/videos" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo "4. Testing image stats..."
curl -X GET "$SITE_URL/api/images?stats=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo "5. Testing video stats..."
curl -X GET "$SITE_URL/api/videos?stats=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo "✅ Testing completed"
