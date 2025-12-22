#!/usr/bin/env python3
"""
RunPod Serverless Handler for FPS Boost using RIFE (Real-Time Intermediate Flow Estimation)
Supports:
- AI-powered frame interpolation
- 2x to 5x FPS boost
- Video upload and processing
- Webhook integration with retry logic
- Comprehensive progress tracking
- AWS S3 storage for output videos
"""

import os
import sys
import json
import time
import base64
import logging
import requests
import subprocess
import traceback
import boto3
from pathlib import Path
from typing import Dict, Any, List, Optional
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS S3 Configuration for primary storage
AWS_S3_ENDPOINT = None  # Use default AWS endpoint
AWS_S3_REGION = os.getenv('AWS_REGION', 'us-east-1')
AWS_S3_BUCKET = os.getenv('AWS_S3_BUCKET', '')

def get_aws_s3_client():
    """Initialize AWS S3 client for primary storage"""
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
            region_name=AWS_S3_REGION
        )
        logger.info("✅ AWS S3 client initialized successfully")
        return s3_client
    except Exception as e:
        logger.error(f"❌ Failed to initialize AWS S3 client: {e}")
        return None

def upload_to_aws_s3(filename: str, video_data: bytes, user_id: str, subfolder: str = '', is_full_prefix: bool = False) -> dict:
    """Upload video to AWS S3 and return details
    
    Args:
        filename: Name of the file
        video_data: Binary video data
        user_id: User ID (used if is_full_prefix is False)
        subfolder: Either a subfolder name or a full S3 prefix path
        is_full_prefix: If True, subfolder is treated as a complete S3 prefix (for shared folders)
    """
    try:
        s3_client = get_aws_s3_client()
        if not s3_client:
            return {"success": False, "error": "S3 client not available"}
        
        # Create S3 key
        if is_full_prefix and subfolder:
            # subfolder is actually a full prefix like "outputs/owner_id/folder-name/"
            # Just append the filename
            s3_key = f"{subfolder.rstrip('/')}/{filename}"
        else:
            # Traditional path construction: outputs/{user_id}/{subfolder}/{filename}
            s3_key_parts = ['outputs', user_id]
            if subfolder:
                s3_key_parts.append(subfolder)
            s3_key_parts.append(filename)
            s3_key = '/'.join(s3_key_parts)
        
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
        
        logger.info(f"✅ Video uploaded to AWS S3: {public_url}")
        
        return {
            "success": True,
            "s3_key": s3_key,
            "public_url": public_url,
            "file_size": len(video_data)
        }
            
    except ClientError as e:
        logger.error(f"❌ AWS S3 upload error for {filename}: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"❌ Error uploading video to AWS S3 {filename}: {str(e)}")
        return {"success": False, "error": str(e)}

def send_webhook(webhook_url: str, data: Dict) -> bool:
    """Send webhook update to your website"""
    if not webhook_url:
        return False
        
    try:
        response = requests.post(webhook_url, json=data, timeout=10)
        response.raise_for_status()
        logger.info(f"✅ Webhook sent successfully: {webhook_url}")
        return True
    except Exception as e:
        logger.error(f"❌ Webhook failed: {e}")
        return False

def validate_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure"""
    try:
        if not isinstance(workflow, dict):
            logger.error("❌ Workflow must be a dictionary")
            return False
        
        required_nodes = ["1", "2", "3"]  # VHS_LoadVideo, RIFE VFI, VHS_VideoCombine
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"❌ Missing required node: {node_id}")
                return False
        
        logger.info("✅ Workflow validation passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Workflow validation error: {e}")
        return False

def is_comfyui_running() -> bool:
    """Check if ComfyUI is already running on port 8188"""
    try:
        response = requests.get("http://127.0.0.1:8188/", timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def prepare_comfyui_environment() -> bool:
    """Prepare ComfyUI environment and start ComfyUI"""
    try:
        logger.info("🎯 Preparing ComfyUI environment...")
        
        # Check if ComfyUI is already running
        if is_comfyui_running():
            logger.info("✅ ComfyUI is already running")
            return True
        
        # Start ComfyUI
        logger.info("🚀 Starting ComfyUI server...")
        start_comfyui()
        
        # Wait for ComfyUI to be ready
        max_retries = 60
        for i in range(max_retries):
            if is_comfyui_running():
                logger.info(f"✅ ComfyUI is ready after {i+1} attempts")
                return True
            logger.info(f"⏳ Waiting for ComfyUI to start... ({i+1}/{max_retries})")
            time.sleep(2)
        
        logger.error("❌ ComfyUI failed to start within timeout period")
        return False
        
    except Exception as e:
        logger.error(f"❌ Error preparing ComfyUI environment: {e}")
        return False

def start_comfyui():
    """Start ComfyUI server in background"""
    try:
        comfyui_dir = "/app/comfyui"
        
        if not os.path.exists(comfyui_dir):
            logger.error(f"❌ ComfyUI directory not found: {comfyui_dir}")
            return
        
        # Start ComfyUI with output capture
        logger.info(f"🚀 Starting ComfyUI from {comfyui_dir}...")
        
        subprocess.Popen(
            ["python", "main.py", "--listen", "0.0.0.0", "--port", "8188"],
            cwd=comfyui_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True
        )
        
        logger.info("✅ ComfyUI startup command executed")
        
    except Exception as e:
        logger.error(f"❌ Error starting ComfyUI: {e}")
        logger.error(traceback.format_exc())

def queue_workflow_with_comfyui(workflow: Dict, job_id: str, video_path: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"📋 Queuing workflow for job: {job_id}")
        
        # Update workflow with video path
        if "1" in workflow and "inputs" in workflow["1"]:
            workflow["1"]["inputs"]["video"] = video_path
        
        # Don't override filename_prefix - it's already set correctly in the frontend with targetFolder
        # The frontend sets it as: `${targetFolder}/fps_boosted_${timestamp}_${seed}`
        if "3" in workflow and "inputs" in workflow["3"]:
            existing_prefix = workflow["3"]["inputs"].get("filename_prefix", "fps_boost/fps_boosted")
            logger.info(f"✅ Using filename prefix from frontend: {existing_prefix}")
        
        # Send to ComfyUI
        response = requests.post(
            "http://127.0.0.1:8188/prompt",
            json={"prompt": workflow},
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"❌ Failed to queue workflow: {response.status_code} - {response.text}")
            return None
        
        result = response.json()
        prompt_id = result.get("prompt_id")
        
        if not prompt_id:
            logger.error("❌ No prompt_id returned from ComfyUI")
            return None
        
        logger.info(f"✅ Workflow queued successfully. Prompt ID: {prompt_id}")
        return prompt_id
        
    except Exception as e:
        logger.error(f"❌ Error queuing workflow: {e}")
        return None

def monitor_comfyui_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = None, workflow: Dict = None) -> Dict:
    """Monitor ComfyUI progress and return final result"""
    try:
        logger.info(f"👀 Monitoring progress for prompt: {prompt_id}")
        
        start_time = time.time()
        max_wait_time = 600  # 10 minutes max
        last_progress = 0
        
        while True:
            elapsed = time.time() - start_time
            
            if elapsed > max_wait_time:
                logger.error(f"❌ Processing timeout after {max_wait_time}s")
                return {
                    "success": False,
                    "error": "Processing timeout",
                    "status": "failed"
                }
            
            # Check queue status
            try:
                history_response = requests.get(
                    f"http://127.0.0.1:8188/history/{prompt_id}",
                    timeout=10
                )
                
                if history_response.status_code == 200:
                    history = history_response.json()
                    
                    if prompt_id in history:
                        prompt_data = history[prompt_id]
                        
                        # Check if completed
                        if "outputs" in prompt_data:
                            logger.info("✅ Processing completed!")
                            
                            # Extract video outputs
                            videos = []
                            for node_id, output_data in prompt_data["outputs"].items():
                                if "gifs" in output_data:
                                    for video in output_data["gifs"]:
                                        videos.append({
                                            "filename": video.get("filename"),
                                            "subfolder": video.get("subfolder", ""),
                                            "type": video.get("type", "output")
                                        })
                            
                            logger.info(f"📹 Found {len(videos)} video(s)")
                            
                            # Download and upload videos to AWS S3
                            uploaded_videos = []
                            for video in videos:
                                try:
                                    # Download from ComfyUI
                                    video_data = get_video_from_comfyui(
                                        video["filename"],
                                        video["subfolder"],
                                        video["type"]
                                    )
                                    
                                    if video_data:
                                        # Extract folder info from the workflow's filename_prefix
                                        # The prefix might be like "outputs/user_123/nov-5/fps_boosted" for shared folders
                                        # or just "nov-5/fps_boosted" for regular folders
                                        is_full_prefix = False
                                        folder_prefix = video["subfolder"]
                                        
                                        if workflow and "3" in workflow:
                                            filename_prefix = workflow.get("3", {}).get("inputs", {}).get("filename_prefix", "")

                                            # Check if this is a full S3 prefix path (starts with "outputs/")
                                            if filename_prefix.startswith("outputs/"):
                                                is_full_prefix = True
                                                # Remove the file prefix portion and keep the full folder hierarchy
                                                sanitized_prefix = filename_prefix.rstrip('/')
                                                prefix_parts = sanitized_prefix.split('/')
                                                if len(prefix_parts) >= 3:
                                                    # Drop the last segment (the generated filename prefix) and keep the rest
                                                    folder_prefix = '/'.join(prefix_parts[:-1]) + '/'
                                                    logger.info(f"🔗 Using shared folder prefix: {folder_prefix}")
                                        
                                        # Upload to AWS S3
                                        upload_result = upload_to_aws_s3(
                                            video["filename"],
                                            video_data,
                                            user_id or "unknown",
                                            subfolder=folder_prefix,
                                            is_full_prefix=is_full_prefix
                                        )
                                        
                                        if upload_result["success"]:
                                            uploaded_videos.append({
                                                "filename": video["filename"],
                                                "subfolder": video["subfolder"],  # Use actual subfolder
                                                "type": "output",
                                                "awsS3Key": upload_result["s3_key"],
                                                "awsS3Url": upload_result["public_url"],
                                                "fileSize": upload_result["file_size"]
                                            })
                                            
                                            logger.info(f"✅ Video uploaded: {video['filename']}")
                                        else:
                                            logger.error(f"❌ Failed to upload {video['filename']}")
                                
                                except Exception as e:
                                    logger.error(f"❌ Error processing video {video['filename']}: {e}")
                            
                            # Send completion webhook
                            if webhook_url:
                                send_webhook(webhook_url, {
                                    "jobId": job_id,
                                    "status": "completed",
                                    "progress": 100,
                                    "videos": uploaded_videos,
                                    "elapsedTime": int(elapsed)
                                })
                            
                            return {
                                "success": True,
                                "status": "completed",
                                "videos": uploaded_videos,
                                "elapsedTime": int(elapsed)
                            }
                
                # Send progress update
                progress = min(90, int((elapsed / max_wait_time) * 100))
                if progress != last_progress and webhook_url:
                    send_webhook(webhook_url, {
                        "jobId": job_id,
                        "status": "processing",
                        "progress": progress,
                        "stage": "Interpolating frames",
                        "elapsedTime": int(elapsed)
                    })
                    last_progress = progress
                
            except Exception as e:
                logger.error(f"❌ Error checking progress: {e}")
            
            time.sleep(3)
        
    except Exception as e:
        logger.error(f"❌ Error monitoring progress: {e}")
        return {
            "success": False,
            "error": str(e),
            "status": "failed"
        }

def get_video_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> bytes:
    """Download video from ComfyUI"""
    try:
        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": type_dir
        }
        
        response = requests.get(
            "http://127.0.0.1:8188/view",
            params=params,
            timeout=60
        )
        
        if response.status_code == 200:
            return response.content
        else:
            logger.error(f"❌ Failed to download video: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error downloading video: {e}")
        return None

def save_uploaded_video(video_data: str, filename: str) -> str:
    """Save uploaded video to ComfyUI input directory"""
    try:
        # Decode base64 video data
        video_bytes = base64.b64decode(video_data)
        
        # Save to ComfyUI input directory
        input_dir = "/app/comfyui/input"
        os.makedirs(input_dir, exist_ok=True)
        
        video_path = os.path.join(input_dir, filename)
        with open(video_path, 'wb') as f:
            f.write(video_bytes)
        
        logger.info(f"✅ Video saved to: {video_path}")
        return filename
        
    except Exception as e:
        logger.error(f"❌ Error saving video: {e}")
        return None

def run_fps_boost_generation(job_input, job_id, webhook_url):
    """Execute the FPS boost generation process"""
    logger.info(f"🎯 Starting FPS boost generation for job: {job_id}")
    
    try:
        # Prepare ComfyUI environment
        if not prepare_comfyui_environment():
            return {
                "error": "Failed to prepare ComfyUI environment",
                "status": "failed"
            }
        
        # Extract parameters
        workflow = job_input.get('workflow', {})
        video_data = job_input.get('videoData')
        user_id = job_input.get('user_id', 'unknown')
        
        if not workflow:
            return {"error": "No workflow provided", "status": "failed"}
        
        if not video_data:
            return {"error": "No video data provided", "status": "failed"}
        
        # Validate workflow
        if not validate_workflow(workflow):
            return {"error": "Invalid workflow", "status": "failed"}
        
        # Save uploaded video
        video_filename = f"fps_boost_input_{job_id}.mp4"
        saved_filename = save_uploaded_video(video_data, video_filename)
        
        if not saved_filename:
            return {"error": "Failed to save uploaded video", "status": "failed"}
        
        # Send initial webhook
        if webhook_url:
            send_webhook(webhook_url, {
                "jobId": job_id,
                "status": "processing",
                "progress": 10,
                "stage": "Starting FPS boost"
            })
        
        # Queue workflow
        prompt_id = queue_workflow_with_comfyui(workflow, job_id, saved_filename)
        
        if not prompt_id:
            return {"error": "Failed to queue workflow", "status": "failed"}
        
        # Monitor progress
        result = monitor_comfyui_progress(prompt_id, job_id, webhook_url, user_id, workflow)
        
        return result
    
    except Exception as e:
        logger.error(f"❌ Generation error: {e}")
        logger.error(traceback.format_exc())
        return {
            "error": str(e),
            "status": "failed"
        }

def handler(job):
    """RunPod serverless handler for FPS boost"""
    job_input = job['input']
    job_id = job_input.get('job_id', 'unknown')  # Use our database job_id from input
    runpod_job_id = job.get('id', 'unknown')  # RunPod's internal job ID
    webhook_url = job_input.get('webhook_url')
    
    logger.info(f"🎬 FPS Boost handler started for job: {job_id} (RunPod: {runpod_job_id})")
    
    result = run_fps_boost_generation(job_input, job_id, webhook_url)
    
    logger.info(f"✅ FPS Boost handler completed for job: {job_id}")
    return result

# Import runpod at the end
try:
    import runpod
except ImportError:
    logger.error("❌ runpod package not found - running in test mode")
    
    class MockRunpod:
        class serverless:
            @staticmethod
            def start(config):
                logger.info("🧪 Mock RunPod handler started (test mode)")
    
    runpod = MockRunpod()

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎯 Starting RunPod FPS Boost handler...")
    runpod.serverless.start({"handler": handler})
