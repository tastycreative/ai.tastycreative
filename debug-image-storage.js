// Test script for image storage debugging
// Paste this in your browser console on the generated content page

async function testImageStorage() {
  console.log('🔍 === IMAGE STORAGE DEBUG TEST ===');
  
  try {
    // Test 1: Check direct database query
    console.log('1️⃣ Testing database image query...');
    const dbResponse = await fetch('/api/debug/check-images');
    const dbData = await dbResponse.json();
    console.log('📊 Database Images:', dbData);
    
    // Test 2: Check images API
    console.log('2️⃣ Testing images API...');
    const apiResponse = await fetch('/api/images');
    const apiData = await apiResponse.json();
    console.log('📡 Images API Response:', apiData);
    
    // Test 3: Check recent jobs
    console.log('3️⃣ Testing recent jobs...');
    const jobsResponse = await fetch('/api/debug/recent-jobs');
    const jobsData = await jobsResponse.json();
    console.log('💼 Recent Jobs:', jobsData);
    
    // Test 4: System status
    console.log('4️⃣ Testing system status...');
    const statusResponse = await fetch('/api/debug/system-status');
    const statusData = await statusResponse.json();
    console.log('🖥️ System Status:', statusData);
    
    // Summary
    console.log('📋 === SUMMARY ===');
    console.log(`Database Images: ${dbData.data?.totalImages || 'N/A'}`);
    console.log(`API Images: ${apiData.images?.length || 'N/A'}`);
    console.log(`Recent Jobs: ${jobsData.data?.jobs?.length || 'N/A'}`);
    
    if (dbData.data?.totalImages > 0 && apiData.images?.length === 0) {
      console.log('⚠️ ISSUE: Images exist in database but API returns none');
    } else if (dbData.data?.totalImages === apiData.images?.length) {
      console.log('✅ SUCCESS: Database and API counts match');
    } else {
      console.log('⚠️ WARNING: Mismatch between database and API counts');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testImageStorage();
