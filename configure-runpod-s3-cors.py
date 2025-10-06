#!/usr/bin/env python3
"""
Configure RunPod S3 bucket with proper CORS for direct browser uploads
"""

import boto3
from botocore.exceptions import ClientError
import os
from pathlib import Path

# Load environment variables from .env.local
def load_env_file():
    env_path = Path(__file__).parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Remove quotes if present
                    value = value.strip('"').strip("'")
                    os.environ[key] = value
    print("📁 Loaded environment variables from .env.local")

# Load environment first
load_env_file()

# RunPod S3 Configuration
RUNPOD_S3_ENDPOINT = 'https://s3api-us-ks-2.runpod.io'
RUNPOD_S3_REGION = 'us-ks-2'
RUNPOD_S3_BUCKET = '83cljmpqfd'
RUNPOD_S3_ACCESS_KEY = os.getenv('RUNPOD_S3_ACCESS_KEY')
RUNPOD_S3_SECRET_KEY = os.getenv('RUNPOD_S3_SECRET_KEY')

def configure_runpod_cors():
    """Configure RunPod S3 bucket CORS for direct browser uploads"""
    print(f"🔧 Configuring CORS for RunPod S3 bucket: {RUNPOD_S3_BUCKET}")
    print(f"🌐 Endpoint: {RUNPOD_S3_ENDPOINT}")
    
    if not RUNPOD_S3_ACCESS_KEY or not RUNPOD_S3_SECRET_KEY:
        print("❌ RunPod S3 credentials not found in .env.local")
        print("   Make sure RUNPOD_S3_ACCESS_KEY and RUNPOD_S3_SECRET_KEY are set")
        return False
    
    # Initialize S3 client for RunPod
    s3_client = boto3.client(
        's3',
        endpoint_url=RUNPOD_S3_ENDPOINT,
        aws_access_key_id=RUNPOD_S3_ACCESS_KEY,
        aws_secret_access_key=RUNPOD_S3_SECRET_KEY,
        region_name=RUNPOD_S3_REGION,
        config=boto3.session.Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'}
        )
    )
    
    try:
        # Configure CORS for direct browser uploads
        cors_configuration = {
            'CORSRules': [
                {
                    'ID': 'AllowDirectBrowserUploads',
                    'AllowedOrigins': [
                        'http://localhost:3000',
                        'http://localhost:3001', 
                        'https://*.vercel.app',
                        'https://*.tastycreative.ai',
                        'https://tastycreative.ai',
                        '*'  # Allow all origins for maximum compatibility
                    ],
                    'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    'AllowedHeaders': [
                        '*',
                        'Content-Type',
                        'Content-Length',
                        'Content-MD5',
                        'Authorization',
                        'x-amz-*'
                    ],
                    'ExposeHeaders': [
                        'ETag',
                        'x-amz-request-id',
                        'x-amz-id-2'
                    ],
                    'MaxAgeSeconds': 3600
                }
            ]
        }
        
        print("🌐 Setting CORS configuration for direct uploads...")
        s3_client.put_bucket_cors(
            Bucket=RUNPOD_S3_BUCKET,
            CORSConfiguration=cors_configuration
        )
        print("✅ CORS configuration applied successfully!")
        
        # Verify CORS configuration
        print("\n🔍 Verifying CORS configuration...")
        cors_result = s3_client.get_bucket_cors(Bucket=RUNPOD_S3_BUCKET)
        
        print("✅ Current CORS rules:")
        for i, rule in enumerate(cors_result['CORSRules'], 1):
            print(f"\n  Rule {i}:")
            print(f"    Allowed Origins: {rule.get('AllowedOrigins', [])}")
            print(f"    Allowed Methods: {rule.get('AllowedMethods', [])}")
            print(f"    Allowed Headers: {rule.get('AllowedHeaders', [])}")
            print(f"    Max Age: {rule.get('MaxAgeSeconds', 0)} seconds")
        
        print("\n🎉 RunPod S3 CORS configuration completed successfully!")
        print(f"📍 Bucket: {RUNPOD_S3_BUCKET}")
        print(f"🌐 Endpoint: {RUNPOD_S3_ENDPOINT}")
        print(f"✅ Direct browser uploads are now enabled!")
        
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"❌ Error configuring CORS: {error_code} - {error_message}")
        
        if error_code == 'AccessDenied':
            print("💡 Make sure your RunPod S3 credentials have the necessary permissions:")
            print("   - s3:PutBucketCors")
            print("   - s3:GetBucketCors")
        
        return False
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 RunPod S3 CORS Configuration Tool\n")
    success = configure_runpod_cors()
    
    if success:
        print("\n✨ Configuration complete!")
        print("   You can now upload files directly from the browser to RunPod S3.")
        print("   The 'Failed to fetch' CORS errors should be resolved.")
    else:
        print("\n🚨 Configuration failed. Please check your credentials and try again.")
