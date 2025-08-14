// Test script to verify chunked upload functionality
// Run with: node test-chunked-upload.js

const fs = require('fs');
const path = require('path');

async function testChunkedUpload() {
  const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
  
  // Create a small test file (simulating a LoRA)
  const testData = Buffer.alloc(1024 * 1024, 'A'); // 1MB of 'A's
  const fileName = 'test-lora.safetensors';
  const sessionId = `test_${Date.now()}`;
  const chunkSize = 512 * 1024; // 512KB chunks
  const totalChunks = Math.ceil(testData.length / chunkSize);
  
  console.log(`🧪 Testing chunked upload with ${totalChunks} chunks`);
  
  try {
    // Step 1: Initialize upload session
    console.log('1️⃣ Initializing upload session...');
    const initResponse = await fetch(`${BASE_URL}/api/models/upload-chunked`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'init',
        sessionId,
        fileName,
        fileSize: testData.length,
        totalChunks,
        metadata: {
          displayName: 'Test LoRA',
          description: 'Test upload'
        }
      })
    });

    if (!initResponse.ok) {
      throw new Error(`Init failed: ${initResponse.status} ${await initResponse.text()}`);
    }
    
    console.log('✅ Session initialized');

    // Step 2: Upload chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, testData.length);
      const chunk = testData.slice(start, end);
      
      console.log(`📦 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} bytes)`);
      
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('sessionId', sessionId);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('chunk', new Blob([chunk]), fileName);

      const chunkResponse = await fetch(`${BASE_URL}/api/models/upload-chunked`, {
        method: 'POST',
        body: formData
      });

      if (!chunkResponse.ok) {
        throw new Error(`Chunk ${chunkIndex} failed: ${chunkResponse.status} ${await chunkResponse.text()}`);
      }

      const result = await chunkResponse.json();
      
      if (result.uploadComplete) {
        console.log('🎉 Upload completed!');
        console.log('📄 Result:', JSON.stringify(result, null, 2));
        return;
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testChunkedUpload();
}

module.exports = { testChunkedUpload };
