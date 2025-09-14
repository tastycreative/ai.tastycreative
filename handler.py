import runpod
import os
import yaml
import subprocess
import json
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_images_from_urls(image_urls: List[Dict], dataset_path: Path) -> int:
    """Download training images from URLs with captions"""
    dataset_path.mkdir(parents=True, exist_ok=True)
    
    processed_count = 0
    for i, image_data in enumerate(image_urls):
        try:
            image_url = image_data['url']
            filename = image_data.get('filename', f"image_{i:04d}.jpg")
            caption = image_data.get('caption', f'Training image {i+1}')
            
            logger.info(f"⬇️ Downloading image {i+1}/{len(image_urls)}: {image_url}")
            
            # Download image with proper headers for ngrok and timeout
            headers = {
                'User-Agent': 'RunPod-AI-Toolkit-Handler/1.0',
                'ngrok-skip-browser-warning': 'true',
                'Accept': 'image/*',
            }
            response = requests.get(image_url, headers=headers, timeout=30, stream=True)
            response.raise_for_status()
            
            # Save image
            image_path = dataset_path / filename
            with open(image_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            # Create caption file
            caption_filename = f"{Path(filename).stem}.txt"
            caption_path = dataset_path / caption_filename
            with open(caption_path, 'w') as f:
                f.write(caption)
            
            logger.info(f"✅ Downloaded: {filename}")
            processed_count += 1
            
        except Exception as e:
            logger.error(f"❌ Failed to download image {i+1}: {str(e)}")
            continue
    
    logger.info(f"✅ Successfully downloaded {processed_count}/{len(image_urls)} images")
    return processed_count

def download_images(image_files: List[Dict], dataset_path: Path) -> int:
    """Download and save training images with captions"""
    dataset_path.mkdir(parents=True, exist_ok=True)
    
    processed_count = 0
    for i, image_file in enumerate(image_files):
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_file['data'])
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Create filename
            filename = image_file.get('filename', f"{i:04d}.jpg")
            if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                filename += '.jpg'
            
            # Handle subfolders
            subfolder = image_file.get('subfolder', '').strip()
            if subfolder:
                image_dir = dataset_path / subfolder
                image_dir.mkdir(parents=True, exist_ok=True)
                image_path = image_dir / filename
            else:
                image_path = dataset_path / filename
            
            # Save image with high quality
            image.save(image_path, "JPEG", quality=95)
            
            # Save caption if provided
            caption = image_file.get('caption', '').strip()
            if caption:
                caption_path = image_path.with_suffix('.txt')
                caption_path.write_text(caption, encoding='utf-8')
            
            processed_count += 1
            logger.info(f"✅ Processed image {i+1}/{len(image_files)}: {image_path.name}")
                
        except Exception as e:
            logger.error(f"❌ Failed to process image {i}: {e}")
            continue
    
    logger.info(f"📷 Successfully processed {processed_count}/{len(image_files)} images")
    return processed_count

def create_ai_toolkit_config(job_data: Dict, dataset_path: Path, output_path: Path) -> Dict:
    """Create ai-toolkit config matching your validation schema exactly"""
    config = job_data['config']
    datasets = job_data.get('datasets', [])
    
    # Build dataset configuration
    dataset_configs = []
    for i, dataset in enumerate(datasets):
        # Use the provided dataset path or default to our dataset folder
        folder_path = dataset.get('folder_path', str(dataset_path))
        
        dataset_config = {
            "folder_path": folder_path,
            "control_path": dataset.get('control_path'),
            "mask_path": dataset.get('mask_path'),
            "mask_min_value": dataset.get('mask_min_value', 0.1),
            "default_caption": dataset.get('default_caption', ''),
            "caption_ext": dataset.get('caption_ext', 'txt'),
            "caption_dropout_rate": dataset.get('caption_dropout_rate', 0.05),
            "cache_latents_to_disk": dataset.get('cache_latents_to_disk', True),
            "is_reg": dataset.get('is_reg', False),
            "network_weight": dataset.get('network_weight', 1.0),
            "resolution": dataset.get('resolution', [512, 768, 1024]),
            "controls": dataset.get('controls', []),
            "shrink_video_to_frames": dataset.get('shrink_video_to_frames', True),
            "num_frames": dataset.get('num_frames', 1),
            "do_i2v": dataset.get('do_i2v', True)
        }
        dataset_configs.append(dataset_config)
    
    # If no datasets provided, create default one
    if not dataset_configs:
        dataset_configs = [{
            "folder_path": str(dataset_path),
            "caption_ext": "txt",
            "caption_dropout_rate": 0.05,
            "resolution": [512, 768, 1024],
            "cache_latents_to_disk": True,
            "cache_latents": True,
            "is_reg": False,
            "network_weight": 1.0
        }]
    
    # Build ai-toolkit configuration exactly matching your schema
    ai_toolkit_config = {
        "job": "extension",
        "config": {
            "name": job_data['name'],
            "process": [{
                "type": "sd_trainer",  # Use sd_trainer for better compatibility
                "training_folder": str(output_path),
                "device": "cuda:0",
                "trigger_word": config.get('trigger_word'),
                "performance_log_every": 50,
                
                # Network configuration from your schema
                "network": {
                    "type": config['network']['type'],
                    "linear": config['network']['linear'],
                    "linear_alpha": config['network']['linear_alpha'],
                    "conv": config['network']['conv'],
                    "conv_alpha": config['network']['conv_alpha'],
                    "lokr_full_rank": config['network']['lokr_full_rank'],
                    "lokr_factor": config['network']['lokr_factor'],
                    "network_kwargs": config['network']['network_kwargs']
                },
                
                # Save configuration from your schema
                "save": {
                    "dtype": config['save']['dtype'],
                    "save_every": config['save']['save_every'],
                    "max_step_saves_to_keep": config['save']['max_step_saves_to_keep'],
                    "save_format": config['save']['save_format'],
                    "push_to_hub": config['save']['push_to_hub']
                },
                
                # Dataset configuration
                "datasets": dataset_configs,
                
                # Training parameters from your schema
                "train": {
                    "batch_size": config['train']['batch_size'],
                    "steps": config['train']['steps'],
                    "gradient_accumulation": config['train']['gradient_accumulation'],
                    "train_unet": config['train']['train_unet'],
                    "train_text_encoder": config['train']['train_text_encoder'],
                    "gradient_checkpointing": config['train']['gradient_checkpointing'],
                    "noise_scheduler": config['train']['noise_scheduler'],
                    "optimizer": config['train']['optimizer'],
                    "timestep_type": config['train']['timestep_type'],
                    "content_or_style": config['train']['content_or_style'],
                    "lr": config['train']['lr'],
                    "optimizer_params": config['train']['optimizer_params'],
                    "unload_text_encoder": config['train']['unload_text_encoder'],
                    "cache_text_embeddings": config['train']['cache_text_embeddings'],
                    "skip_first_sample": config['train']['skip_first_sample'],
                    "disable_sampling": config['train']['disable_sampling'],
                    "dtype": config['train']['dtype'],
                    "diff_output_preservation": config['train']['diff_output_preservation'],
                    "diff_output_preservation_multiplier": config['train']['diff_output_preservation_multiplier'],
                    "diff_output_preservation_class": config['train']['diff_output_preservation_class'],
                    "ema_config": config['train']['ema_config']
                },
                
                # Model configuration from your schema
                "model": {
                    "name_or_path": config['model']['name_or_path'],
                    "quantize": config['model']['quantize'],
                    "qtype": config['model']['qtype'],
                    "quantize_te": config['model']['quantize_te'],
                    "qtype_te": config['model']['qtype_te'],
                    "arch": config['model']['arch'],
                    "low_vram": config['model']['low_vram'],
                    "is_flux": config['model']['arch'] == 'flux',  # Auto-detect FLUX
                    **config['model']['model_kwargs']
                },
                
                # Sample configuration from your schema
                "sample": {
                    "enabled": True,
                    "sampler": config['sample']['sampler'],
                    "sample_every": config['sample']['sample_every'],
                    "width": config['sample']['width'],
                    "height": config['sample']['height'],
                    "samples": [{"prompt": sample["prompt"]} for sample in config['sample']['samples']],
                    "neg": config['sample']['neg'],
                    "seed": config['sample']['seed'],
                    "walk_seed": config['sample']['walk_seed'],
                    "guidance_scale": config['sample']['guidance_scale'],
                    "sample_steps": config['sample']['sample_steps'],
                    "num_frames": config['sample']['num_frames'],
                    "fps": config['sample']['fps']
                }
            }]
        },
        "meta": {
            "name": job_data['name'],
            "version": "1.0"
        }
    }
    
    return ai_toolkit_config

def send_webhook(webhook_url: str, data: Dict) -> bool:
    """Send webhook update to your website"""
    if not webhook_url:
        return False
        
    try:
        # Add headers to bypass ngrok warning page and ensure proper content type
        headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',  # Bypass ngrok warning page
            'User-Agent': 'RunPod-AI-Toolkit/1.0'  # Identify as automated request
        }
        
        response = requests.post(webhook_url, json=data, headers=headers, timeout=120)  # Increased timeout for webhook responses
        response.raise_for_status()
        logger.info(f"✅ Webhook sent: {data.get('message', 'No message')}")
        return True
    except Exception as e:
        logger.error(f"❌ Webhook failed: {e}")
        return False

def parse_training_progress(log_line: str) -> Optional[Dict]:
    """Enhanced training progress parsing"""
    try:
        patterns = [
            (r'step[:\s]*(\d+)', 'step'),
            (r'(\d+)/(\d+)', 'step_total'),
            (r'loss[:\s]*([0-9.]+)', 'loss'),
            (r'lr[:\s]*([0-9.e-]+)', 'lr'),
            (r'eta[:\s]*(\d+:\d+:\d+)', 'eta'),
            (r'epoch[:\s]*(\d+)', 'epoch')
        ]
        
        result = {}
        
        for pattern, key in patterns:
            match = re.search(pattern, log_line, re.IGNORECASE)
            if match:
                if key == 'step_total':
                    result['step'] = int(match.group(1))
                    result['total_steps'] = int(match.group(2))
                elif key in ['loss', 'lr']:
                    result[key] = float(match.group(1))
                elif key in ['step', 'epoch']:
                    result[key] = int(match.group(1))
                elif key == 'eta':
                    result[key] = match.group(1)
        
        return result if result else None
        
    except Exception as e:
        logger.error(f"Error parsing progress: {e}")
        return None

def collect_output_files(output_path: Path) -> Dict[str, List[Dict]]:
    """Collect and categorize all output files"""
    model_files = []
    sample_files = []
    checkpoint_files = []
    log_files = []
    
    if not output_path.exists():
        logger.warning(f"Output path does not exist: {output_path}")
        return {"model_files": [], "sample_files": [], "checkpoint_files": [], "log_files": []}
    
    for file_path in output_path.rglob("*"):
        if not file_path.is_file():
            continue
            
        file_info = {
            "filename": file_path.name,
            "path": str(file_path.relative_to(output_path)),
            "full_path": str(file_path),
            "size": file_path.stat().st_size,
            "extension": file_path.suffix.lower()
        }
        
        # Categorize files based on extension and naming
        if file_path.suffix.lower() in ['.safetensors', '.ckpt', '.bin']:
            if 'checkpoint' in file_path.name.lower() or 'step' in file_path.name.lower():
                checkpoint_files.append(file_info)
            else:
                model_files.append(file_info)
        elif file_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
            if any(keyword in file_path.name.lower() for keyword in ['sample', 'preview', 'test']):
                sample_files.append(file_info)
        elif file_path.suffix.lower() in ['.txt', '.log']:
            log_files.append(file_info)
    
    logger.info(f"📁 Found {len(model_files)} models, {len(sample_files)} samples, {len(checkpoint_files)} checkpoints")
    
    return {
        "model_files": model_files,
        "sample_files": sample_files,
        "checkpoint_files": checkpoint_files,
        "log_files": log_files
    }

def upload_model_to_network_volume(model_file_data, model_filename, job_id, step, job_input, webhook_url):
    """Upload trained model directly to network volume storage and create database record"""
    try:
        logger.info("🚀 Starting upload to network volume storage...")
        logger.info(f"📦 Model file: {model_filename} ({len(model_file_data)} bytes = {len(model_file_data) / 1024 / 1024:.1f}MB)")
        
        # Safely get model name from job_input
        model_name = "unknown_model"
        if isinstance(job_input, dict) and 'name' in job_input:
            model_name = job_input['name']
        elif isinstance(job_input, str):
            model_name = job_input
        
        # Get user ID from training job lookup
        logger.info("🔍 Getting training job info for user ID...")
        base_url = webhook_url.split('/api/webhooks')[0]
        job_info_url = f"{base_url}/api/training/jobs/{job_id}"
        
        user_id = None
        try:
            job_info_response = requests.get(
                job_info_url,
                timeout=30,
                headers={'User-Agent': 'RunPod-Training-Handler/1.0'}
            )
            
            if job_info_response.status_code == 200:
                job_info = job_info_response.json()
                if job_info.get('success') and 'job' in job_info:
                    user_id = job_info['job'].get('clerkId')
                    logger.info(f"✅ Found user ID: {user_id}")
                else:
                    logger.warning(f"⚠️ Invalid job info response: {job_info}")
            else:
                logger.warning(f"⚠️ Job info request failed: {job_info_response.status_code}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting user ID from job info: {e}")
        
        # If we don't have a user ID, use the training job ID as fallback
        if not user_id:
            user_id = f'training_{job_id}'
            logger.warning(f"⚠️ Using fallback user ID: {user_id}")
        
        # Upload to network volume via our API
        logger.info("☁️ Uploading to network volume...")
        
        base_url = webhook_url.split('/api/webhooks')[0]
        upload_url = f"{base_url}/api/training/upload-model"
        
        # Prepare multipart form data for network volume upload
        files = {
            'file': (model_filename, model_file_data, 'application/octet-stream')
        }
        
        data = {
            'jobId': job_id,
            'userId': user_id,
            'modelName': model_name,
            'originalFileName': model_filename
        }
        
        # Upload to network volume with extended timeout
        logger.info(f"📡 Uploading to network volume: {upload_url}")
        upload_response = requests.post(
            upload_url,
            files=files,
            data=data,
            timeout=7200,  # 2 hour timeout for large files
            headers={'User-Agent': 'RunPod-Training-Handler/1.0'}
        )
        
        logger.info(f"📋 Network volume upload response: {upload_response.status_code}")
        
        if upload_response.status_code != 200:
            logger.error(f"❌ Network volume upload failed: {upload_response.status_code}")
            logger.error(f"❌ Response: {upload_response.text}")
            return False
        
        upload_result = upload_response.json()
        if upload_result.get('success'):
            logger.info(f"✅ Model uploaded to network volume successfully!")
            logger.info(f"📁 Network path: {upload_result.get('networkVolumePath')}")
            logger.info(f"� S3 key: {upload_result.get('s3Key')}")
            
            # Send webhook with completion info
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'COMPLETED',
                'progress': 100,
                'message': 'Model uploaded to network volume',
                'modelUrl': upload_result.get('networkVolumePath'),
                'networkVolumePath': upload_result.get('networkVolumePath')
            })
            
            return True
        else:
            logger.error(f"❌ Network volume upload failed: {upload_result}")
            return False
            
    except requests.exceptions.Timeout:
        logger.error(f"❌ Upload timeout (large files may take a while)")
        return False
    except Exception as e:
        logger.error(f"❌ Upload error: {str(e)}")
        return False

def run_training_process(job_input, job_id, webhook_url):
    """Execute the actual training process in background"""
    logger.info(f"🎯 Starting background training process for job: {job_id}")
    
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
        
        # Create working directories (match ai-toolkit expected structure)
        timestamp = int(time.time())
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
        # Don't remove logs_path - let it persist for debugging
        
        # Create directories
        work_dir.mkdir(exist_ok=True)
        training_data_path.mkdir(parents=True)
        output_path.mkdir(parents=True)
        logs_path.mkdir(exist_ok=True)  # Allow existing logs directory
        
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
                # image_info is expected to be a dict with at least a 'url' key
                image_url = image_info['url'] if isinstance(image_info, dict) and 'url' in image_info else image_info
                logger.info(f"📥 Processing image {idx + 1}/{len(job_input['imageUrls'])}: {image_url}")

                # Download image with timeout
                response = requests.get(image_url, timeout=60)
                response.raise_for_status()

                # Determine file extension from content-type or URL
                content_type = response.headers.get('content-type', '').lower()
                if 'jpeg' in content_type or 'jpg' in content_type:
                    ext = 'jpg'
                elif 'png' in content_type:
                    ext = 'png'
                elif 'webp' in content_type:
                    ext = 'webp'
                else:
                    # Fallback to extracting from URL
                    ext = image_url.split('.')[-1].lower() if '.' in image_url else 'jpg'
                    if ext not in ['jpg', 'jpeg', 'png', 'webp']:
                        ext = 'jpg'  # Default fallback

                # Save image with proper naming
                image_filename = f"image_{idx + 1:04d}.{ext}"
                image_path = dataset_path / image_filename

                with open(image_path, 'wb') as f:
                    f.write(response.content)

                logger.info(f"✅ Saved image: {image_path}")
                image_count += 1

                # Update progress for image processing (10-30%)
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
        
        # Generate config with better defaults and longer timeouts
        config = {
            'job': 'extension',
            'config': {
                'name': job_input['config']['name'],
                'process': [
                    {
                        'type': 'sd_trainer',
                        'training_folder': str(training_data_path),
                        'device': 'cuda:0',
                        'trigger_word': job_input['config'].get('trigger_word', 'ohwx'),
                        'network': {
                            'type': 'lora',
                            'linear': job_input['config'].get('linear', 16),
                            'linear_alpha': job_input['config'].get('linear_alpha', 16),
                        },
                        'save': {
                            'dtype': 'float16',
                            'save_every': job_input['config'].get('save_every', 500),
                            'max_step_saves_to_keep': 3,
                        },
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
                        'train': {
                            'batch_size': 1,
                            'steps': job_input['config'].get('steps', 1000),
                            'gradient_accumulation_steps': 4,
                            'train_unet': True,
                            'train_text_encoder': False,
                            'gradient_checkpointing': True,
                            'noise_scheduler': 'flowmatch',
                            'optimizer': 'adamw8bit',
                            'lr': job_input['config'].get('lr', 1e-4),
                            'ema_config': {
                                'use_ema': True,
                                'ema_decay': 0.99,
                            },
                            'dtype': 'bf16',
                        },
                        'model': {
                            'name_or_path': job_input['config'].get('model_name', 'black-forest-labs/FLUX.1-dev'),
                            'is_flux': True,
                            'quantize': True,
                        },
                        'sample': {
                            'sampler': 'flowmatch',
                            'sample_every': job_input['config'].get('sample_every', 250),
                            'width': 1024,
                            'height': 1024,
                            'prompts': [
                                f"A photo of {job_input['config'].get('trigger_word', 'ohwx')}",
                                f"{job_input['config'].get('trigger_word', 'ohwx')} in a professional setting",
                                f"Portrait of {job_input['config'].get('trigger_word', 'ohwx')}"
                            ],
                            'neg': 'blurry, low quality, distorted',
                            'seed': 42,
                            'walk_seed': True,
                            'guidance_scale': 4.0,
                            'sample_steps': 20,
                        }
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
        
        # Build command with extended timeout for training
        cmd = [
            sys.executable, "-m", "ai_toolkit.train",
            "--config", str(config_path)
        ]
        
        logger.info(f"🔧 Training command: {' '.join(cmd)}")
        
        # Set up environment with better memory management
        env = os.environ.copy()
        env['CUDA_VISIBLE_DEVICES'] = '0'
        env['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
        env['TOKENIZERS_PARALLELISM'] = 'false'
        
        # Run training with extended timeout (2 hours)
        start_time = time.time()
        
        try:
            # Enhanced process execution with real-time monitoring
            process = subprocess.Popen(
                cmd,
                cwd=str(work_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env
            )
            
            # Monitor training progress with 2-hour timeout
            last_progress_update = time.time()
            progress_update_interval = 60  # Update every minute
            max_training_time = 7200  # 2 hours
            current_progress = 40
            
            output_lines = []
            
            for line in iter(process.stdout.readline, ''):
                if line:
                    output_lines.append(line.strip())
                    logger.info(f"📋 Training: {line.strip()}")
                    
                    # Check for timeout
                    elapsed = time.time() - start_time
                    if elapsed > max_training_time:
                        logger.warning(f"⏰ Training timeout after {elapsed/60:.1f} minutes")
                        process.terminate()
                        try:
                            process.wait(timeout=30)
                        except subprocess.TimeoutExpired:
                            process.kill()
                        break
                    
                    # Update progress periodically
                    if time.time() - last_progress_update > progress_update_interval:
                        # Estimate progress based on elapsed time (40-85%)
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
            # Training successful - process results
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'IN_PROGRESS',
                'progress': 90,
                'message': 'Training completed, processing results...'
            })
            
            # Find the trained model
            logger.info(f"🔍 Looking for trained model in: {output_path}")
            
            # Look for .safetensors files
            model_files = list(output_path.rglob("*.safetensors"))
            if not model_files:
                raise ValueError("No trained model (.safetensors) found in output directory")
            
            # Use the most recent model file
            model_file = max(model_files, key=lambda p: p.stat().st_mtime)
            logger.info(f"✅ Found trained model: {model_file}")
            
            # Upload model to storage with better error handling
            try:
                # Read model file data
                with open(model_file, 'rb') as f:
                    model_file_data = f.read()
                
                # Use the existing upload function
                upload_success = upload_model_to_network_volume(
                    model_file_data, 
                    model_file.name, 
                    job_id, 
                    job_input['config'].get('steps', 1000), 
                    job_input, 
                    webhook_url
                )
                
                if upload_success:
                    logger.info(f"☁️ Model uploaded successfully")
                    model_url = f"models/loras/{model_file.name}"  # ComfyUI path
                else:
                    logger.error(f"💥 Model upload failed")
                    model_url = None
                    
            except Exception as upload_error:
                logger.error(f"💥 Model upload failed: {upload_error}")
                # Still mark as successful since training completed
                model_url = None
            
            # Final success webhook
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'COMPLETED',
                'progress': 100,
                'model_url': model_url,
                'message': f'Training completed successfully! ({training_duration/60:.1f}min)',
                'training_duration': training_duration
            })
            
            logger.info(f"🎉 Training job {job_id} completed successfully!")
            
        else:
            error_msg = f"Training process failed with return code {return_code}"
            logger.error(f"❌ {error_msg}")
            
            # Try to get error details from logs
            error_details = ""
            try:
                with open(logs_path / "training.log", 'r') as f:
                    lines = f.readlines()
                    # Get last 10 lines for error context
                    error_details = "".join(lines[-10:])
            except:
                pass
            
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'error': error_msg,
                'message': 'Training process failed',
                'error_details': error_details
            })
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"💥 Background training error: {error_msg}")
        
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'FAILED',
            'error': error_msg,
            'message': 'Training failed due to system error'
        })
    
    finally:
        # Cleanup temporary files (but preserve logs for debugging)
        try:
            work_dir = Path("/workspace")
            training_data_path = work_dir / "training_data"
            output_path = work_dir / "output"
            
            if training_data_path.exists():
                shutil.rmtree(training_data_path)
            if output_path.exists():
                shutil.rmtree(output_path)
                
            logger.info(f"🧹 Cleaned up temporary training files")
        except Exception as e:
            logger.warning(f"⚠️ Cleanup failed: {e}")

def handler(job):
    """Enhanced RunPod handler with background processing to prevent timeout"""
    job_input = job['input']
    job_id = job_input['job_id']
    webhook_url = job_input.get('webhook_url')
    
    logger.info(f"🚀 Starting training job: {job_id}")
    logger.info(f"📋 Job config: {job_input.get('name', 'Unknown')}")
    logger.info(f"🔍 Debug - Job input keys: {list(job_input.keys())}")
    logger.info(f"🔍 Debug - imageUrls present: {'imageUrls' in job_input}")
    if 'imageUrls' in job_input:
        logger.info(f"🔍 Debug - imageUrls count: {len(job_input['imageUrls'])}")
        logger.info(f"🔍 Debug - First image URL: {job_input['imageUrls'][0] if job_input['imageUrls'] else 'None'}")
    
    try:
        # Send immediate acknowledgment to prevent timeout
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 2,
            'message': 'Job received and starting...'
        })
        
        # Start training in background thread to prevent RunPod serverless timeout
        import threading
        
        def background_training():
            run_training_process(job_input, job_id, webhook_url)
        
        # Start daemon thread (dies when main process ends)
        training_thread = threading.Thread(target=background_training, daemon=False)
        training_thread.start()
        
        logger.info(f"🎯 Handler returning early - training continues in background thread")
        
        # Return success immediately to prevent RunPod timeout
        return {
            "status": "started",
            "job_id": job_id,
            "message": "Training started in background"
        }
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
        
        # Create working directories (match ai-toolkit expected structure)
        timestamp = int(time.time())
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
        # Don't remove logs_path - let it persist for debugging
        
        # Create directories
        work_dir.mkdir(exist_ok=True)
        training_data_path.mkdir(parents=True)
        output_path.mkdir(parents=True)
        logs_path.mkdir(exist_ok=True)  # Allow existing logs directory
        
        logger.info(f"📁 Created working directory: {work_dir}")
        
        # Process training images
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 10,
            'message': 'Processing training images...'
        })
        
        image_count = download_images_from_urls(job_input['imageUrls'], dataset_path)
        if image_count == 0:
            raise Exception("No images were successfully processed")
        
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 20,
            'message': f'Dataset ready with {image_count} images'
        })
        
        # Create ai-toolkit configuration
        logger.info("⚙️ Creating ai-toolkit configuration...")
        config = create_ai_toolkit_config(job_input, dataset_path, output_path)
        
        # Save config file with pretty formatting
        with open(config_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False, indent=2)
        
        logger.info(f"💾 Config saved to: {config_path}")
        
        # Log the configuration for debugging
        with open(logs_path / "config.yaml", 'w') as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False, indent=2)
        
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'IN_PROGRESS',
            'progress': 25,
            'message': 'Starting AI-toolkit training...'
        })
        
        # Change to ai-toolkit directory
        os.chdir('/workspace/ai-toolkit')
        
        # Log training parameters
        total_steps = job_input['config']['train']['steps']
        logger.info(f"🔧 Starting training:")
        logger.info(f"   📊 Steps: {total_steps}")
        logger.info(f"   🖼️ Images: {image_count}")
        logger.info(f"   🧠 Model: {job_input['config']['model']['name_or_path']}")
        logger.info(f"   ⚡ GPU: {job_input['config']['model']['arch']}")
        
        # Start training process with logging
        log_file = logs_path / "training.log"
        with open(log_file, 'w') as log_f:
            process = subprocess.Popen([
                sys.executable, 'run.py', str(config_path)
            ], 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            bufsize=1,
            universal_newlines=True
            )
            
            # Monitor training progress
            step = 0
            last_progress = 25
            last_webhook_time = time.time()
            
            logger.info("👁️ Monitoring training progress...")
            
            # Read output line by line
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                    
                if output:
                    line = output.strip()
                    print(line)  # Console output
                    log_f.write(f"{line}\n")  # File logging
                    log_f.flush()
                    
                    # Parse progress
                    progress_info = parse_training_progress(line)
                    if progress_info and 'step' in progress_info:
                        step = progress_info['step']
                        
                        # Calculate progress (25% setup + 70% training + 5% cleanup)
                        training_progress = min(70, int((step / total_steps) * 70))
                        current_progress = 25 + training_progress
                        
                        # Send webhook every 30 seconds or significant progress change
                        current_time = time.time()
                        if (current_progress > last_progress + 5 or 
                            current_time - last_webhook_time > 30):
                            
                            webhook_data = {
                                'job_id': job_id,
                                'status': 'IN_PROGRESS',
                                'progress': current_progress,
                                'step': step,
                                'message': f'Training: {step}/{total_steps} steps'
                            }
                            
                            # Add additional metrics if available
                            if 'loss' in progress_info:
                                webhook_data['loss'] = progress_info['loss']
                            if 'lr' in progress_info:
                                webhook_data['learning_rate'] = progress_info['lr']
                            if 'eta' in progress_info:
                                webhook_data['eta'] = progress_info['eta']
                            
                            send_webhook(webhook_url, webhook_data)
                            last_progress = current_progress
                            last_webhook_time = current_time
        
        # Check completion status
        return_code = process.poll()
        
        if return_code == 0:
            logger.info("✅ Training completed successfully!")
            
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'IN_PROGRESS',
                'progress': 95,
                'message': 'Training completed, collecting output files...'
            })
            
            # Collect all output files
            output_files = collect_output_files(output_path)
            
            # Find the main model file (.safetensors)
            model_file_data = None
            model_filename = None
            
            for model_file in output_files['model_files']:
                if model_file['filename'].endswith('.safetensors'):
                    model_path = Path(model_file['full_path'])
                    if model_path.exists():
                        logger.info(f"📁 Reading model file: {model_path}")
                        try:
                            with open(model_path, 'rb') as f:
                                model_file_data = f.read()
                            model_filename = model_file['filename']
                            logger.info(f"✅ Loaded model file: {model_filename} ({len(model_file_data)} bytes)")
                            break
                        except Exception as e:
                            logger.error(f"❌ Failed to read model file: {e}")
            
            # Upload model file to your storage
            model_upload_success = False
            if model_file_data and webhook_url:
                # Use direct ComfyUI upload instead of Cloudinary
                model_upload_success = upload_model_to_network_volume(
                    model_file_data, 
                    model_filename, 
                    job_id, 
                    step, 
                    job_input, 
                    webhook_url
                )
            
            # Prepare sample URLs (these would need to be uploaded to your storage)
            sample_urls = [f"/training/{job_id}/samples/{f['filename']}" for f in output_files['sample_files']]
            checkpoint_urls = [f"/training/{job_id}/checkpoints/{f['filename']}" for f in output_files['model_files']]
            
            # Send completion webhook with enhanced data
            completion_data = {
                'job_id': job_id,
                'status': 'COMPLETED',
                'progress': 100,
                'message': 'Training completed successfully! 🎉',
                'model_files': output_files['model_files'],
                'sample_files': output_files['sample_files'],
                'checkpoint_files': output_files['checkpoint_files'],
                'model_name': job_input['name'],
                'final_step': step,
                'samples': sample_urls,
                'checkpoint_urls': checkpoint_urls,
                'model_uploaded': model_upload_success,
                'model_filename': model_filename,
                'output': {
                    'model_files': output_files['model_files'],
                    'model_uploaded': model_upload_success,
                    'model_filename': model_filename,
                    'final_loss': None,  # Could extract from training logs if needed
                    'final_learning_rate': None,  # Could extract from training logs if needed
                    'sample_urls': sample_urls,
                    'checkpoint_urls': checkpoint_urls
                }
            }
            
            send_webhook(webhook_url, completion_data)
            
            return {
                'status': 'success',
                'message': 'Training completed successfully',
                'output_files': output_files,
                'training_steps': step,
                'job_id': job_id,
                'model_name': job_input['name'],
                'model_uploaded': model_upload_success
            }
            
        else:
            error_msg = f"Training process failed with return code {return_code}"
            logger.error(f"❌ {error_msg}")
            
            # Try to get error details from logs
            error_details = ""
            try:
                with open(logs_path / "training.log", 'r') as f:
                    lines = f.readlines()
                    # Get last 10 lines for error context
                    error_details = "".join(lines[-10:])
            except:
                pass
            
            send_webhook(webhook_url, {
                'job_id': job_id,
                'status': 'FAILED',
                'error': error_msg,
                'message': 'Training process failed',
                'error_details': error_details
            })
            
            return {
                'status': 'error',
                'error': error_msg,
                'error_details': error_details,
                'job_id': job_id
            }
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"💥 Handler error: {error_msg}")
        
        send_webhook(webhook_url, {
            'job_id': job_id,
            'status': 'FAILED',
            'error': error_msg,
            'message': 'Training failed due to system error'
        })
        
        return {
            'status': 'error',
            'error': error_msg,
            'job_id': job_id
        }
    
    finally:
        # Cleanup temporary files (but preserve logs for debugging)
        try:
            work_dir = Path("/workspace")
            training_data_path = work_dir / "training_data"
            output_path = work_dir / "output"
            
            if training_data_path.exists():
                shutil.rmtree(training_data_path)
            if output_path.exists():
                shutil.rmtree(output_path)
                
            logger.info(f"🧹 Cleaned up temporary training files")
        except Exception as e:
            logger.warning(f"⚠️ Cleanup failed: {e}")

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎯 Starting RunPod AI-toolkit handler...")
    runpod.serverless.start({"handler": handler})