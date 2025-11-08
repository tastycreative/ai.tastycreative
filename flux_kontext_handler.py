#!/usr/bin/env python3
"""
RunPod Serverless Handler for Flux Kontext Image Editing using ComfyUI
Supports:
- Image-to-image transformation with Flux Kontext
- Dual image input (left and right)
- Scene modification with AI-powered prompts
- Direct AWS S3 storage for bandwidth optimization
"""

import os
import sys
import json
import time
import requests
import runpod
import base64
import logging
import boto3
import subprocess
import uuid
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

def upload_image_to_aws_s3(image_data: bytes, user_id: str, filename: str, subfolder: str = '', is_full_prefix: bool = False) -> Dict[str, str]:
    """Upload image to AWS S3 and return S3 key and public URL
    
    Args:
        image_data: Binary image data
        user_id: User ID (used if is_full_prefix is False)
        filename: Name of the file
        subfolder: Either a subfolder name or a full S3 prefix path
        is_full_prefix: If True, subfolder is treated as a complete S3 prefix (for shared folders)
    """
    try:
        s3_client = get_aws_s3_client()
        if not s3_client:
            return {"success": False, "error": "Failed to initialize S3 client"}
        
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
        
        logger.info(f"📤 Uploading image to AWS S3: {s3_key}")
        
        # Upload to AWS S3
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            Body=image_data,
            ContentType='image/png',
            CacheControl='public, max-age=31536000'
        )
        
        # Generate public URL
        public_url = f"https://{AWS_S3_BUCKET}.s3.amazonaws.com/{s3_key}"
        
        logger.info(f"✅ Successfully uploaded image to AWS S3: {public_url}")
        return {
            "success": True,
            "awsS3Key": s3_key,
            "awsS3Url": public_url,
            "fileSize": len(image_data)
        }
            
    except ClientError as e:
        logger.error(f"❌ AWS S3 upload failed: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"❌ AWS S3 upload error: {e}")
        return {"success": False, "error": str(e)}

def get_image_bytes_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> bytes:
    """Download image from ComfyUI and return raw bytes"""
    try:
        comfyui_url = "http://127.0.0.1:8188"
        
        # Construct the image URL
        if subfolder:
            url = f"{comfyui_url}/view?filename={filename}&subfolder={subfolder}&type={type_dir}"
        else:
            url = f"{comfyui_url}/view?filename={filename}&type={type_dir}"
        
        logger.info(f"📥 Downloading image from ComfyUI: {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        return response.content
        
    except Exception as e:
        logger.error(f"❌ Error downloading image from ComfyUI: {e}")
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

def validate_flux_kontext_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure for Flux Kontext"""
    try:
        # Updated required nodes for single image workflow
        required_nodes = ["37", "38", "39", "6", "142", "42", "124", "177", "35", "135", "31", "8", "199"]
        
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"❌ Missing required node: {node_id}")
                return False
        
        # Validate node types
        expected_types = {
            "37": "UNETLoader",
            "38": "DualCLIPLoader",
            "39": "VAELoader",
            "6": "CLIPTextEncode",
            "142": "LoadImage",  # Single image input
            "42": "FluxKontextImageScale",
            "124": "VAEEncode",
            "177": "ReferenceLatent",
            "35": "FluxGuidance",
            "135": "ConditioningZeroOut",
            "31": "KSampler",
            "8": "VAEDecode",
            "199": "SaveImage"
        }
        
        for node_id, expected_type in expected_types.items():
            if workflow[node_id].get("class_type") != expected_type:
                logger.error(f"❌ Node {node_id} has wrong type. Expected {expected_type}, got {workflow[node_id].get('class_type')}")
                return False
        
        logger.info("✅ Flux Kontext workflow validation passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Workflow validation error: {e}")
        return False

def process_base64_image_input(workflow, job_id):
    """
    Process base64 image data in LoadImage nodes.
    Extracts base64 images, decodes them, saves to ComfyUI input directory,
    and replaces the base64 data with the filename.
    """
    import base64
    from PIL import Image
    from io import BytesIO
    
    try:
        # Process single image (node 142)
        if "142" in workflow and "inputs" in workflow["142"]:
            image_data = workflow["142"]["inputs"].get("image", "")
            if image_data and image_data.startswith("data:image"):
                logger.info("📸 Processing image (base64)")
                
                # Extract base64 data
                image_data = image_data.split(",")[1] if "," in image_data else image_data
                image_bytes = base64.b64decode(image_data)
                
                # Save to ComfyUI input directory
                input_dir = Path("/app/comfyui/input")
                input_dir.mkdir(parents=True, exist_ok=True)
                
                filename = f"flux_kontext_{job_id}_{uuid.uuid4().hex[:8]}.png"
                filepath = input_dir / filename
                
                with open(filepath, "wb") as f:
                    f.write(image_bytes)
                
                # Replace base64 with filename
                workflow["142"]["inputs"]["image"] = filename
                logger.info(f"✅ Image saved as {filename}")
        
        return workflow
        
    except Exception as e:
        logger.error(f"❌ Error processing base64 images: {e}")
        raise

def queue_flux_kontext_workflow(workflow, job_id):
    """Queue Flux Kontext workflow with ComfyUI"""
    try:
        comfyui_url = "http://127.0.0.1:8188"
        
        # Process base64 image inputs
        workflow = process_base64_image_input(workflow, job_id)
        
        # Validate workflow
        if not validate_flux_kontext_workflow(workflow):
            raise ValueError("Workflow validation failed")
        
        # Prepare prompt structure
        prompt = {
            "prompt": workflow,
            "client_id": job_id
        }
        
        logger.info(f"🎬 Queueing Flux Kontext workflow for job {job_id}")
        
        # Queue the prompt
        response = requests.post(
            f"{comfyui_url}/prompt",
            json=prompt,
            timeout=30
        )
        
        # Log the response for debugging
        if not response.ok:
            try:
                error_detail = response.json()
                logger.error(f"❌ ComfyUI rejected workflow: {error_detail}")
            except:
                logger.error(f"❌ ComfyUI rejected workflow: {response.text}")
        
        response.raise_for_status()
        
        result = response.json()
        prompt_id = result.get("prompt_id")
        
        if not prompt_id:
            raise ValueError("No prompt_id returned from ComfyUI")
        
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
                logger.info(f"✅ ComfyUI started successfully after {i+1} seconds")
                return True
            time.sleep(1)
        
        logger.error("❌ ComfyUI failed to start within 60 seconds")
        return False
        
    except Exception as e:
        logger.error(f"❌ Error preparing ComfyUI environment: {e}")
        return False

def get_models_path() -> str:
    """Get the models path (network volume or local)"""
    if os.path.exists("/runpod-volume"):
        return "/runpod-volume"
    else:
        return "/app/comfyui/models"

def verify_flux_kontext_models() -> bool:
    """Verify that required model files exist for Flux Kontext"""
    try:
        models_path = get_models_path()
        logger.info(f"🔍 Checking models in: {models_path}")
        
        required_models = {
            "unet": ["flux1-dev-kontext_fp8_scaled.safetensors"],
            "clip": ["clip_l.safetensors", "t5xxl_fp16.safetensors"],
            "vae": ["ae.safetensors"]
        }
        
        all_found = True
        for model_type, model_files in required_models.items():
            model_dir = Path(models_path) / model_type
            for model_file in model_files:
                model_path = model_dir / model_file
                if model_path.exists():
                    logger.info(f"✅ Found {model_type} model: {model_file}")
                else:
                    logger.warning(f"⚠️ Missing {model_type} model: {model_file}")
                    all_found = False
        
        return all_found
        
    except Exception as e:
        logger.error(f"❌ Error verifying models: {e}")
        return False

def start_comfyui():
    """Start ComfyUI server in background with cold start optimizations"""
    try:
        comfyui_path = "/app/comfyui"
        
        # Check if using network volume
        models_path = get_models_path()
        extra_model_paths = None
        
        if models_path == "/runpod-volume":
            logger.info("🔗 Using network volume for models")
            extra_model_paths = "/app/extra_model_paths.yaml"
        
        # Build command
        cmd = [
            sys.executable,
            "main.py",
            "--listen",
            "0.0.0.0",
            "--port",
            "8188",
            "--disable-auto-launch"
        ]
        
        if extra_model_paths:
            cmd.extend(["--extra-model-paths-config", extra_model_paths])
        
        logger.info(f"🚀 Starting ComfyUI with command: {' '.join(cmd)}")
        
        # Start ComfyUI in background
        process = subprocess.Popen(
            cmd,
            cwd=comfyui_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        logger.info(f"✅ ComfyUI started with PID: {process.pid}")
        
        # Log first few lines of output
        for i in range(10):
            line = process.stdout.readline()
            if line:
                logger.info(f"ComfyUI: {line.strip()}")
        
    except Exception as e:
        logger.error(f"❌ Error starting ComfyUI: {e}")
        raise

def monitor_flux_kontext_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = 'unknown', workflow: Dict = None) -> Dict:
    """Monitor ComfyUI progress for Flux Kontext with real-time updates"""
    try:
        comfyui_url = "http://127.0.0.1:8188"
        start_time = time.time()
        last_webhook_time = 0
        webhook_interval = 2  # Send webhook every 2 seconds
        
        logger.info(f"👀 Monitoring progress for prompt_id: {prompt_id}")
        
        while True:
            # Get queue status
            try:
                queue_response = requests.get(f"{comfyui_url}/queue", timeout=5)
                queue_data = queue_response.json()
                
                # Check if prompt is still in queue
                queue_pending = queue_data.get("queue_pending", [])
                queue_running = queue_data.get("queue_running", [])
                
                is_in_queue = any(item[1] == prompt_id for item in queue_pending)
                is_running = any(item[1] == prompt_id for item in queue_running)
                
                if is_in_queue:
                    logger.info(f"⏳ Job {job_id} is in queue")
                    if time.time() - last_webhook_time > webhook_interval:
                        send_webhook(webhook_url, {
                            "jobId": job_id,
                            "status": "PROCESSING",
                            "stage": "queued",
                            "message": "Job is queued",
                            "progress": 10
                        })
                        last_webhook_time = time.time()
                
                elif is_running:
                    logger.info(f"🎨 Job {job_id} is processing")
                    if time.time() - last_webhook_time > webhook_interval:
                        send_webhook(webhook_url, {
                            "jobId": job_id,
                            "status": "PROCESSING",
                            "stage": "processing",
                            "message": "AI transforming images",
                            "progress": 50
                        })
                        last_webhook_time = time.time()
                
                else:
                    # Job completed, check for outputs
                    logger.info(f"✅ Job {job_id} completed, fetching outputs")
                    
                    history_response = requests.get(f"{comfyui_url}/history/{prompt_id}", timeout=10)
                    history_data = history_response.json()
                    
                    if prompt_id in history_data:
                        outputs = history_data[prompt_id].get("outputs", {})
                        
                        # Look for SaveImage node (199)
                        if "199" in outputs and "images" in outputs["199"]:
                            images = outputs["199"]["images"]
                            result_images = []
                            
                            for img in images:
                                filename = img["filename"]
                                subfolder = img.get("subfolder", "")
                                type_dir = img.get("type", "output")
                                
                                logger.info(f"📸 Processing output image: {filename}")
                                
                                # Download image from ComfyUI
                                image_bytes = get_image_bytes_from_comfyui(filename, subfolder, type_dir)
                                
                                # Extract folder info from the workflow's filename_prefix
                                # The prefix might be like "outputs/user_123/yuri-sfw/nov-7/FluxKontext_..." for subfolders
                                # or "outputs/user_123/yuri-sfw/FluxKontext_..." for regular folders
                                is_full_prefix = False
                                folder_prefix = subfolder
                                
                                if workflow and "199" in workflow:
                                    filename_prefix = workflow.get("199", {}).get("inputs", {}).get("filename_prefix", "")
                                    
                                    # Check if this is a full S3 prefix path (starts with "outputs/")
                                    if filename_prefix.startswith("outputs/"):
                                        is_full_prefix = True
                                        # Extract the folder path from the prefix (everything before the filename pattern)
                                        # "outputs/user_123/yuri-sfw/nov-7/FluxKontext_..." -> "outputs/user_123/yuri-sfw/nov-7/"
                                        prefix_parts = filename_prefix.split('/')
                                        
                                        # Find where the filename part starts (usually after the last folder segment)
                                        # The filename part typically contains timestamp or pattern like "FluxKontext_"
                                        folder_parts = []
                                        for part in prefix_parts:
                                            # If part contains timestamp pattern or starts with capital letters (filename pattern), stop
                                            if 'FluxKontext' in part or 'TextToImage' in part or part.isdigit():
                                                break
                                            folder_parts.append(part)
                                        
                                        if len(folder_parts) >= 2:  # At least outputs/user_id
                                            folder_prefix = '/'.join(folder_parts) + '/'
                                            logger.info(f"🔗 Using folder prefix: {folder_prefix}")
                                
                                # Upload to AWS S3
                                s3_result = upload_image_to_aws_s3(
                                    image_bytes, 
                                    user_id, 
                                    filename, 
                                    folder_prefix,
                                    is_full_prefix=is_full_prefix
                                )
                                
                                if s3_result.get("success"):
                                    result_images.append({
                                        "filename": filename,
                                        "subfolder": subfolder,  # Use actual subfolder from ComfyUI
                                        "type": type_dir,
                                        "awsS3Url": s3_result.get("awsS3Url"),
                                        "awsS3Key": s3_result.get("awsS3Key"),
                                        "fileSize": s3_result.get("fileSize")
                                    })
                            
                            elapsed_time = int(time.time() - start_time)
                            
                            # Send final webhook
                            send_webhook(webhook_url, {
                                "jobId": job_id,
                                "status": "COMPLETED",
                                "stage": "saving",
                                "message": "Generation completed",
                                "progress": 100,
                                "resultImages": result_images,
                                "elapsedTime": elapsed_time
                            })
                            
                            logger.info(f"✅ Flux Kontext generation completed in {elapsed_time}s")
                            
                            return {
                                "status": "COMPLETED",
                                "images": result_images,
                                "elapsedTime": elapsed_time
                            }
                        else:
                            logger.error("❌ No images found in outputs")
                            return {
                                "status": "FAILED",
                                "error": "No images generated"
                            }
                    else:
                        logger.error(f"❌ Prompt {prompt_id} not found in history")
                        return {
                            "status": "FAILED",
                            "error": "Job not found in history"
                        }
            
            except Exception as e:
                logger.error(f"❌ Error monitoring progress: {e}")
            
            # Check timeout (10 minutes)
            if time.time() - start_time > 600:
                logger.error("❌ Job timeout after 10 minutes")
                return {
                    "status": "FAILED",
                    "error": "Job timeout"
                }
            
            time.sleep(2)
    
    except Exception as e:
        logger.error(f"❌ Error in monitor_flux_kontext_progress: {e}")
        return {
            "status": "FAILED",
            "error": str(e)
        }

def run_flux_kontext_generation(job_input, job_id, webhook_url):
    """Execute the actual Flux Kontext generation process"""
    logger.info(f"🎨 Starting Flux Kontext generation for job: {job_id}")
    
    try:
        workflow = job_input.get("workflow")
        user_id = job_input.get("userId", "unknown")
        
        if not workflow:
            raise ValueError("No workflow provided")
        
        # Prepare ComfyUI environment
        if not prepare_comfyui_environment():
            raise RuntimeError("Failed to prepare ComfyUI environment")
        
        # Verify models
        verify_flux_kontext_models()
        
        # Queue workflow
        prompt_id = queue_flux_kontext_workflow(workflow, job_id)
        
        # Monitor progress and get results (pass workflow for shared folder detection)
        result = monitor_flux_kontext_progress(prompt_id, job_id, webhook_url, user_id, workflow)
        
        return result
    
    except Exception as e:
        logger.error(f"❌ Error in run_flux_kontext_generation: {e}")
        
        # Send error webhook
        send_webhook(webhook_url, {
            "jobId": job_id,
            "status": "FAILED",
            "error": str(e)
        })
        
        return {
            "status": "FAILED",
            "error": str(e)
        }

def handler(job):
    """RunPod serverless handler for Flux Kontext"""
    job_input = job['input']
    action = job_input.get('action', 'transform_flux_kontext')
    
    try:
        if action == 'transform_flux_kontext':
            # Use the database job ID from input, not the RunPod job ID
            job_id = job_input.get('jobId', job.get('id', str(uuid.uuid4())))
            webhook_url = job_input.get('webhook_url', '')
            
            result = run_flux_kontext_generation(job_input, job_id, webhook_url)
            
            return result
        
        elif action == 'health_check':
            return {
                "status": "healthy",
                "comfyui_running": is_comfyui_running(),
                "models_verified": verify_flux_kontext_models()
            }
        
        else:
            return {
                "status": "FAILED",
                "error": f"Unknown action: {action}"
            }
    
    except Exception as e:
        logger.error(f"❌ Handler error: {e}")
        return {
            "status": "FAILED",
            "error": str(e)
        }

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎨 Starting RunPod Flux Kontext handler...")
    runpod.serverless.start({"handler": handler})
