#!/usr/bin/env python3
"""
RunPod Serverless Handler for Text-to-Image Generation using ComfyUI
Supports:
- Text-to-Image generation (FLUX)
- LoRA uploads to network volume
- S3 API for network volume storage
- Webhook integration with retry logic
- Comprehensive progress tracking
- Error handling and recovery
"""

import os
import sys
import time
import json
import uuid
import base64
import requests
import subprocess
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from urllib.parse import urlparse, parse_qs
import tempfile
import shutil

# S3 imports
import boto3
from botocore.exceptions import ClientError

def get_s3_client():
    s3_access_key = os.getenv('RUNPOD_S3_ACCESS_KEY')
    s3_secret_key = os.getenv('RUNPOD_S3_SECRET_KEY')
    
    if not s3_access_key or not s3_secret_key:
        print("❌ S3 credentials not found in environment variables")
        print(f"Looking for: RUNPOD_S3_ACCESS_KEY")
        print(f"Looking for: RUNPOD_S3_SECRET_KEY")
        return None

import os
import sys
import json
import time
import base64
import logging
import requests
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

def save_image_to_s3(filename: str, image_data: bytes, user_id: str, subfolder: str = '') -> str:
    """Save image to S3 network volume and return the S3 key"""
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
        
        logger.info(f"📤 Uploading image to S3: {s3_key}")
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=image_data,
            ContentType='image/png'
        )
        
        logger.info(f"✅ Image uploaded to S3: s3://{S3_BUCKET}/{s3_key}")
        return s3_key
            
    except ClientError as e:
        logger.error(f"❌ S3 upload error for {filename}: {e}")
        return ""
    except Exception as e:
        logger.error(f"❌ Error uploading image to S3 {filename}: {str(e)}")
        return ""

def send_webhook(webhook_url: str, data: Dict) -> bool:
    """Send webhook update to your website"""
    if not webhook_url:
        return False
        
    try:
        # Add headers for ngrok compatibility
        headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'RunPod-AI-Toolkit/1.0'
        }
        
        response = requests.post(webhook_url, json=data, headers=headers, timeout=120)
        response.raise_for_status()
        logger.info(f"✅ Webhook sent: {data.get('message', 'No message')}")
        return True
    except Exception as e:
        logger.error(f"❌ Webhook failed: {e}")
        return False

def validate_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure"""
    try:
        if not isinstance(workflow, dict):
            logger.error("Workflow must be a dictionary")
            return False
        
        # Check for required nodes
        required_nodes = ["1", "2", "3", "4", "5", "6", "12", "13"]  # Basic nodes for FLUX generation
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"Missing required node: {node_id}")
                return False
        
        # Validate node structure
        for node_id, node in workflow.items():
            if not isinstance(node, dict) or 'class_type' not in node or 'inputs' not in node:
                logger.error(f"Invalid node structure for node {node_id}")
                return False
                
        # Check for proper FLUX configuration
        if "UNETLoader" not in [node.get("class_type") for node in workflow.values()]:
            logger.error("No UNETLoader found in workflow")
            return False
        
        logger.info("✅ Workflow validation passed")
        return True
    
    except Exception as e:
        logger.error(f"❌ Workflow validation error: {e}")
        return False

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
            print("✅ ComfyUI is already running, skipping startup")
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
            if not os.path.exists(dir_path):
                missing_models.append(dir_name)
            else:
                # Check if directory has files
                files = os.listdir(dir_path)
                if not files:
                    missing_models.append(f"{dir_name} (empty)")
        
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
            "--disable-auto-launch"  # Disable browser launch in serverless environment
        ]
        
        print(f"🔧 Starting ComfyUI with command: {' '.join(cmd)}")
        
        def log_output(process, stream_name):
            try:
                for line in iter(process.stdout.readline, b''):
                    print(f"[ComfyUI] {line.decode('utf-8', errors='ignore').strip()}")
            except Exception as e:
                print(f"Error reading {stream_name}: {e}")
        
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
            try:
                response = requests.get("http://localhost:8188/system_stats", timeout=5)
                if response.status_code == 200:
                    print(f"✅ ComfyUI started successfully after {i+1} seconds")
                    
                    # Additional verification - check if queue endpoint is available
                    queue_response = requests.get("http://localhost:8188/queue", timeout=5)
                    if queue_response.status_code == 200:
                        print("✅ ComfyUI queue endpoint is ready")
                        return True
                    else:
                        print(f"⚠️ ComfyUI queue endpoint not ready yet: {queue_response.status_code}")
                        
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(1)
            
            # Log progress every 30 seconds
            if (i + 1) % 30 == 0:
                print(f"⏳ Still waiting for ComfyUI... ({i+1}/{max_wait}s)")
            
        print(f"❌ ComfyUI failed to start within {max_wait} seconds")
        return False
        
    except Exception as e:
        print(f"❌ Error starting ComfyUI: {str(e)}")
        return False

def queue_workflow_with_comfyui(workflow: Dict, job_id: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"🎬 Queueing workflow with ComfyUI for job {job_id}")
        
        # Log LoRA information if present in workflow
        if "14" in workflow and "inputs" in workflow["14"]:
            lora_node = workflow["14"]
            lora_name = lora_node["inputs"].get("lora_name", "unknown")
            strength_model = lora_node["inputs"].get("strength_model", "unknown")
            strength_clip = lora_node["inputs"].get("strength_clip", "unknown")
            
            logger.info(f"🎨 LoRA Configuration:")
            logger.info(f"  📁 LoRA Name: {lora_name}")
            logger.info(f"  💪 Model Strength: {strength_model}")
            logger.info(f"  📎 CLIP Strength: {strength_clip}")
            
            # LoRA path should be used as-is since ComfyUI expects the full path with subdirectories
            logger.info(f"✅ Using LoRA path as-is: {lora_name}")
        
        # ComfyUI API endpoint
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        queue_url = f"{comfyui_url}/prompt"
        
        # Debug: Show the workflow being sent
        logger.info("🔍 === WORKFLOW DEBUG ===")
        
        # Find LoRA nodes in workflow
        lora_nodes_found = 0
        for node_id, node in workflow.items():
            node_class = node.get("class_type", "unknown")
            
            if node_class == "LoraLoader":
                lora_nodes_found += 1
                lora_name = node.get("inputs", {}).get("lora_name", "unknown")
                strength_model = node.get("inputs", {}).get("strength_model", "unknown")
                strength_clip = node.get("inputs", {}).get("strength_clip", "unknown")
                
                logger.info(f"🔍 Found LoRA node {node_id}:")
                logger.info(f"  📁 Name: {lora_name}")
                logger.info(f"  💪 Model Strength: {strength_model}")
                logger.info(f"  📎 CLIP Strength: {strength_clip}")
        
        logger.info(f"📊 Total LoRA nodes found in workflow: {lora_nodes_found}")
        
        # Show complete workflow for debugging
        logger.info(f"🔧 Complete workflow JSON: {json.dumps(workflow, indent=2)}")
        
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
            logger.error(f"❌ No prompt_id returned: {result}")
            return None
        
        logger.info(f"✅ Workflow queued successfully with prompt_id: {prompt_id}")
        return prompt_id
    
    except Exception as e:
        logger.error(f"❌ ComfyUI queue error: {e}")
        return None

def save_image_to_network_volume(filename: str, image_data: bytes, user_id: str, subfolder: str = '', type_dir: str = 'output') -> str:
    """Save image to network volume storage and return the file path"""
    try:
        # Create user-specific output directory
        user_output_dir = f"/runpod-volume/outputs/{user_id}"
        os.makedirs(user_output_dir, exist_ok=True)
        
        # Create subfolder if specified
        if subfolder:
            full_output_dir = os.path.join(user_output_dir, subfolder)
            os.makedirs(full_output_dir, exist_ok=True)
        else:
            full_output_dir = user_output_dir
        
        # Save the image file
        file_path = os.path.join(full_output_dir, filename)
        with open(file_path, 'wb') as f:
            f.write(image_data)
        
        logger.info(f"✅ Image saved to network volume: {file_path}")
        return file_path
            
    except Exception as e:
        logger.error(f"❌ Error saving image to network volume {filename}: {str(e)}")
        return ""

def get_image_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> str:
    """Download image from ComfyUI and return as base64 encoded string"""
    try:
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        
        # Build URL parameters
        params = {
            'filename': filename,
            'subfolder': subfolder,
            'type': type_dir
        }
        
        view_url = f"{comfyui_url}/view"
        
        # Download the image
        response = requests.get(view_url, params=params, timeout=30)
        response.raise_for_status()
        
        # Convert to base64
        image_data = response.content
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        return image_base64
            
    except Exception as e:
        logger.error(f"❌ Error downloading image {filename}: {str(e)}")
        return ""

def monitor_comfyui_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = None) -> Dict:
    """Monitor ComfyUI progress and return final result with detailed progress"""
    try:
        logger.info(f"👁️ Starting progress monitoring for job: {job_id}, user: {user_id}")
        
        max_wait_time = 600  # 10 minutes
        start_time = time.time()
        last_webhook_time = 0
        
        # Progress stages
        progress_stages = {
            'starting': {'message': '🚀 Initializing generation...'},
            'loading_models': {'message': '📦 Loading AI models...'},
            'processing_prompt': {'message': '📝 Processing text prompt...'},
            'generating': {'message': '🎨 Generating image...'},
            'saving': {'message': '💾 Saving results...'}
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
                        
                        # Check if our job is in the running queue
                        running_queue = queue_data.get('queue_running', [])
                        pending_queue = queue_data.get('queue_pending', [])
                        
                        found_in_running = any(item[1] == prompt_id for item in running_queue if len(item) > 1)
                        found_in_pending = any(item[1] == prompt_id for item in pending_queue if len(item) > 1)
                        
                        if found_in_running:
                            if current_stage != 'generating':
                                current_stage = 'generating'
                                message = progress_stages['generating']['message']
                                progress = min(progress + 10, 80)
                        elif found_in_pending:
                            if current_stage != 'loading_models':
                                current_stage = 'loading_models'
                                message = progress_stages['loading_models']['message']
                                progress = min(progress + 5, 30)
                        
                except Exception as queue_error:
                    logger.warning(f"⚠️ Could not check ComfyUI queue: {queue_error}")
                
                # Check for completed results
                try:
                    history_response = requests.get(f"http://127.0.0.1:8188/history/{prompt_id}", timeout=10)
                    if history_response.status_code == 200:
                        history_data = history_response.json()
                        
                        if prompt_id in history_data:
                            job_history = history_data[prompt_id]
                            
                            # Check if job is completed
                            if 'outputs' in job_history:
                                current_stage = 'saving'
                                message = progress_stages['saving']['message']
                                progress = 95
                                
                                # Send near-completion webhook
                                if webhook_url and current_time - last_webhook_time > 3:
                                    send_webhook(webhook_url, {
                                        "job_id": job_id,
                                        "status": "PROCESSING",
                                        "progress": progress,
                                        "message": message,
                                        "stage": current_stage,
                                        "elapsedTime": elapsed_time,
                                        "estimatedTimeRemaining": 5
                                    })
                                    last_webhook_time = current_time
                                
                                # Extract results and save to network volume
                                outputs = job_history['outputs']
                                image_results = []
                                network_volume_paths = []
                                total_images = 0
                                
                                # First count total images expected
                                for node_id, output in outputs.items():
                                    if 'images' in output:
                                        total_images += len(output['images'])
                                
                                image_count = 0
                                for node_id, output in outputs.items():
                                    if 'images' in output:
                                        for img_info in output['images']:
                                            filename = img_info.get('filename')
                                            subfolder = img_info.get('subfolder', '')
                                            
                                            if filename:
                                                image_count += 1
                                                logger.info(f"📸 Processing image {image_count} of {total_images}: {filename}")
                                                
                                                # Download image data from ComfyUI
                                                comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
                                                params = {
                                                    'filename': filename,
                                                    'subfolder': subfolder,
                                                    'type': img_info.get('type', 'output')
                                                }
                                                
                                                view_url = f"{comfyui_url}/view"
                                                response = requests.get(view_url, params=params, timeout=30)
                                                
                                                if response.status_code == 200:
                                                    image_data_bytes = response.content
                                                    
                                                    # Save to S3 network volume if user_id is provided
                                                    if user_id:
                                                        s3_key = save_image_to_s3(
                                                            filename, 
                                                            image_data_bytes, 
                                                            user_id, 
                                                            subfolder
                                                        )
                                                        if s3_key:
                                                            network_volume_paths.append({
                                                                'filename': filename,
                                                                'subfolder': subfolder,
                                                                'type': img_info.get('type', 'output'),
                                                                's3_key': s3_key,
                                                                'network_volume_path': f"/runpod-volume/{s3_key}",  # For compatibility
                                                                'file_size': len(image_data_bytes)
                                                            })
                                                            logger.info(f"✅ Image saved to S3: {s3_key}")
                                                    
                                                    # Only send S3 path info, no base64 data to reduce database consumption
                                                    image_data = {
                                                        'filename': filename,
                                                        'subfolder': subfolder,
                                                        'type': img_info.get('type', 'output'),
                                                        's3_key': s3_key if user_id else None
                                                    }
                                                    image_results.append(image_data)
                                                    
                                                    # Send individual image via webhook (chunked upload)
                                                    if webhook_url and total_images > 1:
                                                        chunk_progress = 95 + (image_count / total_images) * 5  # 95-100% for image processing
                                                        logger.info(f"📤 Sending chunked image {image_count}/{total_images} via webhook")
                                                        send_webhook(webhook_url, {
                                                            "job_id": job_id,
                                                            "status": "IMAGE_READY",
                                                            "progress": chunk_progress,
                                                            "message": f"📸 Image {image_count} of {total_images} ready",
                                                            "stage": "uploading_images",
                                                            "elapsedTime": elapsed_time,
                                                            "imageCount": image_count,
                                                            "totalImages": total_images,
                                                            "image": image_data  # Single image for chunked upload
                                                        })
                                                else:
                                                    logger.error(f"❌ Failed to download image {filename}: {response.status_code}")
                                
                                # Send final completion webhook
                                if webhook_url:
                                    # Generate resultUrls for frontend display
                                    resultUrls = []
                                    for path_data in network_volume_paths:
                                        if path_data.get('s3_key'):
                                            # Create S3 proxy URL for frontend
                                            s3_key_encoded = requests.utils.quote(path_data['s3_key'], safe='')
                                            proxy_url = f"/api/images/s3/{s3_key_encoded}"
                                            resultUrls.append(proxy_url)
                                            logger.info(f"✅ Generated S3 proxy URL: {proxy_url}")
                                    
                                    completion_data = {
                                        "job_id": job_id,
                                        "status": "COMPLETED",
                                        "progress": 100,
                                        "message": f"✅ All {total_images} image{'' if total_images == 1 else 's'} completed!",
                                        "stage": "completed",
                                        "elapsedTime": elapsed_time,
                                        "imageCount": total_images,
                                        "totalImages": total_images,
                                        "network_volume_paths": network_volume_paths,  # S3 paths for database storage
                                        "resultUrls": resultUrls  # S3 proxy URLs for frontend display
                                    }
                                    send_webhook(webhook_url, completion_data)
                                    logger.info(f"📤 Sent completion webhook with {len(network_volume_paths)} network volume paths and {len(resultUrls)} result URLs")
                                
                                return {
                                    "status": "success",
                                    "images": image_results,
                                    "network_volume_paths": network_volume_paths,
                                    "message": f"Text-to-image generation completed successfully - {total_images} image{'' if total_images == 1 else 's'} generated"
                                }
                
                except Exception as history_error:
                    logger.warning(f"⚠️ Could not check ComfyUI history: {history_error}")
                
                # Progressive updates
                if elapsed_time > 60 and current_stage == 'starting':
                    current_stage = 'loading_models'
                    message = progress_stages['loading_models']['message']
                    progress = min(progress + 10, 40)
                elif elapsed_time > 120 and current_stage == 'loading_models':
                    current_stage = 'processing_prompt'
                    message = progress_stages['processing_prompt']['message']
                    progress = min(progress + 10, 50)
                elif elapsed_time > 180 and current_stage == 'processing_prompt':
                    current_stage = 'generating'
                    message = progress_stages['generating']['message']
                    progress = min(progress + 10, 70)
                
                # Estimate remaining time
                estimated_remaining = max(0, max_wait_time - elapsed_time)
                
                # Send periodic webhook updates
                if webhook_url and current_time - last_webhook_time > 5:
                    send_webhook(webhook_url, {
                        "job_id": job_id,
                        "status": "PROCESSING",
                        "progress": progress,
                        "message": message,
                        "stage": current_stage,
                        "elapsedTime": elapsed_time,
                        "estimatedTimeRemaining": estimated_remaining
                    })
                    last_webhook_time = current_time
                
                time.sleep(2)  # Check every 2 seconds
                
            except Exception as loop_error:
                logger.warning(f"⚠️ Error in monitoring loop: {loop_error}")
                time.sleep(5)  # Wait longer on errors
        
        # Timeout reached
        logger.error(f"❌ Monitoring timeout reached for job {job_id}")
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "message": "❌ Generation timeout - please try again",
                "error": "Timeout reached"
            })
        
        return {
            "status": "error",
            "error": "Monitoring timeout reached"
        }
    
    except Exception as e:
        logger.error(f"❌ Monitoring error: {e}")
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "message": "❌ Generation error",
                "error": str(e)
            })
        
        return {
            "status": "error",
            "error": f"Monitoring error: {str(e)}"
        }

def run_text_to_image_generation(job_input, job_id, webhook_url):
    """Execute the actual text-to-image generation process"""
    logger.info(f"🎯 Starting text-to-image generation for job: {job_id}")
    
    try:
        # Validate input
        if 'workflow' not in job_input:
            raise ValueError("No workflow provided")
        
        workflow = job_input['workflow']
        user_id = job_input.get('user_id')  # Extract user_id from job input
        
        # Validate workflow
        if not validate_workflow(workflow):
            raise ValueError("Invalid workflow structure")
        
        # Prepare ComfyUI environment
        if not prepare_comfyui_environment():
            raise Exception("Failed to prepare ComfyUI environment")
        
        # Queue workflow with ComfyUI
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        if not prompt_id:
            raise Exception("Failed to queue workflow with ComfyUI")
        
        # Monitor progress and get results (pass user_id for network volume storage)
        result = monitor_comfyui_progress(prompt_id, job_id, webhook_url, user_id)
        
        if result['status'] == 'success':
            logger.info(f"✅ Text-to-image generation completed for job: {job_id}")
            return {
                'success': True,
                'images': result['images'],
                'network_volume_paths': result.get('network_volume_paths', []),
                'message': 'Text-to-image generation completed successfully'
            }
        else:
            logger.error(f"❌ Text-to-image generation failed for job: {job_id}")
            return {
                'success': False,
                'error': result.get('error', 'Unknown error'),
                'message': 'Text-to-image generation failed'
            }
    
    except Exception as e:
        logger.error(f"❌ Text-to-image generation error: {e}")
        return {
            'success': False,
            'error': str(e),
            'message': 'Text-to-image generation failed'
        }

def upload_lora_to_network_volume(file_data: str, file_name: str, user_id: str) -> Dict:
    """Upload LoRA file to network volume storage"""
    try:
        # Decode base64 file data
        import base64
        file_bytes = base64.b64decode(file_data)
        
        # Create user-specific directory on network volume
        network_volume_path = "/runpod-volume"
        user_lora_dir = os.path.join(network_volume_path, "loras", f"user_{user_id}")
        os.makedirs(user_lora_dir, exist_ok=True)
        
        # Save LoRA file
        file_path = os.path.join(user_lora_dir, file_name)
        with open(file_path, 'wb') as f:
            f.write(file_bytes)
        
        logger.info(f"✅ LoRA uploaded to: {file_path}")
        
        return {
            'success': True,
            'path': file_path,
            'message': f'LoRA {file_name} uploaded successfully'
        }
        
    except Exception as e:
        logger.error(f"❌ LoRA upload error: {e}")
        return {
            'success': False,
            'error': str(e),
            'message': 'LoRA upload failed'
        }

def handler(job):
    """RunPod serverless handler for text-to-image generation and LoRA uploads"""
    job_input = job['input']
    action = job_input.get('action', 'generate')  # Default to generation
    generation_type = job_input.get('generation_type', 'text_to_image')  # Default to text-to-image
    
    # Handle LoRA upload requests
    if action == 'upload_lora':
        logger.info("🎯 Processing LoRA upload request")
        
        file_data = job_input.get('file_data')
        file_name = job_input.get('file_name')
        user_id = job_input.get('user_id')
        
        if not all([file_data, file_name, user_id]):
            return {
                'success': False,
                'error': 'Missing required parameters: file_data, file_name, user_id'
            }
        
        return upload_lora_to_network_volume(file_data, file_name, user_id)
    
    # Handle text-to-image generation (default)
    else:
        logger.info(f"🎯 Processing text-to-image generation request for job: {job_input.get('job_id', 'unknown')}")
        
        job_id = job_input.get('job_id', f'job_{int(time.time())}')
        webhook_url = job_input.get('webhook_url')
        
        return run_text_to_image_generation(job_input, job_id, webhook_url)

# Import runpod at the end to handle potential import issues
try:
    import runpod
except ImportError:
    logger.error("❌ runpod package not found - running in test mode")
    
    # Mock runpod for testing
    class MockRunpod:
        class serverless:
            @staticmethod
            def start(config):
                logger.info("🧪 Mock RunPod handler started (test mode)")
                # In test mode, we could call the handler directly for testing
                pass
    
    runpod = MockRunpod()

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎯 Starting RunPod Text-to-Image handler...")
    runpod.serverless.start({"handler": handler})