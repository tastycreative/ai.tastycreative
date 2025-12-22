// Simple database size checker using fetch API
async function checkDatabaseSizes() {
  try {
    console.log('🔍 Checking database image data sizes via API...\n');
    
    // First get the stats
    const statsResponse = await fetch('https://e21ce0a34019.ngrok-free.app/api/images?stats=true', {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json'
      }
    });
    
    if (!statsResponse.ok) {
      throw new Error(`Stats API call failed: ${statsResponse.status} ${statsResponse.statusText}`);
    }
    
    const statsData = await statsResponse.json();
    
    if (statsData.success) {
      console.log('📊 DATABASE IMAGE STATISTICS:');
      console.log(`   Total images: ${statsData.stats.totalImages}`);
      console.log(`   Total storage size: ${formatBytes(statsData.stats.totalSize)}`);
      console.log(`   Images with database data: ${statsData.stats.imagesWithData}`);
      console.log(`   Images without database data: ${statsData.stats.imagesWithoutData}`);
      
      if (statsData.stats.formatBreakdown) {
        console.log('\n📋 Format breakdown:');
        Object.entries(statsData.stats.formatBreakdown).forEach(([format, count]) => {
          console.log(`   ${format}: ${count} images`);
        });
      }
      
      // Calculate potential savings
      const redundantDataSize = statsData.stats.imagesWithData * 1200000; // Estimate 1.2MB per image
      if (statsData.stats.imagesWithData > 0) {
        console.log(`\n⚠️  POTENTIAL SAVINGS: ~${formatBytes(redundantDataSize)}`);
        console.log(`   (${statsData.stats.imagesWithData} images likely have redundant database storage)`);
      }
    }
    
    // Now get recent images to check their storage details
    console.log('\n🔍 Fetching recent images for detailed analysis...');
    
    const imagesResponse = await fetch('https://e21ce0a34019.ngrok-free.app/api/images?limit=10&includeData=false', {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json'
      }
    });
    
    if (!imagesResponse.ok) {
      throw new Error(`Images API call failed: ${imagesResponse.status} ${imagesResponse.statusText}`);
    }
    
    const imagesData = await imagesResponse.json();
    
    if (imagesData.success && imagesData.images) {
      console.log(`\n🔍 RECENT IMAGES ANALYSIS (${imagesData.images.length} shown):`);
      
      let s3Images = 0;
      let networkVolumeImages = 0;
      let databaseOnlyImages = 0;
      
      imagesData.images.forEach((image, index) => {
        const hasS3 = image.s3Key !== null && image.s3Key !== undefined;
        const hasNetworkVolume = image.networkVolumePath !== null && image.networkVolumePath !== undefined;
        const hasData = image.data !== null && image.data !== undefined;
        
        if (hasS3) s3Images++;
        if (hasNetworkVolume) networkVolumeImages++;
        if (!hasS3 && !hasNetworkVolume && hasData) databaseOnlyImages++;
        
        console.log(`\n${index + 1}. ${image.filename}`);
        console.log(`   📁 Job ID: ${image.jobId || 'N/A'}`);
        console.log(`   📏 File Size: ${image.fileSize ? formatBytes(image.fileSize) : 'N/A'}`);
        console.log(`   🗄️  S3 Key: ${hasS3 ? 'YES' : 'NO'}`);
        console.log(`   🌐 Network Volume: ${hasNetworkVolume ? 'YES' : 'NO'}`);
        console.log(`   📅 Created: ${new Date(image.createdAt).toLocaleString()}`);
        
        // Determine storage type
        if (hasS3 || hasNetworkVolume) {
          console.log(`   ✅ Storage: S3/Network Volume (optimal)`);
        } else {
          console.log(`   ⚠️  Storage: Database only (suboptimal)`);
        }
      });
      
      console.log(`\n📈 STORAGE BREAKDOWN:`);
      console.log(`   Images using S3: ${s3Images}`);
      console.log(`   Images using Network Volume: ${networkVolumeImages}`);
      console.log(`   Images using database only: ${databaseOnlyImages}`);
      
      if (s3Images > 0 || networkVolumeImages > 0) {
        console.log(`\n✅ GOOD NEWS: Your recent images are using S3/Network Volume storage!`);
        console.log(`   This means your database size should be much smaller now.`);
      }
      
    } else {
      console.error('❌ Images API call failed:', imagesData.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

checkDatabaseSizes();