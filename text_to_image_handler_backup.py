#!/usr/bin/env python3
"""
RunPod Serverless Handler for Text-to-Image Generation using ComfyUI
Supports:
- Text-to-Image generation (FLUX)
- LoRA uploads to network volume
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
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
            if not isinstance(node, dict):
                logger.error(f"Node {node_id} must be a dictionary")
                return False
            
            if "class_type" not in node:
                logger.error(f"Node {node_id} missing class_type")
                return False
            
            if "inputs" not in node:
                logger.error(f"Node {node_id} missing inputs")
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
        max_wait = 300  # 5 minutes - increased timeout for dependency installation
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
                    print(f"✅ Found {len(files)} files in {dir_name}/ - {', '.join(files[:3])}{'...' if len(files) > 3 else ''}")
        
        if missing_models:
            print(f"❌ Missing models: {missing_models}")
            return False
            
        print("✅ All required model directories found")
        return True
        
    except Exception as e:
        print(f"❌ Error preparing ComfyUI environment: {str(e)}")
        return False

def queue_workflow_with_comfyui(workflow: Dict, job_id: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"🎬 Queueing workflow with ComfyUI for job {job_id}")
        
        # Log LoRA information if present in workflow
        if "14" in workflow and "inputs" in workflow["14"]:
            lora_node = workflow["14"]["inputs"]
            if "lora_name" in lora_node:
                logger.info(f"🎯 LoRA in workflow: {lora_node['lora_name']}")
                logger.info(f"🎯 LoRA strength: {lora_node.get('strength_model', 'N/A')}")
                
                # Check if the LoRA file exists on network volume
                lora_path = f"/runpod-volume/loras/{lora_node['lora_name']}"
                if os.path.exists(lora_path):
                    logger.info(f"✅ LoRA file found: {lora_path}")
                    # List all files in the directory for debugging
                    lora_dir = os.path.dirname(lora_path)
                    if os.path.exists(lora_dir):
                        files_in_dir = os.listdir(lora_dir)
                        logger.info(f"📁 Files in {lora_dir}: {files_in_dir}")
                else:
                    logger.warning(f"⚠️ LoRA file NOT found: {lora_path}")
                    # List what's available in the loras directory
                    loras_base = "/runpod-volume/loras"
                    if os.path.exists(loras_base):
                        subdirs = os.listdir(loras_base)
                        logger.info(f"📁 Available LoRA subdirs: {subdirs}")
                        for subdir in subdirs:
                            subdir_path = os.path.join(loras_base, subdir)
                            if os.path.isdir(subdir_path):
                                files = os.listdir(subdir_path)
                                logger.info(f"📁 Files in {subdir}: {files}")
        
        # ComfyUI API endpoint (using network volume ComfyUI instance)
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        queue_url = f"{comfyui_url}/prompt"
        
        # Debug: Show the workflow being sent
        logger.info("🔍 === WORKFLOW DEBUG ===")
        
        # Find LoRA nodes in workflow
        lora_nodes_found = 0
        for node_id, node in workflow.items():
            if 'lora_name' in node.get('inputs', {}):
                lora_nodes_found += 1
                lora_name = node['inputs']['lora_name']
                logger.info(f"🎯 Found LoRA node {node_id}: {lora_name}")
                
                # Check if this LoRA file actually exists
                full_lora_path = f"/runpod-volume/loras/{lora_name}"
                if os.path.exists(full_lora_path):
                    file_size = os.path.getsize(full_lora_path)
                    logger.info(f"✅ LoRA exists: {full_lora_path} ({file_size} bytes)")
                else:
                    logger.error(f"❌ LoRA missing: {full_lora_path}")
                    
                    # Try to find a matching LoRA file by extracting the display name
                    lora_dir = "/runpod-volume/loras"
                    if os.path.exists(lora_dir):
                        available_files = os.listdir(lora_dir)
                        logger.info(f"📁 Available files in {lora_dir}: {available_files}")
                        
                        # Extract the base user ID from the requested LoRA name
                        # e.g., user_30dULT8ZLO1jthhCEgn349cKcvT_1756718230787_OF_COCO_V3.safetensors -> user_30dULT8ZLO1jthhCEgn349cKcvT
                        if lora_name.startswith('user_'):
                            lora_parts = lora_name.split('_')
                            if len(lora_parts) >= 3:
                                lora_base_name = lora_parts[0] + '_' + lora_parts[1]  # user_USERID
                                # Extract the display name from the filename
                                # e.g., user_30dULT8ZLO1jthhCEgn349cKcvT_1756718230787_OF_COCO_V3.safetensors -> OF_COCO_V3
                                display_name = '_'.join(lora_parts[3:]).replace('.safetensors', '')
                                logger.info(f"🔍 Looking for LoRA: user={lora_base_name}, display_name={display_name}")
                                
                                # First try to find exact match in user subdirectory
                                user_dir_path = f"/runpod-volume/loras/{lora_base_name}"
                                if os.path.isdir(user_dir_path):
                                    user_dir_files = os.listdir(user_dir_path)
                                    logger.info(f"📁 Files in user directory {user_dir_path}: {user_dir_files}")
                                    
                                    # Look for a file that matches the display name
                                    for filename in user_dir_files:
                                        if filename.endswith('.safetensors') and display_name in filename:
                                            actual_lora_name = f"{lora_base_name}/{filename}"
                                            logger.info(f"🎯 Found matching LoRA: {actual_lora_name}")
                                            workflow[node_id]['inputs']['lora_name'] = actual_lora_name
                                            break
                                    else:
                                        # Fallback: use the first .safetensors file in user directory
                                        safetensors_files = [f for f in user_dir_files if f.endswith('.safetensors')]
                                        if safetensors_files:
                                            actual_lora_name = f"{lora_base_name}/{safetensors_files[0]}"
                                            logger.info(f"🔄 Fallback: using first LoRA in subdirectory: {actual_lora_name}")
                                            workflow[node_id]['inputs']['lora_name'] = actual_lora_name
                                        else:
                                            logger.error(f"❌ No .safetensors files found in {user_dir_path}")
                                else:
                                    # Look for any file that starts with this base name
                                    matching_files = [f for f in available_files if f.startswith(lora_base_name)]
                                    if matching_files:
                                        # Prefer files that contain the display name
                                        preferred_files = [f for f in matching_files if display_name in f and f.endswith('.safetensors')]
                                        if preferred_files:
                                            actual_lora_name = preferred_files[0]
                                        else:
                                            # Fallback: use the first .safetensors file
                                            safetensors_files = [f for f in matching_files if f.endswith('.safetensors')]
                                            if safetensors_files:
                                                actual_lora_name = safetensors_files[0]
                                            else:
                                                actual_lora_name = matching_files[0]
                                        
                                        logger.info(f"🔄 Using alternate LoRA file: {actual_lora_name}")
                                        workflow[node_id]['inputs']['lora_name'] = actual_lora_name
                            else:
                                logger.error(f"❌ Invalid LoRA filename format: {lora_name}")
                        else:
                            logger.info(f"🔍 Non-user LoRA file, keeping as-is: {lora_name}")
        
        logger.info(f"📊 Total LoRA nodes found in workflow: {lora_nodes_found}")
        
        # Show complete workflow for debugging
        logger.info(f"🔧 Complete workflow JSON: {json.dumps(workflow, indent=2)}")
        
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

def monitor_comfyui_progress(prompt_id: str, job_id: str, webhook_url: str) -> Dict:
    """Monitor ComfyUI progress and return final result with detailed progress"""
    try:
        logger.info(f"�️ Starting progress monitoring for job: {job_id}")
        
        max_wait_time = 600  # 10 minutes
        start_time = time.time()
        last_webhook_time = 0
        
        # Progress stages for text-to-image generation
        progress_stages = {
            'starting': {'min': 0, 'max': 10, 'message': '🚀 Initializing generation...'},
            'loading_models': {'min': 10, 'max': 20, 'message': '📦 Loading AI models...'},
            'encoding_prompt': {'min': 20, 'max': 30, 'message': '📝 Processing prompt...'},
            'generating': {'min': 30, 'max': 85, 'message': '🎨 Generating image...'},
            'decoding': {'min': 85, 'max': 95, 'message': '🖼️ Finalizing image...'},
            'saving': {'min': 95, 'max': 100, 'message': '💾 Saving results...'}
        }
        
        current_stage = 'starting'
        
        # Send initial progress update
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 5,
                'message': progress_stages['starting']['message'],
                'stage': 'starting',
                'estimatedTimeRemaining': max_wait_time,
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
                
                # Check ComfyUI queue status for more accurate progress
                try:
                    queue_response = requests.get(queue_url, timeout=5)
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
                            message = f'⏳ Job queued (position {queue_position} in queue)'
                            current_stage = 'starting'
                            
                        elif job_in_running:
                            # Job is actively running
                            try:
                                progress_response = requests.get(progress_url, timeout=3)
                                if progress_response.status_code == 200:
                                    progress_data = progress_response.json()
                                    if progress_data.get('value', 0) > 0:
                                        comfy_progress = progress_data.get('value', 0)
                                        max_progress = progress_data.get('max', 100)
                                        node_progress = min(85, (comfy_progress / max_progress) * 85) if max_progress > 0 else 15
                                        
                                        # Determine stage based on progress
                                        if node_progress < 20:
                                            current_stage = 'loading_models'
                                        elif node_progress < 30:
                                            current_stage = 'encoding_prompt'
                                        elif node_progress < 85:
                                            current_stage = 'generating'
                                        else:
                                            current_stage = 'decoding'
                                            
                                        progress = max(15, node_progress)
                                        message = progress_stages[current_stage]['message']
                                        
                                        # Add node-specific info if available
                                        current_node = progress_data.get('node', '')
                                        if current_node:
                                            message += f" (Node: {current_node})"
                                    else:
                                        # Time-based fallback
                                        elapsed_minutes = elapsed_time / 60
                                        if elapsed_minutes < 0.5:
                                            current_stage = 'loading_models'
                                            progress = 15
                                        elif elapsed_minutes < 1:
                                            current_stage = 'encoding_prompt'
                                            progress = 25
                                        elif elapsed_minutes < 5:
                                            current_stage = 'generating'
                                            progress = min(75, 25 + (elapsed_minutes - 1) * 12.5)
                                        else:
                                            current_stage = 'generating'
                                            progress = min(85, 75 + (elapsed_minutes - 5) * 2)
                                        
                                        message = progress_stages[current_stage]['message']
                                else:
                                    # Fallback time-based progress
                                    elapsed_minutes = elapsed_time / 60
                                    progress = min(80, 15 + elapsed_minutes * 13)
                                    message = '🎨 Generating image...'
                                    current_stage = 'generating'
                                    
                            except:
                                # Simple time-based progress
                                elapsed_minutes = elapsed_time / 60
                                progress = min(80, 15 + elapsed_minutes * 13)
                                message = '🎨 Generating image...'
                                current_stage = 'generating'
                        else:
                            # Job not in queue, check for completion
                            response = requests.get(history_url, timeout=10)
                            if response.status_code == 200:
                                history = response.json()
                                
                                if prompt_id in history:
                                    result = history[prompt_id]
                                    
                                    if 'outputs' in result and result['outputs']:
                                        logger.info(f"✅ Generation completed for job: {job_id}")
                                        
                                        # Send final progress update
                                        if webhook_url:
                                            send_webhook(webhook_url, {
                                                'job_id': job_id,
                                                'status': 'PROCESSING',
                                                'progress': 100,
                                                'message': '✅ Generation completed! Processing results...',
                                                'stage': 'completed',
                                                'prompt_id': prompt_id
                                            })
                                        
                                        # Extract and download images
                                        images = []
                                        for node_id, output in result['outputs'].items():
                                            if 'images' in output:
                                                for img_info in output['images']:
                                                    image_data = get_image_from_comfyui(
                                                        img_info['filename'], 
                                                        img_info.get('subfolder', ''),
                                                        img_info.get('type', 'output')
                                                    )
                                                    
                                                    if image_data:
                                                        images.append({
                                                            'filename': img_info['filename'],
                                                            'data': image_data,
                                                            'node_id': node_id
                                                        })
                                        
                                        # Prepare webhook images for database storage
                                        webhook_images = []
                                        for img in images:
                                            webhook_images.append({
                                                'filename': img['filename'],
                                                'subfolder': '',
                                                'type': 'output',
                                                'data': img['data']
                                            })
                                        
                                        # Send completion webhook
                                        if webhook_url:
                                            send_webhook(webhook_url, {
                                                'job_id': job_id,
                                                'status': 'COMPLETED',
                                                'progress': 100,
                                                'message': 'Image generation completed successfully! 🎉',
                                                'images': webhook_images,
                                                'prompt_id': prompt_id,
                                                'totalTime': int(elapsed_time)
                                            })
                                        else:
                                            logger.info("📡 No webhook URL provided - images generated but not sent to database")
                                        
                                        return {
                                            'success': True,
                                            'status': 'completed',
                                            'images': webhook_images,
                                            'prompt_id': prompt_id
                                        }
                            break
                except Exception as queue_error:
                    logger.warning(f"⚠️ Error checking queue status: {queue_error}")
                    # Continue with basic time-based progress
                    elapsed_minutes = elapsed_time / 60
                    progress = min(80, 15 + elapsed_minutes * 13)
                    message = '🎨 Generating image...'
                    current_stage = 'generating'
                
                # Send progress webhook updates (every 5 seconds)
                if webhook_url and (current_time - last_webhook_time) >= 5:
                    estimated_remaining = max(0, max_wait_time - elapsed_time)
                    
                    send_webhook(webhook_url, {
                        'job_id': job_id,
                        'status': 'PROCESSING',
                        'progress': int(progress),
                        'message': message,
                        'stage': current_stage,
                        'elapsedTime': int(elapsed_time),
                        'estimatedTimeRemaining': int(estimated_remaining),
                        'prompt_id': prompt_id
                    })
                    last_webhook_time = current_time
                
                time.sleep(1)  # Check every second
                attempt += 1
                time.sleep(1)
            
            except Exception as e:
                logger.warning(f"⚠️ Progress check failed (attempt {attempt}): {e}")
                attempt += 1
                time.sleep(2)
        
        # Timeout reached
        logger.error(f"❌ Generation timeout for prompt {prompt_id}")
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 0,
                'message': 'Generation timed out after 10 minutes',
                'error': 'Generation took too long to complete'
            })
        
        return {
            'success': False,
            'status': 'failed',
            'error': 'Generation timeout'
        }
    
    except Exception as e:
        logger.error(f"❌ Progress monitoring failed: {e}")
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 0,
                'message': 'Generation monitoring failed',
                'error': str(e)
            })
        
        return {
            'success': False,
            'status': 'failed',
            'error': str(e)
        }

def run_text_to_image_generation(job_input, job_id, webhook_url):
    """Execute the actual text-to-image generation process"""
    logger.info(f"🎯 Starting text-to-image generation for job: {job_id}")
    
    try:
        # Initial status
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 5,
                'message': 'Initializing text-to-image generation...'
            })
        
        # Validate inputs
        if 'workflow' not in job_input:
            raise ValueError("Missing workflow in job input")
        
        workflow = job_input['workflow']
        params = job_input.get('params', {})
        
        logger.info(f"📋 Generation params: {params}")
        
        # Validate workflow
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 10,
            'message': 'Validating workflow...'
        })
        
        if not validate_workflow(workflow):
            raise ValueError("Invalid workflow structure")
        
        # Prepare ComfyUI environment
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 20,
            'message': 'Preparing generation environment...'
        })
        
        if not prepare_comfyui_environment():
            raise ValueError("Failed to prepare ComfyUI environment")
        
        # Queue workflow with ComfyUI
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 30,
            'message': 'Queueing generation workflow...'
        })
        
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        if not prompt_id:
            raise ValueError("Failed to queue workflow with ComfyUI")
        
        # Monitor progress and wait for completion
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 40,
            'message': 'Starting image generation...',
            'prompt_id': prompt_id
        })
        
        result = monitor_comfyui_progress(prompt_id, job_id, webhook_url)
        
        if result['success']:
            logger.info(f"✅ Text-to-image generation completed successfully: {job_id}")
            return {
                'success': True,
                'job_id': job_id,
                'status': 'completed',
                'images': result['images'],
                'prompt_id': prompt_id
            }
        else:
            raise ValueError(f"Generation failed: {result.get('error', 'Unknown error')}")
    
    except Exception as e:
        logger.error(f"❌ Text-to-image generation failed: {e}")
        
        # Send failure webhook only if webhook URL provided
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 0,
                'message': f'Generation failed: {str(e)}',
                'error': str(e)
            })
        
        return {
            'success': False,
            'job_id': job_id,
            'status': 'failed',
            'error': str(e)
        }

def upload_lora_to_network_volume(file_data: str, file_name: str, user_id: str) -> Dict:
    """Upload LoRA file to network volume storage"""
    try:
        import base64
        
        logger.info(f"📁 Uploading LoRA file: {file_name} for user: {user_id}")
        
        # Decode base64 file data
        file_bytes = base64.b64decode(file_data)
        file_size_mb = len(file_bytes) / (1024 * 1024)
        logger.info(f"📊 File size: {file_size_mb:.2f}MB")
        
        # Create user-specific directory in network volume
        user_lora_dir = f"/runpod-volume/loras/{user_id}"
        os.makedirs(user_lora_dir, exist_ok=True)
        
        # Write file to network volume
        file_path = os.path.join(user_lora_dir, file_name)
        
        with open(file_path, 'wb') as f:
            f.write(file_bytes)
        
        # Verify file was written correctly
        if os.path.exists(file_path):
            actual_size = os.path.getsize(file_path)
            logger.info(f"✅ LoRA file uploaded successfully: {file_path}")
            logger.info(f"📊 Verified file size: {actual_size / (1024 * 1024):.2f}MB")
            
            return {
                'success': True,
                'file_path': file_path,
                'file_size': actual_size,
                'network_volume_path': f"loras/{user_id}/{file_name}",
                'message': f'LoRA uploaded successfully to network volume'
            }
        else:
            raise Exception("File not found after upload")
            
    except Exception as e:
        logger.error(f"❌ LoRA upload failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'message': 'LoRA upload failed'
        }

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

def monitor_video_generation_progress(prompt_id: str, job_id: str, webhook_url: str) -> Dict:
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
                                            video_data = get_video_from_comfyui(
                                                vid_info['filename'],
                                                vid_info.get('subfolder', ''),
                                                vid_info.get('type', 'output')
                                            )
                                            
                                            if video_data:
                                                webhook_videos.append({
                                                    'filename': vid_info['filename'],
                                                    'subfolder': vid_info.get('subfolder', ''),
                                                    'type': vid_info.get('type', 'output'),
                                                    'data': video_data
                                                })
                                                logger.info(f"✅ Successfully processed video: {vid_info['filename']}")
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
                                                video_data = get_video_from_comfyui(
                                                    filename,
                                                    img_info.get('subfolder', ''),
                                                    img_info.get('type', 'output')
                                                )
                                                
                                                if video_data:
                                                    webhook_videos.append({
                                                        'filename': filename,
                                                        'subfolder': img_info.get('subfolder', ''),
                                                        'type': img_info.get('type', 'output'),
                                                        'data': video_data
                                                    })
                                                    logger.info(f"✅ Successfully processed video from images: {filename}")
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
                                        video_data = get_video_from_comfyui(
                                            filename,
                                            output.get('subfolder', ''),
                                            output.get('type', 'output')
                                        )
                                        
                                        if video_data:
                                            webhook_videos.append({
                                                'filename': filename,
                                                'subfolder': output.get('subfolder', ''),
                                                'type': output.get('type', 'output'),
                                                'data': video_data
                                            })
                                            logger.info(f"✅ Successfully processed direct video: {filename}")                                            # Send completion webhook
                                            if webhook_url:
                                                send_webhook(webhook_url, {
                                                    "job_id": job_id,
                                                    "status": "COMPLETED",
                                                    "progress": 100,
                                                    "message": "Video generation completed successfully! 🎉",
                                                    "videos": webhook_videos,
                                                    "totalTime": int(elapsed_time)
                                                })
                                            
                                            return {
                                                'success': True,
                                                'status': 'completed',
                                                'videos': webhook_videos
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
                logger.info(f"� Downloading image from constructed URL: {image_url}")
                
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

def download_image_with_unique_name(image_filename: str, job_input: dict) -> tuple[bool, str]:
    """Download the image to ComfyUI input directory with a unique name to avoid caching"""
    try:
        # Check if base64 image data is provided directly (priority for serverless)
        if 'imageData' in job_input and job_input['imageData']:
            logger.info(f"📦 Using base64 image data directly for {image_filename}")
            
            # Decode base64 data
            import base64
            image_data = base64.b64decode(job_input['imageData'])
            
            # ComfyUI input directory
            comfyui_input_dir = "/app/comfyui/input"
            os.makedirs(comfyui_input_dir, exist_ok=True)
            
            # Create unique filename to avoid cache issues
            import time
            timestamp = int(time.time() * 1000)
            file_extension = os.path.splitext(image_filename)[1] or '.png'
            unique_filename = f"upload_{timestamp}_{image_filename}"
            target_path = os.path.join(comfyui_input_dir, unique_filename)
            
            # Save base64 image data to file
            with open(target_path, 'wb') as f:
                f.write(image_data)
            
            # Verify the image was saved correctly
            if os.path.exists(target_path):
                file_size = os.path.getsize(target_path)
                logger.info(f"✅ Base64 image saved to ComfyUI input: {target_path} ({file_size} bytes)")
                return True, unique_filename
            else:
                logger.error(f"❌ Failed to save base64 image to: {target_path}")
                return False, ""
        
        # Fallback: Get the uploaded image URL or data (legacy approach)
        params = job_input.get('params', {})
        uploaded_image = params.get('uploadedImage')
        
        if not uploaded_image:
            logger.error("❌ No uploaded image found in job input")
            return False, ""
        
        # ComfyUI input directory
        comfyui_input_dir = "/app/comfyui/input"
        os.makedirs(comfyui_input_dir, exist_ok=True)
        
        # Create unique filename to avoid cache issues
        import time
        timestamp = int(time.time() * 1000)
        file_extension = os.path.splitext(image_filename)[1] or '.png'
        unique_filename = f"upload_{timestamp}_{image_filename}"
        target_path = os.path.join(comfyui_input_dir, unique_filename)
        
        # Download image data
        image_data = None
        if uploaded_image.startswith('http'):
            logger.info(f"📥 Downloading image from URL: {uploaded_image}")
            response = requests.get(uploaded_image, timeout=30)
            response.raise_for_status()
            image_data = response.content
        else:
            # Get the base URL from job input or environment
            base_url = job_input.get('base_url')
            if not base_url:
                possible_base_urls = [
                    os.environ.get('NEXT_PUBLIC_BASE_URL'),
                    os.environ.get('BASE_URL'),
                    'https://ai.tastycreative.xyz',
                    'http://localhost:3000'
                ]
                
                for url in possible_base_urls:
                    if url:
                        base_url = url
                        break
            
            if base_url:
                image_url = f"{base_url}/uploads/{uploaded_image}"
                logger.info(f"📥 Downloading image from constructed URL: {image_url}")
                
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                image_data = response.content
            else:
                logger.error(f"❌ No base URL available to construct image download URL")
                return False, ""
        
        if not image_data:
            logger.error("❌ No image data obtained")
            return False, ""
        
        # Save with unique filename
        with open(target_path, 'wb') as f:
            f.write(image_data)
        
        # Verify the image was saved correctly
        if os.path.exists(target_path):
            file_size = os.path.getsize(target_path)
            logger.info(f"✅ Image saved to ComfyUI input: {target_path} ({file_size} bytes)")
            return True, unique_filename
        else:
            logger.error(f"❌ Failed to save image to: {target_path}")
            return False, ""
            
    except Exception as e:
        logger.error(f"❌ Error downloading image for ComfyUI: {e}")
        return False, ""

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
        result = monitor_comfyui_progress(prompt_id, job_id, webhook_url)
        
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
        
        result = monitor_video_generation_progress(prompt_id, job_id, webhook_url)
        return result
        
    except Exception as e:
        logger.error(f"❌ Image-to-video generation error: {e}")
        error_msg = f"Generation error: {str(e)}"
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "FAILED",
            "progress": 0,
            "error": error_msg,
            "message": error_msg
        })
        return {"status": "failed", "error": error_msg}

def handler(job):
    """RunPod serverless handler for text-to-image generation, style transfer, image-to-video generation, and LoRA uploads"""
    job_input = job['input']
    action = job_input.get('action', 'generate')  # Default to generation
    generation_type = job_input.get('generation_type', 'text_to_image')  # Default to text-to-image
    
    # Handle LoRA upload requests
    if action == 'upload_lora':
        logger.info("🎯 Starting LoRA upload job")
        
        file_data = job_input.get('file_data')
        file_name = job_input.get('file_name')
        user_id = job_input.get('user_id')
        display_name = job_input.get('display_name')
        
        if not all([file_data, file_name, user_id]):
            return {
                'success': False,
                'error': 'Missing required fields: file_data, file_name, user_id'
            }
        
        result = upload_lora_to_network_volume(file_data, file_name, user_id)
        
        if result['success']:
            logger.info(f"✅ LoRA upload completed: {file_name}")
        
        return result
    
    # Handle style transfer generation
    elif action == 'generate_style_transfer' or generation_type == 'style_transfer':
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
    
    # Handle image-to-video generation
    elif action == 'generate_video' or generation_type == 'image_to_video':
        job_id = job_input.get('job_id', str(uuid.uuid4()))
        webhook_url = job_input.get('webhook_url')
        
        logger.info(f"🎬 Starting image-to-video generation job: {job_id}")
        logger.info(f"📋 Job params: {job_input.get('params', {})}")
        
        if not webhook_url:
            logger.warning("⚠️ No webhook URL provided, updates won't be sent")
        
        try:
            result = run_image_to_video_generation(job_input, job_id, webhook_url)
            
            if result['status'] == 'completed':
                logger.info(f"✅ Image-to-video generation completed: {job_id}")
                return {
                    'success': True,
                    'job_id': job_id,
                    'status': 'completed',
                    'videos': result.get('videos', []),
                    'message': 'Image-to-video generation completed successfully'
                }
            else:
                logger.error(f"💥 Image-to-video generation job failed: {job_id} - {result.get('error')}")
                return {
                    'success': False,
                    'job_id': job_id,
                    'status': 'failed',
                    'error': result.get('error', 'Unknown error'),
                    'message': 'Image-to-video generation failed'
                }
        
        except Exception as e:
            logger.error(f"💥 Image-to-video handler error: {e}")
            
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
    
    # Handle text-to-image generation (existing logic)
    else:
        job_id = job_input.get('job_id', str(uuid.uuid4()))
        webhook_url = job_input.get('webhook_url')
        
        logger.info(f"🚀 Starting text-to-image generation job: {job_id}")
        logger.info(f"📋 Job params: {job_input.get('params', {})}")
        
        if not webhook_url:
            logger.warning("⚠️ No webhook URL provided, updates won't be sent")
    
    try:
        # Validate required inputs
        if 'workflow' not in job_input:
            raise ValueError("Missing 'workflow' in job input")
        
        # Send initial webhook
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'STARTED',
                'progress': 0,
                'message': 'Text-to-image generation job started'
            })
        
        # Run the generation process
        result = run_text_to_image_generation(job_input, job_id, webhook_url)
        
        if result['success']:
            logger.info(f"🎉 Generation job completed successfully: {job_id}")
            return {
                'success': True,
                'job_id': job_id,
                'status': 'completed',
                'images': result['images'],
                'message': 'Text-to-image generation completed successfully'
            }
        else:
            logger.error(f"💥 Generation job failed: {job_id} - {result.get('error')}")
            return {
                'success': False,
                'job_id': job_id,
                'status': 'failed',
                'error': result.get('error', 'Unknown error'),
                'message': 'Text-to-image generation failed'
            }
    
    except Exception as e:
        logger.error(f"💥 Handler error: {e}")
        
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

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎯 Starting RunPod Text-to-Image handler...")
    runpod.serverless.start({"handler": handler})
