#!/usr/bin/env python3

import os
import json
import time
import requests

# Test payload for text-to-image generation with S3 storage
test_payload = {
    "input": {
        "prompt": "A beautiful sunset over mountains, photorealistic, high quality",
        "negative_prompt": "blurry, low quality, distorted",
        "width": 1024,
        "height": 1024,
        "num_inference_steps": 25,
        "guidance_scale": 7.5,
        "seed": 42,
        "webhook": "https://ai.tastycreative.xyz/api/webhooks/runpod",
        "user_id": "test_user_123"
    }
}

# RunPod endpoint configuration
RUNPOD_ENDPOINT_ID = "zzlk9iutmcdtqy"  # Text-to-image endpoint
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")

if not RUNPOD_API_KEY:
    print("❌ RUNPOD_API_KEY environment variable not set")
    exit(1)

def submit_job():
    """Submit a test job to the text-to-image endpoint"""
    url = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run"
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    print("🚀 Submitting test job to RunPod...")
    print(f"📝 Payload: {json.dumps(test_payload, indent=2)}")
    
    response = requests.post(url, json=test_payload, headers=headers)
    
    if response.status_code == 200:
        job_data = response.json()
        job_id = job_data.get("id")
        print(f"✅ Job submitted successfully: {job_id}")
        return job_id
    else:
        print(f"❌ Failed to submit job: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def check_job_status(job_id):
    """Check the status of a submitted job"""
    url = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/status/{job_id}"
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Failed to check job status: {response.status_code}")
        return None

def main():
    """Main test function"""
    print("🧪 Testing S3 Network Volume Storage Integration")
    print("=" * 50)
    
    # Submit job
    job_id = submit_job()
    if not job_id:
        return
    
    # Monitor job progress
    print(f"\n⏳ Monitoring job {job_id}...")
    start_time = time.time()
    
    while True:
        status_data = check_job_status(job_id)
        if not status_data:
            break
            
        status = status_data.get("status")
        print(f"📊 Status: {status}")
        
        if status == "COMPLETED":
            print("✅ Job completed successfully!")
            output = status_data.get("output", {})
            
            # Check for S3 network volume paths
            if "network_volume_paths" in output:
                print(f"🗂️ Network volume paths: {output['network_volume_paths']}")
            
            # Check for status updates
            if "status_updates" in output:
                print(f"📈 Final status updates: {output['status_updates']}")
            
            break
            
        elif status == "FAILED":
            print("❌ Job failed!")
            error = status_data.get("error")
            if error:
                print(f"💥 Error: {error}")
            break
            
        elif status in ["IN_QUEUE", "IN_PROGRESS"]:
            elapsed = time.time() - start_time
            print(f"⏱️ Running for {elapsed:.1f}s...")
            time.sleep(10)  # Check every 10 seconds
            
        else:
            print(f"❓ Unknown status: {status}")
            time.sleep(5)
    
    print("\n🏁 Test completed!")

if __name__ == "__main__":
    main()