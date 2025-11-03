#!/usr/bin/env python3
"""
RunPod Serverless Han        # Validate required nodes for simplified skin enhancement workflow
        required_nodes = ["8", "31", "39", "41", "100", "102", "103", "104", "105", "106", "107", "108", "113", "114", "115", "115_2", "118", "119"]  # Complete simplified workflow
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"❌ Missing required node: {node_id}")
                return Falseor Skin Enhancement using ComfyUI
Supports:
- Skin enhancement with FLUX + realistic LoRAs
- Face-focused enhancement using PersonMaskUltra
- Eye enhancement with face parsing
- Multiple enhancement passes
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

def validate_skin_enhancement_workflow(workflow: Dict) -> bool:
    """Validate the ComfyUI workflow JSON structure for skin enhancement (simplified)"""
    try:
        if not isinstance(workflow, dict):
            logger.error("❌ Workflow must be a dictionary")
            return False
        
        # Check for required nodes for simplified skin enhancement
        required_nodes = ["8", "31", "39", "41", "114", "104", "115", "115_2"]  # Removed complex mask nodes
        for node_id in required_nodes:
            if node_id not in workflow:
                logger.error(f"❌ Missing required node: {node_id}")
                return False
        
        # Validate node structure and clean up problematic LoRA configurations
        for node_id, node in workflow.items():
            if not isinstance(node, dict):
                logger.error(f"❌ Node {node_id} must be a dictionary")
                return False
                
            if "class_type" not in node:
                logger.error(f"❌ Node {node_id} missing class_type")
                return False
            
            # Optimize LoRA loading to prevent shape errors
            if node.get('class_type') == 'LoraLoader':
                inputs = node.get('inputs', {})
                lora_name = inputs.get('lora_name', '')
                
                # Ensure strength is reasonable to prevent model conflicts
                if 'strength_model' in inputs:
                    strength = inputs['strength_model']
                    if strength > 1.0:
                        inputs['strength_model'] = min(strength, 1.0)
                        logger.info(f"🔧 Capped LoRA strength for {lora_name}: {strength} -> {inputs['strength_model']}")
        
        logger.info("✅ Simplified skin enhancement workflow validation passed")
        return True
    
    except Exception as e:
        logger.error(f"❌ Workflow validation error: {e}")
        return False

def fix_lora_paths(workflow):
    """Fix LoRA paths to match ComfyUI's expected format"""
    try:
        for node_id, node in workflow.items():
            # Check for both LoraLoader and LoraLoaderModelOnly
            if isinstance(node, dict) and node.get('class_type') in ['LoraLoader', 'LoraLoaderModelOnly']:
                lora_name = node['inputs'].get('lora_name', '')
                
                # If LoRA name starts with user_ and doesn't contain /, add the subdirectory
                if lora_name.startswith('user_') and '/' not in lora_name and lora_name != 'real-humans-PublicPrompts.safetensors' and lora_name != 'more_details.safetensors':
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

def queue_skin_enhancement_workflow(workflow, job_id):
    """Queue skin enhancement workflow with ComfyUI"""
    try:
        # Fix LoRA paths before sending workflow
        workflow = fix_lora_paths(workflow)
        
        queue_url = "http://localhost:8188/prompt"
        
        # Debug: Log LoRA usage in workflow
        lora_nodes_found = 0
        enhancement_loras = []
        for node_id, node in workflow.items():
            if isinstance(node, dict) and node.get('class_type') == 'LoraLoader':
                lora_nodes_found += 1
                lora_name = node['inputs'].get('lora_name', 'Unknown')
                lora_strength = node['inputs'].get('strength_model', 'Unknown')
                enhancement_loras.append(f"Node {node_id}: {lora_name} (strength: {lora_strength})")
                logger.info(f"🎭 Found enhancement LoRA in node {node_id}: {lora_name} (strength: {lora_strength})")
        
        logger.info(f"📊 Total enhancement LoRA nodes found: {lora_nodes_found}")
        logger.info(f"🎭 Enhancement LoRAs: {enhancement_loras}")
        
        # Prepare payload with unique client_id to prevent caching
        unique_client_id = f"runpod-skin-enhancer-{job_id}-{int(time.time())}-{os.urandom(4).hex()}"
        payload = {
            "prompt": workflow,
            "client_id": unique_client_id
        }
        
        logger.info(f"📡 Sending skin enhancement to ComfyUI: {queue_url}")
        
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
        
        logger.info(f"✅ Skin enhancement workflow queued successfully with prompt_id: {prompt_id}")
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
        print("🔧 Preparing ComfyUI environment for skin enhancement...")
        
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
        if not verify_skin_enhancement_models():
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

def download_model_file(url: str, target_path: str, model_name: str) -> bool:
    """Download a model file from URL to target path with progress tracking"""
    try:
        # Check if file already exists and has reasonable size
        if os.path.exists(target_path):
            file_size = os.path.getsize(target_path)
            if file_size > 1024 * 1024:  # At least 1MB
                print(f"✅ Model already exists: {model_name} ({file_size / 1024 / 1024:.1f}MB)")
                return True
        
        print(f"📥 Downloading {model_name}...")
        print(f"   From: {url}")
        print(f"   To: {target_path}")
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        
        # Create temporary file to avoid partial downloads
        temp_path = target_path + ".tmp"
        
        # Download with progress tracking and longer timeout for large models
        response = requests.get(url, stream=True, timeout=600)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r📥 Downloading {model_name}: {percent:.1f}% ({downloaded / 1024 / 1024:.1f}MB)", end='')
        
        # Move temp file to final location
        os.rename(temp_path, target_path)
        
        print(f"\n✅ Successfully downloaded {model_name} ({downloaded / 1024 / 1024:.1f}MB)")
        return True
        
    except Exception as e:
        print(f"\n❌ Failed to download {model_name}: {e}")
        # Clean up temp file if it exists
        temp_path = target_path + ".tmp"
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return False

def download_missing_models() -> bool:
    """Download missing models to network volume storage"""
    try:
        models_path = get_models_path()
        print(f"🔧 Downloading missing models to: {models_path}")
        
        # Model download URLs (using HuggingFace and reliable sources)
        model_downloads = {
            'unet/flux1-dev.safetensors': 'https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors',
            'clip/t5xxl_fp16.safetensors': 'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors',
            'clip/ViT-L-14-TEXT-detail-improved-hiT-GmP-HF.safetensors': 'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors',
            'vae/ae.safetensors': 'https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors',
            'checkpoints/epicrealismXL_v8Kiss.safetensors': 'https://huggingface.co/frankjoshua/epicrealismXL_v8Kiss/resolve/main/epicrealismXL_v8Kiss.safetensors',
            'loras/real-humans-PublicPrompts.safetensors': 'https://huggingface.co/PublicPrompts/real-humans/resolve/main/real-humans-PublicPrompts.safetensors',
            'loras/more_details.safetensors': 'https://huggingface.co/0x4f/more_details/resolve/main/more_details.safetensors'
        }
        
        downloaded_any = False
        successful_downloads = []
        failed_downloads = []
        
        # Track download progress
        total_models = len(model_downloads)
        current_model = 0
        
        for model_path, download_url in model_downloads.items():
            current_model += 1
            target_path = os.path.join(models_path, model_path)
            
            print(f"📋 Processing model {current_model}/{total_models}: {model_path}")
            
            # Check if model already exists and has reasonable size
            if os.path.exists(target_path):
                file_size = os.path.getsize(target_path)
                if file_size > 1024 * 1024:  # At least 1MB
                    print(f"✅ Model already exists: {model_path} ({file_size / 1024 / 1024:.1f}MB)")
                    continue
            
            print(f"📦 Downloading missing model: {model_path}")
            
            # Download the model
            if download_model_file(download_url, target_path, model_path):
                downloaded_any = True
                successful_downloads.append(model_path)
                print(f"✅ Successfully downloaded {current_model}/{total_models}: {model_path}")
            else:
                failed_downloads.append(model_path)
                print(f"❌ Failed to download {current_model}/{total_models}: {model_path}")
        
        # Create a download log file to track what was downloaded
        log_path = os.path.join(models_path, '.download_log.txt')
        with open(log_path, 'w') as f:
            f.write(f"Download completed at: {time.time()}\n")
            f.write(f"Successful downloads: {len(successful_downloads)}\n")
            f.write(f"Failed downloads: {len(failed_downloads)}\n")
            if successful_downloads:
                f.write("Successfully downloaded:\n")
                for model in successful_downloads:
                    f.write(f"  - {model}\n")
            if failed_downloads:
                f.write("Failed to download:\n")
                for model in failed_downloads:
                    f.write(f"  - {model}\n")
        
        if downloaded_any:
            print("🎉 Successfully downloaded missing models to network volume!")
            print("⚡ Future cold starts will be much faster!")
            if successful_downloads:
                print(f"📥 Downloaded {len(successful_downloads)} models: {', '.join(successful_downloads)}")
        else:
            print("✅ All required models already exist in network volume")
        
        if failed_downloads:
            print(f"⚠️  Warning: {len(failed_downloads)} models failed to download: {', '.join(failed_downloads)}")
            print("   These will be downloaded again next time if still missing")
        
        return True
        
    except Exception as e:
        print(f"❌ Error downloading models: {e}")
        return False

def verify_skin_enhancement_models() -> bool:
    """Verify that required model files exist for skin enhancement, download if missing"""
    try:
        models_path = get_models_path()
        
        # Check for required model directories and specific models for skin enhancement
        required_models = {
            'unet': ['flux1-dev.safetensors'],
            'clip': ['t5xxl_fp16.safetensors', 'ViT-L-14-TEXT-detail-improved-hiT-GmP-HF.safetensors'],
            'vae': ['ae.safetensors'],
            'checkpoints': ['epicrealismXL_v8kiss.safetensors', 'epicrealismXL_v8Kiss.safetensors'],  # Allow both variants
            'loras': ['real-humans-PublicPrompts.safetensors', 'more_details.safetensors']  # TI - Girl Version is optional
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
                    missing_models.append(f"{dir_name}/epicrealismXL_v8Kiss.safetensors")
            else:
                # For other directories, check each required model
                for model_file in model_files:
                    if model_file not in files_in_dir:
                        missing_models.append(f"{dir_name}/{model_file}")
        
        # If models are missing, try to download them
        if missing_models:
            print(f"📦 Missing models detected: {missing_models}")
            print("🔄 Downloading missing models to network volume for faster future cold starts...")
            print("⚡ This will make subsequent generations much faster!")
            
            if download_missing_models():
                # Re-verify after download
                print("🔍 Re-verifying models after download...")
                return verify_skin_enhancement_models()  # Recursive call after download
            else:
                print(f"❌ Could not download all required models: {missing_models}")
                return False
        
        # For other LoRA models (influencer), we'll handle missing ones dynamically in the workflow
        # Check if TI - Girl Version exists for fallback, otherwise use first available LoRA
        loras_dir = os.path.join(models_path, 'loras')
        fallback_lora = None
        if os.path.exists(loras_dir):
            lora_files = os.listdir(loras_dir)
            # Prefer TI - Girl Version if available
            if 'TI - Girl Version.safetensors' in lora_files:
                fallback_lora = 'TI - Girl Version.safetensors'
            else:
                # Find any available user LoRA as fallback
                user_loras = [f for f in lora_files if f.endswith('.safetensors') and 'user_' in f]
                if user_loras:
                    fallback_lora = user_loras[0]
                    print(f"💡 Using fallback LoRA: {fallback_lora}")
        
        print(f"📦 Available fallback LoRA: {fallback_lora}")
            
        print("✅ All required model directories and files found for skin enhancement")
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
            "--disable-server-log",  # Reduce logging overhead
            "--cpu-vae",  # Use CPU for VAE to save VRAM during startup
            "--disable-cuda-malloc",  # Faster CUDA startup
            "--dont-upcast-attention",  # Speed optimization
            "--use-split-cross-attention",  # Memory optimization
            "--disable-metadata"  # Skip metadata processing for faster startup
        ]
        
        # Set environment variables to speed up startup
        env = os.environ.copy()
        env['COMFYUI_MANAGER_NO_AUTO_UPDATE'] = '1'  # Disable ComfyUI Manager auto-update
        env['COMFYUI_NO_FETCH_REGISTRY'] = '1'  # Skip registry fetching that takes 5+ minutes
        env['DISABLE_CUSTOM_NODE_AUTO_UPDATE'] = '1'  # Disable custom node updates
        
        # Use optimized startup script if available
        startup_script = "/app/fast_comfyui_start.sh"
        if os.path.exists(startup_script):
            cmd = ["bash", startup_script]
            print("🚀 Using optimized ComfyUI startup script for faster cold start")
        else:
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
        max_wait = 60  # 1 minute - aggressive cold start optimization 
        for i in range(max_wait):
            if i % 3 == 0:  # More frequent status updates for faster feedback
                print(f"⏳ Still waiting for ComfyUI... ({i}/{max_wait}s)")
            
            if process.poll() is not None:
                print(f"❌ ComfyUI process died with return code: {process.returncode}")
                return False
            
            if is_comfyui_running():
                print(f"✅ ComfyUI started successfully after {i} seconds")
                
                # Skip model preloading for faster cold start
                print("⚡ Skipping model preloading for faster cold start")
                print("📝 Models will load on-demand during first generation")
                
                return True
                
            time.sleep(1)
        
        print(f"❌ ComfyUI failed to start within {max_wait} seconds")
        return False
        
    except Exception as e:
        print(f"❌ Error starting ComfyUI: {str(e)}")
        return False

def preload_essential_models():
    """Skip preloading to reduce cold start time - models will load during actual generation"""
    try:
        print("⚡ Skipping model preloading for faster cold start")
        print("📝 Models will load on-demand during first generation")
        # Models will be loaded lazily during the actual workflow execution
        # This reduces cold start time from 6+ minutes to ~30 seconds
        return True
            
    except Exception as e:
        print(f"⚠️ Preload check failed: {e}, but ComfyUI is ready")
        return True
        
    except Exception as e:
        print(f"❌ Error starting ComfyUI: {str(e)}")
        return False

def queue_workflow_with_comfyui(workflow: Dict, job_id: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"🎨 Queueing skin enhancement workflow with ComfyUI for job {job_id}")
        
        # Fix LoRA paths before sending workflow
        workflow = fix_lora_paths(workflow)
        
        # ComfyUI API endpoint
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        queue_url = f"{comfyui_url}/prompt"
        
        # Debug: Show the workflow being sent
        logger.info("🔍 === SKIN ENHANCEMENT WORKFLOW DEBUG ===")
        
        # Find LoRA nodes in workflow
        lora_nodes_found = 0
        enhancement_loras = []
        
        for node_id, node in workflow.items():
            if node.get('class_type') in ['LoraLoader', 'LoraLoaderModelOnly'] and 'inputs' in node:
                lora_nodes_found += 1
                node_type = node.get('class_type')
                lora_name = node['inputs'].get('lora_name', 'Unknown')
                lora_strength = node['inputs'].get('strength_model', 0)
                enhancement_loras.append(f"Node {node_id}: {lora_name} (strength: {lora_strength}, type: {node_type})")
                logger.info(f"🎭 Found LoRA node {node_id} ({node_type}): {lora_name} (strength: {lora_strength})")
        
        if lora_nodes_found > 1:
            logger.info(f"🎨 Multi-LoRA Configuration Detected:")
            for i, lora_info in enumerate(enhancement_loras, 1):
                logger.info(f"   LoRA {i}: {lora_info}")
        
        logger.info(f"📊 Total LoRA nodes found: {lora_nodes_found}")
        logger.info(f"🎭 Enhancement LoRAs: {enhancement_loras}")
        
        # Prepare payload with unique client_id to prevent caching
        unique_client_id = f"runpod-skin-enhancer-{job_id}-{int(time.time())}-{os.urandom(4).hex()}"
        payload = {
            "prompt": workflow,
            "client_id": unique_client_id
        }
        
        logger.info(f"📡 Sending skin enhancement to ComfyUI: {queue_url}")
        
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
        
        logger.info(f"✅ Skin enhancement workflow queued successfully with prompt_id: {prompt_id}")
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
            import base64
            return base64.b64encode(response.content).decode('utf-8')
        else:
            logger.error(f"Failed to download image {filename}: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Error downloading image {filename}: {e}")
        return None

def get_comfyui_queue_status(comfyui_url: str):
    """Get current queue status from ComfyUI"""
    try:
        response = requests.get(f"{comfyui_url}/queue", timeout=5)
        if response.status_code == 200:
            queue_data = response.json()
            return queue_data
    except:
        pass
    return None

def get_comfyui_progress_status(comfyui_url: str) -> Optional[Dict]:
    """Get ComfyUI internal progress status for more accurate tracking"""
    try:
        response = requests.get(f"{comfyui_url}/progress", timeout=5)
        if response.status_code == 200:
            progress_data = response.json()
            # ComfyUI progress format: {'max': total_steps, 'value': current_step, 'node': current_node}
            return progress_data
    except:
        pass
    return None

def get_comfyui_history_status(comfyui_url: str, prompt_id: str) -> Optional[Dict]:
    """Get specific prompt execution history from ComfyUI"""
    try:
        response = requests.get(f"{comfyui_url}/history/{prompt_id}", timeout=5)
        if response.status_code == 200:
            history_data = response.json()
            if prompt_id in history_data:
                return history_data[prompt_id]
    except:
        pass
    return None

def monitor_skin_enhancement_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = 'unknown') -> Dict:
    """Monitor ComfyUI progress for skin enhancement with real-time updates and ComfyUI integration"""
    try:
        logger.info(f"👀 Starting enhanced real-time progress monitoring for prompt {prompt_id}")
        
        # Send initial monitoring webhook with enhanced data
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 5,
            'message': '🎨 Initializing skin enhancement monitoring...',
            'stage': 'starting',
            'workflow_type': 'skin_enhancement',
            'estimated_time': '3-5 minutes',
            'steps_total': 65  # 40 FLUX steps + 25 enhancement steps
        })
        
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://localhost:8188')
        history_url = f"{comfyui_url}/history/{prompt_id}"
        
        max_attempts = 900  # 15 minutes for complex skin enhancement
        attempt = 0
        last_progress_update = 5
        
        while attempt < max_attempts:
            try:
                # Get queue status for better progress tracking
                queue_status = get_comfyui_queue_status(comfyui_url)
                if queue_status:
                    running = queue_status.get('queue_running', [])
                    pending = queue_status.get('queue_pending', [])
                    
                    if running:
                        # Job is currently running - get accurate ComfyUI progress
                        elapsed_time = attempt * 1  # 1 second per attempt
                        
                        # Try to get accurate progress from ComfyUI progress API
                        progress_status = get_comfyui_progress_status(comfyui_url)
                        
                        if progress_status and progress_status.get('max', 0) > 0:
                            # Use actual ComfyUI progress when available
                            current_step = progress_status.get('value', 0)
                            total_steps = progress_status.get('max', 1)
                            current_node = progress_status.get('node', 'unknown')
                            
                            # Calculate accurate progress percentage
                            step_progress = (current_step / total_steps) * 100
                            
                            # Map to our workflow stages for better UX
                            if step_progress < 20:
                                current_progress = 15 + step_progress  # 15% to 35%
                                stage_message = f"🧠 Loading AI models... ({current_step}/{total_steps} steps)"
                                stage_emoji = "🔧"
                            elif step_progress < 65:  # FLUX generation (40 steps)
                                current_progress = 35 + (step_progress - 20) * 0.6  # 35% to 62%
                                stage_message = f"✨ FLUX AI generation... ({current_step}/{total_steps} steps)"
                                stage_emoji = "🎨"
                            else:  # Enhancement phase (25 steps)
                                current_progress = 62 + (step_progress - 65) * 0.8  # 62% to 90%
                                stage_message = f"💫 Enhancing skin details... ({current_step}/{total_steps} steps)"
                                stage_emoji = "💎"
                        else:
                            # Fallback to time-based progress estimation
                            if elapsed_time < 15:
                                current_progress = 15 + (elapsed_time / 15) * 10  # 15% to 25% - Loading models
                                stage_message = "🧠 Loading AI models and LoRAs..."
                                stage_emoji = "🔧"
                            elif elapsed_time < 45:
                                # FLUX generation stage (40 steps, ~30 seconds)
                                flux_progress = (elapsed_time - 15) / 30  # 0 to 1
                                current_progress = 25 + flux_progress * 35  # 25% to 60% - FLUX generation
                                stage_message = f"✨ Generating initial image with FLUX AI... ({int(flux_progress * 40)}/40 steps)"
                                stage_emoji = "🎨"
                            elif elapsed_time < 75:
                                # Skin enhancement stage (25 steps, ~30 seconds)
                                enhance_progress = (elapsed_time - 45) / 30  # 0 to 1
                                current_progress = 60 + enhance_progress * 25  # 60% to 85% - Enhancement
                                stage_message = f"💫 Enhancing skin details and texture... ({int(enhance_progress * 25)}/25 steps)"
                                stage_emoji = "💎"
                            elif elapsed_time < 90:
                                current_progress = 85 + ((elapsed_time - 75) / 15) * 10  # 85% to 95% - Processing
                                stage_message = "🎯 Applying final enhancements and optimizations..."
                                stage_emoji = "🔥"
                            else:
                                current_progress = min(95, 95 + (elapsed_time - 90) / 30 * 3)  # 95% to 98% - Finalizing
                                stage_message = "📸 Finalizing enhanced images..."
                                stage_emoji = "✨"
                        
                        # Send enhanced progress updates every 2% or stage change
                        if current_progress - last_progress_update >= 2:
                            send_webhook(webhook_url, {
                                'job_id': job_id,
                                'status': 'PROCESSING',
                                'progress': int(current_progress),
                                'message': stage_message,
                                'queue_position': len(pending),
                                'is_processing': True,
                                'elapsed_time': elapsed_time,
                                'stage': 'processing',
                                'workflow_stage': stage_emoji,
                                'estimated_remaining': max(0, 300 - elapsed_time)  # 5 min estimate
                            })
                            last_progress_update = current_progress
                            logger.info(f"📊 Enhanced progress: {int(current_progress)}% - {stage_message}")
                    elif pending:
                        # Job is in queue - provide dynamic queue progress
                        queue_position = len(pending)
                        
                        # Find our job position in the queue
                        our_position = None
                        for idx, item in enumerate(pending):
                            if len(item) >= 2 and item[1] == prompt_id:
                                our_position = idx + 1  # 1-based position
                                break
                        
                        if our_position:
                            # Progress from 5% to 15% based on queue movement
                            queue_progress = 5 + min(10, (queue_position - our_position + 1) / max(queue_position, 1) * 10)
                            message = f'Queued for processing (position {our_position} of {queue_position})'
                        else:
                            queue_progress = 10
                            message = f'Processing queue ({queue_position} jobs ahead)'
                        
                        send_webhook(webhook_url, {
                            'job_id': job_id,
                            'status': 'PROCESSING',
                            'progress': int(queue_progress),
                            'message': message,
                            'queue_position': our_position or queue_position,
                            'total_queued': queue_position,
                            'is_processing': False,
                            'stage': 'queued'
                        })
                
                # Check if generation is complete
                response = requests.get(history_url, timeout=10)
                
                if response.status_code == 200:
                    history = response.json()
                    
                    if prompt_id in history:
                        result_data = history[prompt_id]
                        
                        # Check if generation completed successfully
                        if 'outputs' in result_data:
                            outputs = result_data['outputs']
                            logger.info(f"✅ Skin enhancement completed! Processing outputs...")
                            
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
                            
                            # Get user_id from function parameter (passed from run_skin_enhancement_generation)
                            # user_id already available as function parameter
                            
                            for node_id, node_output in outputs.items():
                                if 'images' in node_output:
                                    for img_info in node_output['images']:
                                        filename = img_info['filename']
                                        subfolder = img_info.get('subfolder', '')
                                        
                                        # Only process the final enhanced skin image, skip intermediate flux_initial
                                        if 'flux_initial' in filename:
                                            logger.info(f"⏭️ Skipping intermediate image: {filename}")
                                            continue
                                        
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
                                logger.info(f"✅ Skin enhancement completed with {len(result_images)} images")
                                
                                # Get timing for elapsed time calculation
                                elapsed_time = attempt * 1  # 1 second per attempt
                                total_images = len(result_images)
                                
                                if webhook_url:
                                    # Send enhanced skin images one by one to avoid 413 payload size errors (chunked upload)
                                    logger.info(f"📤 Sending {total_images} enhanced skin image{'s' if total_images > 1 else ''} via chunked webhooks")
                                    
                                    for image_count, img in enumerate(result_images, 1):
                                        try:
                                            logger.info(f"🎨 Processing enhanced skin image {image_count} of {total_images}: {img['filename']}")
                                            
                                            # Send IMAGE_READY webhook for individual enhanced skin image
                                            if webhook_url and total_images > 1:
                                                chunk_progress = 95 + (image_count / total_images) * 5  # 95-100% for image processing
                                                logger.info(f"📤 Sending chunked enhanced skin image {image_count}/{total_images} via webhook")
                                                send_webhook(webhook_url, {
                                                    "job_id": job_id,
                                                    "status": "IMAGE_READY",
                                                    "progress": chunk_progress,
                                                    "message": f"🎨 Enhanced skin image {image_count} of {total_images} ready",
                                                    "stage": "uploading_images",
                                                    "elapsedTime": elapsed_time,
                                                    "imageCount": image_count,
                                                    "totalImages": total_images,
                                                    "image": img  # Single image for chunked upload (S3 path only)
                                                })
                                        
                                        except Exception as e:
                                            logger.error(f"❌ Failed to send chunked enhanced skin image {image_count}: {e}")
                                    
                                    # Send final completion webhook with AWS S3 paths
                                    logger.info(f"📤 Sending completion webhook with {len(aws_s3_paths)} AWS S3 paths")
                                    
                                    # Generate resultUrls from AWS S3 URLs (direct URLs)
                                    resultUrls = []
                                    for aws_data in aws_s3_paths:
                                        if aws_data.get('awsS3Url'):
                                            resultUrls.append(aws_data['awsS3Url'])
                                            logger.info(f"✅ Added AWS S3 URL: {aws_data['awsS3Url']}")
                                    
                                    # Log AWS S3 paths for debugging
                                    for aws_data in aws_s3_paths:
                                        logger.info(f"📍 AWS S3 key: {aws_data.get('awsS3Key')}")
                                    
                                    completion_data = {
                                        "job_id": job_id,
                                        "status": "COMPLETED", 
                                        "progress": 100,
                                        "message": f"✅ All {total_images} enhanced skin image{'' if total_images == 1 else 's'} completed!",
                                        "stage": "completed",
                                        "elapsedTime": elapsed_time,
                                        "imageCount": total_images,
                                        "totalImages": total_images,
                                        "aws_s3_paths": aws_s3_paths,  # AWS S3 paths for database storage (bandwidth optimized)
                                        "resultUrls": resultUrls,  # Direct AWS S3 URLs for frontend display  
                                        # NO 'images' array - pure AWS S3 optimization
                                    }
                                    send_webhook(webhook_url, completion_data)
                                    logger.info(f"📤 Sent completion webhook with {len(aws_s3_paths)} AWS S3 paths and {len(resultUrls)} result URLs")
                                else:
                                    # Return AWS S3 paths even without webhook
                                    completion_data = {
                                        "aws_s3_paths": aws_s3_paths,
                                    }
                                
                                return {
                                    'success': True,
                                    'status': 'completed',
                                    'images': result_images,
                                    'aws_s3_paths': aws_s3_paths,
                                    'message': f'Successfully enhanced skin in {len(result_images)} images'
                                }
                            else:
                                logger.error("❌ No valid enhanced images found")
                                if webhook_url:
                                    send_webhook(webhook_url, {
                                        'job_id': job_id,
                                        'status': 'FAILED',
                                        'progress': 100,
                                        'message': 'Skin enhancement failed - no valid images generated'
                                    })
                                
                                return {
                                    'success': False,
                                    'status': 'failed',
                                    'error': 'No valid enhanced images found'
                                }
                
                # Check for errors in ComfyUI execution
                if response.status_code == 200 and prompt_id in history:
                    result_data = history[prompt_id]
                    if 'status' in result_data and result_data['status'].get('status_str') == 'error':
                        error_details = result_data['status'].get('messages', [])
                        logger.error(f"❌ ComfyUI execution error: {error_details}")
                        if webhook_url:
                            send_webhook(webhook_url, {
                                'job_id': job_id,
                                'status': 'FAILED',
                                'progress': 100,
                                'message': f'Skin enhancement failed: {error_details}'
                            })
                        
                        return {
                            'success': False,
                            'status': 'failed',
                            'error': f'ComfyUI execution error: {error_details}'
                        }
                
                # Send progress updates
                if attempt % 30 == 0 and webhook_url:  # Every 30 seconds
                    progress = min(80, (attempt / max_attempts) * 80)
                    send_webhook(webhook_url, {
                        'job_id': job_id,
                        'status': 'PROCESSING',
                        'progress': progress,
                        'message': f'Enhancing skin... ({attempt}s elapsed)'
                    })
                
                attempt += 1
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Error checking progress: {e}")
                attempt += 1
                time.sleep(1)
        
        # Timeout reached
        logger.error(f"❌ Skin enhancement timeout for prompt {prompt_id}")
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 100,
                'message': 'Skin enhancement timeout'
            })
        
        return {
            'success': False,
            'status': 'failed',
            'error': 'Skin enhancement timeout'
        }
    
    except Exception as e:
        logger.error(f"❌ Progress monitoring failed: {e}")
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'progress': 100,
                'message': f'Skin enhancement failed: {str(e)}'
            })
        
        return {
            'success': False,
            'status': 'failed',
            'error': str(e)
        }

def optimize_workflow_for_portrait(workflow: Dict, params: Dict) -> Dict:
    """Optimize workflow for portrait mode and apply user parameters"""
    try:
        # Portrait dimensions (3:4 aspect ratio optimized for faces)
        portrait_sizes = {
            'small': {'width': 768, 'height': 1024},     # Fast generation
            'medium': {'width': 832, 'height': 1216},    # Balanced (current)
            'large': {'width': 896, 'height': 1344},     # High quality
            'xl': {'width': 1024, 'height': 1536}        # Ultra quality
        }
        
        # Get size preference from params
        size_mode = params.get('portraitSize', 'medium')
        if size_mode not in portrait_sizes:
            size_mode = 'medium'
        
        dimensions = portrait_sizes[size_mode]
        logger.info(f"📐 Setting portrait dimensions: {dimensions['width']}x{dimensions['height']} ({size_mode})")
        
        # Update workflow nodes with portrait dimensions
        for node_id, node in workflow.items():
            if node.get('class_type') in ['FluxGuidance', 'EmptyLatentImage']:
                if 'inputs' in node:
                    if 'width' in node['inputs']:
                        node['inputs']['width'] = dimensions['width']
                    if 'height' in node['inputs']:
                        node['inputs']['height'] = dimensions['height']
                    logger.info(f"✅ Updated node {node_id} to {dimensions['width']}x{dimensions['height']}")
        
        return workflow
        
    except Exception as e:
        logger.error(f"❌ Error optimizing workflow for portrait: {e}")
        return workflow

def run_skin_enhancement_generation(job_input, job_id, webhook_url):
    """Execute the actual skin enhancement generation process"""
    logger.info(f"🎨 Starting skin enhancement generation for job: {job_id}")
    
    try:
        # Initial status
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 5,
                'message': 'Initializing skin enhancement system...'
            })
        
        # Prepare ComfyUI environment (includes model downloading if needed)
        if webhook_url:
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 10,
                'message': 'Checking models in network volume storage...'
            })
        
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
        
        # Environment ready, continue with normal progress
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
        
        # Optimize workflow for portrait mode
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 8,
            'message': 'Optimizing for portrait mode...'
        })
        
        workflow = optimize_workflow_for_portrait(workflow, params)
        
        # Validate workflow
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 15,
            'message': 'Validating skin enhancement workflow...'
        })
        
        if not validate_skin_enhancement_workflow(workflow):
            raise ValueError("Invalid skin enhancement workflow")
        
        # Check if ComfyUI is already running (cold start optimization)
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 20,
            'message': 'Checking ComfyUI status...'
        })
        
        if is_comfyui_running():
            logger.info("🚀 ComfyUI already running - skipping startup!")
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 35,
                'message': 'ComfyUI ready - fast start!'
            })
        else:
            # Prepare ComfyUI environment
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 25,
                'message': 'Starting ComfyUI (cold start)...'
            })
            
            if not prepare_comfyui_environment():
                raise RuntimeError("Failed to prepare ComfyUI environment")
            
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'PROCESSING',
                'progress': 35,
                'message': 'ComfyUI started successfully!'
            })
        
        # Queue workflow with ComfyUI
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 40,
            'message': 'Queueing skin enhancement workflow...'
        })
        
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        if not prompt_id:
            raise RuntimeError("Failed to queue skin enhancement workflow")
        
        # Monitor progress and wait for completion
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'PROCESSING',
            'progress': 45,
            'message': 'Starting skin enhancement process...',
            'prompt_id': prompt_id
        })
        
        # Extract user_id for S3 storage
        user_id = job_input.get('user_id', 'unknown')
        
        result = monitor_skin_enhancement_progress(prompt_id, job_id, webhook_url, user_id)
        
        if result['success']:
            logger.info(f"✅ Skin enhancement completed successfully for job: {job_id}")
            return result
        else:
            logger.error(f"❌ Skin enhancement failed for job: {job_id} - {result.get('error', 'Unknown error')}")
            return result
    
    except Exception as e:
        error_msg = f"Skin enhancement failed: {str(e)}"
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
    """RunPod serverless handler for skin enhancement"""
    job_input = job['input']
    action = job_input.get('action', 'enhance_skin')
    
    try:
        # Use provided job ID or generate one if not provided
        job_id = job_input.get('job_id')
        if not job_id:
            job_id = f"skin_enhancer_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
            logger.warning(f"⚠️ No job_id provided, generated: {job_id}")
        else:
            logger.info(f"✅ Using provided job_id: {job_id}")
        
        # Extract webhook URL
        webhook_url = job_input.get('webhook_url')
        
        logger.info(f"🎨 Processing skin enhancement job: {job_id}")
        logger.info(f"📞 Webhook URL: {webhook_url}")
        
        # Handle skin enhancement
        if action == 'enhance_skin':
            result = run_skin_enhancement_generation(job_input, job_id, webhook_url)
            
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
    logger.info("🎨 Starting RunPod Skin Enhancement handler...")
    runpod.serverless.start({"handler": handler})
