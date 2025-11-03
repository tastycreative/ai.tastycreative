#!/usr/bin/env python3
"""
RunPod Serverless Handler for Image-to-Image Skin Enhancement using ComfyUI
Supports:
- Image-to-image skin enhancement with face parsing
- Person mask detection and face boundary analysis
- Advanced face parsing for precise skin detection
- Multiple enhancement passes with detail improvement
"""

import json
import os
import sys
import time
import uuid
import subprocess
import threading
import logging
import runpod
import requests
import boto3
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

def upload_image_to_aws_s3(image_data: bytes, user_id: str, filename: str, subfolder: str = '') -> Dict[str, str]:
    """Upload image to AWS S3 and return S3 key and public URL"""
    try:
        s3_client = get_aws_s3_client()
        if not s3_client:
            logger.error("❌ AWS S3 client not available")
            return {"success": False, "error": "S3 client not available"}
        
        # Create S3 key: outputs/{user_id}/{subfolder}/{filename}
        s3_key_parts = ['outputs', user_id]
        if subfolder:
            s3_key_parts.append(subfolder)
        s3_key_parts.append(filename)
        s3_key = '/'.join(s3_key_parts)
        
        logger.info(f"📤 Uploading image to AWS S3: {s3_key}")
        
        # Upload to AWS S3 (no ACL to avoid compatibility issues)
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            Body=image_data,
            ContentType='image/png',
            CacheControl='public, max-age=31536000'  # 1 year cache
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
        params = {
            'filename': filename,
            'subfolder': subfolder,
            'type': type_dir
        }
        
        response = requests.get(f"{comfyui_url}/view", params=params, timeout=30)
        
        if response.status_code == 200:
            logger.info(f"✅ Downloaded image bytes from ComfyUI: {filename}")
            return response.content
        else:
            logger.error(f"❌ Failed to download image from ComfyUI: {response.status_code}")
            return b""
            
    except Exception as e:
        logger.error(f"❌ Error downloading image from ComfyUI: {e}")
        return b""

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

def validate_image_to_image_skin_enhancement_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure for image-to-image skin enhancement"""
    try:
        if not isinstance(workflow, dict):
            logger.error("❌ Workflow must be a dictionary")
            return False
        
        # Check for required nodes for image-to-image skin enhancement
        required_nodes = [
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", 
            "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
            "21", "22", "23", "24", "25", "26", "28", "29", "30",
            "31", "32", "33", "34", "38", "39", "40"
        ]
        
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"❌ Missing required node: {node_id}")
                return False
        
        # Validate key nodes
        key_node_types = {
            "40": "LoadImage",  # Input image
            "39": "CheckpointLoaderSimple",  # Model loader
            "29": "Lora Loader Stack (rgthree)",  # LoRA loader
            "31": "KSampler",  # Main generation
            "38": "SaveImage",  # Output
            "14": "LayerMask: PersonMaskUltra V2",  # Person mask
            "4": "FaceParse(FaceParsing)",  # Face parsing
        }
        
        for node_id, expected_type in key_node_types.items():
            if node_id in workflow:
                node = workflow[node_id]
                if not isinstance(node, dict):
                    logger.error(f"❌ Node {node_id} must be a dictionary")
                    return False
                
                if "class_type" not in node:
                    logger.error(f"❌ Node {node_id} missing class_type")
                    return False
                
                if node["class_type"] != expected_type:
                    logger.warning(f"⚠️ Node {node_id} has unexpected class_type: {node['class_type']} (expected: {expected_type})")
        
        logger.info("✅ Image-to-image skin enhancement workflow validation passed")
        return True
    
    except Exception as e:
        logger.error(f"❌ Workflow validation error: {e}")
        return False

def fix_lora_paths(workflow):
    """Fix LoRA paths to match ComfyUI's expected format"""
    try:
        for node_id, node in workflow.items():
            # Check for both LoraLoader and LoraLoaderModelOnly and Lora Loader Stack
            if isinstance(node, dict) and node.get('class_type') in ['LoraLoader', 'LoraLoaderModelOnly', 'Lora Loader Stack (rgthree)']:
                
                if node.get('class_type') == 'Lora Loader Stack (rgthree)':
                    # Handle multi-LoRA stack
                    inputs = node.get('inputs', {})
                    for lora_key in ['lora_01', 'lora_02', 'lora_03', 'lora_04']:
                        if lora_key in inputs:
                            lora_name = inputs[lora_key]
                            if lora_name and lora_name != 'None' and lora_name.startswith('user_') and '/' not in lora_name:
                                # Extract user directory from filename
                                parts = lora_name.split('_')
                                if len(parts) >= 3:
                                    user_dir = f"{parts[0]}_{parts[1]}"
                                    fixed_path = f"{user_dir}/{lora_name}"
                                    logger.info(f"🔧 Fixing LoRA path in stack {lora_key}: {lora_name} -> {fixed_path}")
                                    inputs[lora_key] = fixed_path
                else:
                    # Handle single LoRA
                    lora_name = node['inputs'].get('lora_name', '')
                    
                    # If LoRA name starts with user_ and doesn't contain /, add the subdirectory
                    if lora_name.startswith('user_') and '/' not in lora_name and lora_name not in ['Real.People.safetensors', 'more_details.safetensors']:
                        # Extract user directory from filename
                        parts = lora_name.split('_')
                        if len(parts) >= 3:
                            user_dir = f"{parts[0]}_{parts[1]}"
                            fixed_path = f"{user_dir}/{lora_name}"
                            logger.info(f"🔧 Fixing LoRA path for {node.get('class_type')}: {lora_name} -> {fixed_path}")
                            node['inputs']['lora_name'] = fixed_path
        
        return workflow
    except Exception as e:
        logger.error(f"❌ Error fixing LoRA paths: {e}")
        return workflow

def process_base64_image_input(workflow, job_id):
    """
    Process base64 image data in LoadImage nodes.
    Extracts base64 image from node 40, decodes it, saves to ComfyUI input directory,
    and replaces the base64 data with the filename.
    """
    import base64
    from PIL import Image
    from io import BytesIO
    
    try:
        # Find LoadImage node (node 40)
        if '40' not in workflow:
            logger.warning("⚠️ Node 40 (LoadImage) not found in workflow")
            return workflow
        
        node_40 = workflow['40']
        if node_40.get('class_type') != 'LoadImage':
            logger.warning(f"⚠️ Node 40 is not LoadImage, it's {node_40.get('class_type')}")
            return workflow
        
        # Get base64 image data
        image_data = node_40['inputs'].get('image', '')
        if not image_data or not isinstance(image_data, str):
            logger.warning("⚠️ No base64 image data found in node 40")
            return workflow
        
        # Check if it's already a filename (not base64)
        if not image_data.startswith('iVBOR') and not image_data.startswith('/9j/'):  # PNG or JPEG headers
            logger.info(f"✅ Image is already a filename: {image_data}")
            return workflow
        
        logger.info("🖼️ Processing base64 image data...")
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"❌ Failed to decode base64 image: {e}")
            return workflow
        
        # Open image with PIL to ensure it's valid and get format
        try:
            img = Image.open(BytesIO(image_bytes))
            img_format = img.format.lower() if img.format else 'png'
            logger.info(f"📸 Decoded image: {img.size[0]}x{img.size[1]} {img_format.upper()}")
        except Exception as e:
            logger.error(f"❌ Invalid image data: {e}")
            return workflow
        
        # Generate unique filename
        timestamp = int(time.time() * 1000)
        filename = f"input_{job_id}_{timestamp}.{img_format}"
        
        # Save to ComfyUI input directory
        comfyui_input_dir = Path("/app/comfyui/input")
        comfyui_input_dir.mkdir(parents=True, exist_ok=True)
        
        filepath = comfyui_input_dir / filename
        
        # Save image
        img.save(str(filepath), format=img_format.upper())
        logger.info(f"✅ Saved input image to: {filepath}")
        
        # Update workflow node with filename instead of base64
        workflow['40']['inputs']['image'] = filename
        logger.info(f"✅ Updated node 40 with filename: {filename}")
        
        return workflow
        
    except Exception as e:
        logger.error(f"❌ Error processing base64 image: {e}")
        import traceback
        traceback.print_exc()
        return workflow

def queue_image_to_image_skin_enhancement_workflow(workflow, job_id):
    """Queue image-to-image skin enhancement workflow with ComfyUI"""
    try:
        # Process base64 image input and save to ComfyUI input directory
        workflow = process_base64_image_input(workflow, job_id)
        
        # Fix LoRA paths before sending workflow
        workflow = fix_lora_paths(workflow)
        
        queue_url = "http://localhost:8188/prompt"
        
        # Debug: Log LoRA usage in workflow
        lora_nodes_found = 0
        enhancement_loras = []
        for node_id, node in workflow.items():
            if isinstance(node, dict):
                if node.get('class_type') == 'LoraLoader':
                    lora_nodes_found += 1
                    lora_name = node['inputs'].get('lora_name', 'Unknown')
                    lora_strength = node['inputs'].get('strength_model', 'Unknown')
                    enhancement_loras.append(f"Node {node_id}: {lora_name} (strength: {lora_strength})")
                    logger.info(f"🎭 Found enhancement LoRA in node {node_id}: {lora_name} (strength: {lora_strength})")
                elif node.get('class_type') == 'Lora Loader Stack (rgthree)':
                    lora_nodes_found += 1
                    inputs = node.get('inputs', {})
                    for i, lora_key in enumerate(['lora_01', 'lora_02', 'lora_03', 'lora_04'], 1):
                        lora_name = inputs.get(lora_key, '')
                        strength_key = f'strength_{i:02d}'
                        lora_strength = inputs.get(strength_key, 1.0)
                        if lora_name and lora_name != 'None':
                            enhancement_loras.append(f"Stack LoRA {i}: {lora_name} (strength: {lora_strength})")
                            logger.info(f"🎭 Found stack LoRA {i} in node {node_id}: {lora_name} (strength: {lora_strength})")
        
        logger.info(f"📊 Total enhancement LoRA nodes found: {lora_nodes_found}")
        logger.info(f"🎭 Enhancement LoRAs: {enhancement_loras}")
        
        # Prepare payload with unique client_id to prevent caching
        unique_client_id = f"runpod-img2img-skin-enhancer-{job_id}-{int(time.time())}-{os.urandom(4).hex()}"
        payload = {
            "prompt": workflow,
            "client_id": unique_client_id
        }
        
        logger.info(f"📡 Sending image-to-image skin enhancement to ComfyUI: {queue_url}")
        
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
        
        logger.info(f"✅ Image-to-image skin enhancement workflow queued successfully with prompt_id: {prompt_id}")
        return prompt_id
    
    except Exception as e:
        logger.error(f"❌ ComfyUI queue error: {e}")
        return None

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
        print("🔧 Preparing ComfyUI environment for image-to-image skin enhancement...")
        
        # Check if ComfyUI is already running
        if is_comfyui_running():
            print("✅ ComfyUI already running")
            return True
        
        # Validate network volume models first
        models_path = get_models_path()
        if not os.path.exists(models_path):
            print(f"❌ Models path does not exist: {models_path}")
            return False
        
        print(f"✅ Using models path: {models_path}")
        
        # Check for required model files
        if not verify_image_to_image_skin_enhancement_models():
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

def verify_image_to_image_skin_enhancement_models() -> bool:
    """Verify that required model files exist for image-to-image skin enhancement"""
    try:
        models_path = get_models_path()
        
        # Check for required model directories and specific models for image-to-image skin enhancement
        required_models = {
            'unet': ['flux1-dev.safetensors'],
            'clip': ['t5xxl_fp16.safetensors', 'ViT-L-14-TEXT-detail-improved-hiT-GmP-HF.safetensors'],
            'vae': ['ae.safetensors'],
            'checkpoints': ['epicrealismXL_vxviLastfameRealism.safetensors', 'epicrealismXL_v8Kiss.safetensors'],
            'loras': ['Real.People.safetensors', 'more_details.safetensors'],
            # Face parsing models
            'face_parsing': ['79999_iter.pth'],  # BiSeNet face parsing model
            'controlnet': ['control_sd15_openpose.pth'],  # Face analysis
        }
        
        missing_models = []
        
        # First pass: Check what's missing
        for dir_name, model_files in required_models.items():
            dir_path = os.path.join(models_path, dir_name)
            if not os.path.exists(dir_path):
                os.makedirs(dir_path, exist_ok=True)
                missing_models.extend([f"{dir_name}/{model}" for model in model_files])
                continue
                
            files_in_dir = os.listdir(dir_path)
            print(f"✅ Found {len(files_in_dir)} model files in {dir_name}/ - {', '.join(files_in_dir[:3])}{'...' if len(files_in_dir) > 3 else ''}")
            
            # Check for specific required models - at least one variant must exist
            if dir_name == 'checkpoints':
                # For checkpoints, we need at least one of the variants
                checkpoint_found = any(model_file in files_in_dir for model_file in model_files)
                if not checkpoint_found:
                    missing_models.append(f"{dir_name}/epicrealismXL_vxviLastfameRealism.safetensors")
            elif dir_name in ['face_parsing', 'controlnet']:
                # Optional directories for enhanced functionality
                for model_file in model_files:
                    if model_file not in files_in_dir:
                        print(f"⚠️ Optional model missing: {dir_name}/{model_file}")
            else:
                # For other directories, check each required model
                for model_file in model_files:
                    if model_file not in files_in_dir:
                        missing_models.append(f"{dir_name}/{model_file}")
        
        if missing_models:
            print(f"❌ Missing critical models: {missing_models}")
            print("🔧 Please ensure all required models are uploaded to the network volume")
            return False
            
        print("✅ All required model directories and files found for image-to-image skin enhancement")
        return True
        
    except Exception as e:
        print(f"❌ Error verifying model files: {str(e)}")
        return False

def start_comfyui():
    """Start ComfyUI server in background with cold start optimizations"""
    try:
        # Start ComfyUI from the correct directory
        comfyui_dir = "/app/comfyui"
        main_py = os.path.join(comfyui_dir, "main.py")
        
        if not os.path.exists(main_py):
            print(f"❌ ComfyUI main.py not found at {main_py}")
            return False
        
        # Aggressive cold start optimization flags
        cmd = [
            sys.executable, main_py, 
            "--listen", "0.0.0.0",
            "--port", "8188",
            "--extra-model-paths-config", "/app/extra_model_paths.yaml",
            "--disable-auto-launch",
            "--cpu-vae",  # Use CPU for VAE to save VRAM during startup
            "--disable-cuda-malloc",  # Faster CUDA startup
            "--dont-upcast-attention",  # Speed optimization
            "--use-split-cross-attention",  # Memory optimization
            "--disable-metadata"  # Skip metadata processing for faster startup
        ]
        
        # Set environment variables to speed up startup
        env = os.environ.copy()
        env['COMFYUI_MANAGER_NO_AUTO_UPDATE'] = '1'
        env['COMFYUI_NO_FETCH_REGISTRY'] = '1'
        env['DISABLE_CUSTOM_NODE_AUTO_UPDATE'] = '1'
        
        print(f"🔧 Starting ComfyUI with cold start optimizations: {' '.join(cmd)}")
        
        def log_output(process, stream_name):
            """Log ComfyUI output"""
            for line in iter(process.stdout.readline, b''):
                try:
                    line_str = line.decode('utf-8').strip()
                    if line_str:
                        print(f"ComfyUI [{stream_name}]: {line_str}")
                except:
                    pass
        
        # Start ComfyUI as background process from the ComfyUI directory
        process = subprocess.Popen(cmd, 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.STDOUT,
                                 cwd=comfyui_dir,
                                 bufsize=1,
                                 universal_newlines=False,
                                 env=env)
        
        # Start logging thread
        log_thread = threading.Thread(target=log_output, args=(process, "stdout"))
        log_thread.daemon = True
        log_thread.start()
        
        # Wait for ComfyUI to start up
        print("⏳ Waiting for ComfyUI to start...")
        max_wait = 60  # 1 minute
        for i in range(max_wait):
            if i % 5 == 0:
                print(f"⏳ Still waiting for ComfyUI... ({i}/{max_wait}s)")
            
            if process.poll() is not None:
                print(f"❌ ComfyUI process died with return code: {process.returncode}")
                return False
            
            if is_comfyui_running():
                print(f"✅ ComfyUI started successfully after {i} seconds")
                return True
                
            time.sleep(1)
        
        print(f"❌ ComfyUI failed to start within {max_wait} seconds")
        return False
        
    except Exception as e:
        print(f"❌ Error starting ComfyUI: {str(e)}")
        return False

def monitor_image_to_image_skin_enhancement_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = 'unknown') -> Dict:
    """Monitor ComfyUI progress for image-to-image skin enhancement with real-time updates"""
    try:
        logger.info(f"👀 Starting image-to-image skin enhancement progress monitoring for prompt {prompt_id}")
        
        # Send initial monitoring webhook
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 5,
            'message': '🎨 Initializing image-to-image skin enhancement monitoring...',
            'stage': 'starting',
            'workflow_type': 'image_to_image_skin_enhancement',
            'estimated_time': '4-6 minutes',
            'steps_total': 85  # More complex workflow with face parsing
        })
        
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        history_url = f"{comfyui_url}/history/{prompt_id}"
        
        max_attempts = 1200  # 20 minutes for complex image-to-image skin enhancement
        attempt = 0
        last_progress_update = 5
        
        while attempt < max_attempts:
            try:
                # Check if generation is complete
                response = requests.get(history_url, timeout=10)
                
                if response.status_code == 200:
                    history = response.json()
                    
                    if prompt_id in history:
                        result_data = history[prompt_id]
                        
                        # Check if generation completed successfully
                        if 'outputs' in result_data:
                            outputs = result_data['outputs']
                            logger.info(f"✅ Image-to-image skin enhancement completed! Processing outputs...")
                            
                            # Send processing completion webhook
                            if webhook_url:
                                send_webhook(webhook_url, {
                                    'job_id': job_id,
                                    'status': 'PROCESSING',
                                    'progress': 95,
                                    'message': 'Enhancement complete! Processing images...',
                                    'stage': 'processing_images'
                                })
                            
                            # Process all generated images with AWS S3 storage
                            result_images = []
                            aws_s3_paths = []
                            
                            for node_id, node_output in outputs.items():
                                if 'images' in node_output:
                                    for img_info in node_output['images']:
                                        filename = img_info['filename']
                                        subfolder = img_info.get('subfolder', '')
                                        
                                        # Only process the final enhanced images from SaveImage node (38)
                                        if node_id == "38":  # SaveImage node
                                            logger.info(f"📸 Processing enhanced image: {filename}")
                                            
                                            # Download raw image bytes from ComfyUI
                                            image_data_bytes = get_image_bytes_from_comfyui(filename, subfolder)
                                            
                                            if image_data_bytes:
                                                # Create unique filename with timestamp and job_id
                                                timestamp = int(time.time() * 1000)
                                                base_name = os.path.splitext(filename)[0]
                                                extension = os.path.splitext(filename)[1]
                                                unique_filename = f"{base_name}_{timestamp}_{job_id.split('_')[-1]}{extension}"
                                                
                                                # Upload to AWS S3 if user_id is provided
                                                aws_s3_result = {}
                                                if user_id and user_id != 'unknown':
                                                    aws_s3_result = upload_image_to_aws_s3(
                                                        image_data_bytes, 
                                                        user_id, 
                                                        unique_filename,
                                                        subfolder
                                                    )
                                                    if aws_s3_result.get('success'):
                                                        aws_s3_paths.append({
                                                            'filename': unique_filename,
                                                            'subfolder': subfolder,
                                                            'type': img_info.get('type', 'output'),
                                                            'awsS3Key': aws_s3_result.get('awsS3Key'),
                                                            'awsS3Url': aws_s3_result.get('awsS3Url'),
                                                            'file_size': aws_s3_result.get('fileSize', len(image_data_bytes))
                                                        })
                                                        logger.info(f"✅ Enhanced image saved to AWS S3: {aws_s3_result.get('awsS3Url')}")
                                                
                                                # Store AWS S3 data for the database
                                                image_data = {
                                                    'filename': unique_filename,
                                                    'subfolder': subfolder,
                                                    'type': img_info.get('type', 'output'),
                                                    'awsS3Key': aws_s3_result.get('awsS3Key') if user_id != 'unknown' else None,
                                                    'awsS3Url': aws_s3_result.get('awsS3Url') if user_id != 'unknown' else None,
                                                    'fileSize': aws_s3_result.get('fileSize', len(image_data_bytes))
                                                }
                                                result_images.append(image_data)
                                                logger.info(f"✅ Enhanced image processed: {unique_filename}")
                                            else:
                                                logger.error(f"❌ Failed to download enhanced image: {filename}")
                            
                            if result_images:
                                logger.info(f"✅ Image-to-image skin enhancement completed with {len(result_images)} images")
                                
                                # Get timing for elapsed time calculation
                                elapsed_time = attempt * 1  # 1 second per attempt
                                total_images = len(result_images)
                                
                                if webhook_url:
                                    # Generate resultUrls from AWS S3 URLs (direct URLs)
                                    resultUrls = []
                                    for aws_data in aws_s3_paths:
                                        if aws_data.get('awsS3Url'):
                                            resultUrls.append(aws_data['awsS3Url'])
                                            logger.info(f"✅ Added AWS S3 URL: {aws_data['awsS3Url']}")
                                    
                                    completion_data = {
                                        "job_id": job_id,
                                        "status": "COMPLETED", 
                                        "progress": 100,
                                        "message": f"✅ Image-to-image skin enhancement completed successfully!",
                                        "stage": "completed",
                                        "elapsedTime": elapsed_time,
                                        "imageCount": total_images,
                                        "totalImages": total_images,
                                        "aws_s3_paths": aws_s3_paths,  # AWS S3 paths for database storage
                                        "resultUrls": resultUrls,  # Direct AWS S3 URLs for frontend display  
                                    }
                                    send_webhook(webhook_url, completion_data)
                                    logger.info(f"📤 Sent completion webhook with {len(aws_s3_paths)} AWS S3 paths and {len(resultUrls)} result URLs")
                                
                                return {
                                    'success': True,
                                    'status': 'completed',
                                    'images': result_images,
                                    'aws_s3_paths': aws_s3_paths,
                                    'message': f'Successfully enhanced {len(result_images)} images with image-to-image skin enhancement'
                                }
                            else:
                                logger.error("❌ No valid enhanced images found")
                                if webhook_url:
                                    send_webhook(webhook_url, {
                                        'job_id': job_id,
                                        'status': 'FAILED',
                                        'progress': 100,
                                        'message': 'Image-to-image skin enhancement failed - no valid images generated'
                                    })
                                
                                return {
                                    'success': False,
                                    'status': 'failed',
                                    'error': 'No valid enhanced images found'
                                }
                
                # Send progress updates with enhanced staging
                elapsed_time = attempt * 1
                if elapsed_time < 20:
                    current_progress = 15 + (elapsed_time / 20) * 15  # 15% to 30% - Loading models
                    stage_message = "🧠 Loading AI models and face parsing components..."
                elif elapsed_time < 60:
                    # Face parsing and mask generation (40 seconds)
                    face_progress = (elapsed_time - 20) / 40
                    current_progress = 30 + face_progress * 25  # 30% to 55% - Face analysis
                    stage_message = f"🎭 Analyzing faces and generating masks... ({int(face_progress * 100)}%)"
                elif elapsed_time < 120:
                    # Image enhancement phase (60 seconds)
                    enhance_progress = (elapsed_time - 60) / 60
                    current_progress = 55 + enhance_progress * 30  # 55% to 85% - Enhancement
                    stage_message = f"✨ Enhancing skin details with AI... ({int(enhance_progress * 100)}%)"
                else:
                    current_progress = min(90, 85 + (elapsed_time - 120) / 60 * 5)  # 85% to 90% - Finalizing
                    stage_message = "🎯 Applying final touches and optimizations..."
                
                # Send enhanced progress updates every 5% or stage change
                if current_progress - last_progress_update >= 5:
                    send_webhook(webhook_url, {
                        'job_id': job_id,
                        'status': 'PROCESSING',
                        'progress': int(current_progress),
                        'message': stage_message,
                        'elapsed_time': elapsed_time,
                        'stage': 'processing',
                        'estimated_remaining': max(0, 360 - elapsed_time)  # 6 min estimate
                    })
                    last_progress_update = current_progress
                    logger.info(f"📊 Enhanced progress: {int(current_progress)}% - {stage_message}")
                
                attempt += 1
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Error checking progress: {e}")
                attempt += 1
                time.sleep(1)
        
        # Timeout reached
        logger.error(f"❌ Image-to-image skin enhancement timeout for prompt {prompt_id}")
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 100,
                'message': 'Image-to-image skin enhancement timeout'
            })
        
        return {
            'success': False,
            'status': 'failed',
            'error': 'Image-to-image skin enhancement timeout'
        }
    
    except Exception as e:
        logger.error(f"❌ Progress monitoring failed: {e}")
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 100,
                'message': f'Image-to-image skin enhancement failed: {str(e)}'
            })
        
        return {
            'success': False,
            'status': 'failed',
            'error': str(e)
        }

def run_image_to_image_skin_enhancement_generation(job_input, job_id, webhook_url):
    """Execute the actual image-to-image skin enhancement generation process"""
    logger.info(f"🎨 Starting image-to-image skin enhancement generation for job: {job_id}")
    
    try:
        # Initial status
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 5,
                'message': 'Initializing image-to-image skin enhancement system...'
            })
        
        # Prepare ComfyUI environment
        if not prepare_comfyui_environment():
            error_msg = "Failed to prepare ComfyUI environment"
            if webhook_url:
                send_webhook(webhook_url, {
                    'job_id': job_id,
                    'status': 'FAILED',
                    'progress': 100,
                    'message': error_msg
                })
            return {
                'success': False,
                'status': 'failed',
                'error': error_msg
            }
        
        # Environment ready
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 20,
                'message': 'ComfyUI environment ready, starting generation...'
            })
        
        # Validate inputs
        if 'workflow' not in job_input:
            raise ValueError("No workflow provided")
        
        workflow = job_input['workflow']
        params = job_input.get('params', {})
        
        logger.info(f"📋 Enhancement params: {params}")
        
        # Validate workflow
        if not validate_image_to_image_skin_enhancement_workflow(workflow):
            raise ValueError("Invalid image-to-image skin enhancement workflow")
        
        # Queue workflow with ComfyUI
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 30,
            'message': 'Queueing image-to-image skin enhancement workflow...'
        })
        
        prompt_id = queue_image_to_image_skin_enhancement_workflow(workflow, job_id)
        if not prompt_id:
            raise RuntimeError("Failed to queue image-to-image skin enhancement workflow")
        
        # Monitor progress and wait for completion
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 35,
            'message': 'Starting image-to-image skin enhancement process...',
            'prompt_id': prompt_id
        })
        
        # Extract user_id for S3 storage
        user_id = job_input.get('user_id', 'unknown')
        
        result = monitor_image_to_image_skin_enhancement_progress(prompt_id, job_id, webhook_url, user_id)
        
        if result['success']:
            logger.info(f"✅ Image-to-image skin enhancement completed successfully for job: {job_id}")
            return result
        else:
            logger.error(f"❌ Image-to-image skin enhancement failed for job: {job_id} - {result.get('error', 'Unknown error')}")
            return result
    
    except Exception as e:
        error_msg = f"Image-to-image skin enhancement failed: {str(e)}"
        logger.error(f"❌ {error_msg}")
        
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 100,
                'message': error_msg
            })
        
        return {
            'success': False,
            'status': 'failed',
            'error': error_msg
        }

def handler(job):
    """RunPod serverless handler for image-to-image skin enhancement"""
    job_input = job['input']
    action = job_input.get('action', 'enhance_skin_image_to_image')
    
    try:
        # Use provided job ID or generate one if not provided
        job_id = job_input.get('job_id')
        if not job_id:
            job_id = f"img2img_skin_enhancer_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
            logger.warning(f"⚠️ No job_id provided, generated: {job_id}")
        else:
            logger.info(f"✅ Using provided job_id: {job_id}")
        
        # Extract webhook URL
        webhook_url = job_input.get('webhook_url')
        
        logger.info(f"🎨 Processing image-to-image skin enhancement job: {job_id}")
        logger.info(f"📞 Webhook URL: {webhook_url}")
        
        # Handle image-to-image skin enhancement
        if action == 'enhance_skin_image_to_image':
            result = run_image_to_image_skin_enhancement_generation(job_input, job_id, webhook_url)
            
            return {
                'job_id': job_id,
                'action': action,
                'success': result['success'],
                'status': result['status'],
                'images': result.get('images', []),
                'aws_s3_paths': result.get('aws_s3_paths', []),
                'message': result.get('message', result.get('error', 'Unknown')),
                'error': result.get('error') if not result['success'] else None
            }
        else:
            error_msg = f"Unknown action: {action}"
            logger.error(f"❌ {error_msg}")
            
            if webhook_url:
                send_webhook(webhook_url, {
                    'job_id': job_id,
                    'status': 'FAILED',
                    'progress': 100,
                    'message': error_msg
                })
            
            return {
                'job_id': job_id,
                'action': action,
                'success': False,
                'status': 'failed',
                'error': error_msg
            }
    
    except Exception as e:
        error_msg = f"Handler error: {str(e)}"
        logger.error(f"❌ {error_msg}")
        
        return {
            'job_id': 'unknown',
            'action': job_input.get('action', 'unknown'),
            'success': False,
            'status': 'failed',
            'error': error_msg
        }

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎨 Starting RunPod Image-to-Image Skin Enhancement handler...")
    runpod.serverless.start({"handler": handler})