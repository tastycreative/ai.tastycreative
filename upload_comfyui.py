def upload_model_file_comfyui(model_file_data, model_filename, job_id, step, job_input, webhook_url):
    """Upload model file directly to ComfyUI and create database record via API"""
    try:
        logger.info("🚀 Starting direct upload to ComfyUI...")
        logger.info(f"📦 Model file: {model_filename} ({len(model_file_data)} bytes = {len(model_file_data) / 1024 / 1024:.1f}MB)")
        
        # Safely get model name from job_input
        model_name = "unknown_model"
        if isinstance(job_input, dict) and 'name' in job_input:
            model_name = job_input['name']
        elif isinstance(job_input, str):
            model_name = job_input
        
        # Generate unique filename with timestamp (similar to your influencer tab approach)
        timestamp = int(time.time() * 1000)
        unique_filename = f"{model_name}_{timestamp}_{model_filename}"
        
        # Step 1: Upload directly to ComfyUI
        logger.info("🎯 Uploading to ComfyUI...")
        
        # Get ComfyUI URL from environment (same as your frontend)
        comfyui_url = os.environ.get('COMFYUI_URL', 'http://209.53.88.242:14753')
        upload_url = f"{comfyui_url}/upload/image"
        
        # Prepare multipart form data for ComfyUI (exactly like your influencer tab)
        files = {
            'image': (unique_filename, model_file_data, 'application/octet-stream')
        }
        
        data = {
            'subfolder': 'loras'  # Upload to loras subfolder
        }
        
        # Upload to ComfyUI with extended timeout
        logger.info(f"📡 Uploading to ComfyUI: {upload_url}")
        comfyui_response = requests.post(
            upload_url,
            files=files,
            data=data,
            timeout=1800,  # 30 minute timeout for large files
            headers={'User-Agent': 'RunPod-Training-Handler/1.0'}
        )
        
        logger.info(f"📋 ComfyUI response: {comfyui_response.status_code}")
        
        if comfyui_response.status_code != 200:
            logger.error(f"❌ ComfyUI upload failed: {comfyui_response.status_code}")
            logger.error(f"❌ Response: {comfyui_response.text}")
            return False
        
        try:
            comfyui_result = comfyui_response.json()
            logger.info(f"✅ Uploaded to ComfyUI successfully: {comfyui_result}")
        except:
            comfyui_result = {"name": unique_filename}
            logger.info(f"✅ Uploaded to ComfyUI successfully (no JSON response)")
        
        # Step 2: Create database record via small API call (no file data)
        logger.info("💾 Creating database record...")
        
        # Extract base URL from webhook URL
        base_url = webhook_url.split('/api/webhooks')[0]
        db_record_url = f"{base_url}/api/models/upload-from-training/create-record"
        
        record_data = {
            'job_id': job_id,
            'model_name': model_name,
            'file_name': unique_filename,
            'original_file_name': model_filename,
            'file_size': len(model_file_data),
            'comfyui_path': f'models/loras/{unique_filename}',
            'sync_status': 'synced',  # Already synced since uploaded directly to ComfyUI
            'training_steps': str(step),
            'final_loss': None  # Could extract from training logs if needed
        }
        
        # Send small JSON payload to create database record
        db_response = requests.post(
            db_record_url,
            json=record_data,
            timeout=60,
            headers={
                'User-Agent': 'RunPod-Training-Handler/1.0',
                'Content-Type': 'application/json'
            }
        )
        
        logger.info(f"📋 Database record response: {db_response.status_code}")
        
        if db_response.status_code == 200:
            response_data = db_response.json()
            logger.info("✅ Model uploaded to ComfyUI and database record created successfully!")
            logger.info(f"📂 LoRA created: {response_data.get('lora', {}).get('name', 'Unknown')}")
            return True
        else:
            logger.error(f"❌ Database record creation failed: {db_response.status_code}")
            logger.error(f"❌ Response: {db_response.text}")
            # Even if DB record fails, the file is uploaded to ComfyUI
            logger.info("⚠️ File uploaded to ComfyUI but database record failed")
            return False
            
    except requests.exceptions.Timeout:
        logger.error(f"❌ Upload timeout (large files may take a while)")
        return False
    except Exception as e:
        logger.error(f"❌ Upload error: {str(e)}")
        return False
