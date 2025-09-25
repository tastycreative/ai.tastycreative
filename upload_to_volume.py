#!/usr/bin/env python3
"""
Simple network volume upload script for RunPod ComfyUI
This script accepts file uploads and saves them directly to /runpod-volume/loras/{user_id}/
"""

import os
import sys
from pathlib import Path
from flask import Flask, request, jsonify
import werkzeug
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Network volume base path
NETWORK_VOLUME_BASE = Path('/runpod-volume')
LORAS_DIR = NETWORK_VOLUME_BASE / 'loras'

def ensure_directory_exists(path: Path) -> bool:
    """Ensure directory exists and is writable"""
    try:
        path.mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        print(f"❌ Failed to create directory {path}: {e}")
        return False

@app.route('/upload_to_network_volume', methods=['POST'])
def upload_to_network_volume():
    """Upload file directly to network volume"""
    try:
        # Check if file is in the request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get user_id and display_name from form
        user_id = request.form.get('user_id', 'unknown')
        display_name = request.form.get('display_name', 'Unknown LoRA')
        
        # Validate file type
        allowed_extensions = {'.safetensors', '.pt', '.ckpt'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            return jsonify({
                'error': f'Invalid file type {file_extension}. Only .safetensors, .pt, and .ckpt are allowed.'
            }), 400
        
        # Create user directory
        user_dir = LORAS_DIR / user_id
        if not ensure_directory_exists(user_dir):
            return jsonify({'error': 'Failed to create user directory'}), 500
        
        # Secure the filename
        filename = secure_filename(file.filename)
        file_path = user_dir / filename
        
        # Save file to network volume
        print(f"📁 Saving {filename} to {file_path}")
        file.save(str(file_path))
        
        # Verify file was saved
        if not file_path.exists():
            return jsonify({'error': 'File save failed'}), 500
        
        file_size = file_path.stat().st_size
        print(f"✅ File saved successfully: {file_path} ({file_size} bytes)")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'user_id': user_id,
            'file_path': str(file_path),
            'file_size': file_size,
            'network_volume_path': f'/runpod-volume/loras/{user_id}/{filename}',
            'comfyui_path': f'models/loras/{filename}',  # If models is symlinked to network volume
            'message': f'LoRA "{display_name}" uploaded to network volume successfully'
        })
        
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/network_volume_status', methods=['GET'])
def network_volume_status():
    """Check network volume status and list user files"""
    try:
        user_id = request.args.get('user_id', 'all')
        
        status = {
            'network_volume_available': NETWORK_VOLUME_BASE.exists(),
            'loras_dir_exists': LORAS_DIR.exists(),
            'loras_dir_writable': os.access(str(LORAS_DIR), os.W_OK) if LORAS_DIR.exists() else False,
        }
        
        # List files for specific user or all users
        files = []
        if LORAS_DIR.exists():
            if user_id == 'all':
                for user_dir in LORAS_DIR.iterdir():
                    if user_dir.is_dir():
                        for file_path in user_dir.glob('*'):
                            if file_path.is_file():
                                files.append({
                                    'user_id': user_dir.name,
                                    'filename': file_path.name,
                                    'size': file_path.stat().st_size,
                                    'path': str(file_path)
                                })
            else:
                user_dir = LORAS_DIR / user_id
                if user_dir.exists():
                    for file_path in user_dir.glob('*'):
                        if file_path.is_file():
                            files.append({
                                'user_id': user_id,
                                'filename': file_path.name,
                                'size': file_path.stat().st_size,
                                'path': str(file_path)
                            })
        
        return jsonify({
            'success': True,
            'status': status,
            'files': files,
            'total_files': len(files)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Ensure base directories exist
    ensure_directory_exists(LORAS_DIR)
    
    print("🚀 Network Volume Upload Server starting...")
    print(f"📂 Network volume base: {NETWORK_VOLUME_BASE}")
    print(f"📂 LoRAs directory: {LORAS_DIR}")
    print(f"📂 Directory exists: {LORAS_DIR.exists()}")
    
    # Run on port 8189 (different from ComfyUI's 8188)
    app.run(host='0.0.0.0', port=8189, debug=True)
