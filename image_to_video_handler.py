#!/usr/bin/env python3
"""
RunPod Serverless Handler for Image-to-Video Generation using ComfyUI
Supports WAN 2.2 video generation model with comprehensive progress tracking and S3 storage.
"""
import runpod
import json
import requests
import time
import os
import sys
import logging
import base64
import subprocess
import threading
import boto3
from botocore.exceptions import ClientError
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# S3 Configuration for RunPod Network Volume
S3_ENDPOINT = 'https://s3api-us-ks-2.runpod.io'
S3_REGION = 'us-ks-2'
S3_BUCKET = '83cljmpqfd'

def get_s3_client():
    """Initialize S3 client for RunPod network volume"""
    s3_access_key = os.getenv('RUNPOD_S3_ACCESS_KEY')
    s3_secret_key = os.getenv('RUNPOD_S3_SECRET_KEY')
    
    if not s3_access_key or not s3_secret_key:
        logger.error("❌ S3 credentials not found in environment variables")
        return None
    
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            region_name=S3_REGION
        )
        logger.info("✅ S3 client initialized successfully")
        return s3_client
    except Exception as e:
        logger.error(f"❌ Failed to initialize S3 client: {e}")
        return None

def save_video_to_s3(filename: str, video_data: bytes, user_id: str, subfolder: str = '') -> str:
    """Save video to S3 network volume and return the S3 key"""
    try:
        s3_client = get_s3_client()
        if not s3_client:
            logger.error("❌ S3 client not available")
            return ""
        
        # Create S3 key: outputs/{user_id}/{subfolder}/{filename}
        s3_key_parts = ['outputs', user_id]
        if subfolder:
            s3_key_parts.append(subfolder)
        s3_key_parts.append(filename)
        s3_key = '/'.join(s3_key_parts)
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=video_data,
            ContentType='video/mp4'
        )
        
        logger.info(f"✅ Video saved to S3: {s3_key}")
        return s3_key
        
    except ClientError as e:
        logger.error(f"❌ S3 upload failed: {e}")
        return ""
    except Exception as e:
        logger.error(f"❌ Error saving video to S3: {e}")
        return ""

def save_video_to_network_volume(filename: str, video_data: bytes, user_id: str, subfolder: str = '', type_dir: str = 'output') -> str:
    """Save video to network volume storage and return the file path"""
    try:
        # Create user directory structure
        base_path = "/runpod-volume" if os.path.exists("/runpod-volume") else "/workspace/output"
        user_dir = os.path.join(base_path, "outputs", user_id)
        if subfolder:
            user_dir = os.path.join(user_dir, subfolder)
        
        os.makedirs(user_dir, exist_ok=True)
        
        # Save video file
        video_path = os.path.join(user_dir, filename)
        with open(video_path, 'wb') as f:
            f.write(video_data)
        
        logger.info(f"✅ Video saved to network volume: {video_path}")
        return video_path
        
    except Exception as e:
        logger.error(f"❌ Error saving video to network volume: {e}")
        return ""

def send_webhook(webhook_url: str, data: Dict) -> bool:
    """Send webhook update to your website"""
    if not webhook_url:
        return False
        
    try:
        response = requests.post(webhook_url, json=data, timeout=120)
        response.raise_for_status()
        logger.info(f"✅ Webhook sent: {data.get('message', 'No message')}")
        return True
    except Exception as e:
        logger.error(f"❌ Webhook failed: {e}")
        return False

def validate_video_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure for image-to-video"""
    try:
        if not isinstance(workflow, dict):
            logger.error("Video workflow must be a dictionary")
            return False
        
        # Check for required video nodes
        required_nodes = ["6", "7", "37", "38", "39", "48", "56", "65", "81", "89", "90", "91", "92", "93", "94", "8", "57", "131"]
        
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"Missing required video node: {node_id}")
                return False
        
        # Validate node structure
        for node_id, node in workflow.items():
            if not isinstance(node, dict) or 'class_type' not in node or 'inputs' not in node:
                logger.error(f"Invalid video node structure for node {node_id}")
                return False
        
        logger.info("✅ Video workflow validation passed")
        return True
    
    except Exception as e:
        logger.error(f"❌ Video workflow validation error: {e}")
        return False

def get_video_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> str:
    """Download video from ComfyUI and return as base64 encoded string"""
    try:
        import base64
        logger.info(f"📥 Downloading video: {filename} from {subfolder}/{type_dir}")
        
        # Construct the URL for downloading the video
        params = {
            'filename': filename,
            'subfolder': subfolder,
            'type': type_dir
        }
        
        response = requests.get(
            "http://127.0.0.1:8188/view",
            params=params,
            timeout=60
        )
        
        if response.status_code != 200:
            logger.error(f"❌ Failed to download video: {response.status_code}")
            return ""
        
        # Encode video as base64
        video_b64 = base64.b64encode(response.content).decode('utf-8')
        logger.info(f"✅ Video downloaded and encoded: {len(video_b64)} characters")
        
        return video_b64
        
    except Exception as e:
        logger.error(f"❌ Error downloading video: {e}")
        return ""

def get_video_bytes_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> bytes:
    """Download video from ComfyUI and return as raw bytes for S3 storage"""
    try:
        logger.info(f"📥 Downloading video bytes: {filename} from {subfolder}/{type_dir}")
        
        # Construct the URL for downloading the video
        params = {
            'filename': filename,
            'subfolder': subfolder,
            'type': type_dir
        }
        
        response = requests.get(
            "http://127.0.0.1:8188/view",
            params=params,
            timeout=60
        )
        
        if response.status_code != 200:
            logger.error(f"❌ Failed to download video bytes: {response.status_code}")
            return b""
        
        logger.info(f"✅ Video bytes downloaded: {len(response.content)} bytes")
        return response.content
        
    except Exception as e:
        logger.error(f"❌ Error downloading video bytes: {e}")
        return b""

def is_comfyui_running() -> bool:
    """Check if ComfyUI is already running on port 8188"""
    try:
        response = requests.get("http://localhost:8188/system_stats", timeout=5)
        if response.status_code == 200:
            logger.info("✅ ComfyUI is already running")
            return True
    except requests.exceptions.RequestException:
        pass
    return False

def prepare_comfyui_environment() -> bool:
    """Prepare ComfyUI environment, start ComfyUI, and verify model files"""
    try:
        print("🔧 Preparing ComfyUI environment...")
        
        # Check if ComfyUI is already running
        if is_comfyui_running():
            print("🔄 ComfyUI is already running, skipping startup")
            return True
        
        # Validate network volume models first
        models_path = get_models_path()
        if not os.path.exists(models_path):
            print(f"❌ Models path not found: {models_path}")
            return False
        
        print(f"✅ Using models path: {models_path}")
        
        # Check for required model files
        if not verify_model_files():
            return False
        
        # Start ComfyUI server
        return start_comfyui()
        
    except Exception as e:
        print(f"❌ Error preparing ComfyUI environment: {str(e)}")
        return False

def get_models_path() -> str:
    """Get the models path (network volume or local)"""
    if os.path.exists("/runpod-volume"):
        return "/runpod-volume"
    else:
        return "/workspace/models"

def verify_model_files() -> bool:
    """Verify that required model files exist"""
    try:
        models_path = get_models_path()
        
        # Check for required model directories
        required_dirs = ['unet', 'vae', 'clip']
        missing_models = []
        
        for dir_name in required_dirs:
            dir_path = os.path.join(models_path, dir_name)
            if os.path.exists(dir_path):
                files = [f for f in os.listdir(dir_path) if not f.startswith('.')]
                print(f"✅ Found {len(files)} model files in {dir_name}/ - {', '.join(files[:3])}")
                if len(files) > 3:
                    print(f"    ... and {len(files) - 3} more files")
            else:
                missing_models.append(dir_name)
        
        if missing_models:
            print(f"❌ Missing model directories: {missing_models}")
            return False
            
        print("✅ All required model directories and files found")
        return True
        
    except Exception as e:
        print(f"❌ Error verifying model files: {str(e)}")
        return False

def start_comfyui():
    """Start ComfyUI server in background"""
    try:
        # Start ComfyUI from the correct directory
        comfyui_dir = "/app/comfyui"
        main_py = os.path.join(comfyui_dir, "main.py")
        
        if not os.path.exists(main_py):
            print(f"❌ ComfyUI main.py not found at: {main_py}")
            return False
        
        cmd = [
            sys.executable, main_py, 
            "--listen", "0.0.0.0",
            "--port", "8188",
            "--extra-model-paths-config", "/app/extra_model_paths.yaml",
            "--disable-auto-launch"
        ]
        
        print(f"🔧 Starting ComfyUI with command: {' '.join(cmd)}")
        
        def log_output(process, stream_name):
            for line in iter(process.stdout.readline, b''):
                if line:
                    print(f"ComfyUI [{stream_name}]: {line.decode().strip()}")
        
        # Start ComfyUI as background process from the ComfyUI directory
        process = subprocess.Popen(cmd, 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.STDOUT,
                                 cwd=comfyui_dir,
                                 bufsize=1,
                                 universal_newlines=False)
        
        # Start logging thread
        log_thread = threading.Thread(target=log_output, args=(process, "stdout"))
        log_thread.daemon = True
        log_thread.start()
        
        # Wait for ComfyUI to start up
        print("⏳ Waiting for ComfyUI to start...")
        max_wait = 300  # 5 minutes - increased timeout for dependency installation
        for i in range(max_wait):
            if i % 10 == 0:
                print(f"⏳ Still waiting for ComfyUI... ({i}/{max_wait}s)")
            
            try:
                response = requests.get("http://localhost:8188/system_stats", timeout=5)
                if response.status_code == 200:
                    print("✅ ComfyUI is running!")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(1)
            
        print(f"❌ ComfyUI failed to start within {max_wait} seconds")
        return False
        
    except Exception as e:
        print(f"❌ Error starting ComfyUI: {str(e)}")
        return False

def queue_workflow_with_comfyui(workflow: Dict, job_id: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"🎬 Queueing workflow with ComfyUI for job {job_id}")
        
        # ComfyUI API endpoint (using network volume ComfyUI instance)
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        queue_url = f"{comfyui_url}/prompt"
        
        # Prepare payload with unique client_id to prevent caching
        unique_client_id = f"runpod-{job_id}-{int(time.time())}-{os.urandom(4).hex()}"
        payload = {
            "prompt": workflow,
            "client_id": unique_client_id
        }
        
        logger.info(f"📡 Sending to ComfyUI: {queue_url}")
        
        # Send request to ComfyUI
        response = requests.post(
            queue_url,
            json=payload,
            timeout=30,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code != 200:
            logger.error(f"❌ ComfyUI queue failed: {response.status_code} - {response.text}")
            return None
        
        result = response.json()
        prompt_id = result.get('prompt_id')
        
        if not prompt_id:
            logger.error(f"❌ No prompt_id in response: {result}")
            return None
        
        logger.info(f"✅ Workflow queued successfully with prompt_id: {prompt_id}")
        return prompt_id
    
    except Exception as e:
        logger.error(f"❌ ComfyUI queue error: {e}")
        return None

def download_image_for_comfyui(image_filename: str, job_input: dict, base64_key: str = 'referenceImageData', **kwargs) -> bool:
    """Download the uploaded image to ComfyUI's input directory or use base64 data if available"""
    try:
        logger.info(f"📦 Using base64 image data directly for {image_filename} (key: {base64_key})")
        
        # Try to get base64 data from the provided key or kwargs
        base64_data = job_input.get(base64_key) or kwargs.get('base64_data')
        
        if not base64_data:
            # Try alternative keys
            for alt_key in ['originalImageData', 'imageData', 'referenceImageData']:
                if alt_key in job_input and job_input[alt_key]:
                    base64_data = job_input[alt_key]
                    logger.info(f"📦 Found base64 data in alternative key: {alt_key}")
                    break
        
        if not base64_data:
            logger.error(f"❌ No base64 image data found for {image_filename}")
            return False
        
        # Decode base64 and save to ComfyUI input directory
        try:
            # Remove data URL prefix if present
            if base64_data.startswith('data:'):
                base64_data = base64_data.split(',', 1)[1]
            
            image_data = base64.b64decode(base64_data)
            
            # Ensure input directory exists
            input_dir = "/app/comfyui/input"
            os.makedirs(input_dir, exist_ok=True)
            
            # Write image file
            image_path = os.path.join(input_dir, image_filename)
            with open(image_path, 'wb') as f:
                f.write(image_data)
            
            logger.info(f"✅ Base64 image saved to ComfyUI input: {image_path} ({len(image_data)} bytes)")
            return True
            
        except Exception as decode_error:
            logger.error(f"❌ Error decoding base64 image: {decode_error}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error saving image to ComfyUI: {e}")
        return False

def download_image_with_unique_name(image_filename: str, job_input: dict) -> tuple[bool, str]:
    """Download the image to ComfyUI input directory with a unique name to avoid caching"""
    try:
        logger.info(f"📥 Processing image with unique name: {image_filename}")
        
        # Create unique filename to prevent caching
        import time
        timestamp = int(time.time() * 1000)
        name_parts = image_filename.split('.')
        if len(name_parts) > 1:
            extension = name_parts[-1]
            base_name = '.'.join(name_parts[:-1])
            unique_filename = f"{base_name}_{timestamp}.{extension}"
        else:
            unique_filename = f"{image_filename}_{timestamp}"
        
        logger.info(f"🎯 Generated unique filename: {unique_filename}")
        
        # Use the existing download function with the unique filename
        success = download_image_for_comfyui(unique_filename, job_input)
        
        if success:
            logger.info(f"✅ Image downloaded with unique name: {unique_filename}")
            return True, unique_filename
        else:
            logger.error(f"❌ Failed to download image with unique name: {unique_filename}")
            return False, image_filename
            
    except Exception as e:
        logger.error(f"❌ Error creating unique image filename: {e}")
        return False, image_filename

def monitor_video_generation_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = "default_user") -> Dict:
    """Monitor ComfyUI progress for video generation with detailed progress tracking"""
    try:
        logger.info(f"👁️ Starting video generation progress monitoring for job: {job_id}")
        
        max_wait_time = 600  # 10 minutes for video generation  
        start_time = time.time()
        last_webhook_time = 0
        
        # Progress stages for video generation
        progress_stages = {
            'starting': {'message': '🚀 Initializing video generation...'},
            'loading_models': {'message': '📦 Loading video models...'},
            'processing_image': {'message': '🖼️ Processing input image...'},
            'generating_frames': {'message': '🎬 Generating video frames...'},
            'encoding_video': {'message': '🎞️ Encoding final video...'},
            'saving': {'message': '💾 Saving video file...'}
        }
        
        current_stage = 'starting'
        progress = 5
        message = progress_stages['starting']['message']
        
        # Send initial progress update
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "PROCESSING",
                "progress": progress,
                "message": message,
                "stage": current_stage,
                "estimatedTimeRemaining": max_wait_time
            })
        
        while time.time() - start_time < max_wait_time:
            try:
                current_time = time.time()
                elapsed_time = current_time - start_time
                
                # Check ComfyUI queue and progress
                try:
                    queue_response = requests.get("http://127.0.0.1:8188/queue", timeout=10)
                    if queue_response.status_code == 200:
                        queue_data = queue_response.json()
                        
                        running_jobs = queue_data.get('queue_running', [])
                        pending_jobs = queue_data.get('queue_pending', [])
                        
                        job_in_running = any(job[1] == prompt_id for job in running_jobs)
                        job_in_pending = any(job[1] == prompt_id for job in pending_jobs)
                        
                        if job_in_pending:
                            # Job is waiting in queue
                            queue_position = next((i+1 for i, job in enumerate(pending_jobs) if job[1] == prompt_id), 0)
                            progress = max(2, min(8, 2 + (queue_position * 2)))
                            message = f'⏳ Video job queued (position {queue_position})'
                            current_stage = 'starting'
                            
                        elif job_in_running:
                            # Job is actively running - use time-based progress for video
                            elapsed_minutes = elapsed_time / 60
                            if elapsed_minutes < 1:
                                current_stage = 'loading_models'
                                progress = 20
                            elif elapsed_minutes < 2:
                                current_stage = 'processing_image'
                                progress = 30
                            elif elapsed_minutes < 7:
                                current_stage = 'generating_frames'
                                progress = min(70, 30 + (elapsed_minutes - 2) * 8)
                            else:
                                current_stage = 'encoding_video'
                                progress = min(85, 70 + (elapsed_minutes - 7) * 3)
                            
                            message = progress_stages[current_stage]['message']
                        else:
                            # Job not in queue, check for completion
                            history_response = requests.get("http://127.0.0.1:8188/history", timeout=10)
                            if history_response.status_code == 200:
                                history_data = history_response.json()
                                
                                for hist_prompt_id, job_data in history_data.items():
                                    is_our_job = hist_prompt_id == prompt_id
                                    
                                    if not is_our_job:
                                        prompt_data = job_data.get('prompt', [])
                                        if len(prompt_data) >= 2 and isinstance(prompt_data[1], dict):
                                            is_our_job = prompt_data[1].get('client_id') == job_id
                                    
                                    if is_our_job and isinstance(job_data, dict):
                                        status = job_data.get('status', {})
                                        if isinstance(status, dict) and status.get('status_str') == 'success':
                                            logger.info(f"✅ Video generation completed for job: {job_id}")
                                            
                                            # Extract and download videos
                                            videos = []
                                            webhook_videos = []
                                            outputs = job_data.get('outputs', {})
                                            
                                            # Debug: log the actual output structure
                                            logger.info(f"🔍 ComfyUI outputs structure: {list(outputs.keys())}")
                                            for node_id, output in outputs.items():
                                                logger.info(f"🔍 Node {node_id} output keys: {list(output.keys()) if isinstance(output, dict) else type(output)}")
                                            
                                            for node_id, output in outputs.items():
                                                # Check for videos in multiple possible output keys
                                                video_keys = ['gifs', 'videos', 'animations', 'mp4', 'webm', 'mov', 'avi']
                                                found_videos = False
                                                
                                                # First, check standard video keys
                                                for video_key in video_keys:
                                                    if video_key in output:
                                                        logger.info(f"🎬 Found videos under key '{video_key}' in node {node_id}")
                                                        found_videos = True
                                                        for vid_info in output[video_key]:
                                                            # Download video as bytes (not base64)
                                                            video_bytes = get_video_bytes_from_comfyui(
                                                                vid_info['filename'],
                                                                vid_info.get('subfolder', ''),
                                                                vid_info.get('type', 'output')
                                                            )
                                                            
                                                            if video_bytes:
                                                                # Save to S3
                                                                s3_key = save_video_to_s3(
                                                                    vid_info['filename'],
                                                                    video_bytes,
                                                                    user_id,
                                                                    vid_info.get('subfolder', '')
                                                                )
                                                                
                                                                # Save to network volume
                                                                network_path = save_video_to_network_volume(
                                                                    vid_info['filename'],
                                                                    video_bytes,
                                                                    user_id,
                                                                    vid_info.get('subfolder', ''),
                                                                    vid_info.get('type', 'output')
                                                                )
                                                                
                                                                if s3_key:
                                                                    webhook_videos.append({
                                                                        'filename': vid_info['filename'],
                                                                        'subfolder': vid_info.get('subfolder', ''),
                                                                        'type': vid_info.get('type', 'output'),
                                                                        's3Key': s3_key,
                                                                        'networkVolumePath': network_path,
                                                                        'fileSize': len(video_bytes)
                                                                    })
                                                                    logger.info(f"✅ Successfully processed video with S3: {vid_info['filename']}")
                                                                else:
                                                                    logger.error(f"❌ Failed to save video to S3: {vid_info['filename']}")
                                                            else:
                                                                logger.error(f"❌ Failed to get video data for: {vid_info['filename']}")
                                                
                                                # Check if 'images' key contains video files (SaveVideo node case)
                                                if 'images' in output and isinstance(output['images'], list):
                                                    logger.info(f"🔍 Checking 'images' key in node {node_id} for video files")
                                                    for img_info in output['images']:
                                                        if isinstance(img_info, dict) and 'filename' in img_info:
                                                            filename = img_info['filename']
                                                            # Check if this is actually a video file
                                                            video_extensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.gif']
                                                            if any(filename.lower().endswith(ext) for ext in video_extensions):
                                                                logger.info(f"🎬 Found video file in images: {filename}")
                                                                found_videos = True
                                                                
                                                                # Download video as bytes (not base64)
                                                                video_bytes = get_video_bytes_from_comfyui(
                                                                    filename,
                                                                    img_info.get('subfolder', ''),
                                                                    img_info.get('type', 'output')
                                                                )
                                                                
                                                                if video_bytes:
                                                                    # Save to S3
                                                                    s3_key = save_video_to_s3(
                                                                        filename,
                                                                        video_bytes,
                                                                        user_id,
                                                                        img_info.get('subfolder', '')
                                                                    )
                                                                    
                                                                    # Save to network volume
                                                                    network_path = save_video_to_network_volume(
                                                                        filename,
                                                                        video_bytes,
                                                                        user_id,
                                                                        img_info.get('subfolder', ''),
                                                                        img_info.get('type', 'output')
                                                                    )
                                                                    
                                                                    if s3_key:
                                                                        webhook_videos.append({
                                                                            'filename': filename,
                                                                            'subfolder': img_info.get('subfolder', ''),
                                                                            'type': img_info.get('type', 'output'),
                                                                            's3Key': s3_key,
                                                                            'networkVolumePath': network_path,
                                                                            'fileSize': len(video_bytes)
                                                                        })
                                                                        logger.info(f"✅ Successfully processed video from images with S3: {filename}")
                                                                    else:
                                                                        logger.error(f"❌ Failed to save video to S3: {filename}")
                                                                else:
                                                                    logger.error(f"❌ Failed to get video data for: {filename}")
                                                
                                                # If no videos found in standard keys, check if this node might contain video info
                                                if not found_videos and isinstance(output, dict):
                                                    # Log the entire output structure for debugging
                                                    logger.info(f"🔍 Node {node_id} full output: {output}")
                                                
                                                # Also check for individual video file entries (direct node output)
                                                if isinstance(output, dict) and 'filename' in output and 'subfolder' in output:
                                                    filename = output['filename']
                                                    video_extensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.gif']
                                                    if any(filename.lower().endswith(ext) for ext in video_extensions):
                                                        logger.info(f"🎬 Found direct video output: {filename}")
                                                        
                                                        # Download video as bytes (not base64)
                                                        video_bytes = get_video_bytes_from_comfyui(
                                                            filename,
                                                            output.get('subfolder', ''),
                                                            output.get('type', 'output')
                                                        )
                                                        
                                                        if video_bytes:
                                                            # Save to S3
                                                            s3_key = save_video_to_s3(
                                                                filename,
                                                                video_bytes,
                                                                user_id,
                                                                output.get('subfolder', '')
                                                            )
                                                            
                                                            # Save to network volume
                                                            network_path = save_video_to_network_volume(
                                                                filename,
                                                                video_bytes,
                                                                user_id,
                                                                output.get('subfolder', ''),
                                                                output.get('type', 'output')
                                                            )
                                                            
                                                            if s3_key:
                                                                webhook_videos.append({
                                                                    'filename': filename,
                                                                    'subfolder': output.get('subfolder', ''),
                                                                    'type': output.get('type', 'output'),
                                                                    's3Key': s3_key,
                                                                    'networkVolumePath': network_path,
                                                                    'fileSize': len(video_bytes)
                                                                })
                                                                logger.info(f"✅ Successfully processed direct video with S3: {filename}")
                                                            else:
                                                                logger.error(f"❌ Failed to save direct video to S3: {filename}")
                                            
                                            # Send completion webhook using network_volume_paths format (no blob data)
                                            if webhook_url:
                                                send_webhook(webhook_url, {
                                                    "job_id": job_id,
                                                    "status": "COMPLETED",
                                                    "progress": 100,
                                                    "message": "Video generation completed successfully! 🎉",
                                                    "network_volume_paths": webhook_videos,  # Use this instead of 'videos'
                                                    "totalTime": int(elapsed_time)
                                                })
                                            
                                            return {
                                                'success': True,
                                                'status': 'completed',
                                                'videos': webhook_videos  # Return S3 metadata instead of blob data
                                            }
                                            
                                        elif isinstance(status, dict) and status.get('status_str') == 'error':
                                            error_msg = f"Video generation failed: {status.get('messages', ['Unknown error'])}"
                                            logger.error(f"❌ {error_msg}")
                                            
                                            if webhook_url:
                                                send_webhook(webhook_url, {
                                                    "job_id": job_id,
                                                    "status": "FAILED",
                                                    "progress": 0,
                                                    "message": error_msg,
                                                    "error": error_msg
                                                })
                                            
                                            return {
                                                'success': False,
                                                'status': 'failed',
                                                'error': error_msg
                                            }
                            break
                            
                except Exception as queue_error:
                    logger.warning(f"⚠️ Error checking video queue status: {queue_error}")
                    # Continue with basic time-based progress
                    elapsed_minutes = elapsed_time / 60
                    progress = min(85, 15 + elapsed_minutes * 10)
                    message = '🎬 Generating video...'
                    current_stage = 'generating_frames'
                
                # Send progress webhook updates (every 5 seconds)
                if webhook_url and (current_time - last_webhook_time) >= 5:
                    estimated_remaining = max(0, max_wait_time - elapsed_time)
                    
                    send_webhook(webhook_url, {
                        "job_id": job_id,
                        "status": "PROCESSING", 
                        "progress": int(progress),
                        "message": message,
                        "stage": current_stage,
                        "elapsedTime": int(elapsed_time),
                        "estimatedTimeRemaining": int(estimated_remaining)
                    })
                    last_webhook_time = current_time
                
                time.sleep(3)  # Check every 3 seconds for video generation
                
            except Exception as e:
                logger.warning(f"⚠️ Error checking video progress: {e}")
                time.sleep(3)
        
        # Timeout
        error_msg = f"Video generation timeout after {max_wait_time} seconds"
        logger.error(f"⏰ {error_msg}")
        
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
        
        return {
            "success": False,
            "status": "timeout",
            "error": error_msg
        }
        
    except Exception as e:
        logger.error(f"❌ Error monitoring video progress: {e}")
        
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "error": f"Monitoring error: {str(e)}",
                "message": f"Video generation failed: {str(e)}"
            })
        
        return {
            "success": False,
            "status": "error",
            "error": f"Monitoring error: {str(e)}"
        }

def run_image_to_video_generation(job_input, job_id, webhook_url):
    """Execute the actual image-to-video generation process"""
    logger.info(f"🎬 Starting image-to-video generation for job: {job_id}")
    
    try:
        # Send initial webhook
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "PROCESSING",
            "progress": 5,
            "message": "Starting video generation..."
        })
        
        # Download the image with unique name to avoid caching
        params = job_input.get('params', {})
        uploaded_image = params.get('uploadedImage')
        final_image_filename = uploaded_image  # Default to original filename
        
        if uploaded_image:
            # Check if base64 data is available for debugging
            has_base64_data = any(key in job_input for key in ['originalImageData', 'referenceImageData', 'imageData'])
            logger.info(f"📥 Preparing uploaded image: {uploaded_image} (has base64 data: {has_base64_data})")
            
            # Download with unique filename to prevent caching issues
            success, unique_filename = download_image_with_unique_name(uploaded_image, job_input)
            if not success:
                error_msg = f"Failed to download image: {uploaded_image}"
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "progress": 0,
                    "error": error_msg,
                    "message": error_msg
                })
                return {"status": "failed", "error": error_msg}
            
            # Use the unique filename in the workflow
            final_image_filename = unique_filename
            logger.info(f"🎯 Using unique filename: {final_image_filename}")
        
        # Get and update workflow with the correct uploaded image filename
        workflow = job_input.get('workflow', {})
        
        # Debug workflow and uploaded image info
        logger.info(f"🔍 DEBUG: final_image_filename = {final_image_filename}")
        logger.info(f"🔍 DEBUG: workflow keys = {list(workflow.keys())}")
        if "56" in workflow:
            logger.info(f"🔍 DEBUG: workflow[56] before update = {workflow['56']}")
        if "131" in workflow:
            logger.info(f"🔍 DEBUG: workflow[131] before update = {workflow['131']}")
        
        # Update node 56 (LoadImage) with the correct uploaded image filename
        if final_image_filename and "56" in workflow:
            logger.info(f"🔄 Updating workflow node 56 with final image filename: {final_image_filename}")
            workflow["56"]["inputs"]["image"] = final_image_filename
            logger.info(f"✅ Updated workflow node 56 inputs: {workflow['56']['inputs']}")
        else:
            logger.warning(f"⚠️ Cannot update workflow: final_image_filename={final_image_filename}, has_node_56={'56' in workflow}")
            if not final_image_filename:
                logger.error("❌ No final image filename!")
            if "56" not in workflow:
                logger.error(f"❌ Node 56 not found in workflow! Available nodes: {list(workflow.keys())}")
        
        # Update node 131 (SaveVideo) with unique filename to prevent caching
        if "131" in workflow:
            import time
            timestamp = int(time.time() * 1000)
            # Keep the video/ComfyUI subfolder structure but make the filename unique
            unique_video_prefix = f"video/ComfyUI/wan2_video_{job_id}_{timestamp}"
            logger.info(f"🔄 Updating workflow node 131 with unique video filename: {unique_video_prefix}")
            workflow["131"]["inputs"]["filename_prefix"] = unique_video_prefix
            logger.info(f"✅ Updated workflow node 131 inputs: {workflow['131']['inputs']}")
        else:
            logger.warning("⚠️ Node 131 (SaveVideo) not found in workflow!")
        
        if not validate_video_workflow(workflow):
            error_msg = "Invalid workflow for image-to-video generation"
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
            return {"status": "failed", "error": error_msg}
        
        # Prepare environment (reuse existing function)
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "PROCESSING",
            "progress": 10,
            "message": "Preparing ComfyUI environment..."
        })
        
        if not prepare_comfyui_environment():
            error_msg = "Failed to prepare ComfyUI environment"
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
            return {"status": "failed", "error": error_msg}
        
        # Start ComfyUI (reuse existing function)
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "PROCESSING",
            "progress": 15,
            "message": "Starting ComfyUI server..."
        })
        
        # Check if ComfyUI is already running before starting
        if not is_comfyui_running():
            if not start_comfyui():
                error_msg = "Failed to start ComfyUI server"
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "progress": 0,
                    "error": error_msg,
                    "message": error_msg
                })
                return {"status": "failed", "error": error_msg}
        else:
            print("🔄 ComfyUI already running, skipping startup")
        
        # Queue the workflow (reuse existing function)
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "PROCESSING",
            "progress": 20,
            "message": "Queueing video generation workflow..."
        })
        
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        if not prompt_id:
            error_msg = "Failed to queue workflow with ComfyUI"
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
            return {"status": "failed", "error": error_msg}
        
        # Monitor progress and get result
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "PROCESSING",
            "progress": 25,
            "message": "Video generation started, monitoring progress..."
        })
        
        result = monitor_video_generation_progress(prompt_id, job_id, webhook_url, job_input.get('user_id', 'default_user'))
        return result
        
    except Exception as e:
        logger.error(f"❌ Image-to-video generation failed: {e}")
        
        # Send failure webhook
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "error": str(e),
                "message": f"Video generation failed: {str(e)}"
            })
        
        return {"status": "failed", "error": str(e)}

def handler(job):
    """RunPod serverless handler for image-to-video generation"""
    job_input = job['input']
    
    # Generate job ID
    job_id = job_input.get('job_id', f"video_{int(time.time())}")
    
    # Get webhook URL
    webhook_url = job_input.get('webhook_url')
    
    logger.info(f"🎬 Starting RunPod Image-to-Video handler for job: {job_id}")
    
    try:
        result = run_image_to_video_generation(job_input, job_id, webhook_url)
        
        # Return result
        return {
            'success': result.get('success', False),
            'job_id': job_id,
            'status': result.get('status', 'unknown'),
            'videos': result.get('videos', []),
            'error': result.get('error'),
            'message': result.get('message', 'Video generation completed')
        }
    
    except Exception as e:
        logger.error(f"❌ Handler error: {e}")
        
        # Send failure webhook
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "error": str(e),
                "message": f"Handler error: {str(e)}"
            })
        
        return {
            'success': False,
            'job_id': job_id,
            'status': 'failed',
            'error': str(e)
        }

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎬 Starting RunPod Image-to-Video handler...")
    runpod.serverless.start({"handler": handler})