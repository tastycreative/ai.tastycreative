FROM runpod/pytorch:2.0.1-py3.10-cuda11.8.0-devel

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/workspace

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    unzip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Clone ai-toolkit (latest version)
RUN git clone https://github.com/ostris/ai-toolkit.git && \
    cd ai-toolkit && \
    git checkout main

# Install ai-toolkit dependencies
WORKDIR /workspace/ai-toolkit
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies for RunPod integration
RUN pip install --no-cache-dir \
    runpod==1.6.2 \
    pyyaml==6.0.1 \
    requests==2.31.0 \
    pillow==10.0.1 \
    python-multipart==0.0.6

# Create necessary directories
RUN mkdir -p /workspace/training_data \
    /workspace/outputs \
    /workspace/logs

# Copy the handler
COPY handler.py /workspace/handler.py
RUN chmod +x /workspace/handler.py

# Set working directory back to workspace
WORKDIR /workspace

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import runpod; print('RunPod handler ready')" || exit 1

# Default command
CMD ["python", "handler.py"]
