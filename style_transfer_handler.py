#!/usr/bin/env python3
"""
RunPod Serverless Handler for Style Transfer using ComfyUI
Handles style transfer generation using Flux Redux
"""

import os
import sys
import json
import time
import uuid
import logging
import requests
import subprocess
import threading
import runpod
import boto3
import base64
from pathlib import Path
from typing import Dict, List, Any, Optional
from botocore.exceptions import ClientError, NoCredentialsError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_image_to_aws_s3(image_data: str, filename: str, user_id: str, subfolder: str = '') -> Optional[tuple]:
    """Upload base64 image data to AWS S3 and return the S3 key and public URL"""
    try:
        # Get AWS S3 credentials from environment
        aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')
        aws_secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
        aws_region = os.environ.get('AWS_REGION', 'us-east-1')
        s3_bucket = os.environ.get('AWS_S3_BUCKET', 'tastycreative')
        
        if not all([aws_access_key, aws_secret_key, s3_bucket]):
            logger.warning("⚠️ AWS S3 credentials not configured, skipping S3 upload")
            logger.warning(f"Missing: AWS_ACCESS_KEY_ID={bool(aws_access_key)}, AWS_SECRET_ACCESS_KEY={bool(aws_secret_key)}, AWS_S3_BUCKET={bool(s3_bucket)}")
            return None
        
        # Initialize AWS S3 client
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region
        )
        
        # Decode base64 image data
        if image_data.startswith('data:image/'):
            # Remove data URL prefix
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        
        # Generate S3 key with organized structure: outputs/{user_id}/{subfolder}/{filename}
        file_extension = filename.split('.')[-1] if '.' in filename else 'png'
        s3_key_parts = ['outputs', user_id]
        if subfolder:
            s3_key_parts.append(subfolder)
        s3_key_parts.append(filename)
        s3_key = '/'.join(s3_key_parts)
        
        # Upload to S3 with proper content type and public access
        content_type = f"image/{file_extension.lower()}"
        if file_extension.lower() == 'jpg':
            content_type = "image/jpeg"
        
        logger.info(f"📤 Uploading image to AWS S3: {s3_key}")
        
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=s3_key,
            Body=image_bytes,
            ContentType=content_type,
            CacheControl='public, max-age=31536000'  # 1 year cache
            # Removed ACL='public-read' - bucket uses public access policy instead
        )
        
        # Generate public URL
        public_url = f"https://{s3_bucket}.s3.amazonaws.com/{s3_key}"
        
        logger.info(f"✅ Successfully uploaded image to AWS S3: {public_url}")
        return s3_key, public_url
        
    except (ClientError, NoCredentialsError) as e:
        logger.error(f"❌ AWS S3 upload failed: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ Unexpected error during AWS S3 upload: {e}")
        return None

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
            return verify_model_files()
        
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
                missing_models.append(f"Directory: {dir_name}")
            else:
                # List files in each model directory
                files = os.listdir(dir_path)
                if not files:
                    missing_models.append(f"Empty directory: {dir_name}")
                else:
                    print(f"✅ Found {len(files)} model files in {dir_name}/ - {', '.join(files[:3])}{'...' if len(files) > 3 else ''}")
        
        if missing_models:
            print(f"❌ Missing models: {missing_models}")
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
            print(f"❌ ComfyUI main.py not found at {main_py}")
            return False
        
        cmd = [
            sys.executable, main_py, 
            "--listen", "0.0.0.0",
            "--port", "8188",
            "--extra-model-paths-config", "/app/extra_model_paths.yaml",
            "--disable-auto-launch"  # Prevent automatic browser launch
        ]
        
        print(f"🔧 Starting ComfyUI with command: {' '.join(cmd)}")
        
        def log_output(process, stream_name):
            """Log ComfyUI output in real time"""
            for line in iter(process.stdout.readline, b''):
                line_str = line.decode().strip()
                if line_str:
                    print(f"ComfyUI [{stream_name}]: {line_str}")
        
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
        max_wait = 600  # 10 minutes - increased timeout for dependency installation and GPU initialization
        for i in range(max_wait):
            try:
                response = requests.get("http://localhost:8188/system_stats", timeout=5)
                if response.status_code == 200:
                    print("✅ ComfyUI is running!")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            # Check if process died
            if process.poll() is not None:
                print(f"❌ ComfyUI process died with return code: {process.returncode}")
                # Try to read any error output
                try:
                    stdout, stderr = process.communicate(timeout=5)
                    if stdout:
                        print(f"ComfyUI stdout: {stdout.decode()}")
                    if stderr:
                        print(f"ComfyUI stderr: {stderr.decode()}")
                except:
                    pass
                return False
                
            if i % 10 == 0:  # Log every 10 seconds
                print(f"⏳ Still waiting for ComfyUI... ({i}/{max_wait}s)")
            time.sleep(1)
            
        print(f"❌ ComfyUI failed to start within {max_wait} seconds")
        return False
        
    except Exception as e:
        print(f"❌ Error starting ComfyUI: {str(e)}")
        return False

def download_image_for_comfyui(image_filename: str, job_input: dict, base64_key: str = 'referenceImageData', **kwargs) -> bool:
    """Download the uploaded image to ComfyUI's input directory or use base64 data if available
    
    Args:
        image_filename: Name of the image file
        job_input: Job input containing image data
        base64_key: Key to look for base64 data in job_input (default: 'referenceImageData')
        **kwargs: Additional arguments for compatibility (e.g., base64_data parameter)
    """
    try:
        # Handle legacy parameter names for compatibility
        if 'base64_data' in kwargs:
            logger.warning(f"⚠️ Legacy 'base64_data' parameter used, converting to base64_key lookup")
        
        # Check if base64 data is provided directly (new approach)
        if base64_key in job_input and job_input[base64_key]:
            logger.info(f"📦 Using base64 image data directly for {image_filename} (key: {base64_key})")
            
            # Decode base64 data
            import base64
            image_data = base64.b64decode(job_input[base64_key])
            
            # ComfyUI input directory
            comfyui_input_dir = "/app/comfyui/input"
            os.makedirs(comfyui_input_dir, exist_ok=True)
            
            # Target path for the image
            target_path = os.path.join(comfyui_input_dir, image_filename)
            
            # Save base64 image data to file
            with open(target_path, 'wb') as f:
                f.write(image_data)
            
            # Verify the image was saved correctly
            if os.path.exists(target_path):
                file_size = os.path.getsize(target_path)
                logger.info(f"✅ Base64 image saved to ComfyUI input: {target_path} ({file_size} bytes)")
                return True
            else:
                logger.error(f"❌ Failed to save base64 image to: {target_path}")
                return False
        
        # Fallback: Get the uploaded image URL or data (legacy approach)
        params = job_input.get('params', {})
        uploaded_image = params.get('uploadedImage')
        
        if not uploaded_image:
            logger.error("❌ No uploaded image found in job input")
            return False
        
        # ComfyUI input directory
        comfyui_input_dir = "/app/comfyui/input"
        os.makedirs(comfyui_input_dir, exist_ok=True)
        
        # Target path for the image
        target_path = os.path.join(comfyui_input_dir, image_filename)
        
        # If image is a URL, download it
        if uploaded_image.startswith('http'):
            logger.info(f"📥 Downloading image from URL: {uploaded_image}")
            response = requests.get(uploaded_image, timeout=30)
            response.raise_for_status()
            
            with open(target_path, 'wb') as f:
                f.write(response.content)
                
        # If image is a filename, try to construct the public URL and download
        else:
            # Get the base URL from job input or environment
            base_url = job_input.get('base_url')
            if not base_url:
                # Try common base URLs (you may need to adjust this)
                possible_base_urls = [
                    os.environ.get('NEXT_PUBLIC_BASE_URL'),
                    os.environ.get('BASE_URL'),
                    'https://ai.tastycreative.xyz',  # Your production URL
                    'http://localhost:3000'  # Development URL
                ]
                
                for url in possible_base_urls:
                    if url:
                        base_url = url
                        break
            
            if base_url:
                image_url = f"{base_url}/uploads/{uploaded_image}"
                logger.info(f"📥 Downloading image from constructed URL: {image_url}")
                
                try:
                    response = requests.get(image_url, timeout=30)
                    response.raise_for_status()
                    
                    with open(target_path, 'wb') as f:
                        f.write(response.content)
                        
                except requests.exceptions.RequestException as e:
                    logger.error(f"❌ Failed to download from URL {image_url}: {e}")
                    return False
            else:
                logger.error(f"❌ No base URL available to construct image download URL")
                return False
        
        # Verify the image was saved correctly
        if os.path.exists(target_path):
            file_size = os.path.getsize(target_path)
            logger.info(f"✅ Image saved to ComfyUI input: {target_path} ({file_size} bytes)")
            return True
        else:
            logger.error(f"❌ Failed to save image to: {target_path}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error downloading image for ComfyUI: {e}")
        return False

def queue_workflow_with_comfyui(workflow: Dict, job_id: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"🎬 Queueing workflow with ComfyUI for job {job_id}")
        
        # Detect and log multi-LoRA configuration
        lora_nodes = []
        for node_id, node in workflow.items():
            if isinstance(node, dict) and node.get('class_type') in ['LoraLoader', 'LoraLoaderModelOnly']:
                lora_name = node.get('inputs', {}).get('lora_name', 'Unknown')
                strength = node.get('inputs', {}).get('strength_model', 0)
                lora_nodes.append({
                    'node_id': node_id,
                    'name': lora_name,
                    'strength': strength,
                    'type': node.get('class_type')
                })
        
        if lora_nodes:
            logger.info(f"🎨 Multi-LoRA Configuration Detected:")
            for idx, lora in enumerate(lora_nodes, 1):
                logger.info(f"   LoRA {idx}: {lora['name']} (strength: {lora['strength']}, type: {lora['type']}, node: {lora['node_id']})")
        else:
            logger.info("ℹ️  No LoRA models detected in workflow")
        
        # ComfyUI API endpoint (using network volume ComfyUI instance)
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        queue_url = f"{comfyui_url}/prompt"
        
        # Prepare payload with unique client_id to prevent caching
        import time
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
            logger.error(f"❌ No prompt_id in ComfyUI response: {result}")
            return None
        
        logger.info(f"✅ Workflow queued successfully with prompt_id: {prompt_id}")
        return prompt_id
    
    except Exception as e:
        logger.error(f"❌ ComfyUI queue error: {e}")
        return None

def get_image_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> str:
    """Download image from ComfyUI and return as base64 encoded string"""
    try:
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        
        # Construct the image URL
        params = {
            'filename': filename,
            'type': type_dir
        }
        if subfolder:
            params['subfolder'] = subfolder
            
        response = requests.get(f"{comfyui_url}/view", params=params, timeout=30)
        
        if response.status_code == 200:
            # Convert image to base64
            import base64
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            return f"data:image/png;base64,{image_base64}"
        else:
            logger.error(f"Failed to download image {filename}: HTTP {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Error downloading image {filename}: {e}")
        return None

def monitor_comfyui_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = None) -> Dict:
    """Monitor ComfyUI progress and return final result with comprehensive progress tracking"""
    try:
        logger.info(f"🔍 Starting progress monitoring for job: {job_id}")
        
        max_wait_time = 600  # 10 minutes
        start_time = time.time()
        last_webhook_time = 0
        last_progress_check = 0
        
        # Enhanced progress stages with more granular tracking
        progress_stages = {
            'initializing': {'min': 0, 'max': 5, 'message': '🚀 Initializing style transfer workflow...', 'duration': 2},
            'queue_waiting': {'min': 5, 'max': 15, 'message': '⏳ Waiting in processing queue...', 'duration': 5},
            'loading_models': {'min': 15, 'max': 35, 'message': '📦 Loading FLUX and style models...', 'duration': 20},
            'encoding_prompt': {'min': 35, 'max': 45, 'message': '📝 Encoding text prompt and style reference...', 'duration': 8},
            'generating': {'min': 45, 'max': 85, 'message': '🎨 Generating style transfer (step {current_step}/{total_steps})...', 'duration': 40},
            'decoding': {'min': 85, 'max': 95, 'message': '🖼️ Decoding and finalizing image...', 'duration': 8},
            'saving': {'min': 95, 'max': 100, 'message': '💾 Saving and preparing results...', 'duration': 5}
        }
        
        current_stage = 'initializing'
        generation_started = False
        current_step = 0
        total_steps = 40  # Default, will be updated from actual progress
        steps_per_second = 1.8  # Average from logs
        
        # Send initial progress update
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 2,
                'message': progress_stages['initializing']['message'],
                'stage': 'initializing',
                'estimatedTimeRemaining': max_wait_time,
                'currentStep': 0,
                'totalSteps': total_steps,
                'prompt_id': prompt_id
            })
        
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        history_url = f"{comfyui_url}/history/{prompt_id}"
        queue_url = f"{comfyui_url}/queue"
        progress_url = f"{comfyui_url}/progress"
        
        attempt = 0
        max_attempts = 600  # 10 minutes with 1-second intervals
        
        while attempt < max_attempts:
            try:
                current_time = time.time()
                elapsed_time = current_time - start_time
                
                # Check actual ComfyUI progress first
                try:
                    progress_response = requests.get(progress_url, timeout=5)
                    if progress_response.status_code == 200:
                        progress_data = progress_response.json()
                        
                        if progress_data and 'value' in progress_data and 'max' in progress_data:
                            # We have actual generation progress!
                            current_step = progress_data['value']
                            total_steps = progress_data['max']
                            
                            if current_step > 0:
                                generation_started = True
                                current_stage = 'generating'
                                
                                # Calculate progress within generation stage (45-85%)
                                generation_progress = (current_step / total_steps) if total_steps > 0 else 0
                                stage_min = progress_stages['generating']['min']
                                stage_max = progress_stages['generating']['max']
                                progress = stage_min + (generation_progress * (stage_max - stage_min))
                                
                                # Calculate estimated time remaining
                                if current_step > 1:
                                    steps_remaining = total_steps - current_step
                                    estimated_remaining = steps_remaining / steps_per_second
                                    generation_eta = estimated_remaining + 10  # Add buffer for post-processing
                                else:
                                    generation_eta = (total_steps / steps_per_second) + 10
                                
                                message = progress_stages['generating']['message'].format(
                                    current_step=current_step, 
                                    total_steps=total_steps
                                )
                                
                                # Send progress update every 2 steps or every 3 seconds
                                if (current_time - last_progress_check > 3 or 
                                    (current_step > 0 and current_step % 2 == 0)):
                                    
                                    if webhook_url:
                                        send_webhook(webhook_url, {
                                            'job_id': job_id,
                                            'status': 'PROCESSING',
                                            'progress': int(progress),
                                            'message': message,
                                            'stage': 'generating',
                                            'currentStep': current_step,
                                            'totalSteps': total_steps,
                                            'estimatedTimeRemaining': generation_eta,
                                            'stepsPerSecond': round(steps_per_second, 2),
                                            'prompt_id': prompt_id
                                        })
                                    last_progress_check = current_time
                
                except Exception as progress_error:
                    logger.debug(f"Progress check failed (normal during early stages): {progress_error}")
                
                # Check ComfyUI queue status for workflow state
                try:
                    queue_response = requests.get(queue_url, timeout=5)
                    if queue_response.status_code == 200:
                        queue_data = queue_response.json()
                        
                        # Check if our prompt is in the running queue
                        running_queue = queue_data.get('queue_running', [])
                        pending_queue = queue_data.get('queue_pending', [])
                        
                        # Update stage based on queue status
                        if any(item[1] == prompt_id for item in running_queue):
                            if not generation_started:
                                # In running queue but no generation progress yet
                                if current_stage == 'initializing':
                                    current_stage = 'loading_models'
                                elif elapsed_time > 30 and current_stage == 'loading_models':
                                    current_stage = 'encoding_prompt'
                            
                        elif any(item[1] == prompt_id for item in pending_queue):
                            current_stage = 'queue_waiting'
                            queue_position = next(i for i, item in enumerate(pending_queue) if item[1] == prompt_id) + 1
                            estimated_wait = queue_position * 60  # Rough estimate
                            
                            if current_time - last_webhook_time > 10:  # Every 10 seconds for queue updates
                                if webhook_url:
                                    send_webhook(webhook_url, {
                                        'job_id': job_id,
                                        'status': 'PROCESSING',
                                        'progress': progress_stages['queue_waiting']['min'] + 2,
                                        'message': f"⏳ Position {queue_position} in queue...",
                                        'stage': 'queue_waiting',
                                        'queuePosition': queue_position,
                                        'estimatedTimeRemaining': estimated_wait,
                                        'prompt_id': prompt_id
                                    })
                                last_webhook_time = current_time
                        
                        else:
                            # Not in queue, check history for completion
                            history_response = requests.get(history_url, timeout=5)
                            if history_response.status_code == 200:
                                history_data = history_response.json()
                                
                                if prompt_id in history_data:
                                    # Found in history - processing complete or near complete
                                    if current_stage != 'saving':
                                        current_stage = 'decoding'
                                        if webhook_url:
                                            send_webhook(webhook_url, {
                                                'job_id': job_id,
                                                'status': 'PROCESSING',
                                                'progress': 90,
                                                'message': progress_stages['decoding']['message'],
                                                'stage': 'decoding',
                                                'estimatedTimeRemaining': 10,
                                                'prompt_id': prompt_id
                                            })
                                        time.sleep(2)
                                        current_stage = 'saving'
                                    
                                    job_history = history_data[prompt_id]
                                    
                                    if 'outputs' in job_history:
                                        # Extract images from outputs with chunked upload support
                                        images = []
                                        outputs = job_history['outputs']
                                        total_images = 0
                                        
                                        # First count total images expected
                                        for node_id, node_output in outputs.items():
                                            if 'images' in node_output:
                                                total_images += len(node_output['images'])
                                        
                                        image_count = 0
                                        for node_id, node_output in outputs.items():
                                            if 'images' in node_output:
                                                for img_info in node_output['images']:
                                                    original_filename = img_info['filename']
                                                    subfolder = img_info.get('subfolder', '')
                                                    
                                                    # Generate unique filename with same pattern as text-to-image handler
                                                    timestamp = int(time.time() * 1000)  # Milliseconds for uniqueness
                                                    random_number = hash(f"{job_id}{timestamp}") % 1000000000  # Generate consistent random number
                                                    file_extension = original_filename.split('.')[-1] if '.' in original_filename else 'png'
                                                    unique_filename = f"ComfyUI_{timestamp}_{random_number}_{image_count:05d}_.{file_extension}"
                                                    
                                                    image_count += 1
                                                    logger.info(f"🎨 Processing style transfer image {image_count} of {total_images}: {original_filename} -> {unique_filename}")
                                                    
                                                    # Download image and convert to base64
                                                    image_base64 = get_image_from_comfyui(original_filename, subfolder)
                                                    if image_base64:
                                                        # Upload to AWS S3 with unique filename and subfolder, get S3 key + public URL
                                                        aws_result = upload_image_to_aws_s3(image_base64, unique_filename, user_id, subfolder)
                                                        s3_key = None
                                                        public_url = None
                                                        
                                                        if aws_result:
                                                            s3_key, public_url = aws_result
                                                        
                                                        # Database storage monitoring and optimization logging
                                                        image_size_bytes = len(base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64))
                                                        image_size_mb = image_size_bytes / (1024 * 1024)
                                                        
                                                        if s3_key:
                                                            logger.info(f"✅ Image saved to AWS S3: {public_url}")
                                                        else:
                                                            logger.warning(f"⚠️ AWS S3 upload failed for {unique_filename}")
                                                        
                                                        # Create AWS S3-only image data structure (NO blob data - bandwidth optimized)
                                                        image_data = {
                                                            'filename': unique_filename,  # Use unique filename
                                                            'originalFilename': original_filename,  # Keep original for reference
                                                            'subfolder': subfolder,
                                                            'type': img_info.get('type', 'output'),
                                                            'awsS3Key': s3_key,  # AWS S3 key
                                                            'awsS3Url': public_url,  # AWS S3 public URL
                                                            'fileSize': len(base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)),
                                                            'format': file_extension.upper(),
                                                            'createdAt': time.time(),
                                                            'timestamp': timestamp
                                                            # NO 'data' field - pure S3 optimization like text-to-image
                                                        }
                                                        images.append(image_data)
                                                        logger.info(f"✅ Processed style transfer image: {unique_filename}")
                                                        if s3_key:
                                                            logger.info(f"📤 Uploaded to AWS S3: {public_url}")
                                                        
                                                        # Send individual image via webhook (chunked upload) - UPDATED for AWS S3 optimization
                                                        if webhook_url and total_images > 1:
                                                            chunk_progress = 95 + (image_count / total_images) * 5  # 95-100% for image processing
                                                            logger.info(f"📤 Sending chunked style transfer image {image_count}/{total_images} via webhook")
                                                            
                                                            # AWS S3-only image data (NO blob data) - bandwidth optimized
                                                            enhanced_image_data = {
                                                                'filename': image_data['filename'],
                                                                'subfolder': image_data.get('subfolder', ''),
                                                                'type': image_data.get('type', 'output'),
                                                                'awsS3Key': image_data.get('awsS3Key'),  # AWS S3 key for storage
                                                                'awsS3Url': image_data.get('awsS3Url'),  # AWS S3 public URL
                                                                'file_size': image_data.get('fileSize'),
                                                                # NO 'data' field - pure AWS S3 optimization
                                                            }
                                                            
                                                            send_webhook(webhook_url, {
                                                                "job_id": job_id,
                                                                "status": "IMAGE_READY",
                                                                "progress": chunk_progress,
                                                                "message": f"🎨 Style transfer image {image_count} of {total_images} ready",
                                                                "stage": "uploading_images",
                                                                "elapsedTime": elapsed_time,
                                                                "imageCount": image_count,
                                                                "totalImages": total_images,
                                                                "image": enhanced_image_data  # Enhanced image data with S3 optimization info
                                                            })
                                        
                                        if images:
                                            logger.info(f"✅ Style transfer completed with {total_images} image{'' if total_images == 1 else 's'}")
                                            
                                            # Calculate and log database optimization summary (AWS S3 pattern)
                                            total_s3_images = sum(1 for img in images if img.get('awsS3Key'))
                                            total_database_images = total_images - total_s3_images
                                            total_size_mb = sum(img.get('fileSize', 0) for img in images) / (1024 * 1024)
                                            s3_size_mb = sum(img.get('fileSize', 0) for img in images if img.get('awsS3Key')) / (1024 * 1024)
                                            database_size_mb = total_size_mb - s3_size_mb
                                            
                                            logger.info(f"📊 DATABASE OPTIMIZATION SUMMARY:")
                                            logger.info(f"📊 Total images: {total_images} ({total_size_mb:.2f}MB)")
                                            logger.info(f"📊 S3 storage: {total_s3_images} images ({s3_size_mb:.2f}MB) - Database space saved!")
                                            logger.info(f"📊 Database storage: {total_database_images} images ({database_size_mb:.2f}MB)")
                                            if total_s3_images > 0:
                                                optimization_percentage = (s3_size_mb / total_size_mb) * 100 if total_size_mb > 0 else 0
                                                logger.info(f"📊 Storage optimization: {optimization_percentage:.1f}% of data stored in S3 instead of database")
                                            
                                            # Send final completion webhook with enhanced data
                                            if webhook_url:
                                                # Collect all result URLs and S3 data for the database
                                                result_urls = []
                                                s3_keys = []
                                                network_volume_paths = []
                                                
                                                for result in images:
                                                    if result.get('filename'):
                                                        # Use AWS S3 URL instead of legacy ComfyUI URL
                                                        if result.get('awsS3Url'):
                                                            result_urls.append(result['awsS3Url'])
                                                        elif result.get('awsS3Key'):
                                                            # Generate AWS S3 URL from key
                                                            bucket_name = os.environ.get('AWS_S3_BUCKET', 'tastycreative')
                                                            result_url = f"https://{bucket_name}.s3.amazonaws.com/{result['awsS3Key']}"
                                                            result_urls.append(result_url)
                                                        
                                                        # Collect AWS S3 data
                                                        if result.get('awsS3Key'):
                                                            s3_keys.append(result['awsS3Key'])
                                                        # Note: No longer using RunPod networkVolumePath or legacy ComfyUI URLs
                                                
                                                # Build AWS S3 paths array for bandwidth optimization
                                                webhook_aws_s3_paths = []
                                                for i, s3_key in enumerate(s3_keys):
                                                    if s3_key:
                                                        # Get image info from corresponding index
                                                        img_data = images[i] if i < len(images) else {}
                                                        
                                                        webhook_aws_s3_paths.append({
                                                            'filename': img_data.get('filename', f'style_transfer_{i+1}.png'),
                                                            'subfolder': img_data.get('subfolder', ''),
                                                            'type': img_data.get('type', 'output'),
                                                            'awsS3Key': s3_key,  # AWS S3 key
                                                            'awsS3Url': img_data.get('awsS3Url'),  # AWS S3 public URL
                                                            'file_size': img_data.get('fileSize', 0)
                                                        })
                                                
                                                completion_data = {
                                                    "job_id": job_id,
                                                    "status": "COMPLETED", 
                                                    "progress": 100,
                                                    "message": f"✅ All {total_images} style transfer image{'' if total_images == 1 else 's'} completed!",
                                                    "stage": "completed",
                                                    "elapsedTime": elapsed_time,
                                                    "imageCount": total_images,
                                                    "totalImages": total_images,
                                                    "aws_s3_paths": webhook_aws_s3_paths,  # Primary: AWS S3 paths for database storage (bandwidth optimized)
                                                    "resultUrls": result_urls,  # Fallback: ComfyUI URLs for legacy compatibility
                                                    # NO 'images' array - pure AWS S3 optimization
                                                }
                                                send_webhook(webhook_url, completion_data)
                                                logger.info(f"📤 Sent style transfer completion webhook with {len(webhook_aws_s3_paths)} AWS S3 paths and {len(result_urls)} result URLs")
                                            
                                            return {'success': True, 'images': images}
                                        else:
                                            logger.error("❌ No images found in ComfyUI output")
                                            return {'success': False, 'error': 'No images generated'}
                                    else:
                                        logger.error("❌ No outputs found in ComfyUI history")
                                        return {'success': False, 'error': 'No outputs in history'}
                                else:
                                    logger.debug(f"⏳ Job {prompt_id} not yet in history")
                
                except Exception as queue_error:
                    logger.warning(f"⚠️ Queue check failed: {queue_error}")
                
                # Send periodic stage updates for non-generating stages
                if not generation_started and current_time - last_webhook_time > 8:
                    stage_info = progress_stages.get(current_stage, progress_stages['initializing'])
                    base_progress = stage_info['min'] + min(5, elapsed_time // 2)
                    estimated_remaining = max(30, max_wait_time - elapsed_time)
                    
                    if webhook_url:
                        send_webhook(webhook_url, {
                            'job_id': job_id,
                            'status': 'PROCESSING',
                            'progress': int(base_progress),
                            'message': stage_info['message'],
                            'stage': current_stage,
                            'estimatedTimeRemaining': estimated_remaining,
                            'prompt_id': prompt_id
                        })
                    last_webhook_time = current_time
                
                time.sleep(1)
                attempt += 1
                
            except Exception as e:
                logger.warning(f"⚠️ Progress check error: {e}")
                time.sleep(1)
                attempt += 1
        
        logger.error(f"❌ Style transfer timed out after {max_wait_time} seconds")
        return {'success': False, 'error': f'Style transfer timed out after {max_wait_time} seconds'}
        
    except Exception as e:
        logger.error(f"❌ Progress monitoring error: {e}")
        return {'success': False, 'error': f'Progress monitoring error: {str(e)}'}

def validate_style_transfer_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure for style transfer"""
    try:
        if not isinstance(workflow, dict):
            logger.error("Style transfer workflow must be a dictionary")
            return False
        
        # Check for required style transfer nodes (flexible for different implementations)
        required_nodes = ["8", "31", "33", "37", "38", "41", "50", "51", "6", "27", "154", "155"]  # Removed 42, 43, 44 as they may vary
        
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"Missing required style transfer node: {node_id}")
                return False
        
        # Validate node structure
        for node_id, node in workflow.items():
            if not isinstance(node, dict) or 'class_type' not in node or 'inputs' not in node:
                logger.error(f"Invalid style transfer node structure for node {node_id}")
                return False
        
        # Check for style transfer implementation (flexible approach)
        has_style_nodes = False
        
        # Check for StyleModelLoader (Redux approach)
        if any(node.get("class_type") == "StyleModelLoader" for node in workflow.values()):
            has_style_nodes = True
            
        # Check for CLIPVisionEncode approach (alternative)
        if any(node.get("class_type") == "CLIPVisionEncode" for node in workflow.values()):
            has_style_nodes = True
            
        # Check for ConditioningConcat (for combining text and image conditioning)
        if any(node.get("class_type") == "ConditioningConcat" for node in workflow.values()):
            has_style_nodes = True
            
        if not has_style_nodes:
            logger.error("No style transfer implementation found (StyleModelLoader, CLIPVisionEncode, or ConditioningConcat)")
            return False
        
        logger.info("✅ Style transfer workflow validation passed")
        return True
    
    except Exception as e:
        logger.error(f"❌ Style transfer workflow validation error: {e}")
        return False

def adapt_style_transfer_workflow(workflow: Dict) -> Dict:
    """Adapt style transfer workflow to use available nodes if ReduxAdvanced is missing"""
    try:
        # Check if ReduxAdvanced node exists in node 44
        redux_node = workflow.get("44", {})
        if redux_node.get("class_type") == "ReduxAdvanced":
            logger.info("🔄 ReduxAdvanced node detected, attempting to use alternative approach...")
            
            # Replace with proper FLUX Redux workflow
            logger.warning("🔄 Replacing ReduxAdvanced with StyleModelApplyAdvanced")
            
            # Keep node 44 as CLIPVisionEncode
            workflow["44"] = {
                "class_type": "CLIPVisionEncode",
                "inputs": {
                    "clip_vision": redux_node["inputs"]["clip_vision"],
                    "image": redux_node["inputs"]["image"],
                    "crop": "center"  # Add required crop parameter
                }
            }
            
            # Use StyleModelApplyAdvanced to apply the style
            workflow["44_redux"] = {
                "class_type": "StyleModelApplyAdvanced",
                "inputs": {
                    "conditioning": ["6", 0],  # Text conditioning
                    "style_model": ["42", 0],  # Style model
                    "clip_vision_output": ["44", 0],  # CLIPVision output
                    "strength": 0.8,
                    "strength_type": "multiply"
                }
            }
            
            # Update FluxGuidance to use the redux output instead of concat
            if "41" in workflow and "44_concat" in workflow["41"]["inputs"]["conditioning"]:
                workflow["41"]["inputs"]["conditioning"] = ["44_redux", 0]
            
            # Remove the problematic ConditioningConcat node if it exists
            if "44_concat" in workflow:
                del workflow["44_concat"]
                
            logger.info("✅ Successfully adapted workflow to use StyleModelApplyAdvanced")
            
        # Ensure CLIPVisionEncode has crop parameter if it exists
        if "44" in workflow and workflow["44"].get("class_type") == "CLIPVisionEncode":
            if "crop" not in workflow["44"]["inputs"]:
                workflow["44"]["inputs"]["crop"] = "center"
                logger.info("🖼️ Added missing crop parameter to CLIPVisionEncode")
        
        return workflow
        
    except Exception as e:
        logger.error(f"❌ Failed to adapt style transfer workflow: {str(e)}")
        return workflow

def run_style_transfer_generation(job_input, job_id, webhook_url):
    """Execute the actual style transfer generation process"""
    logger.info(f"🎨 Starting style transfer generation for job: {job_id}")
    
    # Extract user_id for S3 organization (matching text-to-image pattern)
    user_id = job_input.get('user_id')
    
    # If no user_id in job_input, try to extract from params or selectedLora
    if not user_id:
        params = job_input.get('params', {})
        selected_lora = params.get('selectedLora', '')
        
        # Extract user_id from LoRA filename pattern: user_{user_id}_timestamp_name.safetensors
        if selected_lora.startswith('user_') and '_' in selected_lora:
            # Split and get the user part: user_30dULT8ZLO1jthhCEgn349cKcvT_1758107677309_OF Essie.safetensors
            parts = selected_lora.split('_')
            if len(parts) >= 2:
                user_id = f"user_{parts[1]}"  # Extract user_30dULT8ZLO1jthhCEgn349cKcvT
                logger.info(f"📋 Extracted user_id from LoRA: {user_id}")
    
    if not user_id:
        logger.warning("⚠️ No user_id provided and couldn't extract from LoRA - S3 uploads will use job_id as fallback")
        user_id = job_id  # Fallback to job_id if user_id not provided
    
    try:
        # Prepare ComfyUI environment
        if not prepare_comfyui_environment():
            error_msg = "Failed to prepare ComfyUI environment for style transfer"
            logger.error(f"💥 {error_msg}")
            if webhook_url:
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "progress": 0,
                    "message": error_msg,
                    "error": error_msg
                })
            return {"success": False, "error": error_msg}
        
        # Validate and adapt workflow for available nodes
        workflow = job_input.get('workflow')
        if not workflow:
            error_msg = "No workflow provided for style transfer"
            logger.error(f"💥 {error_msg}")
            if webhook_url:
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "progress": 0,
                    "message": error_msg,
                    "error": error_msg
                })
            return {"success": False, "error": error_msg}

        # Download reference image if provided
        reference_image_filename = job_input.get('referenceImage')
        if reference_image_filename:
            try:
                logger.info(f"📥 Processing reference image: {reference_image_filename}")
                
                # Use the updated download function that handles base64 data
                if not download_image_for_comfyui(reference_image_filename, job_input):
                    error_msg = f"Failed to download reference image: {reference_image_filename}"
                    logger.error(f"❌ {error_msg}")
                    if webhook_url:
                        send_webhook(webhook_url, {
                            "job_id": job_id,
                            "status": "FAILED", 
                            "progress": 0,
                            "message": error_msg,
                            "error": error_msg
                        })
                    return {"success": False, "error": error_msg}
                
                # Update workflow with the actual filename
                if "155" in workflow:
                    workflow["155"]["inputs"]["image"] = reference_image_filename
                    logger.info(f"🔄 Updated LoadImage node 155 with filename: {reference_image_filename}")
                
                # Handle mask image if provided
                mask_image_filename = job_input.get('maskImage')
                if mask_image_filename and 'maskImageData' in job_input:
                    logger.info(f"📥 Processing mask image: {mask_image_filename}")
                    
                    # Create a temporary job input for mask download
                    mask_job_input = job_input.copy()
                    mask_job_input['referenceImageData'] = job_input.get('maskImageData')
                    
                    if download_image_for_comfyui(mask_image_filename, mask_job_input):
                        # Update workflow with mask filename
                        if "156" in workflow:
                            workflow["156"]["inputs"]["image"] = mask_image_filename
                            logger.info(f"🔄 Updated mask LoadImage node 156 with filename: {mask_image_filename}")
                    else:
                        logger.warning(f"⚠️ Failed to download mask image: {mask_image_filename}")
                    
            except Exception as e:
                logger.error(f"❌ Failed to download reference image: {str(e)}")
                error_msg = f"Failed to download reference image: {str(e)}"
                if webhook_url:
                    send_webhook(webhook_url, {
                        "job_id": job_id,
                        "status": "FAILED",
                        "progress": 0,
                        "message": error_msg,
                        "error": error_msg
                    })
                return {"success": False, "error": error_msg}

        # Adapt workflow to use available nodes
        workflow = adapt_style_transfer_workflow(workflow)
        
        # Fix LoRA paths - transform user LoRA names to include subdirectory structure
        try:
            for node_id, node in workflow.items():
                # Handle both LoraLoader and LoraLoaderModelOnly nodes
                if node.get('class_type') in ['LoraLoader', 'LoraLoaderModelOnly'] and 'inputs' in node:
                    if 'lora_name' in node.get('inputs', {}):
                        lora_name = node['inputs']['lora_name']
                        logger.info(f"🎯 Found LoRA node {node_id} ({node.get('class_type')}): {lora_name}")
                        
                        if lora_name.startswith('user_'):
                            lora_parts = lora_name.split('_')
                            if len(lora_parts) >= 3:
                                lora_base_name = lora_parts[0] + '_' + lora_parts[1]  # user_USERID
                                # Extract the display name from the filename
                                display_name = '_'.join(lora_parts[3:]).replace('.safetensors', '')
                                logger.info(f"🔍 Looking for LoRA: user={lora_base_name}, display_name={display_name}")
                                
                                # Check if user subdirectory exists
                                user_dir_path = f"/runpod-volume/loras/{lora_base_name}"
                                if os.path.isdir(user_dir_path):
                                    user_dir_files = os.listdir(user_dir_path)
                                    logger.info(f"📁 Files in user directory {user_dir_path}: {user_dir_files}")
                                    
                                    # Look for exact match first
                                    if lora_name in user_dir_files:
                                        actual_lora_name = f"{lora_base_name}/{lora_name}"
                                        logger.info(f"🎯 Found exact match: {actual_lora_name}")
                                        workflow[node_id]['inputs']['lora_name'] = actual_lora_name
                                    else:
                                        # Look for a file that matches the display name
                                        found = False
                                        for filename in user_dir_files:
                                            if filename.endswith('.safetensors') and display_name in filename:
                                                actual_lora_name = f"{lora_base_name}/{filename}"
                                                logger.info(f"🎯 Found matching LoRA: {actual_lora_name}")
                                                workflow[node_id]['inputs']['lora_name'] = actual_lora_name
                                                found = True
                                                break
                                        
                                        if not found:
                                            # Fallback: use the first .safetensors file in user directory
                                            safetensors_files = [f for f in user_dir_files if f.endswith('.safetensors')]
                                            if safetensors_files:
                                                actual_lora_name = f"{lora_base_name}/{safetensors_files[0]}"
                                                logger.info(f"🔄 Fallback: using first LoRA in subdirectory: {actual_lora_name}")
                                                workflow[node_id]['inputs']['lora_name'] = actual_lora_name
                                            else:
                                                logger.error(f"❌ No .safetensors files found in {user_dir_path}")
                                else:
                                    logger.warning(f"⚠️ User directory not found: {user_dir_path}")
        except Exception as e:
            logger.error(f"❌ Failed to fix LoRA paths: {str(e)}")
        
        if not validate_style_transfer_workflow(workflow):
            error_msg = "Invalid style transfer workflow structure"
            logger.error(f"💥 {error_msg}")
            if webhook_url:
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "progress": 0,
                    "message": error_msg,
                    "error": error_msg
                })
            return {"success": False, "error": error_msg}
        
        # Send progress update
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "PROCESSING",
                "progress": 10,
                "message": "Environment prepared, starting style transfer generation..."
            })
        
        # Queue workflow with ComfyUI
        logger.info(f"🎨 Queueing style transfer workflow for job {job_id}")
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        
        if not prompt_id:
            error_msg = "Failed to queue style transfer workflow with ComfyUI"
            logger.error(f"💥 {error_msg}")
            if webhook_url:
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "progress": 0,
                    "message": error_msg,
                    "error": error_msg
                })
            return {"success": False, "error": error_msg}
        
        logger.info(f"✅ Style transfer workflow queued with prompt_id: {prompt_id}")
        
        # Send progress update
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "PROCESSING",
                "progress": 30,
                "message": f"Style transfer generation queued (ID: {prompt_id})"
            })
        
        # Monitor progress and get results
        result = monitor_comfyui_progress(prompt_id, job_id, webhook_url, user_id)
        
        if result['success']:
            logger.info(f"✅ Style transfer generation completed for job: {job_id}")
            # Send completion webhook
            if webhook_url:
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "COMPLETED",
                    "progress": 100,
                    "message": "Style transfer generation completed successfully",
                    "images": result.get('images', []),
                    "comfyUIPromptId": prompt_id
                })
            return {
                "success": True,
                "status": "completed",
                "images": result.get('images', []),
                "comfyUIPromptId": prompt_id
            }
        else:
            error_msg = result.get('error', 'Style transfer generation failed')
            logger.error(f"💥 Style transfer generation failed for job: {job_id} - {error_msg}")
            if webhook_url:
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "FAILED",
                    "progress": 0,
                    "message": error_msg,
                    "error": error_msg
                })
            return {"success": False, "error": error_msg}
    
    except Exception as e:
        error_msg = f"Style transfer generation error: {str(e)}"
        logger.error(f"💥 {error_msg}")
        if webhook_url:
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "FAILED",
                "progress": 0,
                "message": error_msg,
                "error": str(e)
            })
        return {"success": False, "error": str(e)}

def handler(job):
    """RunPod serverless handler for style transfer generation"""
    job_input = job['input']
    action = job_input.get('action', 'generate_style_transfer')
    generation_type = job_input.get('generation_type', 'style_transfer')
    
    # Only handle style transfer requests
    if action == 'generate_style_transfer' or generation_type == 'style_transfer':
        job_id = job_input.get('job_id', str(uuid.uuid4()))
        webhook_url = job_input.get('webhook_url')
        
        logger.info(f"🎨 Starting style transfer generation job: {job_id}")
        logger.info(f"📋 Job params: {job_input.get('params', {})}")
        
        if not webhook_url:
            logger.warning("⚠️ No webhook URL provided, updates won't be sent")
        
        try:
            result = run_style_transfer_generation(job_input, job_id, webhook_url)
            
            if result['success']:
                logger.info(f"✅ Style transfer generation completed: {job_id}")
                return {
                    'success': True,
                    'job_id': job_id,
                    'status': 'completed',
                    'images': result.get('images', []),
                    'message': 'Style transfer generation completed successfully'
                }
            else:
                logger.error(f"💥 Style transfer generation job failed: {job_id} - {result.get('error')}")
                return {
                    'success': False,
                    'job_id': job_id,
                    'status': 'failed',
                    'error': result.get('error', 'Unknown error'),
                    'message': 'Style transfer generation failed'
                }
        
        except Exception as e:
            logger.error(f"💥 Style transfer handler error: {e}")
            
            # Send failure webhook
            if webhook_url:
                send_webhook(webhook_url, {
                    'job_id': job_id,
                    'status': 'FAILED',
                    'progress': 0,
                    'message': f'Handler error: {str(e)}',
                    'error': str(e)
                })
            
            return {
                'success': False,
                'job_id': job_id,
                'status': 'failed',
                'error': str(e),
                'message': 'Handler error occurred'
            }
    else:
        # Reject non-style transfer requests
        return {
            'success': False,
            'error': f'Invalid action or generation_type. Expected style_transfer, got action={action}, generation_type={generation_type}',
            'message': 'This handler only supports style transfer generation'
        }

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎨 Starting RunPod Style Transfer handler...")
    runpod.serverless.start({"handler": handler})