#!/usr/bin/env python3
"""
RunPod Serverless Handler for Text-to-Image Generation using ComfyUI
Similar to the training handler but focused on image generation
"""

import os
import sys
import json
import time
import uuid
import logging
import requests
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

def prepare_comfyui_environment():
    """Prepare the ComfyUI environment and check for required models"""
    try:
        print("🔧 Preparing ComfyUI environment...")
        
        # Based on filesystem exploration, models are in /runpod-volume
        models_path = "/runpod-volume"
        
        if not os.path.exists(models_path):
            print(f"❌ Models path not found: {models_path}")
            return False
            
        print(f"✅ Using models path: {models_path}")
        
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
                model_files = [f for f in files if f.endswith('.safetensors')]
                if not model_files:
                    missing_models.append(f"No model files in {dir_name}")
                else:
                    print(f"✅ Found {len(model_files)} model files in {dir_name}/ - {', '.join(model_files[:3])}{'...' if len(model_files) > 3 else ''}")
        
        if missing_models:
            print(f"❌ Missing models: {missing_models}")
            return False
            
        print("✅ All required model directories and files found")
        
        # Start ComfyUI server
        print("🚀 Starting ComfyUI server...")
        if not start_comfyui():
            print("❌ Failed to start ComfyUI")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Error preparing ComfyUI environment: {str(e)}")
        return False

def start_comfyui():
    """Start ComfyUI server in background"""
    try:
        import subprocess
        import time
        import requests
        import threading
        import sys
        import os
        
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
            "--extra-model-paths-config", "/app/extra_model_paths.yaml"
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
        max_wait = 120  # 2 minutes
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
                    
                    # List what files ARE available
                    lora_dir = os.path.dirname(full_lora_path)
                    if os.path.exists(lora_dir):
                        available_files = os.listdir(lora_dir)
                        logger.info(f"📁 Available files in {lora_dir}: {available_files}")
        
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
    """Monitor ComfyUI progress and return final result"""
    try:
        logger.info(f"👀 Monitoring ComfyUI progress for prompt {prompt_id}")
        
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        history_url = f"{comfyui_url}/history/{prompt_id}"
        
        max_attempts = 600  # 10 minutes with 1-second intervals (increased for FLUX model loading)
        attempt = 0
        
        while attempt < max_attempts:
            try:
                # Check ComfyUI history for completion
                response = requests.get(history_url, timeout=10)
                
                if response.status_code == 200:
                    history = response.json()
                    
                    if prompt_id in history:
                        result = history[prompt_id]
                        
                        # Check if generation is complete
                        if 'outputs' in result and result['outputs']:
                            logger.info(f"✅ Generation completed for prompt {prompt_id}")
                            
                            # Extract and download images
                            images = []
                            for node_id, output in result['outputs'].items():
                                if 'images' in output:
                                    for img_info in output['images']:
                                        # Download image from ComfyUI
                                        image_data = get_image_from_comfyui(
                                            img_info['filename'], 
                                            img_info.get('subfolder', ''),
                                            img_info.get('type', 'output')
                                        )
                                        
                                        if image_data:
                                            images.append({
                                                'filename': img_info['filename'],
                                                'data': image_data,  # Base64 encoded image data
                                                'node_id': node_id
                                            })
                            
                            # Prepare webhook images for database storage
                            webhook_images = []
                            for img in images:
                                webhook_images.append({
                                    'filename': img['filename'],
                                    'subfolder': '',
                                    'type': 'output',
                                    'data': img['data']  # Include full base64 image data
                                })
                                
                            # Send completion webhook with image data (if webhook URL provided)
                            if webhook_url:
                                send_webhook(webhook_url, {
                                    'job_id': job_id,
                                    'status': 'COMPLETED',
                                    'progress': 100,
                                    'message': 'Image generation completed successfully',
                                    'images': webhook_images,  # Send full image data for database storage
                                    'prompt_id': prompt_id
                                })
                            else:
                                logger.info("📡 No webhook URL provided - images generated but not sent to database")
                                logger.info(f"🖼️ Generated {len(webhook_images)} images locally:")
                                for img in webhook_images:
                                    logger.info(f"  📸 {img['filename']} ({len(img.get('data', ''))} chars base64)")
                            
                            return {
                                'success': True,
                                'status': 'completed',
                                'images': webhook_images,  # Return full image data with base64
                                'prompt_id': prompt_id
                            }
                
                # Send progress update with more detailed messaging
                progress = min(90, (attempt / max_attempts) * 90)  # Cap at 90% until completion
                
                if attempt % 30 == 0:  # Send update every 30 seconds (less frequent for longer jobs)
                    message = 'Generating image...'
                    if attempt < 120:  # First 2 minutes
                        message = 'Loading models and preparing generation...'
                    elif attempt < 300:  # Next 3 minutes  
                        message = 'Generating image with FLUX model...'
                    else:  # After 5 minutes
                        message = 'Finalizing generation (FLUX models require extra time)...'
                        
                    if webhook_url:
                        send_webhook(webhook_url, {
                            'job_id': job_id,
                            'status': 'IN_PROGRESS',
                            'progress': int(progress),
                            'message': f'{message} ({attempt//60}:{attempt%60:02d})',
                            'prompt_id': prompt_id
                        })
                    
                    logger.info(f"⏳ Generation in progress... {attempt//60}:{attempt%60:02d} ({int(progress)}%)")
                
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
                'status': 'IN_PROGRESS',
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
            'status': 'IN_PROGRESS',
            'progress': 10,
            'message': 'Validating workflow...'
        })
        
        if not validate_workflow(workflow):
            raise ValueError("Invalid workflow structure")
        
        # Prepare ComfyUI environment
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 20,
            'message': 'Preparing generation environment...'
        })
        
        if not prepare_comfyui_environment():
            raise ValueError("Failed to prepare ComfyUI environment")
        
        # Queue workflow with ComfyUI
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 30,
            'message': 'Queueing generation workflow...'
        })
        
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        if not prompt_id:
            raise ValueError("Failed to queue workflow with ComfyUI")
        
        # Monitor progress and wait for completion
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
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

def handler(job):
    """RunPod serverless handler for text-to-image generation and LoRA uploads"""
    job_input = job['input']
    action = job_input.get('action', 'generate')  # Default to generation
    
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
    
    # Handle text-to-image generation (existing logic)
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
