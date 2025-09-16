import runpod
import os
import yaml
import subprocess
import json
import time
import requests
import shutil
from pathlib import Path
import tempfile
import base64
from PIL import Image
import io
import sys
import time
import re
from typing import Dict, List, Any, Optional
import logging
import threading
import boto3
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_to_network_volume(model_file: Path, job_id: str, website_config: Dict, work_dir: Path, job_input: Dict = None) -> Dict:
    """Upload trained model to RunPod network volume via S3 and create database record"""
    try:
        logger.info(f"🚀 Starting network volume upload for {model_file.name}")
        
        # Debug: Log all environment variables that start with RUNPOD_
        runpod_env_vars = {k: v for k, v in os.environ.items() if k.startswith('RUNPOD_')}
        logger.info(f"🔍 RUNPOD environment variables: {list(runpod_env_vars.keys())}")
        
        # Get S3 credentials from environment
        s3_access_key = os.getenv('RUNPOD_S3_ACCESS_KEY')
        s3_secret_key = os.getenv('RUNPOD_S3_SECRET_KEY')
        
        logger.info(f"🔑 S3 Access Key found: {bool(s3_access_key)}")
        logger.info(f"🔑 S3 Secret Key found: {bool(s3_secret_key)}")
        
        if not s3_access_key or not s3_secret_key:
            raise ValueError("S3 credentials not found in environment")
        
        # Initialize S3 client for RunPod network volume
        s3_client = boto3.client(
            's3',
            endpoint_url='https://s3api-us-ks-2.runpod.io',  # RunPod S3 endpoint
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            region_name='us-ks-2'
        )
        
        # Get user ID from website config (should be available in training jobs)
        # Extract user ID from multiple sources
        user_id = (
            # Try job_input level first (where tRPC sends it)
            (job_input.get('user_id') if job_input else None) or
            # Then try website_config
            website_config.get('user_id') or 
            website_config.get('userId') or 
            'unknown_user'
        )
        
        # Create unique filename with timestamp
        timestamp = int(time.time())
        model_name = website_config.get('name', 'trained_model').lower().replace(' ', '_').replace('.', '_')
        unique_filename = f"{user_id}_{timestamp}_{model_name}.safetensors"
        
        # S3 key for the model file - save directly in loras folder  
        s3_key = f"loras/{user_id}/{unique_filename}"
        
        logger.info(f"📦 Uploading to S3 key: {s3_key}")
        
        # Upload to S3
        with open(model_file, 'rb') as file_data:
            s3_client.upload_fileobj(
                file_data,
                '83cljmpqfd',  # Bucket name for RunPod network volume
                s3_key,
                ExtraArgs={'ContentType': 'application/octet-stream'}
            )
        
        # Create ComfyUI path
        comfyui_path = f"loras/{user_id}/{unique_filename}"
        network_path = f"/workspace/ComfyUI/loras/{user_id}/{unique_filename}"
        
        logger.info(f"✅ Model uploaded to network volume: {network_path}")
        
        # Create database record via API call
        lora_record_created = False
        try:
            # Get clerk user ID - try different sources including job_input level
            clerk_user_id = (
                # Try job_input level first (where tRPC sends it)
                (job_input.get('user_id') if job_input else None) or
                # Then try website_config
                website_config.get('clerkId') or 
                website_config.get('clerk_id') or 
                website_config.get('userId') or
                website_config.get('user_id')
            )
            
            if not clerk_user_id:
                logger.warning("⚠️ No clerkId found in website_config, will rely on trainingJobId lookup")
            
            # Prepare LoRA record data
            lora_data = {
                'name': model_name,
                'displayName': website_config.get('name', 'Trained Model'),
                'fileName': unique_filename,
                'originalFileName': model_file.name,
                'fileSize': model_file.stat().st_size,
                'description': f"LoRA model trained from {website_config.get('name', 'training job')}",
                'comfyUIPath': comfyui_path,
                'syncStatus': 'SYNCED',  # Already uploaded to network volume
                'isActive': True,
                'trainingJobId': job_id
            }
            
            # Add clerkId if available
            if clerk_user_id:
                lora_data['clerkId'] = clerk_user_id
            
            # Call the website API to create the record
            api_base_url = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ai.tastycreative.xyz')
            api_url = f"{api_base_url}/api/influencers/training-complete"
            
            logger.info(f"📡 Creating LoRA record via API: {api_url}")
            
            # Debug the authentication key
            training_key = os.getenv("TRAINING_UPLOAD_KEY", "")
            logger.info(f"🔍 Training key length: {len(training_key)}")
            logger.info(f"🔍 Training key first 20 chars: {training_key[:20] if training_key else 'EMPTY'}")
            
            # Create the record via webhook/API call
            response = requests.post(
                api_url,
                json=lora_data,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {training_key}'
                },
                timeout=30
            )
            
            if response.status_code == 200:
                lora_record_created = True
                logger.info("✅ LoRA database record created successfully")
            else:
                logger.warning(f"⚠️ Failed to create LoRA database record: {response.status_code} - {response.text}")
                
        except Exception as db_error:
            logger.error(f"❌ Database record creation failed: {db_error}")
        
        return {
            'success': True,
            'network_path': network_path,
            'comfyui_path': comfyui_path,
            's3_key': s3_key,
            'unique_filename': unique_filename,
            'lora_record_created': lora_record_created
        }
        
    except Exception as e:
        logger.error(f"❌ Network volume upload failed: {e}")
        raise e

def send_webhook_async(webhook_url: str, data: Dict) -> None:
    """Send webhook update asynchronously without blocking"""
    if not webhook_url:
        return
        
    def _send_webhook():
        try:
            # Add headers to bypass ngrok warning page and ensure proper content type
            headers = {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',  # Bypass ngrok warning page
                'User-Agent': 'RunPod-AI-Toolkit/1.0'  # Identify as automated request
            }
            
            logger.info(f"📡 Sending async webhook: {data.get('message', 'No message')}")
            
            response = requests.post(webhook_url, json=data, headers=headers, timeout=10)  # Very short timeout
            response.raise_for_status()
            logger.info(f"✅ Async webhook sent successfully: {data.get('message', 'No message')}")
        except Exception as e:
            logger.error(f"❌ Async webhook failed (non-blocking): {e}")
    
    # Run in background thread
    thread = threading.Thread(target=_send_webhook, daemon=True)
    thread.start()

def send_webhook(webhook_url: str, data: Dict) -> bool:
    """Send webhook update to your website (now uses async)"""
    send_webhook_async(webhook_url, data)
    return True  # Always return True since it's async

def run_training_process(job_input, job_id, webhook_url):
    """Execute the actual training process for serverless"""
    logger.info(f"🎯 Starting training process for job: {job_id}")
    
    try:
        # Initial status
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 5,
            'message': 'Initializing AI-toolkit environment...'
        })
        
        # Validate input
        if 'config' not in job_input:
            raise ValueError("Missing training configuration")
        if 'imageUrls' not in job_input or not job_input['imageUrls']:
            raise ValueError("No training images provided")
        
        # Create working directories
        work_dir = Path("/workspace")
        training_data_path = work_dir / "training_data"
        dataset_path = training_data_path / "images"
        config_path = work_dir / "config.yaml"
        output_path = work_dir / "output"
        logs_path = work_dir / "logs"
        
        # Clean up any existing directory structure
        if training_data_path.exists():
            shutil.rmtree(training_data_path)
        if output_path.exists():
            shutil.rmtree(output_path)
        
        # Create directories
        work_dir.mkdir(exist_ok=True)
        training_data_path.mkdir(parents=True)
        output_path.mkdir(parents=True)
        logs_path.mkdir(exist_ok=True)
        
        logger.info(f"📁 Created working directory: {work_dir}")
        
        # Process training images
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 10,
            'message': 'Processing training images...'
        })
        
        # Download and process images
        logger.info(f"📥 Processing {len(job_input['imageUrls'])} images")
        dataset_path.mkdir(parents=True, exist_ok=True)
        
        # Process each image
        image_count = 0
        for idx, image_info in enumerate(job_input['imageUrls']):
            try:
                # Extract URL from dict or use directly if string
                image_url = image_info['url'] if isinstance(image_info, dict) and 'url' in image_info else image_info
                logger.info(f"📥 Processing image {idx + 1}/{len(job_input['imageUrls'])}: {image_url}")

                # Download image with proper headers
                headers = {
                    'User-Agent': 'RunPod-AI-Toolkit-Handler/1.0',
                    'Accept': 'image/*',
                }
                response = requests.get(image_url, headers=headers, timeout=30, stream=True)
                response.raise_for_status()

                # Determine file extension
                content_type = response.headers.get('content-type', '').lower()
                if 'jpeg' in content_type or 'jpg' in content_type:
                    ext = 'jpg'
                elif 'png' in content_type:
                    ext = 'png'
                elif 'webp' in content_type:
                    ext = 'webp'
                else:
                    ext = image_url.split('.')[-1].lower() if '.' in image_url else 'jpg'
                    if ext not in ['jpg', 'jpeg', 'png', 'webp']:
                        ext = 'jpg'

                # Save image
                image_filename = f"image_{idx + 1:04d}.{ext}"
                image_path = dataset_path / image_filename

                with open(image_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)

                logger.info(f"✅ Saved image: {image_path}")
                image_count += 1

                # Update progress
                progress = 10 + (idx + 1) * 20 // len(job_input['imageUrls'])
                send_webhook(webhook_url, {
                    'job_id': job_id,
                    'status': 'IN_PROGRESS',
                    'progress': progress,
                    'message': f'Processed {idx + 1}/{len(job_input["imageUrls"])} images'
                })

            except Exception as e:
                logger.error(f"💥 Failed to process image {idx + 1}: {e}")
                continue
        
        if image_count == 0:
            raise ValueError("No images were successfully processed")
        
        logger.info(f"✅ Successfully processed {image_count} training images")
        
        # Create training configuration
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 35,
            'message': 'Creating training configuration...'
        })
        
        # Use the complete config sent from the website
        website_config = job_input['config']
        
        # Create ai-toolkit compatible config structure
        config = {
            'job': 'extension',
            'config': {
                'name': website_config['name'],
                'process': [
                    {
                        'type': 'sd_trainer',
                        'training_folder': str(training_data_path),
                        'device': 'cuda:0',
                        'trigger_word': website_config.get('trigger_word', 'ohwx'),
                        'network': website_config.get('network', {
                            'type': 'lora',
                            'linear': 16,
                            'linear_alpha': 16,
                        }),
                        'save': website_config.get('save', {
                            'dtype': 'bf16',
                            'save_every': 250,
                            'max_step_saves_to_keep': 4,
                            'save_format': 'diffusers',
                            'output_folder': '/workspace/output'
                        }),
                        'datasets': [
                            {
                                'folder_path': str(dataset_path),
                                'caption_ext': 'txt',
                                'caption_dropout_rate': 0.05,
                                'shuffle_tokens': False,
                                'cache_latents_to_disk': True,
                                'resolution': [512, 768, 1024],
                            }
                        ],
                        'train': website_config.get('train', {
                            'batch_size': 1,
                            'steps': 1000,
                            'gradient_accumulation_steps': 4,
                            'train_unet': True,
                            'train_text_encoder': False,
                            'gradient_checkpointing': True,
                            'noise_scheduler': 'flowmatch',
                            'optimizer': 'adamw8bit',
                            'lr': 1e-4,
                            'ema_config': {
                                'use_ema': True,
                                'ema_decay': 0.99,
                            },
                            'dtype': 'bf16',
                        }),
                        'model': website_config.get('model', {
                            'name_or_path': 'black-forest-labs/FLUX.1-dev',
                            'is_flux': True,
                            'quantize': True,
                        }),
                        'sample': website_config.get('sample', {
                            'sampler': 'flowmatch',
                            'sample_every': 250,
                            'width': 1024,
                            'height': 1024,
                            'prompts': [
                                f"A photo of {website_config.get('trigger_word', 'ohwx')}",
                                f"{website_config.get('trigger_word', 'ohwx')} in a professional setting",
                                f"Portrait of {website_config.get('trigger_word', 'ohwx')}"
                            ],
                            'neg': 'blurry, low quality, distorted',
                            'seed': 42,
                            'walk_seed': True,
                            'guidance_scale': 4.0,
                            'sample_steps': 20,
                        })
                    }
                ]
            }
        }
        
        # Write config file
        with open(config_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
        
        logger.info(f"📋 Created training config: {config_path}")
        
        # Start training
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 40,
            'message': 'Starting training process...'
        })
        
        logger.info(f"🧠 Starting training with config: {config_path}")
        
        # Build command to run from ai-toolkit directory
        ai_toolkit_dir = Path("/workspace/ai-toolkit")
        cmd = [
            sys.executable, "run.py",
            str(config_path)
        ]
        
        logger.info(f"🔧 Training command: {' '.join(cmd)}")
        logger.info(f"🔧 Working directory: {ai_toolkit_dir}")
        
        # Set up environment
        env = os.environ.copy()
        env['CUDA_VISIBLE_DEVICES'] = '0'
        env['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
        env['TOKENIZERS_PARALLELISM'] = 'false'
        # Add ai-toolkit to Python path
        env['PYTHONPATH'] = f"{ai_toolkit_dir}:{env.get('PYTHONPATH', '')}"
        
        # Run training
        start_time = time.time()
        
        try:
            process = subprocess.Popen(
                cmd,
                cwd=str(ai_toolkit_dir),  # Run from ai-toolkit directory
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env
            )
            
            # Monitor training progress
            last_progress_update = time.time()
            progress_update_interval = 60
            max_training_time = 7200  # 2 hours
            current_progress = 40
            
            for line in iter(process.stdout.readline, ''):
                if line:
                    logger.info(f"📋 Training: {line.strip()}")
                    
                    # Send training progress lines that contain percentage or step info
                    line_stripped = line.strip()
                    if any(keyword in line_stripped for keyword in [
                        '%|', 'test', 'step', 'loss:', 'lr:', 'it/s]'
                    ]):
                        # This looks like a training progress line, send it immediately
                        send_webhook(webhook_url, {
                            'job_id': job_id,
                            'status': 'IN_PROGRESS',
                            'message': line_stripped
                        })
                    
                    # Check for timeout
                    elapsed = time.time() - start_time
                    if elapsed > max_training_time:
                        logger.warning(f"⏰ Training timeout after {elapsed/60:.1f} minutes")
                        process.terminate()
                        break
                    
                    # Update progress periodically
                    if time.time() - last_progress_update > progress_update_interval:
                        time_progress = min(45, (elapsed / max_training_time) * 45)
                        current_progress = int(40 + time_progress)
                        
                        send_webhook(webhook_url, {
                            'job_id': job_id,
                            'status': 'IN_PROGRESS',
                            'progress': current_progress,
                            'message': f'Training in progress... ({elapsed/60:.1f}min elapsed)'
                        })
                        
                        last_progress_update = time.time()
            
            # Wait for process to complete
            return_code = process.wait()
            training_duration = time.time() - start_time
            
            logger.info(f"🏁 Training completed in {training_duration/60:.1f} minutes with code {return_code}")
            
        except Exception as e:
            logger.error(f"💥 Training process error: {e}")
            try:
                process.terminate()
                process.wait(timeout=30)
            except:
                try:
                    process.kill()
                except:
                    pass
            raise e
        
        if return_code == 0:
            # Training successful
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'IN_PROGRESS',
                'progress': 90,
                'message': 'Training completed, processing results...'
            })
            
            # Find the trained model - ai-toolkit saves models in training_data folder
            training_output_path = work_dir / 'training_data' / website_config['name']
            logger.info(f"🔍 Looking for trained model in: {training_output_path}")
            
            model_files = list(training_output_path.rglob("*.safetensors"))
            if not model_files:
                # Fallback to original output directory
                logger.info(f"🔍 Fallback: Looking for trained model in: {output_path}")
                model_files = list(output_path.rglob("*.safetensors"))
                if not model_files:
                    raise ValueError("No trained model (.safetensors) found in training output directories")
            
            # Use the most recent model file
            model_file = max(model_files, key=lambda p: p.stat().st_mtime)
            logger.info(f"✅ Found trained model: {model_file}")
            
            # Copy model to output directory for consistent upload location
            if not model_file.parent.samefile(output_path):
                output_model_file = output_path / model_file.name
                shutil.copy2(model_file, output_model_file)
                logger.info(f"📁 Copied model to output directory: {output_model_file}")
                model_file = output_model_file
            
            # Upload to network volume and create LoRA record
            network_upload_result = None
            try:
                logger.info(f"🚀 Uploading trained model to network volume...")
                network_upload_result = upload_to_network_volume(
                    model_file, job_id, website_config, work_dir, job_input
                )
                logger.info(f"✅ Network volume upload successful: {network_upload_result}")
            except Exception as upload_error:
                logger.error(f"⚠️ Network volume upload failed: {upload_error}")
                # Continue with completion - model is still available in output directory
            
            # Final success webhook with network volume info
            webhook_data = {
                'job_id': job_id,
                'status': 'COMPLETED',
                'progress': 100,
                'message': f'Training completed successfully! ({training_duration/60:.1f}min)',
                'training_duration': training_duration,
                'model_file': str(model_file.name),
                'model_path': str(model_file),
                'model_size': model_file.stat().st_size if model_file.exists() else 0
            }
            
            # Add network volume info if upload succeeded
            if network_upload_result:
                webhook_data.update({
                    'network_volume_path': network_upload_result.get('network_path'),
                    'comfyui_path': network_upload_result.get('comfyui_path'),
                    'lora_record_created': network_upload_result.get('lora_record_created', False)
                })
            
            send_webhook(webhook_url, webhook_data)
            
            logger.info(f"🎉 Training job {job_id} completed successfully!")
            
        else:
            error_msg = f"Training process failed with return code {return_code}"
            logger.error(f"❌ {error_msg}")
            
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'error': error_msg,
                'message': 'Training process failed'
            })
            
            raise ValueError(error_msg)
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"💥 Training error: {error_msg}")
        
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'FAILED',
            'error': error_msg,
            'message': 'Training failed due to system error'
        })
        
        raise e

def handler(job):
    """RunPod serverless handler"""
    job_input = job['input']
    job_id = job_input['job_id']
    webhook_url = job_input.get('webhook_url')
    
    logger.info(f"🚀 Starting serverless training job: {job_id}")
    logger.info(f"📋 Job config: {job_input.get('name', 'Unknown')}")
    logger.info(f"🔍 Full job_input keys: {list(job_input.keys())}")
    
    # Debug: Log environment variables for debugging
    env_vars = {k: ('***' if 'SECRET' in k or 'KEY' in k else v) for k, v in os.environ.items() 
                if k.startswith(('RUNPOD_', 'TRAINING_', 'BASE_'))}
    logger.info(f"🔍 Available environment variables: {env_vars}")
    logger.info(f"🔍 Config section: {job_input.get('config', 'Not found')}")
    
    try:
        # Send immediate acknowledgment
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 2,
            'message': 'Job received and starting...'
        })
        
        # Run training process synchronously for serverless
        run_training_process(job_input, job_id, webhook_url)
        
        logger.info(f"🎉 Training job {job_id} completed successfully!")
        
        return {
            "status": "completed",
            "job_id": job_id,
            "message": "Training completed successfully"
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"💥 Handler error: {error_msg}")
        
        return {
            "status": "failed",
            "job_id": job_id,
            "error": error_msg,
            "message": "Training failed"
        }

if __name__ == "__main__":
    logger.info("🎯 Starting RunPod AI-toolkit handler...")
    runpod.serverless.start({"handler": handler})