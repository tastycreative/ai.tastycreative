#!/bin/bash
# Fast ComfyUI startup script for RunPod serverless
# Bypasses ComfyUI-Manager registry fetching for 5+ minute cold start reduction

echo "🚀 Starting ComfyUI with aggressive cold start optimizations..."

# Set environment variables to disable slow operations
export COMFYUI_MANAGER_NO_AUTO_UPDATE=1
export COMFYUI_NO_FETCH_REGISTRY=1  
export DISABLE_CUSTOM_NODE_AUTO_UPDATE=1
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
export COMFYUI_SKIP_REGISTRY_FETCH=1
export COMFYUI_DISABLE_MANAGER_UPDATES=1
export COMFYUI_OFFLINE_MODE=1

# Disable ComfyUI Manager completely by moving it out of the way
if [ -d "/app/comfyui/custom_nodes/ComfyUI-Manager" ]; then
    echo "⚡ Completely disabling ComfyUI-Manager for faster startup"
    mv /app/comfyui/custom_nodes/ComfyUI-Manager /app/comfyui/custom_nodes/ComfyUI-Manager.disabled || true
fi

# Create minimal ComfyUI-Manager config to skip registry operations
mkdir -p /app/comfyui/user/default/ComfyUI-Manager
cat > /app/comfyui/user/default/ComfyUI-Manager/config.ini << EOF
[default]
auto_update = False
startup_skip_update = True
channel_url_list = 
model_download_by_agent = False
security_level = weak
ui_mode = simple
skip_update_all = True
bypass_ssl = True
EOF

# Disable BiRefNet custom node that's causing import errors
if [ -d "/app/comfyui/custom_nodes/ComfyUI-BiRefNet" ]; then
    echo "⚠️ Disabling problematic BiRefNet node"
    mv /app/comfyui/custom_nodes/ComfyUI-BiRefNet /app/comfyui/custom_nodes/ComfyUI-BiRefNet.disabled || true
fi

# Start ComfyUI with optimized flags
cd /app/comfyui
exec python main.py \
    --listen 0.0.0.0 \
    --port 8188 \
    --extra-model-paths-config /app/extra_model_paths.yaml \
    --disable-auto-launch \
    --dont-print-server \
    --disable-all-custom-nodes \
    --cpu-vae \
    --disable-cuda-malloc \
    --dont-upcast-attention \
    --use-split-cross-attention \
    --disable-metadata \
    --fast \
    "$@"
