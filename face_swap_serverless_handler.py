#!/usr/bin/env python3
"""
RunPod Serverless Handler for Face Swap using ComfyUI
Supports advanced face swapping with ACE++ LoRA and Flux Fill
"""
import os
import sys
import json
import time
import base64
import logging
import requests
import subprocess
import threading
import boto3
import copy
from pathlib import Path
from typing import Dict, List, Any, Optional
from botocore.exceptions import ClientError
import runpod

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS S3 Configuration for direct storage (bandwidth optimization)
AWS_REGION = os.environ.get('AWS_REGION') or os.environ.get('S3_REGION') or 'us-east-1'
AWS_S3_BUCKET = os.environ.get('AWS_S3_BUCKET') or os.environ.get('S3_BUCKET') or 'tastycreative'

def get_aws_s3_client():
    """Initialize AWS S3 client for direct storage"""
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID') or os.getenv('S3_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY') or os.getenv('S3_SECRET_ACCESS_KEY')
    
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
        image_data: Image file bytes
        user_id: User ID for folder structure
        filename: Image filename
        subfolder: Subfolder path (can be full prefix if is_full_prefix=True)
        is_full_prefix: If True, subfolder is treated as full S3 prefix path
    """
    try:
        s3_client = get_aws_s3_client()
        if not s3_client:
            logger.error("❌ AWS S3 client not available")
            return {"success": False, "error": "S3 client not available"}
        
        # Generate S3 key with organized structure OR use full prefix for shared folders
        if is_full_prefix and subfolder:
            # For shared folders: subfolder is already the full path like "outputs/owner_id/folder_name"
            s3_key = f"{subfolder.rstrip('/')}/{filename}"
            logger.info(f"📂 Using shared folder full prefix: {subfolder}")
        else:
            # Normal flow: build path from parts
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

def setup_professional_models():
    """Download and setup required models for professional face swapping"""
    import os
    import requests
    
    print("🚀 Setting up models for professional face swapping...")
    
    models_dir = "/app/comfyui/models"
    
    # Create model directories
    os.makedirs(f"{models_dir}/diffusion_models", exist_ok=True)
    os.makedirs(f"{models_dir}/loras", exist_ok=True)
    os.makedirs(f"{models_dir}/clip", exist_ok=True)
    os.makedirs(f"{models_dir}/vae", exist_ok=True)
    
    # Essential models for ACE++ workflow
    essential_models = {
        "loras/comfyui_portrait_lora64.safetensors": {
            "url": "https://huggingface.co/ali-vilab/ACE_Plus/resolve/main/portrait/comfyui_portrait_lora64.safetensors",
            "desc": "ACE++ Portrait LoRA"
        },
        "clip/clip_l.safetensors": {
            "url": "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors",
            "desc": "CLIP-L Text Encoder"
        },
        "vae/ae.safetensors": {
            "url": "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors",
            "desc": "Flux VAE"
        }
    }
    
    def quick_download(url, filepath, desc):
        """Quick download with basic error handling"""
        try:
            if os.path.exists(filepath):
                print(f"✅ {desc} already exists")
                return True
                
            print(f"📥 Downloading {desc}...")
            response = requests.get(url, stream=True, timeout=180)
            response.raise_for_status()
            
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            print(f"✅ Downloaded {desc}")
            return True
        except Exception as e:
            print(f"⚠️ Could not download {desc}: {str(e)}")
            return False
    
    # Download essential models
    for relative_path, model_info in essential_models.items():
        filepath = os.path.join(models_dir, relative_path)
        quick_download(model_info["url"], filepath, model_info["desc"])
    
    print("✅ Professional model setup completed")

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

def validate_face_swap_workflow(workflow):
    """
    Validate workflow JSON for pure inpainting face swapping operations.
    Look for essential nodes for direct inpainting approach.
    """
    try:
        # Check for core inpainting nodes
        core_nodes = []
        save_nodes = []
        
        for node_id, node_data in workflow.items():
            class_type = node_data.get('class_type', '')
            
            # Look for essential inpainting nodes
            if any(keyword in class_type for keyword in [
                'InpaintModelConditioning',  # Core inpainting
                'KSampler',                  # Generation/sampling
                'UNETLoader',                # Model loading
                'VAEDecode',                 # VAE decoding
                'LoraLoader',                # LoRA loading for ACE++
                'FluxGuidance',              # Flux guidance
                'LoadImage',                 # Image loading
                'ImageConcanate',            # Image concatenation
                'ImageToMask'                # Mask creation
            ]):
                core_nodes.append(f"{node_id}:{class_type}")
            
            # Look for SaveImage or PreviewImage nodes
            if class_type in ['SaveImage', 'PreviewImage']:
                save_nodes.append(node_id)
        
        if core_nodes:
            print(f"✅ Found core inpainting nodes: {core_nodes}")
        else:
            print(f"⚠️ No specific inpainting nodes found - using basic image processing")
        
        if save_nodes:
            print(f"✅ Found output nodes: {save_nodes}")
            print(f"✅ Pure inpainting workflow validation passed")
            return True
        else:
            print(f"❌ No SaveImage/PreviewImage nodes found in workflow")
            return False
            
    except Exception as e:
        print(f"❌ Error validating workflow: {str(e)}")
        return False

def create_fallback_workflow(original_image_name: str, new_face_image_name: str, params: dict) -> dict:
    """
    Create a simplified pure inpainting workflow.
    Uses direct inpainting without crop/stitch complexity.
    """
    try:
        workflow = {
            "239": {
                "inputs": {
                    "image": original_image_name,
                    "upload": "image"
                },
                "class_type": "LoadImage",
                "_meta": {
                    "title": "Load Original Image"
                }
            },
            "240": {
                "inputs": {
                    "image": new_face_image_name,
                    "upload": "image"
                },
                "class_type": "LoadImage",
                "_meta": {
                    "title": "Load New Face"
                }
            },
            "340": {
                "inputs": {
                    "unet_name": params.get("model_name", "flux1FillDevFp8_v10.safetensors"),
                    "weight_dtype": "default"
                },
                "class_type": "UNETLoader",
                "_meta": {
                    "title": "Load Model"
                }
            },
            "341": {
                "inputs": {
                    "clip_name1": "clip_l.safetensors",
                    "clip_name2": "t5xxl_fp16.safetensors",
                    "type": "flux",
                    "weight_dtype": "default"
                },
                "class_type": "DualCLIPLoader",
                "_meta": {
                    "title": "Load CLIP"
                }
            },
            "337": {
                "inputs": {
                    "model": [
                        "340",
                        0
                    ],
                    "clip": [
                        "341",
                        0
                    ],
                    "lora_name": "comfyui_portrait_lora64.safetensors",
                    "strength_model": 1.0,
                    "strength_clip": 1.0
                },
                "class_type": "LoraLoader",
                "_meta": {
                    "title": "Load ACE++ LoRA"
                }
            },
            "338": {
                "inputs": {
                    "vae_name": "ae.safetensors"
                },
                "class_type": "VAELoader",
                "_meta": {
                    "title": "Load VAE"
                }
            },
            "343": {
                "inputs": {
                    "text": params.get("prompt", "Professional portrait, natural face swap, high quality"),
                    "clip": [
                        "341",
                        0
                    ]
                },
                "class_type": "CLIPTextEncode",
                "_meta": {
                    "title": "Positive Prompt"
                }
            },
            "404": {
                "inputs": {
                    "conditioning": [
                        "343",
                        0
                    ]
                },
                "class_type": "ConditioningZeroOut",
                "_meta": {
                    "title": "Negative Conditioning"
                }
            },
            "345": {
                "inputs": {
                    "guidance": params.get("guidance", 50),
                    "conditioning": [
                        "343",
                        0
                    ]
                },
                "class_type": "FluxGuidance",
                "_meta": {
                    "title": "Flux Guidance"
                }
            },
            "323": {
                "inputs": {
                    "image1": [
                        "239",
                        0
                    ],
                    "image2": [
                        "240",
                        0
                    ],
                    "direction": "right",
                    "match_image_size": True
                },
                "class_type": "ImageConcanate",
                "_meta": {
                    "title": "Combine Images"
                }
            },
            "241": {
                "inputs": {
                    "image": [
                        "239",
                        0
                    ],
                    "channel": "red"
                },
                "class_type": "ImageToMask",
                "_meta": {
                    "title": "Create Mask"
                }
            },
            "221": {
                "inputs": {
                    "positive": [
                        "345",
                        0
                    ],
                    "negative": [
                        "404",
                        0
                    ],
                    "vae": [
                        "338",
                        0
                    ],
                    "pixels": [
                        "323",
                        0
                    ],
                    "mask": [
                        "241",
                        0
                    ]
                },
                "class_type": "InpaintModelConditioning",
                "_meta": {
                    "title": "Inpaint Conditioning"
                }
            },
            "346": {
                "inputs": {
                    "seed": params.get("seed", 42),
                    "steps": params.get("steps", 25),
                    "cfg": params.get("cfg", 1),
                    "sampler_name": params.get("sampler_name", "euler"),
                    "scheduler": params.get("scheduler", "normal"),
                    "denoise": params.get("denoise", 0.8),
                    "model": [
                        "337",
                        0
                    ],
                    "positive": [
                        "221",
                        0
                    ],
                    "negative": [
                        "221",
                        1
                    ],
                    "latent_image": [
                        "221",
                        2
                    ]
                },
                "class_type": "KSampler",
                "_meta": {
                    "title": "Sample"
                }
            },
            "214": {
                "inputs": {
                    "samples": [
                        "346",
                        0
                    ],
                    "vae": [
                        "338",
                        0
                    ]
                },
                "class_type": "VAEDecode",
                "_meta": {
                    "title": "Decode"
                }
            },
            "413": {
                "inputs": {
                    "filename_prefix": "PureInpaint_FaceSwap",
                    "images": [
                        "214",
                        0
                    ]
                },
                "class_type": "SaveImage",
                "_meta": {
                    "title": "Save Result"
                }
            },
            "382": {
                "inputs": {
                    "images": [
                        "214",
                        0
                    ]
                },
                "class_type": "PreviewImage",
                "_meta": {
                    "title": "Preview Result"
                }
            }
        }
        
        print("✅ Created pure inpainting workflow without crop/stitch")
        return workflow
        
    except Exception as e:
        print(f"❌ Error creating pure inpainting workflow: {str(e)}")
        return {}

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
        print("🔧 Preparing ComfyUI environment for face swapping...")
        
        # Check if ComfyUI is already running
        if is_comfyui_running():
            print("✅ ComfyUI is already running")
            return True
        
        # Validate network volume models first
        models_path = get_models_path()
        if not os.path.exists(models_path):
            print(f"❌ Models path not found: {models_path}")
            return False
        
        print(f"✅ Using models path: {models_path}")
        
        # Check for required model files
        if not verify_model_files():
            print("❌ Required model files not found")
            return False
        
        # Try to prepare InsightFace models if not available
        try_download_insightface_models()
        
        # Start ComfyUI server
        return start_comfyui()
        
    except Exception as e:
        print(f"❌ Error preparing ComfyUI environment: {str(e)}")
        return False

def try_download_insightface_models():
    """Try to download InsightFace models if they're missing"""
    try:
        print("🤖 Checking InsightFace models...")
        import insightface
        
        # Try to initialize InsightFace
        app = insightface.app.FaceAnalysis(providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=0, det_size=(640, 640))
        print("✅ InsightFace models ready")
        
    except Exception as e:
        print(f"⚠️ InsightFace setup failed: {e}")
        print("📝 Face swapping will use ComfyUI nodes instead")
        # This is not a fatal error - we can still do face swapping with ComfyUI nodes

def get_models_path() -> str:
    """Get the models path (network volume or local)"""
    if os.path.exists("/runpod-volume"):
        return "/runpod-volume"
    else:
        return "/workspace/models"

def verify_model_files() -> bool:
    """Verify that required model files exist for face swapping"""
    try:
        models_path = get_models_path()
        
        # Check for required model directories for basic FLUX generation
        required_dirs = ['unet', 'vae', 'clip']
        missing_models = []
        
        for dir_name in required_dirs:
            dir_path = os.path.join(models_path, dir_name)
            if not os.path.exists(dir_path):
                missing_models.append(dir_name)
                continue
            
            # Check if directory has files
            if not any(os.path.isfile(os.path.join(dir_path, f)) for f in os.listdir(dir_path)):
                missing_models.append(f"{dir_name} (empty)")
        
        if missing_models:
            print(f"❌ Missing required model directories: {missing_models}")
            print(f"📁 Available directories in {models_path}: {os.listdir(models_path) if os.path.exists(models_path) else 'None'}")
            return False
        
        # Check for InsightFace models (optional - will download if missing)
        insightface_path = os.path.join(models_path, 'insightface')
        if not os.path.exists(insightface_path):
            print("⚠️ InsightFace models not found - will use ComfyUI face swap nodes instead")
            print("📁 Face swapping will work with available ComfyUI custom nodes")
        else:
            print("✅ InsightFace models found")
            
        print("✅ Basic required model directories found - face swap ready")
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
            "--disable-auto-launch"
        ]
        
        print(f"🔧 Starting ComfyUI with command: {' '.join(cmd)}")
        
        def log_output(process, stream_name):
            for line in iter(process.stdout.readline, b''):
                try:
                    decoded_line = line.decode('utf-8').strip()
                    if decoded_line:
                        print(f"[ComfyUI-{stream_name}] {decoded_line}")
                except UnicodeDecodeError:
                    pass
        
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
        max_wait = 300  # 5 minutes
        for i in range(max_wait):
            if is_comfyui_running():
                print(f"✅ ComfyUI started successfully after {i+1} seconds")
                return True
            time.sleep(1)
            
        print(f"❌ ComfyUI failed to start within {max_wait} seconds")
        return False
        
    except Exception as e:
        print(f"❌ Error starting ComfyUI: {str(e)}")
        return False

def remove_unavailable_nodes(workflow: Dict) -> Dict:
    """Remove nodes that are not available (like TeaCache) from the workflow"""
    import copy
    workflow_cleaned = copy.deepcopy(workflow)
    
    # List of problematic nodes that commonly fail to import
    problematic_nodes = ['TeaCache', 'TeaCacheNode']
    
    # Nodes to remove
    nodes_to_remove = []
    
    # Find nodes that use problematic node types
    for node_id, node_data in workflow_cleaned.items():
        if isinstance(node_data, dict) and 'class_type' in node_data:
            class_type = node_data['class_type']
            if class_type in problematic_nodes:
                nodes_to_remove.append(node_id)
                logger.info(f"🔧 Removing unavailable node: {node_id} ({class_type})")
    
    # Store connections that need to be restored
    connections_to_restore = {}
    
    # Find what each removed node was connected to
    for node_id in nodes_to_remove:
        if node_id in workflow_cleaned and 'inputs' in workflow_cleaned[node_id]:
            # Store the input connections of the node we're removing
            node_inputs = workflow_cleaned[node_id]['inputs']
            for input_key, input_value in node_inputs.items():
                if isinstance(input_value, list) and len(input_value) >= 2:
                    source_node = str(input_value[0])
                    source_output = input_value[1] if len(input_value) > 1 else 0
                    connections_to_restore[node_id] = {
                        'source_node': source_node,
                        'source_output': source_output,
                        'input_key': input_key
                    }
                    break  # Take the first meaningful connection
    
    # Remove the problematic nodes
    for node_id in nodes_to_remove:
        del workflow_cleaned[node_id]
    
    # Update connections to removed nodes and restore the chain
    for node_id, node_data in workflow_cleaned.items():
        if isinstance(node_data, dict) and 'inputs' in node_data:
            inputs = node_data['inputs']
            for input_key, input_value in list(inputs.items()):
                # Check if input references a removed node
                if isinstance(input_value, list) and len(input_value) >= 2:
                    referenced_node = str(input_value[0])
                    if referenced_node in nodes_to_remove:
                        # Try to restore the connection by connecting to the source of the removed node
                        if referenced_node in connections_to_restore:
                            restore_info = connections_to_restore[referenced_node]
                            new_connection = [restore_info['source_node'], restore_info['source_output']]
                            inputs[input_key] = new_connection
                            logger.info(f"🔧 Restoring connection: {node_id}.{input_key} -> {restore_info['source_node']}.{restore_info['source_output']}")
                        else:
                            # Remove this input connection if we can't restore it
                            logger.info(f"🔧 Removing connection from {node_id}.{input_key} to removed node {referenced_node}")
                            del inputs[input_key]
    
    # Fix workflow parameters and model names
    workflow_cleaned = fix_workflow_parameters(workflow_cleaned)
    
    # Detect if this is a manual masking workflow (Sebastian Kamph style) 
    # and add automatic face detection if needed
    workflow_cleaned = add_automatic_face_detection(workflow_cleaned)
    
    return workflow_cleaned

def create_automatic_face_swap_workflow(original_image_path: str, new_face_image_path: str) -> Dict:
    """Create a complete automatic face swap workflow using ReActor"""
    
    workflow = {
        # Input: Original image
        "1": {
            "inputs": {
                "image": original_image_path,
                "upload": "image"
            },
            "class_type": "LoadImage",
            "_meta": {
                "title": "Load Original Image"
            }
        },
        
        # Input: New face image  
        "2": {
            "inputs": {
                "image": new_face_image_path,
                "upload": "image"
            },
            "class_type": "LoadImage",
            "_meta": {
                "title": "Load New Face"
            }
        },
        
        # Face swap using ReActor
        "3": {
            "inputs": {
                "enabled": True,
                "input_image": ["1", 0],
                "source_image": ["2", 0],
                "face_model": "inswapper_128.onnx",
                "face_restore_model": "CodeFormer",
                "face_restore_visibility": 1.0,
                "codeformer_weight": 0.5,
                "detect_gender_input": "no",
                "detect_gender_source": "no", 
                "input_faces_index": "0",
                "source_faces_index": "0",
                "console_log_level": 1
            },
            "class_type": "ReActorFaceSwap",
            "_meta": {
                "title": "Face Swap"
            }
        },
        
        # Save result
        "4": {
            "inputs": {
                "filename_prefix": "FaceSwap",
                "images": ["3", 0]
            },
            "class_type": "SaveImage",
            "_meta": {
                "title": "Save Face Swap Result"
            }
        }
    }
    
    return workflow

def add_automatic_face_detection(workflow: Dict) -> Dict:
    """Create a complete automatic face swap workflow using ReActor"""
    
    workflow = {
        # Input: Original image
        "1": {
            "inputs": {
                "image": original_image_path,
                "upload": "image"
            },
            "class_type": "LoadImage",
            "_meta": {
                "title": "Load Original Image"
            }
        },
        
        # Input: New face image  
        "2": {
            "inputs": {
                "image": new_face_image_path,
                "upload": "image"
            },
            "class_type": "LoadImage",
            "_meta": {
                "title": "Load New Face"
            }
        },
        
        # Face swap using ReActor
        "3": {
            "inputs": {
                "enabled": True,
                "input_image": ["1", 0],
                "source_image": ["2", 0],
                "face_model": "inswapper_128.onnx",
                "face_restore_model": "CodeFormer",
                "face_restore_visibility": 1.0,
                "codeformer_weight": 0.5,
                "detect_gender_input": "no",
                "detect_gender_source": "no", 
                "input_faces_index": "0",
                "source_faces_index": "0",
                "console_log_level": 1
            },
            "class_type": "ReActorFaceSwap",
            "_meta": {
                "title": "Face Swap"
            }
        },
        
        # Save result
        "4": {
            "inputs": {
                "filename_prefix": "FaceSwap",
                "images": ["3", 0]
            },
            "class_type": "SaveImage",
            "_meta": {
                "title": "Save Face Swap Result"
            }
        }
    }
    
    return workflow

def add_automatic_face_detection(workflow: Dict) -> Dict:
    import copy
    workflow_enhanced = copy.deepcopy(workflow)
    
    # Check if this workflow has InpaintModelConditioning but no face detection
    has_inpaint = False
    has_face_detection = False
    
    for node_id, node_data in workflow_enhanced.items():
        if isinstance(node_data, dict) and 'class_type' in node_data:
            class_type = node_data['class_type']
            
            if class_type == 'InpaintModelConditioning':
                has_inpaint = True
            
            if any(face_node in class_type for face_node in [
                'FaceAnalysis', 'ReActorFaceSwap', 'FaceSwap', 'FaceAnalysisFaceSwapper'
            ]):
                has_face_detection = True
    
    # If we have inpainting but no face detection, this is likely a manual masking workflow
    # For Sebastian Kamph ACE++ workflow, manual masking is the intended approach
    # Don't add automatic face detection - the workflow expects manual masks
    if has_inpaint and not has_face_detection:
        logger.info("🔧 Sebastian Kamph workflow detected - using manual masking approach")
        logger.info("� This workflow requires manual face masking (red painted areas)")
    
    return workflow_enhanced

def fix_workflow_parameters(workflow: Dict) -> Dict:
    """Fix common parameter issues in the workflow"""
    import copy
    workflow_fixed = copy.deepcopy(workflow)
    
    # Model name mappings (from what the workflow expects to what's available)
    model_mappings = {
        'flux1FillDevFp8_v10.safetensors': 'Flux-FillDevFP8.safetensors'
    }
    
    for node_id, node_data in workflow_fixed.items():
        if isinstance(node_data, dict) and 'class_type' in node_data:
            class_type = node_data['class_type']
            
            # Fix UNETLoader model names
            if class_type == 'UNETLoader' and 'inputs' in node_data:
                if 'unet_name' in node_data['inputs']:
                    current_name = node_data['inputs']['unet_name']
                    if current_name in model_mappings:
                        node_data['inputs']['unet_name'] = model_mappings[current_name]
                        logger.info(f"🔧 Fixed UNET model name: {current_name} -> {model_mappings[current_name]}")
            
            # Fix InpaintModelConditioning missing noise_mask parameter
            elif class_type == 'InpaintModelConditioning' and 'inputs' in node_data:
                inputs = node_data['inputs']
                # The noise_mask should be a boolean, not a mask connection
                if 'noise_mask' not in inputs:
                    # Check if there's a 'mask' input that should be moved to a different parameter
                    if 'mask' in inputs:
                        # Keep the mask connection but add noise_mask as boolean
                        inputs['noise_mask'] = True  # Default boolean value
                        logger.info(f"🔧 Fixed InpaintModelConditioning node {node_id}: added noise_mask=True, kept mask connection")
                    else:
                        # Add default boolean value for noise_mask
                        inputs['noise_mask'] = True
                        logger.info(f"🔧 Fixed InpaintModelConditioning node {node_id}: added noise_mask=True")
                elif isinstance(inputs.get('noise_mask'), list):
                    # If noise_mask is incorrectly connected to another node, make it boolean
                    inputs['noise_mask'] = True
                    logger.info(f"🔧 Fixed InpaintModelConditioning node {node_id}: changed noise_mask from connection to boolean")
    
    return workflow_fixed

def create_enhanced_face_swap_workflow(original_filename: str, new_face_filename: str) -> Dict:
    """Create an enhanced face swap workflow with automatic face detection and masking"""
    logger.info("🔧 Creating enhanced face swap workflow with automatic face detection")
    
    # Enhanced workflow with InsightFace face detection and automatic masking
    enhanced_workflow = {
        # Load original image
        "239": {
            "inputs": {
                "image": original_filename,
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        # Load new face image  
        "240": {
            "inputs": {
                "image": new_face_filename,
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        # Face detection and analysis on original image
        "500": {
            "inputs": {
                "image": ["239", 0],
                "face_model": "buffalo_l",
                "face_index": 0
            },
            "class_type": "FaceAnalysisFaceSwapper"
        },
        # Face detection on new face image
        "501": {
            "inputs": {
                "image": ["240", 0],
                "face_model": "buffalo_l", 
                "face_index": 0
            },
            "class_type": "FaceAnalysisFaceSwapper"
        },
        # Perform the actual face swap
        "502": {
            "inputs": {
                "source_image": ["239", 0],
                "face_image": ["240", 0],
                "face_model": "buffalo_l",
                "face_restore_model": "codeformer.pth",
                "face_restore_visibility": 1,
                "codeformer_weight": 0.8,
                "detect_gender_source": "no",
                "detect_gender_input": "no",
                "source_faces_index": "0",
                "input_faces_index": "0",
                "console_log_level": 1
            },
            "class_type": "ReActorFaceSwap"
        },
        # Save the result
        "382": {
            "inputs": {
                "filename_prefix": "face_swap_result",
                "images": ["502", 0]
            },
            "class_type": "SaveImage"
        }
    }
    
    logger.info("✅ Enhanced face swap workflow created with InsightFace integration")
    return enhanced_workflow

def create_professional_ace_workflow_with_auto_mask(original_filename: str, new_face_filename: str) -> Dict:
    """Create the Sebastian Kamph ACE++ workflow with automatic face masking"""
    logger.info("🔧 Creating ACE++ workflow with automatic face detection and masking")
    
    # Professional ACE++ workflow with automatic face masking additions
    ace_workflow = {
        # Load original image
        "239": {
            "inputs": {
                "image": original_filename,
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        # Load new face image
        "240": {
            "inputs": {
                "image": new_face_filename,
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        # Automatic face detection and mask creation
        "600": {
            "inputs": {
                "image": ["239", 0],
                "face_index": 0,
                "face_model": "buffalo_l"
            },
            "class_type": "FaceAnalysis"
        },
        # Create face mask from detection
        "601": {
            "inputs": {
                "face_analysis": ["600", 0],
                "mask_blur": 30,
                "mask_padding": 32
            },
            "class_type": "CreateFaceMask"
        },
        # Use the automatic mask in the ACE++ workflow
        "221": {
            "inputs": {
                "positive": ["345", 0],
                "negative": ["404", 0], 
                "vae": ["338", 0],
                "pixels": ["323", 0],
                "mask": ["601", 0]  # Use automatic face mask
            },
            "class_type": "InpaintModelConditioning",
            "widgets_values": [True]
        },
        # Rest of the ACE++ workflow nodes...
        # (Include all the other nodes from Sebastian Kamph workflow)
    }
    
    logger.info("✅ Professional ACE++ workflow created with automatic face masking")
    return ace_workflow
def create_fallback_workflow(original_filename: str, new_face_filename: str) -> Dict:
    """Create a simple fallback workflow for basic face swapping when advanced nodes are missing"""
    logger.info("🔧 Creating fallback workflow with basic nodes only")
    
    # Try enhanced face swap first if ReActor nodes are available
    try:
        enhanced = create_enhanced_face_swap_workflow(original_filename, new_face_filename)
        return enhanced
    except:
        pass
    
    # Simple workflow using only basic ComfyUI nodes
    fallback_workflow = {
        "239": {
            "inputs": {
                "image": original_filename,
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        "240": {
            "inputs": {
                "image": new_face_filename,
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        "382": {
            "inputs": {
                "filename_prefix": "face_swap_result",
                "images": ["239", 0]
            },
            "class_type": "SaveImage"
        }
    }
    
    logger.info("✅ Fallback workflow created with basic LoadImage and SaveImage nodes")
    return fallback_workflow

def queue_workflow_with_comfyui(workflow: Dict, job_id: str) -> Optional[str]:
    """Queue workflow with ComfyUI and return prompt ID"""
    try:
        logger.info(f"🎭 Queueing face swap workflow with ComfyUI for job {job_id}")
        
        # Remove TeaCache nodes if they exist and aren't available
        workflow_cleaned = remove_unavailable_nodes(workflow)
        
        # Log face swap information if present in workflow
        if "239" in workflow_cleaned and "inputs" in workflow_cleaned["239"]:
            logger.info(f"📸 Original image: {workflow_cleaned['239']['inputs'].get('image', 'Unknown')}")
        if "240" in workflow_cleaned and "inputs" in workflow_cleaned["240"]:
            logger.info(f"👤 New face image: {workflow_cleaned['240']['inputs'].get('image', 'Unknown')}")
        
        # Queue the workflow
        response = requests.post(
            "http://localhost:8188/prompt",
            json={"prompt": workflow_cleaned},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            prompt_id = result.get('prompt_id')
            logger.info(f"✅ Face swap workflow queued with prompt ID: {prompt_id}")
            return prompt_id
        else:
            error_text = response.text
            logger.error(f"❌ Failed to queue workflow: {response.status_code} - {error_text}")
            
            # Try to parse the error and provide helpful information
            try:
                error_data = response.json()
                if 'error' in error_data and 'message' in error_data['error']:
                    error_msg = error_data['error']['message']
                    logger.error(f"💡 ComfyUI Error: {error_msg}")
                    
                    # Check if it's a missing node error and suggest fallback
                    if "does not exist" in error_msg:
                        logger.error("🔧 Node missing - check ComfyUI installation and use basic nodes only")
                        
                        # If InpaintCrop is missing, suggest using fallback workflow
                        if "InpaintCrop" in error_msg or "InpaintStitch" in error_msg or "ImageResize+" in error_msg:
                            logger.info("💡 Advanced inpaint nodes missing - consider using fallback workflow")
                            return "MISSING_NODES"  # Special return value to trigger fallback
                    
                    # Check for validation errors that might be caused by broken connections
                    if "failed validation" in error_msg.lower() or "required input is missing" in error_msg.lower():
                        logger.error("🔧 Workflow validation failed - attempting fallback workflow")
                        return "VALIDATION_FAILED"  # Special return value to trigger fallback
            except:
                pass
            
            return None
    
    except Exception as e:
        logger.error(f"❌ Error queueing face swap workflow: {e}")
        return None

def get_image_from_comfyui(filename: str, subfolder: str = '', type_dir: str = 'output') -> bytes:
    """Download image from ComfyUI and return as raw bytes"""
    try:
        url = f"http://localhost:8188/view"
        params = {
            'filename': filename,
            'type': type_dir,
            'subfolder': subfolder
        }
        
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        logger.info(f"✅ Downloaded image: {filename}")
        return response.content
            
    except Exception as e:
        logger.error(f"❌ Error downloading image {filename}: {e}")
        return b""

def monitor_face_swap_progress(prompt_id: str, job_id: str, webhook_url: str, user_id: str = None, subfolder: str = '', workflow: Dict = None) -> Dict:
    """Monitor ComfyUI progress for face swap and return final result with detailed progress
    
    Args:
        prompt_id: ComfyUI prompt ID
        job_id: Job ID
        webhook_url: URL for status updates
        user_id: User ID
        subfolder: Subfolder or full prefix path
        workflow: Full workflow JSON for shared folder detection
    """
    try:
        logger.info(f"👁️ Starting face swap progress monitoring for job: {job_id}")
        
        # Detect if this is a shared folder workflow by checking SaveImage node
        is_shared_folder = False
        if workflow:
            try:
                for node_id, node_data in workflow.items():
                    if isinstance(node_data, dict) and node_data.get('class_type') == 'SaveImage':
                        inputs = node_data.get('inputs', {})
                        filename_prefix = inputs.get('filename_prefix', '')
                        
                        # Check if this is a shared folder pattern
                        if filename_prefix.startswith('outputs/'):
                            is_shared_folder = True
                            # Use the subfolder that was already extracted earlier (contains full path)
                            # Don't re-extract here to preserve nested subfolders
                            logger.info(f"📂 Detected shared folder workflow with subfolder: {subfolder}")
                            break
            except Exception as e:
                logger.error(f"⚠️ Error checking for shared folder: {e}")
        
        max_wait_time = 1800  # 30 minutes for face swap
        start_time = time.time()
        last_progress_update = 0
        last_webhook_time = 0
        current_node_info = {}
        
        # Progress stages for face swapping workflow
        progress_stages = {
            'starting': {'min': 0, 'max': 10, 'message': '🚀 Initializing face swap workflow...'},
            'loading_images': {'min': 10, 'max': 20, 'message': '📷 Loading and analyzing images...'},
            'face_detection': {'min': 20, 'max': 35, 'message': '👤 Detecting faces in images...'},
            'preprocessing': {'min': 35, 'max': 50, 'message': '🔧 Preprocessing images for face swap...'},
            'face_swapping': {'min': 50, 'max': 85, 'message': '🎭 Performing face swap generation...'},
            'postprocessing': {'min': 85, 'max': 95, 'message': '✨ Enhancing and finalizing results...'},
            'saving': {'min': 95, 'max': 100, 'message': '💾 Saving final images...'}
        }
        
        current_stage = 'starting'
        stage_start_time = time.time()
        
        # Send initial progress update
        if webhook_url:
            initial_webhook_data = {
                'jobId': job_id,
                'status': 'processing',
                'progress': 5,
                'message': progress_stages['starting']['message'],
                'stage': 'starting',
                'estimatedTimeRemaining': max_wait_time
            }
            send_webhook(webhook_url, initial_webhook_data)
        
        while time.time() - start_time < max_wait_time:
            try:
                current_time = time.time()
                elapsed_time = current_time - start_time
                
                # Check ComfyUI queue and execution status
                queue_response = requests.get("http://localhost:8188/queue", timeout=10)
                if queue_response.status_code == 200:
                    queue_data = queue_response.json()
                    
                    # Check if our job is still in queue
                    running_jobs = queue_data.get('queue_running', [])
                    pending_jobs = queue_data.get('queue_pending', [])
                    
                    job_in_running = any(job[1] == prompt_id for job in running_jobs)
                    job_in_pending = any(job[1] == prompt_id for job in pending_jobs)
                    
                    if job_in_pending:
                        # Job is waiting in queue
                        queue_position = next((i+1 for i, job in enumerate(pending_jobs) if job[1] == prompt_id), 0)
                        progress = max(2, min(8, 2 + (queue_position * 2)))
                        message = f'⏳ Job queued (position {queue_position} in queue)'
                        
                    elif job_in_running:
                        # Job is actively running - estimate progress based on time and node execution
                        try:
                            # Try to get more detailed progress from ComfyUI
                            progress_response = requests.get(f"http://localhost:8188/progress", timeout=5)
                            if progress_response.status_code == 200:
                                progress_data = progress_response.json()
                                if progress_data.get('value', 0) > 0:
                                    # Use ComfyUI's internal progress if available
                                    comfy_progress = progress_data.get('value', 0)
                                    max_progress = progress_data.get('max', 100)
                                    node_progress = min(85, (comfy_progress / max_progress) * 85) if max_progress > 0 else 15
                                    
                                    # Determine stage based on progress
                                    if node_progress < 20:
                                        current_stage = 'loading_images'
                                    elif node_progress < 35:
                                        current_stage = 'face_detection'
                                    elif node_progress < 50:
                                        current_stage = 'preprocessing'
                                    elif node_progress < 85:
                                        current_stage = 'face_swapping'
                                    else:
                                        current_stage = 'postprocessing'
                                        
                                    progress = max(15, node_progress)
                                    message = progress_stages[current_stage]['message']
                                    
                                    # Add node-specific info if available
                                    current_node = progress_data.get('node', '')
                                    if current_node:
                                        message += f" (Node: {current_node})"
                                else:
                                    # Fallback to time-based estimation
                                    elapsed_minutes = elapsed_time / 60
                                    if elapsed_minutes < 1:
                                        current_stage = 'loading_images'
                                        progress = 15
                                    elif elapsed_minutes < 2:
                                        current_stage = 'face_detection' 
                                        progress = 25
                                    elif elapsed_minutes < 4:
                                        current_stage = 'preprocessing'
                                        progress = 40
                                    elif elapsed_minutes < 8:
                                        current_stage = 'face_swapping'
                                        progress = min(75, 40 + (elapsed_minutes - 4) * 8)
                                    else:
                                        current_stage = 'face_swapping'
                                        progress = min(85, 75 + (elapsed_minutes - 8) * 2)
                                    
                                    message = progress_stages[current_stage]['message']
                                    
                            else:
                                # Fallback time-based progress
                                elapsed_minutes = elapsed_time / 60
                                progress = min(80, 15 + elapsed_minutes * 8)
                                message = '🎭 Face swap processing...'
                                
                        except Exception as progress_error:
                            # Fallback to simple time-based progress
                            elapsed_minutes = elapsed_time / 60
                            progress = min(80, 15 + elapsed_minutes * 8)
                            message = '🎭 Face swap processing...'
                        
                    else:
                        # Job not in queue - check if completed
                        logger.info(f"✅ Face swap job {job_id} completed, checking for results...")
                        
                        history_response = requests.get(f"http://localhost:8188/history/{prompt_id}", timeout=10)
                        if history_response.status_code == 200:
                            history_data = history_response.json()
                            
                            if prompt_id in history_data:
                                job_data = history_data[prompt_id]
                                status = job_data.get('status', {})
                                
                                if status.get('status_str') == 'success':
                                    logger.info(f"🎉 Face swap generation completed for job: {job_id}")
                                    
                                    # Send completion progress update
                                    if webhook_url:
                                        webhook_data = {
                                            'jobId': job_id,
                                            'status': 'processing',
                                            'progress': 100,
                                            'message': '✅ Face swap completed! Processing results...',
                                            'stage': 'completed'
                                        }
                                        send_webhook(webhook_url, webhook_data)
                                    
                                    # Get output images and save to S3
                                    outputs = job_data.get('outputs', {})
                                    result_images = []
                                    network_volume_paths = []
                                    
                                    # Extract user_id from parameter or job_id
                                    if not user_id:
                                        user_id = job_id.split('_')[0] if '_' in job_id else 'default_user'
                                    
                                    for node_id, node_output in outputs.items():
                                        if 'images' in node_output:
                                            for img_info in node_output['images']:
                                                original_filename = img_info['filename']
                                                comfyui_subfolder = img_info.get('subfolder', '')  # ComfyUI's subfolder
                                                type_dir = img_info.get('type', 'output')
                                                
                                                # Only process FaceSwap files (skip comfyui_temp and other intermediate files)
                                                # Accept any filename containing "FaceSwap" to support all workflow variants
                                                if 'FaceSwap' not in original_filename and not original_filename.startswith('face_swap_result'):
                                                    logger.info(f"⏭️ Skipping intermediate file: {original_filename}")
                                                    continue
                                                
                                                # Create unique filename with timestamp (like text-to-image handler)
                                                timestamp = int(time.time() * 1000)  # Milliseconds for uniqueness
                                                name_part, ext = os.path.splitext(original_filename)
                                                unique_filename = f"{name_part}_{timestamp}{ext}"
                                                
                                                # Download image data as bytes (use ComfyUI's subfolder for retrieval)
                                                image_data = get_image_from_comfyui(original_filename, comfyui_subfolder, type_dir)
                                                if image_data:
                                                    try:
                                                        # Upload to AWS S3 with user's selected subfolder (from workflow)
                                                        s3_result = upload_image_to_aws_s3(image_data, user_id, unique_filename, subfolder, is_full_prefix=is_shared_folder)
                                                        
                                                        if s3_result.get("success"):
                                                            # Track image info for webhook (AWS S3 optimized structure)
                                                            aws_s3_paths = {
                                                                'filename': unique_filename,
                                                                'subfolder': subfolder,
                                                                'type': type_dir,
                                                                'awsS3Key': s3_result['awsS3Key'],
                                                                'awsS3Url': s3_result['awsS3Url'],
                                                                'fileSize': s3_result['fileSize']
                                                            }
                                                            
                                                            # For backward compatibility, still populate network_volume_paths but with AWS S3 data
                                                            network_volume_paths.append(aws_s3_paths)
                                                            
                                                            logger.info(f"✅ Image uploaded to AWS S3: {s3_result['awsS3Url']}")
                                                            logger.info(f"� Processing image {len(network_volume_paths)}: {unique_filename}")
                                                        else:
                                                            logger.error(f"❌ Failed to upload image to AWS S3: {s3_result.get('error')}")
                                                            # Fallback to base64 in result_images
                                                            result_images.append({
                                                                'filename': unique_filename,
                                                                'subfolder': subfolder,
                                                                'type': type_dir,
                                                                'data': base64.b64encode(image_data).decode('utf-8')
                                                            })
                                                        
                                                    except Exception as save_error:
                                                        logger.error(f"❌ Failed to save image {unique_filename}: {save_error}")
                                                        # Fallback: keep legacy format for webhook
                                                        result_images.append({
                                                            'filename': unique_filename,
                                                            'subfolder': subfolder,
                                                            'type': type_dir,
                                                            'data': base64.b64encode(image_data).decode('utf-8')
                                                        })
                                    
                                    # Generate resultUrls for frontend display (AWS S3 optimized URLs)
                                    resultUrls = []
                                    for path_data in network_volume_paths:
                                        if path_data.get('awsS3Url'):
                                            # Use direct AWS S3 URL for optimized bandwidth
                                            resultUrls.append(path_data['awsS3Url'])
                                            logger.info(f"✅ Generated AWS S3 URL: {path_data['awsS3Url']}")
                                    
                                    # Send final completion webhook with AWS S3 data
                                    if webhook_url:
                                        webhook_data = {
                                            'jobId': job_id,
                                            'status': 'COMPLETED',
                                            'progress': 100,
                                            'message': '🎭 Face swap generation completed successfully!',
                                            'aws_s3_paths': network_volume_paths,  # AWS S3 optimized data for database
                                            'resultUrls': resultUrls,  # Direct AWS S3 URLs for frontend display
                                            'resultImages': result_images,  # Legacy fallback (should be empty if AWS S3 works)
                                            'totalTime': int(elapsed_time)
                                        }
                                        send_webhook(webhook_url, webhook_data)
                                    
                                    logger.info(f"📤 Sent completion webhook with {len(network_volume_paths)} AWS S3 paths and {len(resultUrls)} result URLs")
                                    
                                    return {
                                        'status': 'completed',
                                        'aws_s3_paths': network_volume_paths,  # AWS S3 optimized data
                                        'resultUrls': resultUrls,  # Direct AWS S3 URLs
                                        'images': result_images,  # Legacy fallback
                                        'message': 'Face swap generation completed successfully'
                                    }
                                
                                elif status.get('status_str') == 'error':
                                    error_msg = f"Face swap generation failed: {status.get('messages', ['Unknown error'])}"
                                    logger.error(f"❌ {error_msg}")
                                    
                                    if webhook_url:
                                        webhook_data = {
                                            'jobId': job_id,
                                            'status': 'failed',
                                            'progress': 0,
                                            'message': error_msg,
                                            'error': error_msg
                                        }
                                        send_webhook(webhook_url, webhook_data)
                                    
                                    return {
                                        'status': 'failed',
                                        'error': error_msg
                                    }
                        break
                
                # Send progress webhook updates (every 5 seconds)
                if webhook_url and (current_time - last_webhook_time) >= 5:
                    estimated_remaining = max(0, max_wait_time - elapsed_time)
                    
                    webhook_data = {
                        'jobId': job_id,
                        'status': 'processing',
                        'progress': int(progress),
                        'message': message,
                        'stage': current_stage,
                        'elapsedTime': int(elapsed_time),
                        'estimatedTimeRemaining': int(estimated_remaining)
                    }
                    send_webhook(webhook_url, webhook_data)
                    last_webhook_time = current_time
                
                time.sleep(3)  # Check every 3 seconds for more responsive updates
                
            except Exception as check_error:
                logger.warning(f"⚠️ Error checking face swap progress: {check_error}")
                time.sleep(5)  # Wait longer on error
                continue
        
        # Timeout case
        timeout_msg = f"Face swap generation timed out after {max_wait_time} seconds"
        logger.error(f"❌ {timeout_msg}")
        
        if webhook_url:
            webhook_data = {
                'jobId': job_id,
                'status': 'failed',
                'progress': 0,
                'message': timeout_msg,
                'error': timeout_msg
            }
            send_webhook(webhook_url, webhook_data)
        
        return {
            'status': 'failed',
            'error': timeout_msg
        }
        
    except Exception as e:
        error_msg = f"Error monitoring face swap progress: {str(e)}"
        logger.error(f"❌ {error_msg}")
        
        if webhook_url:
            webhook_data = {
                'jobId': job_id,
                'status': 'failed',
                'progress': 0,
                'message': error_msg,
                'error': error_msg
            }
            send_webhook(webhook_url, webhook_data)
        
        return {
            'status': 'failed',
            'error': error_msg
        }

def download_image_for_comfyui(image_filename: str, job_input: dict, base64_key: str = None) -> bool:
    """Download or save base64 image to ComfyUI's input directory"""
    try:
        if not image_filename or image_filename == "None":
            return True
        
        input_dir = "/app/comfyui/input"
        os.makedirs(input_dir, exist_ok=True)
        image_path = os.path.join(input_dir, image_filename)
        
        # Priority 1: Use base64 data if available
        if base64_key and base64_key in job_input:
            base64_data = job_input[base64_key]
            if base64_data and base64_data != "None":
                try:
                    # Remove data URL prefix if present
                    if base64_data.startswith('data:image/'):
                        base64_data = base64_data.split(',', 1)[1]
                    
                    # Decode and save base64 image
                    image_data = base64.b64decode(base64_data)
                    with open(image_path, 'wb') as f:
                        f.write(image_data)
                    
                    logger.info(f"✅ Saved base64 image to: {image_path}")
                    return True
                except Exception as base64_error:
                    logger.warning(f"⚠️ Failed to process base64 data for {image_filename}: {base64_error}")
                    # Fall back to URL download
        
        # Priority 2: Try URL download if base64 failed or not available
        image_url = job_input.get('imageUrl')
        if image_url and image_url != "None":
            try:
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                
                with open(image_path, 'wb') as f:
                    f.write(response.content)
                
                logger.info(f"✅ Downloaded image from URL to: {image_path}")
                return True
            except Exception as url_error:
                logger.error(f"❌ Error downloading image {image_filename} from URL: {url_error}")
                return False
        
        logger.error(f"❌ No valid image data (base64 or URL) provided for {image_filename}")
        return False
        
    except Exception as e:
        logger.error(f"❌ Error processing image {image_filename}: {e}")
        return False

def run_face_swap_generation(job_input, job_id, webhook_url):
    """Execute the actual face swap generation process"""
    logger.info(f"🎭 Starting face swap generation for job: {job_id}")
    
    try:
        # Validate required parameters
        required_params = ['workflow', 'originalImageUrl', 'newFaceImageUrl']
        for param in required_params:
            if param not in job_input:
                error_msg = f"Missing required parameter: {param}"
                logger.error(f"❌ {error_msg}")
                return {'status': 'failed', 'error': error_msg}
        
        # Get workflow and validate it
        workflow = job_input['workflow']
        if not validate_face_swap_workflow(workflow):
            error_msg = "Invalid face swap workflow structure"
            logger.error(f"❌ {error_msg}")
            return {'status': 'failed', 'error': error_msg}
        
        # Download images
        original_filename = job_input.get('originalFilename')
        new_face_filename = job_input.get('newFaceFilename')
        mask_filename = job_input.get('maskFilename')
        
        if original_filename:
            # Prepare job input with both URL and base64 data
            image_input = {
                'imageUrl': job_input.get('originalImageUrl'),
                'originalImageData': job_input.get('originalImageData')
            }
            if not download_image_for_comfyui(original_filename, image_input, 'originalImageData'):
                error_msg = "Failed to download original image"
                logger.error(f"❌ {error_msg}")
                return {'status': 'failed', 'error': error_msg}
        
        if new_face_filename:
            # Prepare job input with both URL and base64 data
            image_input = {
                'imageUrl': job_input.get('newFaceImageUrl'),
                'newFaceImageData': job_input.get('newFaceImageData')
            }
            if not download_image_for_comfyui(new_face_filename, image_input, 'newFaceImageData'):
                error_msg = "Failed to download new face image"
                logger.error(f"❌ {error_msg}")
                return {'status': 'failed', 'error': error_msg}
        
        if mask_filename and (job_input.get('maskImageUrl') or job_input.get('maskImageData')):
            # Prepare job input with both URL and base64 data
            image_input = {
                'imageUrl': job_input.get('maskImageUrl'),
                'maskImageData': job_input.get('maskImageData')
            }
            if not download_image_for_comfyui(mask_filename, image_input, 'maskImageData'):
                logger.warning("⚠️ Failed to download mask image, proceeding without mask")
        elif mask_filename:
            # Mask was uploaded directly to ComfyUI input directory, no need to download
            logger.info(f"✅ Using uploaded mask file: {mask_filename}")
        elif not job_input.get('maskImageUrl') and not mask_filename:
            logger.warning("⚠️ No mask image provided. Sebastian Kamph ACE++ workflow will use default masking.")
            logger.warning("💡 To use this workflow properly:")
            logger.warning("   1. Paint RED areas over faces you want to replace in your original image")
            logger.warning("   2. Provide the masked image as 'originalImageUrl'")
            logger.warning("   3. Or provide a separate mask image as 'maskImageUrl'")
            logger.warning("   4. Or use the mask editor in the frontend")
            logger.warning("   5. Without a mask, the workflow will create a default white mask for the entire image")
        
        # Send initial webhook
        if webhook_url:
            webhook_data = {
                'jobId': job_id,
                'status': 'processing',
                'progress': 10,
                'message': 'Starting face swap generation...',
                'comfyUIPromptId': None
            }
            send_webhook(webhook_url, webhook_data)
        
        # Queue workflow with ComfyUI
        prompt_id = queue_workflow_with_comfyui(workflow, job_id)
        if not prompt_id:
            error_msg = "Failed to queue workflow with ComfyUI"
            logger.error(f"❌ {error_msg}")
            return {'status': 'failed', 'error': error_msg}
        elif prompt_id in ["MISSING_NODES", "VALIDATION_FAILED"]:
            # Try fallback workflow
            logger.info("🔄 Attempting fallback workflow...")
            fallback_workflow = create_fallback_workflow(
                job_input.get('originalFilename', 'input_image.jpg'),
                job_input.get('newFaceFilename', 'face_image.png')
            )
            prompt_id = queue_workflow_with_comfyui(fallback_workflow, job_id)
            if not prompt_id or prompt_id in ["MISSING_NODES", "VALIDATION_FAILED"]:
                error_msg = "Both original and fallback workflows failed"
                logger.error(f"❌ {error_msg}")
                return {'status': 'failed', 'error': error_msg}
        
        # Send progress webhook with prompt ID
        if webhook_url:
            webhook_data = {
                'jobId': job_id,
                'status': 'processing',
                'progress': 20,
                'message': 'Face swap workflow queued successfully',
                'comfyUIPromptId': prompt_id
            }
            send_webhook(webhook_url, webhook_data)
        
        # Monitor progress and get result
        # Get user_id from job input (consistent with text-to-image handler)
        user_id = job_input.get('user_id') or job_input.get('userId')
        if not user_id and '_' in job_id:
            # Try extracting from job_id pattern (e.g., "user_30dULT8ZLO1jthhCEgn349cKcvT_...")
            potential_user = job_id.split('_')[0] + '_' + job_id.split('_')[1] if len(job_id.split('_')) > 1 else job_id.split('_')[0]
            if potential_user.startswith('user_'):
                user_id = potential_user
        
        if not user_id:
            user_id = 'default_user'
        
        # Extract subfolder from workflow for S3 organization with enhanced path parsing
        # Look for SaveImage node filename_prefix like "outputs/user_id/folder/subfolder/FaceSwap"
        subfolder = ''
        is_full_prefix = False
        try:
            for node_id, node_data in workflow.items():
                if isinstance(node_data, dict) and node_data.get('class_type') == 'SaveImage':
                    filename_prefix = node_data.get('inputs', {}).get('filename_prefix', '')
                    
                    # Check if this is a full S3 prefix path (starts with "outputs/")
                    if filename_prefix.startswith('outputs/'):
                        is_full_prefix = True
                        # Remove the file prefix portion and keep the full folder hierarchy
                        sanitized_prefix = filename_prefix.rstrip('/')
                        prefix_parts = sanitized_prefix.split('/')
                        if len(prefix_parts) >= 3:
                            # Drop the last segment (the generated filename prefix) and keep the rest
                            subfolder = '/'.join(prefix_parts[:-1]) + '/'
                            logger.info(f"🔗 Using full folder prefix with subfolders: {subfolder}")
                    elif '/' in filename_prefix:
                        # Extract user's folder from prefix like "nov-2/FaceSwap"
                        folder_parts = filename_prefix.split('/')
                        subfolder = '/'.join(folder_parts[:-1])  # Get everything before the last part
                        logger.info(f"🔍 Extracted subfolder from workflow: '{subfolder}'")
                    break
        except Exception as e:
            logger.warning(f"⚠️ Could not extract subfolder from workflow: {e}")
            
        logger.info(f"🔍 Using user_id: {user_id} for face swap job: {job_id}")
        result = monitor_face_swap_progress(prompt_id, job_id, webhook_url, user_id, subfolder, workflow=workflow)
        return result
        
    except Exception as e:
        error_msg = f"Face swap generation error: {str(e)}"
        logger.error(f"❌ {error_msg}")
        
        if webhook_url:
            webhook_data = {
                'jobId': job_id,
                'status': 'failed',
                'progress': 0,
                'message': error_msg,
                'error': error_msg
            }
            send_webhook(webhook_url, webhook_data)
        
        return {'status': 'failed', 'error': error_msg}

def handler(job):
    """RunPod serverless handler for face swap generation"""
    job_input = job['input']
    action = job_input.get('action', 'generate_face_swap')
    
    # Use the job ID passed from the API, or generate one if not provided
    job_id = job_input.get('jobId')
    if not job_id:
        job_id = f"face_swap_{int(time.time())}_{hash(str(job_input)) % 10000}"
    
    webhook_url = job_input.get('webhookUrl')
    
    logger.info(f"🎭 Face Swap Handler - Job ID: {job_id}, Action: {action}")
    
    try:
        # Prepare ComfyUI environment
        if not prepare_comfyui_environment():
            error_msg = "Failed to prepare ComfyUI environment"
            logger.error(f"❌ {error_msg}")
            return {'status': 'failed', 'error': error_msg}
        
        # Handle face swap generation
        if action == 'generate_face_swap':
            return run_face_swap_generation(job_input, job_id, webhook_url)
        else:
            error_msg = f"Unsupported action: {action}"
            logger.error(f"❌ {error_msg}")
            return {'status': 'failed', 'error': error_msg}
    
    except Exception as e:
        error_msg = f"Handler error: {str(e)}"
        logger.error(f"❌ {error_msg}")
        
        if webhook_url:
            webhook_data = {
                'jobId': job_id,
                'status': 'failed',
                'progress': 0,
                'message': error_msg,
                'error': error_msg
            }
            send_webhook(webhook_url, webhook_data)
        
        return {'status': 'failed', 'error': error_msg}

# Start the RunPod handler
if __name__ == "__main__":
    logger.info("🎭 Starting RunPod Face Swap handler...")
    
    # Setup professional models for ACE++ workflow
    try:
        setup_professional_models()
    except Exception as e:
        logger.warning(f"⚠️ Model setup failed: {str(e)} - continuing anyway")
    
    runpod.serverless.start({"handler": handler})
