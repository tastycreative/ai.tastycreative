const fs = require('fs');

// Test payload for face swap with all fixes
const testPayload = {
  originalImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
  newFaceImageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400", 
  originalFilename: "test-original.jpg",
  newFaceFilename: "test-new-face.jpg",
  workflow: {
    "1": {
      "inputs": {
        "image": "test-original.jpg",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "Load Image"
      }
    },
    "2": {
      "inputs": {
        "image": "test-new-face.jpg", 
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "Load New Face"
      }
    },
    "3": {
      "inputs": {
        "enabled": true,
        "input_image": ["1", 0],
        "source_image": ["2", 0],
        "face_model": "inswapper_128.onnx",
        "face_restore_model": "none",
        "face_restore_visibility": 1,
        "codeformer_weight": 0.5,
        "detect_gender_input": "no",
        "detect_gender_source": "no", 
        "input_faces_index": "0",
        "source_faces_index": "0",
        "console_log_level": 1
      },
      "class_type": "ReActorFaceSwap",
      "_meta": {
        "title": "ReActor Face Swap"
      }
    },
    "4": {
      "inputs": {
        "filename_prefix": "face_swap_result",
        "images": ["3", 0]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "Save Image"
      }
    }
  }
};

async function testFaceSwapFixes() {
  console.log('🧪 Testing Face Swap Handler Fixes');
  console.log('==================================');
  
  try {
    const response = await fetch('http://localhost:3000/api/generate/face-swap-serverless', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token_user_30dULT8ZLO1jthhCEgn349cKcvT' // Mock Clerk token
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    console.log('✅ Response received:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.jobId) {
      console.log('\n🎯 Testing webhook endpoint...');
      
      // Test webhook payload with fixes
      const webhookPayload = {
        id: result.jobId,
        status: "COMPLETED",
        output: {
          resultUrls: [
            `https://s3api-us-ks-2.runpod.io/83cljmpqfd/user_30dULT8ZLO1jthhCEgn349cKcvT/face_swap_result_${Date.now()}.png`
          ],
          network_volume_paths: [
            `/workspace/output/face_swap_result_${Date.now()}.png`
          ]
        }
      };
      
      const webhookResponse = await fetch(`http://localhost:3000/api/generation/${result.jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      const webhookResult = await webhookResponse.json();
      console.log('✅ Webhook response:');
      console.log(JSON.stringify(webhookResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

console.log('🔧 Fix 1: resultUrls generation with S3 proxy URLs');
console.log('🔧 Fix 2: user_id extraction from Clerk auth (user_30dULT8ZLO1jthhCEgn349cKcvT)');
console.log('🔧 Fix 3: Unique timestamp-based filename generation');
console.log('🔧 Fix 4: Webhook endpoint routing to /generation/{jobId}');
console.log('');

// Run test if this is executed directly
if (require.main === module) {
  testFaceSwapFixes();
}

module.exports = { testFaceSwapFixes, testPayload };