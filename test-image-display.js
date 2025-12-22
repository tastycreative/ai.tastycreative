// Test script to check image display functionality
const fetch = require('node-fetch');

async function testImageDisplay() {
  try {
    console.log('🔍 Testing image display functionality...');
    
    // Test the API endpoint that the gallery uses
    const response = await fetch('http://localhost:3000/api/images?includeData=false&limit=5');
    
    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('📊 API Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.images && data.images.length > 0) {
      console.log('✅ Found', data.images.length, 'images');
      
      data.images.forEach((image, index) => {
        console.log(`\n🖼️ Image ${index + 1}:`);
        console.log('  ID:', image.id);
        console.log('  Filename:', image.filename);
        console.log('  AWS S3 Key:', image.awsS3Key || 'none');
        console.log('  AWS S3 URL:', image.awsS3Url || 'none');
        console.log('  RunPod S3 Key:', image.s3Key || 'none');
        console.log('  Network Path:', image.networkVolumePath || 'none');
        console.log('  URL:', image.url || 'none');
        console.log('  Data URL:', image.dataUrl || 'none');
        console.log('  Created:', image.createdAt);
      });
    } else {
      console.log('⚠️ No images found or API error');
    }
    
  } catch (error) {
    console.error('💥 Error testing image display:', error);
  }
}

testImageDisplay();