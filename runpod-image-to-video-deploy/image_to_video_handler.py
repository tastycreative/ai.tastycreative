#!/usr/bin/env python3
"""
RunPod Serverless Handler for Image-to-Video Generation using ComfyUI WAN 2.2
Based on the text-to-image handler but adapted for video generation
"""

import os
import sys
import json
import time
import uuid
import logging
import requests
import runpod
import base64
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
    """Validate the ComfyUI workflow JSON structure for image-to-video"""
    try:
        if not isinstance(workflow, dict):
            logger.error("Workflow must be a dictionary")
            return False
        
        # Check for required nodes for WAN 2.2 image-to-video workflow
        required_nodes = ["6", "7", "37", "38", "39", "48", "56", "65", "91", "92", "93", "94", "8", "57", "131"]
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"Missing required node: {node_id}")
                return False
        
        # Validate specific nodes for video generation
        if workflow.get("56", {}).get("class_type") != "LoadImage":
            logger.error("Node 56 should be LoadImage for uploaded image")
            return False
            
        if workflow.get("57", {}).get("class_type") != "CreateVideo":
            logger.error("Node 57 should be CreateVideo")
            return False
            
        if workflow.get("131", {}).get("class_type") != "SaveVideo":
            logger.error("Node 131 should be SaveVideo")
            return False
        
        logger.info("✅ Image-to-video workflow validation passed")
        return True
    
    except Exception as e:
        logger.error(f"❌ Workflow validation error: {e}")
        return False

def prepare_comfyui_environment():
    """Prepare the ComfyUI environment and check for required models"""
    try:
        print("🔧 Preparing ComfyUI environment for image-to-video...")
        
        # Based on filesystem exploration, models are in /runpod-volume
        models_path = "/runpod-volume"
        
        if not os.path.exists(models_path):
            print(f"❌ Models path not found: {models_path}")
            return False
            
        print(f"✅ Using models path: {models_path}")
        
        # Check for required model directories for WAN 2.2
        required_dirs = ['unet', 'vae', 'clip', 'loras']
        missing_models = []
        
        for dir_name in required_dirs:
            dir_path = os.path.join(models_path, dir_name)
            if not os.path.exists(dir_path):
                missing_models.append(f"Directory: {dir_name}")
            else:
                # List files in each model directory
                files = os.listdir(dir_path)
                if dir_name == 'loras':
                    model_files = [f for f in files if f.endswith('.safetensors')]
                else:
                    model_files = [f for f in files if f.endswith('.safetensors')]
                
                if not model_files:
                    missing_models.append(f"No model files in {dir_name}")
                else:
                    print(f"✅ Found {len(model_files)} model files in {dir_name}/ - {', '.join(model_files[:3])}{'...' if len(model_files) > 3 else ''}")
        
        # Check for specific WAN 2.2 models
        wan_models = [
            'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors',
            'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors',
            'wan_2.1_vae.safetensors',
            'umt5_xxl_fp8_e4m3fn_scaled.safetensors'
        ]
        
        for model in wan_models:
            found = False
            for dir_name in required_dirs:
                dir_path = os.path.join(models_path, dir_name)
                if os.path.exists(dir_path):
                    files = os.listdir(dir_path)
                    if model in files:
                        print(f"✅ Found required WAN 2.2 model: {model} in {dir_name}/")
                        found = True
                        break
            
            if not found:
                print(f"⚠️ Warning: WAN 2.2 model not found: {model}")
        
        if missing_models:
            print(f"❌ Missing models: {', '.join(missing_models)}")
            return False
        
        print("✅ ComfyUI environment ready for image-to-video generation")
        return True
        
    except Exception as e:
        logger.error(f"❌ Environment setup error: {e}")
        return False

def start_comfyui():
    """Start ComfyUI server in background"""
    try:
        logger.info("🚀 Starting ComfyUI server...")
        
        # Set ComfyUI path
        comfyui_path = "/workspace/ComfyUI"
        
        if not os.path.exists(comfyui_path):
            logger.error(f"❌ ComfyUI not found at {comfyui_path}")
            return False
        
        # Change to ComfyUI directory
        os.chdir(comfyui_path)
        logger.info(f"📂 Changed to ComfyUI directory: {comfyui_path}")
        
        # Start ComfyUI with specific arguments for RunPod
        import subprocess
        
        # Check if ComfyUI is already running
        try:
            response = requests.get("http://127.0.0.1:8188/", timeout=5)
            if response.status_code == 200:
                logger.info("✅ ComfyUI already running")
                return True
        except requests.exceptions.RequestException:
            pass  # ComfyUI not running yet
        
        # Start ComfyUI
        cmd = [
            sys.executable, "main.py",
            "--listen", "127.0.0.1",
            "--port", "8188",
            "--disable-auto-launch",
            "--disable-metadata"
        ]
        
        logger.info(f"🖥️ Starting ComfyUI with command: {' '.join(cmd)}")
        
        # Start ComfyUI in background
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=comfyui_path
        )
        
        # Wait a few seconds for startup
        time.sleep(10)
        
        # Check if ComfyUI started successfully
        for attempt in range(30):  # Wait up to 30 seconds
            try:
                response = requests.get("http://127.0.0.1:8188/", timeout=5)
                if response.status_code == 200:
                    logger.info(f"✅ ComfyUI started successfully after {attempt + 1} attempts")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(1)
        
        logger.error("❌ ComfyUI failed to start within timeout")
        return False
        
    except Exception as e:
        logger.error(f"❌ ComfyUI startup error: {e}")
        return False

def queue_workflow_with_comfyui(workflow: Dict, job_id: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"📤 Queuing workflow with ComfyUI for job: {job_id}")
        
        # Prepare the prompt
        prompt_data = {
            "prompt": workflow,
            "client_id": job_id
        }
        
        # Submit to ComfyUI
        response = requests.post(
            "http://127.0.0.1:8188/prompt",
            json=prompt_data,
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"❌ ComfyUI prompt submission failed: {response.status_code}")
            logger.error(f"❌ Error: {response.text}")
            return None
        
        result = response.json()
        prompt_id = result.get("prompt_id")
        
        if prompt_id:
            logger.info(f"✅ Workflow queued successfully with prompt ID: {prompt_id}")
        else:
            logger.error("❌ No prompt ID returned from ComfyUI")
        
        return prompt_id
        
    except Exception as e:
        logger.error(f"❌ Error queuing workflow: {e}")
        return None

def get_video_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> str:
    """Download video from ComfyUI and return as base64 encoded string"""
    try:
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

def monitor_comfyui_progress(prompt_id: str, job_id: str, webhook_url: str) -> Dict:
    """Monitor ComfyUI progress and return final result"""
    try:
        logger.info(f"👀 Monitoring progress for prompt: {prompt_id}, job: {job_id}")
        
        max_wait_time = 600  # 10 minutes for video generation
        check_interval = 5   # Check every 5 seconds
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            try:
                # Check queue status
                queue_response = requests.get("http://127.0.0.1:8188/queue", timeout=10)
                if queue_response.status_code == 200:
                    queue_data = queue_response.json()
                    
                    # Check if our job is still in the queue
                    in_queue = False
                    for item in queue_data.get('queue_running', []) + queue_data.get('queue_pending', []):
                        if len(item) >= 3 and item[2].get('client_id') == job_id:
                            in_queue = True
                            break
                    
                    if in_queue:
                        progress = min(10 + (elapsed_time / max_wait_time * 80), 90)
                        send_webhook(webhook_url, {
                            "job_id": job_id,
                            "status": "processing",
                            "progress": int(progress),
                            "message": f"Video generation in progress... ({elapsed_time}s elapsed)"
                        })
                
                # Check history for completion
                history_response = requests.get("http://127.0.0.1:8188/history", timeout=10)
                if history_response.status_code == 200:
                    history_data = history_response.json()
                    
                    for hist_prompt_id, job_data in history_data.items():
                        # Check if this is our job (by prompt_id or client_id)
                        if (hist_prompt_id == prompt_id or 
                            job_data.get('prompt', [None, {}])[1].get('client_id') == job_id):
                            
                            status = job_data.get('status', {})
                            if status.get('status_str') == 'success':
                                logger.info(f"✅ Video generation completed for job: {job_id}")
                                
                                # Extract video files from outputs
                                outputs = job_data.get('outputs', {})
                                videos = []
                                
                                # Look for video outputs (typically in SaveVideo nodes)
                                for node_id, node_output in outputs.items():
                                    for key, value in node_output.items():
                                        if isinstance(value, list):
                                            for item in value:
                                                if isinstance(item, dict) and 'filename' in item:
                                                    # Check if it's a video file
                                                    filename = item['filename']
                                                    if any(filename.lower().endswith(ext) for ext in ['.mp4', '.webm', '.avi', '.mov']):
                                                        video_info = {
                                                            'filename': filename,
                                                            'subfolder': item.get('subfolder', ''),
                                                            'type': item.get('type', 'output')
                                                        }
                                                        
                                                        # Download and encode video
                                                        video_b64 = get_video_from_comfyui(
                                                            video_info['filename'],
                                                            video_info['subfolder'],
                                                            video_info['type']
                                                        )
                                                        
                                                        if video_b64:
                                                            video_info['data'] = video_b64
                                                            videos.append(video_info)
                                
                                # Send success webhook
                                send_webhook(webhook_url, {
                                    "job_id": job_id,
                                    "status": "completed",
                                    "progress": 100,
                                    "videos": videos,
                                    "message": f"Video generation completed! Generated {len(videos)} videos."
                                })
                                
                                return {
                                    "status": "completed",
                                    "videos": videos,
                                    "message": f"Successfully generated {len(videos)} videos"
                                }
                            
                            elif status.get('status_str') == 'error':
                                error_msg = ', '.join(status.get('messages', ['Unknown error']))
                                logger.error(f"❌ Video generation failed: {error_msg}")
                                
                                send_webhook(webhook_url, {
                                    "job_id": job_id,
                                    "status": "failed",
                                    "progress": 0,
                                    "error": error_msg,
                                    "message": f"Video generation failed: {error_msg}"
                                })
                                
                                return {
                                    "status": "failed",
                                    "error": error_msg
                                }
            
            except Exception as e:
                logger.warning(f"⚠️ Error checking progress: {e}")
            
            time.sleep(check_interval)
            elapsed_time += check_interval
        
        # Timeout
        error_msg = f"Video generation timeout after {max_wait_time} seconds"
        logger.error(f"⏰ {error_msg}")
        
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "failed",
            "progress": 0,
            "error": error_msg,
            "message": error_msg
        })
        
        return {
            "status": "failed",
            "error": error_msg
        }
        
    except Exception as e:
        logger.error(f"❌ Error monitoring progress: {e}")
        return {
            "status": "failed",
            "error": f"Monitoring error: {str(e)}"
        }

def run_image_to_video_generation(job_input, job_id, webhook_url):
    """Execute the actual image-to-video generation process"""
    logger.info(f"🎬 Starting image-to-video generation for job: {job_id}")
    
    try:
        # Send initial webhook
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "processing",
            "progress": 5,
            "message": "Starting video generation..."
        })
        
        # Validate workflow
        workflow = job_input.get('workflow', {})
        if not validate_workflow(workflow):
            error_msg = "Invalid workflow for image-to-video generation"
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "failed",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
            return {"status": "failed", "error": error_msg}
        
        # Prepare environment
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "processing",
            "progress": 10,
            "message": "Preparing ComfyUI environment..."
        })
        
        if not prepare_comfyui_environment():
            error_msg = "Failed to prepare ComfyUI environment"
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "failed",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
            return {"status": "failed", "error": error_msg}
        
        # Start ComfyUI
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "processing",
            "progress": 15,
            "message": "Starting ComfyUI server..."
        })
        
        if not start_comfyui():
            error_msg = "Failed to start ComfyUI server"
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "failed",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
            return {"status": "failed", "error": error_msg}
        
        # Queue the workflow
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "processing",
            "progress": 20,
            "message": "Queueing video generation workflow..."
        })
        
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        if not prompt_id:
            error_msg = "Failed to queue workflow with ComfyUI"
            send_webhook(webhook_url, {
                "job_id": job_id,
                "status": "failed",
                "progress": 0,
                "error": error_msg,
                "message": error_msg
            })
            return {"status": "failed", "error": error_msg}
        
        # Monitor progress and get result
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "processing",
            "progress": 25,
            "message": "Video generation started, monitoring progress..."
        })
        
        result = monitor_comfyui_progress(prompt_id, job_id, webhook_url)
        return result
        
    except Exception as e:
        logger.error(f"❌ Image-to-video generation error: {e}")
        error_msg = f"Generation error: {str(e)}"
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "failed",
            "progress": 0,
            "error": error_msg,
            "message": error_msg
        })
        return {"status": "failed", "error": error_msg}

def handler(job):
    """RunPod serverless handler for image-to-video generation"""
    job_input = job['input']
    action = job_input.get('action', 'generate_video')
    
    # Handle image-to-video generation
    if action == 'generate_video':
        job_id = job_input.get('job_id', str(uuid.uuid4()))
        webhook_url = job_input.get('webhook_url')
        
        logger.info(f"🎬 Starting image-to-video generation job: {job_id}")
        logger.info(f"📋 Job params: {job_input.get('params', {})}")
        
        if not webhook_url:
            logger.warning("⚠️ No webhook URL provided")
        
        try:
            result = run_image_to_video_generation(job_input, job_id, webhook_url)
            return result
        except Exception as e:
            logger.error(f"❌ Handler error: {e}")
            return {
                "status": "failed",
                "error": f"Handler error: {str(e)}"
            }
    
    else:
        return {
            "status": "failed",
            "error": f"Unknown action: {action}"
        }

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎬 Starting RunPod Image-to-Video handler...")
    runpod.serverless.start({"handler": handler})
