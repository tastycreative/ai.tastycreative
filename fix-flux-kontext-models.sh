#!/bin/bash
# Fix Flux Kontext Model Paths on RunPod
# This script creates symbolic links so ComfyUI can find models in the correct directories

echo "Creating symbolic links for Flux Kontext models..."

# Create unet directory if it doesn't exist
mkdir -p /unet

# Create symbolic link from diffusion_models to unet for Flux Kontext model
if [ -f "/diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors" ]; then
    ln -sf /diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors /unet/flux1-dev-kontext_fp8_scaled.safetensors
    echo "✓ Created symlink: /unet/flux1-dev-kontext_fp8_scaled.safetensors -> /diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors"
else
    echo "✗ Source file not found: /diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors"
fi

# Verify all required models exist
echo ""
echo "Checking for required models:"

if [ -f "/clip/clip_l.safetensors" ]; then
    echo "✓ /clip/clip_l.safetensors"
else
    echo "✗ /clip/clip_l.safetensors NOT FOUND"
fi

if [ -f "/clip/t5xxl_fp16.safetensors" ]; then
    echo "✓ /clip/t5xxl_fp16.safetensors"
else
    echo "✗ /clip/t5xxl_fp16.safetensors NOT FOUND"
fi

if [ -f "/unet/flux1-dev-kontext_fp8_scaled.safetensors" ]; then
    echo "✓ /unet/flux1-dev-kontext_fp8_scaled.safetensors"
else
    echo "✗ /unet/flux1-dev-kontext_fp8_scaled.safetensors NOT FOUND"
fi

if [ -f "/vae/ae.safetensors" ]; then
    echo "✓ /vae/ae.safetensors"
else
    echo "✗ /vae/ae.safetensors NOT FOUND"
fi

echo ""
echo "Model setup complete!"
