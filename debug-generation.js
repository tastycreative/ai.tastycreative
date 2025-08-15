// Test script to debug generation issue
// Run this in your browser console on the deployed site

async function debugGeneration() {
  console.log('🔍 === GENERATION DEBUG TEST ===');
  
  // Test 1: Check system status
  try {
    const statusResponse = await fetch('/api/debug/system-status');
    const statusData = await statusResponse.json();
    console.log('📊 System Status:', statusData);
  } catch (error) {
    console.error('❌ System status check failed:', error);
  }
  
  // Test 2: Check if images API works
  try {
    console.log('🖼️ Testing images API...');
    const imagesResponse = await fetch('/api/images?limit=5');
    const imagesData = await imagesResponse.json();
    console.log('📸 Images API Response:', imagesData);
  } catch (error) {
    console.error('❌ Images API failed:', error);
  }
  
  // Test 3: Check if job listing works
  try {
    console.log('🔍 Testing jobs API...');
    const jobsResponse = await fetch('/api/user/jobs?limit=5');
    if (jobsResponse.ok) {
      const jobsData = await jobsResponse.json();
      console.log('💼 Recent jobs:', jobsData);
    } else {
      console.log('ℹ️ Jobs API not available or empty');
    }
  } catch (error) {
    console.log('ℹ️ Jobs API test skipped (may not exist)');
  }
}

// Run the debug function
debugGeneration();
