#!/usr/bin/env python3
"""
Deploy skin enhancement handler to RunPod serverless endpoint
"""

import runpod
import os

# RunPod API configuration
RUNPOD_API_KEY = os.getenv('RUNPOD_API_KEY')

if not RUNPOD_API_KEY:
    print("❌ RUNPOD_API_KEY environment variable not set")
    exit(1)

runpod.api_key = RUNPOD_API_KEY

def deploy_skin_enhancement_endpoint():
    """Deploy or update the skin enhancement serverless endpoint"""
    
    # Latest docker image
    docker_image = "rfldln01/skin-enhancement-handler:v1.0-skin-enhancement-20250910-200429"
    
    # Endpoint configuration
    endpoint_config = {
        "name": "AI Tasty Creative - Skin Enhancement",
        "template": {
            "container": {
                "image": docker_image,
                "registry_auth": None
            },
            "runtime": {
                "handler": "skin_enhancer_handler.py",
                "python_version": "3.10"
            },
            "env": {
                "RUNPOD_AI_API_KEY": RUNPOD_API_KEY
            }
        },
        "active_workers": 1,
        "max_workers": 3,
        "idle_timeout": 5,
        "locations": "US",
        "gpu_ids": "NVIDIA GeForce RTX 4090,NVIDIA RTX A6000"
    }
    
    print(f"🚀 Deploying skin enhancement endpoint with image: {docker_image}")
    
    try:
        # Create new serverless endpoint
        endpoint = runpod.create_endpoint(**endpoint_config)
        endpoint_id = endpoint.get('id')
        
        print(f"✅ Skin enhancement endpoint created successfully!")
        print(f"📋 Endpoint ID: {endpoint_id}")
        print(f"🐳 Docker Image: {docker_image}")
        print(f"🎯 Use this endpoint ID in your environment variables:")
        print(f"   RUNPOD_SKIN_ENHANCER_ENDPOINT_ID={endpoint_id}")
        
        return endpoint_id
        
    except Exception as e:
        print(f"❌ Failed to deploy skin enhancement endpoint: {e}")
        return None

if __name__ == "__main__":
    endpoint_id = deploy_skin_enhancement_endpoint()
    if endpoint_id:
        print(f"\n🎉 Deployment completed successfully!")
        print(f"🔗 Endpoint ID: {endpoint_id}")
    else:
        print(f"\n💥 Deployment failed!")
