// Test script for database upload endpoint
import fs from 'fs';
import path from 'path';

// Create a small test file
const testData = Buffer.from('This is a test model file content for database storage', 'utf-8');
const base64Data = testData.toString('base64');

const testPayload = {
    jobId: 'test-job-123',
    modelName: 'test-model',
    fileName: 'test-model.safetensors',
    fileData: base64Data,
    trainingSteps: 1000,
    finalLoss: 0.05
};

const uploadUrl = 'http://localhost:3000/api/models/upload-to-database';

async function testUpload() {
    try {
        console.log('🧪 Testing database upload endpoint...');
        console.log(`📦 Test payload size: ${JSON.stringify(testPayload).length} bytes`);
        
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload)
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Database upload test successful!');
            console.log('📊 Response:', JSON.stringify(result, null, 2));
        } else {
            console.log('❌ Database upload test failed!');
            console.log(`💥 Status: ${response.status}`);
            console.log('💥 Error:', JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('💥 Test error:', error);
    }
}

// Run test if this script is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    testUpload();
}

export { testUpload };
