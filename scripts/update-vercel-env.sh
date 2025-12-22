#!/bin/bash

# Script to add environment variables to Vercel
# Make sure you have Vercel CLI installed: npm i -g vercel

echo "Adding environment variables to Vercel..."

# Image-to-Video endpoint
vercel env add RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID production
# When prompted, enter: ruuan3q8eweazy

vercel env add RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_URL production
# When prompted, enter: https://api.runpod.ai/v2/ruuan3q8eweazy

# Style Transfer endpoint
vercel env add RUNPOD_STYLE_TRANSFER_ENDPOINT_ID production
# When prompted, enter: 6ghwjnvjxr5e16

vercel env add RUNPOD_STYLE_TRANSFER_ENDPOINT_URL production
# When prompted, enter: https://api.runpod.ai/v2/6ghwjnvjxr5e16

echo "Environment variables added. Triggering redeploy..."
vercel --prod