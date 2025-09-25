"""
Basic Video Generation Nodes for ComfyUI
Provides WanImageToVideo, CreateVideo, and SaveVideo functionality
"""

import torch
import numpy as np
import cv2
import os
import json
from PIL import Image
import folder_paths
import comfy.model_management
import comfy.utils
import base64

class WanImageToVideo:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "start_image": ("IMAGE",),
                "vae": ("VAE",),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 64}),
                "width": ("INT", {"default": 480, "min": 64, "max": 2048, "step": 8}),
                "height": ("INT", {"default": 720, "min": 64, "max": 2048, "step": 8}),
                "length": ("INT", {"default": 65, "min": 1, "max": 200}),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "LATENT")
    RETURN_NAMES = ("positive", "negative", "latent")
    FUNCTION = "encode"
    CATEGORY = "video"

    def encode(self, positive, negative, start_image, vae, batch_size, width, height, length):
        # Create a simple latent based on the input image
        # Encode the start image to latent space
        pixels = comfy.model_management.cast_to_device(start_image, comfy.model_management.get_torch_device(), torch.float32)
        
        # Encode using VAE
        latent = vae.encode(pixels[:,:,:,:3])
        
        # Expand for video frames
        batch_size = min(batch_size, length)
        latent_video = latent.repeat(batch_size, 1, 1, 1)
        
        # Create latent dict
        latent_dict = {"samples": latent_video}
        
        return (positive, negative, latent_dict)

class CreateVideo:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "fps": ("INT", {"default": 16, "min": 1, "max": 60}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "create_video"
    CATEGORY = "video"

    def create_video(self, images, fps):
        # Simply return the images as they are
        # The actual video creation will be handled by SaveVideo
        return (images,)

class SaveVideo:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "video": ("IMAGE",),
                "filename_prefix": ("STRING", {"default": "video/ComfyUI/wan2.2"}),
                "format": ("STRING", {"default": "auto"}),
                "codec": ("STRING", {"default": "auto"}),
            }
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "save_video"
    CATEGORY = "video"

    def save_video(self, video, filename_prefix, format, codec):
        # Convert images to numpy arrays
        if isinstance(video, torch.Tensor):
            # Convert from torch tensor to numpy array
            images = video.cpu().numpy()
            # Convert from [N, H, W, C] to list of [H, W, C] arrays
            if images.ndim == 4:
                images = [images[i] for i in range(images.shape[0])]
            else:
                images = [images]
        else:
            images = video

        # Ensure we have proper format
        processed_images = []
        for img in images:
            if isinstance(img, torch.Tensor):
                img = img.cpu().numpy()
            
            # Convert to uint8 if needed
            if img.dtype != np.uint8:
                if img.max() <= 1.0:
                    img = (img * 255).astype(np.uint8)
                else:
                    img = img.astype(np.uint8)
            
            # Ensure RGB format
            if img.shape[-1] == 3:
                processed_images.append(img)
            elif img.shape[-1] == 4:  # RGBA
                processed_images.append(img[:, :, :3])
        
        # Create output directory
        output_dir = folder_paths.get_output_directory()
        video_dir = os.path.join(output_dir, "video", "ComfyUI")
        os.makedirs(video_dir, exist_ok=True)
        
        # Generate filename
        counter = 1
        while True:
            video_filename = f"wan2.2_{counter:05d}.mp4"
            video_path = os.path.join(video_dir, video_filename)
            if not os.path.exists(video_path):
                break
            counter += 1
        
        # Save as video using OpenCV
        if len(processed_images) > 0:
            height, width = processed_images[0].shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            fps = 16  # Default FPS
            
            out = cv2.VideoWriter(video_path, fourcc, fps, (width, height))
            
            for img in processed_images:
                # Convert RGB to BGR for OpenCV
                bgr_img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                out.write(bgr_img)
            
            out.release()
            print(f"Video saved: {video_path}")
        
        return {"ui": {"videos": [{"filename": video_filename, "subfolder": "video/ComfyUI", "type": "output"}]}}

# Node mappings
NODE_CLASS_MAPPINGS = {
    "WanImageToVideo": WanImageToVideo,
    "CreateVideo": CreateVideo,
    "SaveVideo": SaveVideo,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WanImageToVideo": "WAN Image to Video",
    "CreateVideo": "Create Video",
    "SaveVideo": "Save Video",
}
