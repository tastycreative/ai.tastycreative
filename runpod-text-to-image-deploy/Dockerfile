# RunPod Text-to-Image Handler Container with LoRA Debugging
FROM runpod/pytorch:2.2.1-py3.10-cuda12.1.1-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements-handler.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /app/comfyui && \
    cd /app/comfyui && \
    pip install -r requirements.txt

# Copy handler and config files (UPDATED VERSION WITH BINARY DATA WEBHOOKS)
COPY text_to_image_handler.py /app/handler.py
COPY extra_model_paths.yaml /app/extra_model_paths.yaml

# Create necessary directories
RUN mkdir -p /workspace/models /workspace/output /workspace/logs /runpod-volume

# Add version label for tracking
LABEL version="3.0-binary-webhooks"
LABEL description="Text-to-Image handler with binary data webhooks for RunPod"

# Set the handler as the entry point
CMD ["python", "-u", "handler.py"]
