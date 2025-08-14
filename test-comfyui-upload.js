// Test script to verify ComfyUI upload functionality
async function testComfyUIUpload() {
  const COMFYUI_URL = 'http://209.53.88.242:14753';
  
  console.log('🔍 Testing ComfyUI upload functionality...');
  
  // Test 1: Check system stats
  try {
    const response = await fetch(`${COMFYUI_URL}/system_stats`);
    if (response.ok) {
      const stats = await response.json();
      console.log('✅ ComfyUI system stats:', stats.system.comfyui_version);
    } else {
      console.log('❌ Failed to get system stats:', response.status);
      return;
    }
  } catch (error) {
    console.log('❌ Error getting system stats:', error.message);
    return;
  }
  
  // Test 2: Check upload endpoints
  const endpoints = ['/upload', '/api/upload', '/upload/image'];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing endpoint: ${COMFYUI_URL}${endpoint}`);
      const response = await fetch(`${COMFYUI_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: new FormData() // Empty form data just to test the endpoint
      });
      
      console.log(`📡 ${endpoint} response:`, response.status, response.statusText);
      
      if (response.status === 400 || response.status === 422) {
        console.log('✅ Endpoint exists (expects proper file data)');
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint} error:`, error.message);
    }
  }
}

// Run the test
testComfyUIUpload().then(() => {
  console.log('🏁 Test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
});
