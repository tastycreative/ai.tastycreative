#!/usr/bin/env python3
"""
RunPod Serverless Handler for Text to Video using Wan 2.2 Models with ComfyUI
Supports:
- Text-to-video generation with Wan 2.2 14B models
- 4-step LoRA acceleration (high & low noise)
- Custom prompt and negative prompt support
- Direct AWS S3 storage for bandwidth optimization
"""

import os
import sys
import json
import time
import base64
import logging
import requests
import runpod
import boto3
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS S3 Configuration for direct storage (bandwidth optimization)
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
AWS_S3_BUCKET = os.environ.get('AWS_S3_BUCKET', 'tastycreative')

def get_aws_s3_client():
    """Initialize AWS S3 client for direct storage"""
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    
    if not aws_access_key or not aws_secret_key:
        logger.error("❌ AWS S3 credentials not found in environment variables")
        return None
    
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=AWS_REGION
        )
        logger.info("✅ AWS S3 client initialized successfully")
        return s3_client
    except Exception as e:
        logger.error(f"❌ Failed to initialize AWS S3 client: {e}")
        return None

def upload_video_to_aws_s3(video_data: bytes, user_id: str, filename: str, subfolder: str = '', is_full_prefix: bool = False) -> Dict[str, str]:
    """Upload video to AWS S3 and return S3 key and public URL
    
    Args:
        video_data: Binary video data
        user_id: User ID (used if is_full_prefix is False)
        filename: Name of the file
        subfolder: Either a subfolder name or a full S3 prefix path
        is_full_prefix: If True, subfolder is treated as a complete S3 prefix (for shared folders)
    """
    try:
        s3_client = get_aws_s3_client()
        if not s3_client:
            return {"success": False, "error": "S3 client not initialized"}
        
        # Create S3 key
        if is_full_prefix and subfolder:
            # Use the full prefix as-is
            s3_key = f"{subfolder.rstrip('/')}/{filename}"
        else:
            # Build the key with user_id
            if subfolder:
                s3_key = f"generated-content/{user_id}/{subfolder}/{filename}"
            else:
                s3_key = f"generated-content/{user_id}/text-to-video/{filename}"
        
        logger.info(f"📤 Uploading video to AWS S3: {s3_key}")
        
        # Upload to AWS S3
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            Body=video_data,
            ContentType='video/mp4',
            CacheControl='public, max-age=31536000'
        )
        
        # Generate public URL
        public_url = f"https://{AWS_S3_BUCKET}.s3.amazonaws.com/{s3_key}"
        
        logger.info(f"✅ Successfully uploaded video to AWS S3: {public_url}")
        return {
            "success": True,
            "awsS3Key": s3_key,
            "awsS3Url": public_url,
            "fileSize": len(video_data)
        }
            
    except ClientError as e:
        logger.error(f"❌ AWS S3 upload failed: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"❌ AWS S3 upload error: {e}")
        return {"success": False, "error": str(e)}

def get_video_bytes_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> bytes:
    """Download video from ComfyUI and return raw bytes"""
    try:
        comfyui_url = "http://127.0.0.1:8188"
        
        # Construct the video URL
        if subfolder:
            url = f"{comfyui_url}/view?filename={filename}&subfolder={subfolder}&type={type_dir}"
        else:
            url = f"{comfyui_url}/view?filename={filename}&type={type_dir}"
        
        logger.info(f"📥 Downloading video from ComfyUI: {url}")
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        return response.content
        
    except Exception as e:
        logger.error(f"❌ Error downloading video from ComfyUI: {e}")
        raise

def send_webhook(webhook_url: str, data: Dict) -> bool:
    """Send webhook update to your website"""
    if not webhook_url:
        return False
        
    try:
        response = requests.post(webhook_url, json=data, timeout=10)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"❌ Webhook error: {e}")
        return False

def fix_lora_paths(workflow):
    """Fix LoRA paths to match ComfyUI's expected format with subdirectories"""
    try:
        for node_id, node in workflow.items():
            # Check for both LoraLoader and LoraLoaderModelOnly
            if isinstance(node, dict) and node.get('class_type') in ['LoraLoader', 'LoraLoaderModelOnly']:
                lora_name = node['inputs'].get('lora_name', '')
                
                # If LoRA name starts with user_ and doesn't contain /, add the subdirectory
                # Skip fixed 4-step LoRAs (wan2.2_t2v_lightx2v_4steps_lora_v1.1)
                if lora_name.startswith('user_') and '/' not in lora_name:
                    # Extract user directory from filename (format: user_XXX_timestamp_name.safetensors)
                    parts = lora_name.split('_')
                    if len(parts) >= 3:
                        user_dir = f"{parts[0]}_{parts[1]}"  # e.g., user_30dULT8ZLO1jthhCEgn349cKcvT
                        fixed_path = f"{user_dir}/{lora_name}"
                        logger.info(f"🔧 Fixing LoRA path for node {node_id}: {lora_name} -> {fixed_path}")
                        node['inputs']['lora_name'] = fixed_path
        
        return workflow
    except Exception as e:
        logger.error(f"❌ Error fixing LoRA paths: {e}")
        return workflow

def validate_text_to_video_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure for Text to Video"""
    try:
        # Required nodes for Wan 2.2 Text to Video workflow (nodes 90, 91, 114, 115 are optional custom LoRAs)
        required_nodes = ["71", "72", "73", "74", "75", "76", "78", "80", "81", "82", "83", "85", "86", "87", "88", "89"]
        
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"❌ Missing required node: {node_id}")
                return False
        
        # Validate node types
        expected_types = {
            "71": "CLIPLoader",
            "72": "CLIPTextEncode",  # Negative prompt
            "73": "VAELoader",
            "74": "EmptyHunyuanLatentVideo",
            "75": "UNETLoader",  # High noise model
            "76": "UNETLoader",  # Low noise model
            "78": "KSamplerAdvanced",  # Low noise sampler
            "80": "SaveVideo",
            "81": "KSamplerAdvanced",  # High noise sampler
            "82": "ModelSamplingSD3",  # High noise sampling
            "83": "LoraLoaderModelOnly",  # High noise LoRA
            "85": "LoraLoaderModelOnly",  # Low noise LoRA
            "86": "ModelSamplingSD3",  # Low noise sampling
            "87": "VAEDecode",
            "88": "CreateVideo",
            "89": "CLIPTextEncode"  # Positive prompt
        }
        
        for node_id, expected_type in expected_types.items():
            if workflow[node_id].get("class_type") != expected_type:
                logger.error(f"❌ Node {node_id} has incorrect type. Expected {expected_type}, got {workflow[node_id].get('class_type')}")
                return False
        
        logger.info("✅ Text to Video workflow validation passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Workflow validation error: {e}")
        return False

def queue_text_to_video_workflow(workflow, job_id):
    """Queue Text to Video workflow with ComfyUI"""
    try:
        comfyui_url = "http://127.0.0.1:8188"
        
        # Validate workflow
        if not validate_text_to_video_workflow(workflow):
            raise Exception("Workflow validation failed")
        
        # Fix LoRA paths before sending workflow (adds user subdirectories)
        workflow = fix_lora_paths(workflow)
        
        # Log detailed workflow structure for debugging
        logger.info("📝 Workflow Structure Debug:")
        if "83" in workflow:
            logger.info(f"  Node 83 (Fixed High Noise 4-step LoRA):")
            logger.info(f"    class_type: {workflow['83'].get('class_type')}")
            logger.info(f"    inputs: {workflow['83'].get('inputs')}")
        if "85" in workflow:
            logger.info(f"  Node 85 (Fixed Low Noise 4-step LoRA):")
            logger.info(f"    class_type: {workflow['85'].get('class_type')}")
            logger.info(f"    inputs: {workflow['85'].get('inputs')}")
        if "90" in workflow:
            logger.info(f"  Node 90 (Custom High Noise LoRA):")
            logger.info(f"    class_type: {workflow['90'].get('class_type')}")
            logger.info(f"    inputs: {workflow['90'].get('inputs')}")
        if "91" in workflow:
            logger.info(f"  Node 91 (Custom Low Noise LoRA):")
            logger.info(f"    class_type: {workflow['91'].get('class_type')}")
            logger.info(f"    inputs: {workflow['91'].get('inputs')}")
        if "114" in workflow:
            logger.info(f"  Node 114 (Custom High Noise LoRA):")
            logger.info(f"    class_type: {workflow['114'].get('class_type')}")
            logger.info(f"    inputs: {workflow['114'].get('inputs')}")
        if "115" in workflow:
            logger.info(f"  Node 115 (Custom Low Noise LoRA):")
            logger.info(f"    class_type: {workflow['115'].get('class_type')}")
            logger.info(f"    inputs: {workflow['115'].get('inputs')}")
        
        # Prepare prompt structure
        prompt = {
            "prompt": workflow,
            "client_id": job_id
        }
        
        logger.info(f"🎬 Queueing Text to Video workflow for job {job_id}")
        
        # Queue the prompt
        response = requests.post(
            f"{comfyui_url}/prompt",
            json=prompt,
            timeout=30
        )
        
        # Log the response for debugging
        if not response.ok:
            logger.error(f"❌ ComfyUI API error: {response.status_code}")
            logger.error(f"Response: {response.text}")
            response.raise_for_status()
        
        response.raise_for_status()
        
        result = response.json()
        prompt_id = result.get("prompt_id")
        
        if not prompt_id:
            raise Exception("No prompt_id returned from ComfyUI")
        
        logger.info(f"✅ Workflow queued successfully with prompt_id: {prompt_id}")
        return prompt_id
        
    except Exception as e:
        logger.error(f"❌ Error queueing workflow: {e}")
        raise

def is_comfyui_running() -> bool:
    """Check if ComfyUI is already running on port 8188"""
    try:
        response = requests.get("http://127.0.0.1:8188", timeout=2)
        return True
    except requests.exceptions.RequestException:
        return False
    return False

def prepare_comfyui_environment() -> bool:
    """Prepare ComfyUI environment and start ComfyUI"""
    try:
        # Check if ComfyUI is already running
        if is_comfyui_running():
            logger.info("✅ ComfyUI is already running")
            return True
        
        logger.info("🚀 Starting ComfyUI...")
        start_comfyui()
        
        # Wait for ComfyUI to start (max 60 seconds)
        for i in range(60):
            if is_comfyui_running():
                logger.info("✅ ComfyUI started successfully")
                
                # Check if ComfyUI can see LoRA files and rgthree node
                time.sleep(2)  # Give ComfyUI a moment to fully initialize
                check_comfyui_lora_availability()
                
                return True
            time.sleep(1)
        
        logger.error("❌ ComfyUI failed to start within 60 seconds")
        return False
        
    except Exception as e:
        logger.error(f"❌ Error preparing ComfyUI environment: {e}")
        return False

def get_models_path() -> str:
    """Get the models path (network volume or local)"""
    # Check multiple possible network volume paths
    possible_paths = ["/runpod-volume", "/workspace", "/runpod"]
    
    for path in possible_paths:
        if os.path.exists(path):
            logger.info(f"✅ Found network volume at: {path}")
            # Verify it has model directories
            if os.path.exists(os.path.join(path, "diffusion_models")) or os.path.exists(os.path.join(path, "loras")):
                logger.info(f"✅ Confirmed model directories exist in: {path}")
                return path
            else:
                logger.warning(f"⚠️ Path exists but no model directories found: {path}")
    
    logger.warning("⚠️ No network volume found, using local models path")
    return "/app/comfyui/models"

def verify_text_to_video_models() -> bool:
    """Verify that required model files exist for Text to Video"""
    try:
        # Debug: List root directory contents
        logger.info("🔍 Checking available mount points:")
        try:
            root_contents = os.listdir("/")
            logger.info(f"Root directory contents: {root_contents}")
        except Exception as e:
            logger.warning(f"Could not list root directory: {e}")
        
        models_path = get_models_path()
        logger.info(f"🔍 Using models path: {models_path}")
        
        # List contents of models path
        if os.path.exists(models_path):
            try:
                path_contents = os.listdir(models_path)
                logger.info(f"📂 Contents of {models_path}: {path_contents}")
            except Exception as e:
                logger.warning(f"Could not list {models_path}: {e}")
        
        required_models = {
            "diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors": "High Noise UNET",
            "diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors": "Low Noise UNET",
            "clip/umt5_xxl_fp8_e4m3fn_scaled.safetensors": "CLIP Text Encoder",
            "vae/wan_2.1_vae.safetensors": "VAE",
            "loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors": "High Noise LoRA",
            "loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors": "Low Noise LoRA"
        }
        
        for model_path, model_name in required_models.items():
            full_path = os.path.join(models_path, model_path)
            if os.path.exists(full_path):
                logger.info(f"✅ Found {model_name}: {full_path}")
            else:
                logger.error(f"❌ Missing {model_name}: {full_path}")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error verifying models: {e}")
        return False

def verify_rgthree_installation() -> bool:
    """Verify that rgthree-comfy custom node is properly installed"""
    try:
        custom_nodes_path = "/app/comfyui/custom_nodes/rgthree-comfy"
        
        if not os.path.exists(custom_nodes_path):
            logger.error(f"❌ rgthree-comfy not found at {custom_nodes_path}")
            return False
        
        # Check for key files
        required_files = [
            "__init__.py",
            "py/power_lora_loader.py"
        ]
        
        for file in required_files:
            file_path = os.path.join(custom_nodes_path, file)
            if not os.path.exists(file_path):
                logger.warning(f"⚠️  rgthree-comfy file not found: {file}")
        
        logger.info(f"✅ rgthree-comfy installation verified at {custom_nodes_path}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error verifying rgthree installation: {e}")
        return False

def check_comfyui_lora_availability() -> bool:
    """Check if ComfyUI API can see the LoRA files"""
    try:
        comfyui_url = "http://127.0.0.1:8188"
        
        # Get object info from ComfyUI API
        response = requests.get(f"{comfyui_url}/object_info", timeout=10)
        
        if not response.ok:
            logger.warning("⚠️  Could not fetch ComfyUI object_info")
            return False
        
        object_info = response.json()
        
        # Check if Power Lora Loader is available
        if "Power Lora Loader (rgthree)" in object_info:
            logger.info("✅ ComfyUI recognizes 'Power Lora Loader (rgthree)' node")
            
            # Get the node info
            node_info = object_info["Power Lora Loader (rgthree)"]
            logger.info(f"📋 Power Lora Loader input types: {node_info.get('input', {})}")
        else:
            logger.error("❌ ComfyUI does NOT recognize 'Power Lora Loader (rgthree)' node")
            logger.info(f"Available nodes: {list(object_info.keys())[:10]}...")
            return False
        
        # Try to get available LoRAs
        try:
            response = requests.get(f"{comfyui_url}/extensions", timeout=5)
            if response.ok:
                logger.info("✅ ComfyUI extensions endpoint accessible")
        except:
            pass
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error checking ComfyUI LoRA availability: {e}")
        return False

def stream_comfyui_logs(process):
    """Stream ComfyUI stdout/stderr to RunPod logs"""
    def log_output(pipe, prefix):
        try:
            for line in iter(pipe.readline, ''):
                if line:
                    logger.info(f"{prefix} {line.rstrip()}")
        except Exception as e:
            logger.error(f"Error streaming {prefix}: {e}")
    
    # Start threads to stream stdout and stderr
    import threading
    stdout_thread = threading.Thread(target=log_output, args=(process.stdout, "[ComfyUI]"), daemon=True)
    stderr_thread = threading.Thread(target=log_output, args=(process.stderr, "[ComfyUI ERROR]"), daemon=True)
    stdout_thread.start()
    stderr_thread.start()

def start_comfyui():
    """Start ComfyUI server in background with cold start optimizations"""
    try:
        comfyui_path = "/app/comfyui"
        
        # Verify rgthree-comfy is installed
        verify_rgthree_installation()
        
        # Set environment variables for optimal performance
        env = os.environ.copy()
        env.update({
            'PYTORCH_CUDA_ALLOC_CONF': 'max_split_size_mb:512',
            'CUDA_LAUNCH_BLOCKING': '0',
            'CUDA_VISIBLE_DEVICES': '0'
        })
        
        # Start ComfyUI in background
        cmd = [
            sys.executable,
            f"{comfyui_path}/main.py",
            "--listen", "0.0.0.0",
            "--port", "8188",
            "--output-directory", "/runpod-volume/outputs" if os.path.exists("/runpod-volume") else f"{comfyui_path}/output"
        ]
        
        logger.info(f"🚀 Starting ComfyUI with command: {' '.join(cmd)}")
        logger.info("📺 ComfyUI logs will be streamed below...")
        
        process = subprocess.Popen(
            cmd,
            cwd=comfyui_path,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1  # Line buffered
        )
        
        logger.info(f"✅ ComfyUI process started with PID: {process.pid}")
        
        # Start streaming logs in background threads
        stream_comfyui_logs(process)
        
    except Exception as e:
        logger.error(f"❌ Error starting ComfyUI: {e}")
        raise

def monitor_text_to_video_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = 'unknown', workflow: Dict = None) -> Dict:
    """Monitor ComfyUI progress for Text to Video with real-time updates"""
    try:
        comfyui_url = "http://127.0.0.1:8188"
        max_wait_time = 600  # 10 minutes timeout
        start_time = time.time()
        last_progress_update = 0
        
        logger.info(f"📊 Monitoring progress for prompt_id: {prompt_id}")
        
        # Send initial webhook
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "PROCESSING",
            "progress": 0,
            "message": "Starting video generation..."
        })
        
        while True:
            # Check timeout
            if time.time() - start_time > max_wait_time:
                logger.error(f"❌ Job {job_id} timed out after {max_wait_time} seconds")
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "error": "Generation timed out"
                })
                return {"success": False, "error": "Timeout"}
            
            try:
                # Check queue status for progress updates
                elapsed = time.time() - start_time
                if elapsed - last_progress_update >= 10:  # Update every 10 seconds
                    try:
                        queue_response = requests.get(f"{comfyui_url}/queue", timeout=5)
                        queue_data = queue_response.json()
                        
                        # Calculate rough progress based on elapsed time
                        estimated_total_time = 360  # ~6 minutes for text-to-video
                        progress = min(95, int((elapsed / estimated_total_time) * 100))
                        
                        logger.info(f"⏳ Progress: {progress}% | Elapsed: {int(elapsed)}s")
                        
                        send_webhook(webhook_url, {
                            "job_id": job_id,
                            "status": "PROCESSING",
                            "progress": progress,
                            "message": f"Generating video... {int(elapsed)}s elapsed"
                        })
                        
                        last_progress_update = elapsed
                    except Exception as e:
                        logger.warning(f"⚠️ Could not fetch queue status: {e}")
                
                # Get history
                history_response = requests.get(f"{comfyui_url}/history/{prompt_id}", timeout=10)
                history_data = history_response.json()
                
                if prompt_id in history_data:
                    job_data = history_data[prompt_id]
                    
                    # Check if job is completed
                    if "outputs" in job_data:
                        logger.info("✅ Job completed, processing outputs...")
                        
                        outputs = job_data["outputs"]
                        video_results = []
                        
                        # Extract video from SaveVideo node (node 80)
                        if "80" in outputs:
                            save_video_output = outputs["80"]
                            logger.info(f"🔍 SaveVideo output keys: {list(save_video_output.keys())}")
                            logger.info(f"🔍 SaveVideo output content: {save_video_output}")
                            
                            # Check multiple possible output fields
                            video_list = None
                            if "images" in save_video_output and save_video_output["images"]:
                                video_list = save_video_output["images"]
                                logger.info(f"✅ Found videos in 'images' field: {len(video_list)} video(s)")
                            elif "videos" in save_video_output and save_video_output["videos"]:
                                video_list = save_video_output["videos"]
                                logger.info(f"✅ Found videos in 'videos' field: {len(video_list)} video(s)")
                            elif "gifs" in save_video_output and save_video_output["gifs"]:
                                video_list = save_video_output["gifs"]
                                logger.info(f"✅ Found videos in 'gifs' field: {len(video_list)} video(s)")
                            elif "filenames" in save_video_output and save_video_output["filenames"]:
                                video_list = save_video_output["filenames"]
                                logger.info(f"✅ Found videos in 'filenames' field: {len(video_list)} video(s)")
                            
                            if video_list:
                                for video_info in video_list:
                                    # Handle both dict and string formats
                                    if isinstance(video_info, dict):
                                        filename = video_info.get("filename")
                                        subfolder = video_info.get("subfolder", "")
                                    else:
                                        filename = video_info
                                        subfolder = ""
                                    
                                    if filename:
                                        logger.info(f"📹 Processing video: {filename}")
                                        
                                        try:
                                            # Download video from ComfyUI
                                            video_data = get_video_bytes_from_comfyui(filename, subfolder)
                                            
                                            # Get target folder from workflow
                                            target_folder = ""
                                            is_full_prefix = False
                                            
                                            if workflow and "80" in workflow and "inputs" in workflow["80"]:
                                                filename_prefix = workflow["80"]["inputs"].get("filename_prefix", "")
                                                if filename_prefix and filename_prefix != "video/ComfyUI":
                                                    target_folder = filename_prefix.replace("ComfyUI", "").rstrip("/")
                                                    is_full_prefix = True
                                            
                                            # Upload to AWS S3
                                            upload_result = upload_video_to_aws_s3(
                                                video_data,
                                                user_id,
                                                filename,
                                                target_folder,
                                                is_full_prefix
                                            )
                                            
                                            if upload_result.get("success"):
                                                video_results.append({
                                                    "filename": filename,
                                                    "subfolder": subfolder,
                                                    "awsS3Key": upload_result.get("awsS3Key"),
                                                    "awsS3Url": upload_result.get("awsS3Url"),
                                                    "fileSize": upload_result.get("fileSize")
                                                })
                                                logger.info(f"✅ Video uploaded: {upload_result.get('awsS3Url')}")
                                            else:
                                                logger.error(f"❌ Failed to upload video: {upload_result.get('error')}")
                                        
                                        except Exception as e:
                                            logger.error(f"❌ Error processing video {filename}: {e}")
                            else:
                                logger.error(f"❌ No video list found in SaveVideo output. Available keys: {list(save_video_output.keys())}")
                        else:
                            logger.error(f"❌ Node 80 not found in outputs. Available nodes: {list(outputs.keys())}")
                        
                        # Send completion webhook
                        if video_results:
                            # Match image-to-video webhook format
                            webhook_videos = []
                            for v in video_results:
                                webhook_videos.append({
                                    "filename": v["filename"],
                                    "subfolder": v["subfolder"],
                                    "awsS3Key": v["awsS3Key"],
                                    "awsS3Url": v["awsS3Url"],
                                    "fileSize": v.get("fileSize", 0)
                                })
                            
                            # Calculate elapsed time
                            elapsed_time = time.time() - start_time
                            
                            send_webhook(webhook_url, {
                                "job_id": job_id,
                                "status": "COMPLETED",
                                "progress": 100,
                                "message": "Video generation completed successfully! 🎉",
                                "aws_s3_paths": webhook_videos,
                                "totalTime": int(elapsed_time)
                            })
                            
                            return {
                                "success": True,
                                "status": "completed",
                                "videos": webhook_videos
                            }
                        else:
                            logger.error("❌ No video outputs found")
                            send_webhook(webhook_url, {
                                "job_id": job_id,
                                "status": "FAILED",
                                "error": "No video outputs generated"
                            })
                            return {"success": False, "error": "No outputs"}
                
                # Check queue status for progress
                queue_response = requests.get(f"{comfyui_url}/queue", timeout=10)
                queue_data = queue_response.json()
                
                # Update progress periodically
                current_time = time.time()
                if current_time - last_progress_update > 5:
                    elapsed = int(current_time - start_time)
                    progress = min(90, int((elapsed / max_wait_time) * 90))
                    
                    send_webhook(webhook_url, {
                        "job_id": job_id,
                        "status": "PROCESSING",
                        "progress": progress,
                        "message": f"Generating video... ({elapsed}s elapsed)",
                        "stage": "generating_frames",
                        "elapsedTime": elapsed
                    })
                    
                    last_progress_update = current_time
                
            except Exception as e:
                logger.error(f"❌ Error checking progress: {e}")
            
            time.sleep(2)
    
    except Exception as e:
        logger.error(f"❌ Error monitoring progress: {e}")
        send_webhook(webhook_url, {
            "jobId": job_id,
            "status": "FAILED",
            "error": str(e)
        })
        return {"success": False, "error": str(e)}

def run_text_to_video_generation(job_input, job_id, webhook_url):
    """Execute the actual Text to Video generation process"""
    logger.info(f"🎬 Starting Text to Video generation for job: {job_id}")
    
    try:
        # Check what LoRA files ComfyUI can see
        try:
            lora_check = requests.get("http://127.0.0.1:8188/object_info/LoraLoader", timeout=5)
            if lora_check.status_code == 200:
                lora_info = lora_check.json()
                if "LoraLoader" in lora_info and "input" in lora_info["LoraLoader"]:
                    available_loras = lora_info["LoraLoader"]["input"].get("required", {}).get("lora_name", [[]])[0]
                    logger.info(f"🔍 ComfyUI discovered {len(available_loras)} LoRA files:")
                    for lora_file in available_loras:
                        logger.info(f"  - {lora_file}")
                    
                    # Check if our required LoRAs are in the list
                    required_loras = [
                        "wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors",
                        "wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors"
                    ]
                    for req_lora in required_loras:
                        if req_lora in available_loras:
                            logger.info(f"✅ Found required LoRA: {req_lora}")
                        else:
                            logger.warning(f"⚠️ Required LoRA NOT in ComfyUI's list: {req_lora}")
                            # Check for partial matches
                            matches = [l for l in available_loras if req_lora in l]
                            if matches:
                                logger.info(f"   Found partial matches: {matches}")
        except Exception as e:
            logger.warning(f"⚠️ Could not query LoRA files: {e}")
        
        # Log input parameters
        logger.info("=" * 80)
        logger.info("📋 TEXT TO VIDEO GENERATION PARAMETERS")
        logger.info("=" * 80)
        logger.info(f"Job ID: {job_id}")
        logger.info(f"User ID: {job_input.get('userId', 'unknown')}")
        
        # Extract workflow to show actual parameters being used
        workflow = job_input.get('workflow', {})
        
        # Log prompts
        if '89' in workflow and 'inputs' in workflow['89']:
            positive_prompt = workflow['89']['inputs'].get('text', 'N/A')
            logger.info(f"Positive Prompt: {positive_prompt[:200]}..." if len(positive_prompt) > 200 else f"Positive Prompt: {positive_prompt}")
        
        if '72' in workflow and 'inputs' in workflow['72']:
            negative_prompt = workflow['72']['inputs'].get('text', 'N/A')
            logger.info(f"Negative Prompt: {negative_prompt[:200]}..." if len(negative_prompt) > 200 else f"Negative Prompt: {negative_prompt}")
        
        # Log video dimensions
        if '74' in workflow and 'inputs' in workflow['74']:
            video_params = workflow['74']['inputs']
            logger.info(f"Video Dimensions: {video_params.get('width', 640)}x{video_params.get('height', 640)}")
            logger.info(f"Video Length: {video_params.get('length', 81)} frames (~{video_params.get('length', 81)/16:.1f}s @ 16fps)")
            logger.info(f"Batch Size: {video_params.get('batch_size', 1)}")
        
        # Log sampler settings from KSamplerAdvanced nodes
        if '81' in workflow and 'inputs' in workflow['81']:
            sampler1 = workflow['81']['inputs']
            logger.info("--- High Noise Sampler (Node 81) ---")
            logger.info(f"  Steps: {sampler1.get('steps', 4)}")
            logger.info(f"  CFG Scale: {sampler1.get('cfg', 1)}")
            logger.info(f"  Sampler: {sampler1.get('sampler_name', 'euler')}")
            logger.info(f"  Scheduler: {sampler1.get('scheduler', 'simple')}")
            logger.info(f"  Seed: {sampler1.get('noise_seed', 'random')}")
            logger.info(f"  Add Noise: {sampler1.get('add_noise', 'enable')}")
            logger.info(f"  Start Step: {sampler1.get('start_at_step', 0)}")
            logger.info(f"  End Step: {sampler1.get('end_at_step', 2)}")
            logger.info(f"  Return with Noise: {sampler1.get('return_with_leftover_noise', 'enable')}")
        
        if '78' in workflow and 'inputs' in workflow['78']:
            sampler2 = workflow['78']['inputs']
            logger.info("--- Low Noise Sampler (Node 78) ---")
            logger.info(f"  Steps: {sampler2.get('steps', 4)}")
            logger.info(f"  CFG Scale: {sampler2.get('cfg', 1)}")
            logger.info(f"  Sampler: {sampler2.get('sampler_name', 'euler')}")
            logger.info(f"  Scheduler: {sampler2.get('scheduler', 'simple')}")
            logger.info(f"  Seed: {sampler2.get('noise_seed', 0)}")
            logger.info(f"  Add Noise: {sampler2.get('add_noise', 'disable')}")
            logger.info(f"  Start Step: {sampler2.get('start_at_step', 2)}")
            logger.info(f"  End Step: {sampler2.get('end_at_step', 10000)}")
            logger.info(f"  Return with Noise: {sampler2.get('return_with_leftover_noise', 'disable')}")
        
        # Log model sampling settings
        if '82' in workflow and 'inputs' in workflow['82']:
            logger.info(f"High Noise Model Sampling Shift: {workflow['82']['inputs'].get('shift', 8)}")
        
        if '86' in workflow and 'inputs' in workflow['86']:
            logger.info(f"Low Noise Model Sampling Shift: {workflow['86']['inputs'].get('shift', 8)}")
        
        # Log models being used
        logger.info("--- Models ---")
        if '75' in workflow and 'inputs' in workflow['75']:
            logger.info(f"High Noise UNET: {workflow['75']['inputs'].get('unet_name', 'N/A')}")
        
        if '76' in workflow and 'inputs' in workflow['76']:
            logger.info(f"Low Noise UNET: {workflow['76']['inputs'].get('unet_name', 'N/A')}")
        
        if '71' in workflow and 'inputs' in workflow['71']:
            logger.info(f"CLIP Model: {workflow['71']['inputs'].get('clip_name', 'N/A')}")
            logger.info(f"CLIP Type: {workflow['71']['inputs'].get('type', 'wan')}")
        
        if '73' in workflow and 'inputs' in workflow['73']:
            logger.info(f"VAE Model: {workflow['73']['inputs'].get('vae_name', 'N/A')}")
        
        # Log LoRA settings
        logger.info("--- LoRA Models ---")
        # Fixed 4-step High Noise LoRA
        if '83' in workflow and 'inputs' in workflow['83']:
            lora_inputs = workflow['83']['inputs']
            logger.info(f"Fixed High Noise 4-step LoRA (Node 83): {lora_inputs.get('lora_name', 'N/A')}")
            logger.info(f"  Strength: {lora_inputs.get('strength_model', 'N/A')}")
        
        # Fixed 4-step Low Noise LoRA
        if '85' in workflow and 'inputs' in workflow['85']:
            lora_inputs = workflow['85']['inputs']
            logger.info(f"Fixed Low Noise 4-step LoRA (Node 85): {lora_inputs.get('lora_name', 'N/A')}")
            logger.info(f"  Strength: {lora_inputs.get('strength_model', 'N/A')}")
        
        # Optional Custom High Noise LoRA (Node 90 or 114)
        if '90' in workflow and 'inputs' in workflow['90']:
            lora_inputs = workflow['90']['inputs']
            logger.info(f"Custom High Noise LoRA (Node 90): {lora_inputs.get('lora_name', 'N/A')}")
            logger.info(f"  Strength: {lora_inputs.get('strength_model', 'N/A')}")
        elif '114' in workflow and 'inputs' in workflow['114']:
            lora_inputs = workflow['114']['inputs']
            logger.info(f"Custom High Noise LoRA (Node 114): {lora_inputs.get('lora_name', 'N/A')}")
            logger.info(f"  Strength: {lora_inputs.get('strength_model', 'N/A')}")
        
        # Optional Custom Low Noise LoRA (Node 91 or 115)
        if '91' in workflow and 'inputs' in workflow['91']:
            lora_inputs = workflow['91']['inputs']
            logger.info(f"Custom Low Noise LoRA (Node 91): {lora_inputs.get('lora_name', 'N/A')}")
            logger.info(f"  Strength: {lora_inputs.get('strength_model', 'N/A')}")
        elif '115' in workflow and 'inputs' in workflow['115']:
            lora_inputs = workflow['115']['inputs']
            logger.info(f"Custom Low Noise LoRA (Node 115): {lora_inputs.get('lora_name', 'N/A')}")
            logger.info(f"  Strength: {lora_inputs.get('strength_model', 'N/A')}")
        
        if not any(node in workflow for node in ['90', '91', '114', '115']):
            logger.info("No custom LoRAs selected (using only fixed 4-step LoRAs)")
        
        # Log output settings
        if '80' in workflow and 'inputs' in workflow['80']:
            output_settings = workflow['80']['inputs']
            logger.info("--- Output Settings ---")
            logger.info(f"Filename Prefix: {output_settings.get('filename_prefix', 'video/ComfyUI')}")
            logger.info(f"Format: {output_settings.get('format', 'auto')}")
            logger.info(f"Codec: {output_settings.get('codec', 'auto')}")
        
        if '88' in workflow and 'inputs' in workflow['88']:
            logger.info(f"Output FPS: {workflow['88']['inputs'].get('fps', 16)}")
        
        logger.info("=" * 80)
        
        # Verify models exist
        if not verify_text_to_video_models():
            raise Exception("Required models not found")
        
        # Prepare ComfyUI environment
        if not prepare_comfyui_environment():
            raise Exception("Failed to prepare ComfyUI environment")
        
        # Get user_id
        user_id = job_input.get('userId', 'unknown')
        
        if not workflow:
            raise Exception("No workflow provided")
        
        # Queue the workflow
        prompt_id = queue_text_to_video_workflow(workflow, job_id)
        
        # Monitor progress
        result = monitor_text_to_video_progress(prompt_id, job_id, webhook_url, user_id, workflow)
        
        return result
    
    except Exception as e:
        logger.error(f"❌ Text to Video generation error: {e}")
        send_webhook(webhook_url, {
            "jobId": job_id,
            "status": "FAILED",
            "error": str(e)
        })
        return {"success": False, "error": str(e)}

def handler(job):
    """RunPod serverless handler for Text to Video"""
    job_input = job['input']
    action = job_input.get('action', 'generate_text_to_video')
    
    try:
        if action == 'health_check':
            logger.info("🏥 Health check requested")
            return {
                "success": True,
                "message": "Text to Video handler is healthy",
                "models_verified": verify_text_to_video_models()
            }
        
        elif action == 'generate_text_to_video':
            job_id = job.get('id', 'unknown')
            webhook_url = job_input.get('webhook_url', '')
            
            logger.info(f"🎬 Starting Text to Video generation job: {job_id}")
            result = run_text_to_video_generation(job_input, job_id, webhook_url)
            
            return result
        
        else:
            logger.error(f"❌ Unknown action: {action}")
            return {"success": False, "error": f"Unknown action: {action}"}
    
    except Exception as e:
        logger.error(f"❌ Handler error: {e}")
        return {"success": False, "error": str(e)}

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎬 Starting RunPod Text to Video (Wan 2.2) handler...")
    runpod.serverless.start({"handler": handler})
