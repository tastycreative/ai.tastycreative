#!/usr/bin/env python3
"""
RunPod API Deployment Script for Text-to-Image Handler
This script uses the RunPod API to deploy the handler programmatically
"""

import os
import json
import requests
import base64
import time
from pathlib import Path

# RunPod API configuration
RUNPOD_API_URL = "https://api.runpod.ai/graphql"

def get_runpod_headers():
    """Get headers for RunPod API requests"""
    api_key = os.environ.get('RUNPOD_API_KEY')
    if not api_key:
        raise ValueError("RUNPOD_API_KEY environment variable is required")
    
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

def read_handler_code():
    """Read the handler code and encode it"""
    handler_path = Path("text_to_image_handler.py")
    if not handler_path.exists():
        raise FileNotFoundError("text_to_image_handler.py not found")
    
    with open(handler_path, 'r') as f:
        code = f.read()
    
    return base64.b64encode(code.encode()).decode()

def create_endpoint(name, gpu_type="NVIDIA RTX A5000"):
    """Create a new RunPod serverless endpoint"""
    
    handler_code = read_handler_code()
    
    query = """
    mutation CreateEndpoint($input: EndpointInput!) {
        createEndpoint(input: $input) {
            id
            name
            status
            gpuIds
            locations
        }
    }
    """
    
    variables = {
        "input": {
            "name": name,
            "gpu_ids": gpu_type,
            "handler": {
                "dockerArgs": "",
                "runtimeArgs": "",
                "handlerPath": "text_to_image_handler.py",
                "handlerFunction": "handler",
                "pythonVersion": "3.10"
            },
            "containerDiskInGb": 10,
            "env": [
                {
                    "key": "COMFYUI_URL",
                    "value": "http://localhost:8188"
                }
            ],
            "scaling": {
                "maxWorkers": 5,
                "idleTimeout": 10,
                "scaleUpDelay": 0,
                "scaleDownDelay": 60
            },
            "handler_code": handler_code
        }
    }
    
    response = requests.post(
        RUNPOD_API_URL,
        headers=get_runpod_headers(),
        json={"query": query, "variables": variables}
    )
    
    return response.json()

def update_endpoint(endpoint_id, handler_code=None):
    """Update an existing endpoint with new handler code"""
    
    if handler_code is None:
        handler_code = read_handler_code()
    
    query = """
    mutation UpdateEndpoint($input: UpdateEndpointInput!) {
        updateEndpoint(input: $input) {
            id
            name
            status
        }
    }
    """
    
    variables = {
        "input": {
            "id": endpoint_id,
            "handler_code": handler_code
        }
    }
    
    response = requests.post(
        RUNPOD_API_URL,
        headers=get_runpod_headers(),
        json={"query": query, "variables": variables}
    )
    
    return response.json()

def list_endpoints():
    """List all serverless endpoints"""
    
    query = """
    query GetUser {
        myself {
            serverlessEndpoints {
                id
                name
                status
                gpuIds
                locations
            }
        }
    }
    """
    
    response = requests.post(
        RUNPOD_API_URL,
        headers=get_runpod_headers(),
        json={"query": query}
    )
    
    return response.json()

def main():
    """Main deployment function"""
    
    print("🚀 RunPod API Deployment for Text-to-Image Handler")
    print("=" * 55)
    
    try:
        # Check API key
        if not os.environ.get('RUNPOD_API_KEY'):
            print("❌ Error: RUNPOD_API_KEY environment variable is required")
            print("Set it with: export RUNPOD_API_KEY=your_api_key")
            return
        
        # List existing endpoints
        print("📋 Fetching existing endpoints...")
        endpoints_response = list_endpoints()
        
        if 'errors' in endpoints_response:
            print(f"❌ Error fetching endpoints: {endpoints_response['errors']}")
            return
        
        endpoints = endpoints_response['data']['myself']['serverlessEndpoints']
        
        print(f"📊 Found {len(endpoints)} existing endpoints:")
        for i, endpoint in enumerate(endpoints):
            print(f"  {i+1}. {endpoint['name']} (ID: {endpoint['id']}) - Status: {endpoint['status']}")
        
        # Ask user what to do
        print("\n🔧 Deployment Options:")
        print("1. Create new endpoint")
        print("2. Update existing endpoint")
        print("3. Exit")
        
        choice = input("\nEnter your choice (1-3): ").strip()
        
        if choice == "1":
            # Create new endpoint
            name = input("Enter endpoint name (default: text-to-image-generation): ").strip()
            if not name:
                name = "text-to-image-generation"
            
            print(f"🔨 Creating new endpoint: {name}")
            result = create_endpoint(name)
            
            if 'errors' in result:
                print(f"❌ Error creating endpoint: {result['errors']}")
            else:
                endpoint = result['data']['createEndpoint']
                print(f"✅ Endpoint created successfully!")
                print(f"   ID: {endpoint['id']}")
                print(f"   Name: {endpoint['name']}")
                print(f"   Status: {endpoint['status']}")
        
        elif choice == "2":
            # Update existing endpoint
            if not endpoints:
                print("❌ No existing endpoints found. Create one first.")
                return
            
            print("\n📝 Select endpoint to update:")
            for i, endpoint in enumerate(endpoints):
                print(f"  {i+1}. {endpoint['name']} ({endpoint['id']})")
            
            try:
                selection = int(input("\nEnter endpoint number: ").strip()) - 1
                selected_endpoint = endpoints[selection]
                
                print(f"🔄 Updating endpoint: {selected_endpoint['name']}")
                result = update_endpoint(selected_endpoint['id'])
                
                if 'errors' in result:
                    print(f"❌ Error updating endpoint: {result['errors']}")
                else:
                    print("✅ Endpoint updated successfully!")
                    
            except (ValueError, IndexError):
                print("❌ Invalid selection")
        
        elif choice == "3":
            print("👋 Exiting...")
            return
        
        else:
            print("❌ Invalid choice")
            return
        
        print("\n📋 Next Steps:")
        print("1. Wait for endpoint to be active (check RunPod console)")
        print("2. Test endpoint with sample payload")
        print("3. Update your Next.js app with the endpoint ID")
        print("4. Set RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID in your environment")
        
        print("\n🎉 Deployment completed!")
        
    except Exception as e:
        print(f"❌ Deployment error: {e}")

if __name__ == "__main__":
    main()
