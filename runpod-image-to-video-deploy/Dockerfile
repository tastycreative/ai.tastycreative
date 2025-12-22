FROM runpod/pytorch:2.2.1-py3.10-cuda12.1.1-devel-ubuntu22.04

# Set working directory
WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Clone ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /workspace/ComfyUI

# Install ComfyUI dependencies
WORKDIR /workspace/ComfyUI
RUN pip install -r requirements.txt

# Install additional requirements
COPY requirements.txt /workspace/
RUN pip install -r /workspace/requirements.txt

# Install handler requirements
COPY requirements-handler.txt /workspace/
RUN pip install -r /workspace/requirements-handler.txt

# Copy the handler
COPY image_to_video_handler.py /workspace/

# Copy extra model paths configuration
COPY extra_model_paths.yaml /workspace/ComfyUI/

# Set the Python path
ENV PYTHONPATH=/workspace/ComfyUI:$PYTHONPATH

# Set the handler
CMD ["python", "/workspace/image_to_video_handler.py"]
