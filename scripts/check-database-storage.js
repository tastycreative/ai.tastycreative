// Database Storage Analysis Script
// This script checks the generated_images and generated_videos tables for blob data and storage consumption

const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function analyzeTableStorage() {
  try {
    console.log('🔍 Analyzing database storage for generated_images and generated_videos tables...\n');

    // Check generated_images table
    console.log('📊 GENERATED_IMAGES TABLE ANALYSIS');
    console.log('=' .repeat(50));

    const images = await prisma.generatedImage.findMany({
      select: {
        id: true,
        filename: true,
        fileSize: true,
        data: true,
        s3Key: true,
        networkVolumePath: true,
        createdAt: true,
        jobId: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Get latest 20 images
    });

    console.log(`📈 Total images found: ${images.length}`);
    
    let totalBlobSize = 0;
    let imagesWithBlob = 0;
    let imagesWithS3Key = 0;
    let imagesWithNetworkPath = 0;

    images.forEach((image, index) => {
      const hasBlob = image.data && image.data.length > 0;
      const blobSize = hasBlob ? image.data.length : 0;
      const haS3Key = !!image.s3Key;
      const hasNetworkPath = !!image.networkVolumePath;

      if (hasBlob) {
        imagesWithBlob++;
        totalBlobSize += blobSize;
      }
      if (haS3Key) imagesWithS3Key++;
      if (hasNetworkPath) imagesWithNetworkPath++;

      console.log(`\n🖼️  Image ${index + 1}: ${image.filename}`);
      console.log(`   ID: ${image.id}`);
      console.log(`   Job ID: ${image.jobId || 'N/A'}`);
      console.log(`   Reported File Size: ${image.fileSize ? `${(image.fileSize / 1024 / 1024).toFixed(2)} MB (${image.fileSize.toLocaleString()} bytes)` : 'N/A'}`);
      console.log(`   Has Blob Data: ${hasBlob ? '✅ YES' : '❌ NO'}`);
      if (hasBlob) {
        console.log(`   Actual Blob Size: ${(blobSize / 1024 / 1024).toFixed(2)} MB (${blobSize.toLocaleString()} bytes)`);
        console.log(`   Storage Method: 🗄️ DATABASE BLOB (inefficient)`);
      } else {
        console.log(`   Storage Method: ${haS3Key ? '☁️ S3 OPTIMIZED' : (hasNetworkPath ? '💾 NETWORK VOLUME' : '❓ UNKNOWN')}`);
      }
      console.log(`   Has S3 Key: ${haS3Key ? '✅ YES' : '❌ NO'} ${image.s3Key ? `(${image.s3Key.length > 60 ? image.s3Key.substring(0, 60) + '...' : image.s3Key})` : ''}`);
      console.log(`   Has Network Path: ${hasNetworkPath ? '✅ YES' : '❌ NO'} ${image.networkVolumePath ? `(${image.networkVolumePath.length > 60 ? image.networkVolumePath.substring(0, 60) + '...' : image.networkVolumePath})` : ''}`);
      console.log(`   Created: ${image.createdAt.toISOString()}`);
    });

    console.log(`\n📊 IMAGES SUMMARY:`);
    console.log(`   Total images analyzed: ${images.length}`);
    console.log(`   Images with blob data: ${imagesWithBlob} (${((imagesWithBlob/images.length)*100).toFixed(1)}%)`);
    console.log(`   Images with S3 keys: ${imagesWithS3Key} (${((imagesWithS3Key/images.length)*100).toFixed(1)}%)`);
    console.log(`   Images with network paths: ${imagesWithNetworkPath} (${((imagesWithNetworkPath/images.length)*100).toFixed(1)}%)`);
    console.log(`   Total blob storage: ${(totalBlobSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Calculate total file sizes reported vs actual blob usage
    const totalReportedImageSize = images.reduce((sum, img) => sum + (img.fileSize || 0), 0);
    console.log(`   Total reported file sizes: ${(totalReportedImageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Database storage efficiency: ${totalBlobSize === 0 ? '💯 PERFECT (0% blob storage)' : `${((1 - totalBlobSize/totalReportedImageSize) * 100).toFixed(1)}% saved`}`);

    // Check generated_videos table
    console.log('\n\n🎬 GENERATED_VIDEOS TABLE ANALYSIS');
    console.log('=' .repeat(50));

    const videos = await prisma.generatedVideo.findMany({
      select: {
        id: true,
        filename: true,
        fileSize: true,
        data: true,
        s3Key: true,
        networkVolumePath: true,
        createdAt: true,
        jobId: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Get latest 20 videos
    });

    console.log(`📈 Total videos found: ${videos.length}`);
    
    let totalVideoBlobSize = 0;
    let videosWithBlob = 0;
    let videosWithS3Key = 0;
    let videosWithNetworkPath = 0;

    videos.forEach((video, index) => {
      const hasBlob = video.data && video.data.length > 0;
      const blobSize = hasBlob ? video.data.length : 0;
      const hasS3Key = !!video.s3Key;
      const hasNetworkPath = !!video.networkVolumePath;

      if (hasBlob) {
        videosWithBlob++;
        totalVideoBlobSize += blobSize;
      }
      if (hasS3Key) videosWithS3Key++;
      if (hasNetworkPath) videosWithNetworkPath++;

      console.log(`\n🎥 Video ${index + 1}: ${video.filename}`);
      console.log(`   ID: ${video.id}`);
      console.log(`   Job ID: ${video.jobId || 'N/A'}`);
      console.log(`   Reported File Size: ${video.fileSize ? `${(video.fileSize / 1024 / 1024).toFixed(2)} MB (${video.fileSize.toLocaleString()} bytes)` : 'N/A'}`);
      console.log(`   Has Blob Data: ${hasBlob ? '✅ YES' : '❌ NO'}`);
      if (hasBlob) {
        console.log(`   Actual Blob Size: ${(blobSize / 1024 / 1024).toFixed(2)} MB (${blobSize.toLocaleString()} bytes)`);
        console.log(`   Storage Method: 🗄️ DATABASE BLOB (inefficient)`);
      } else {
        console.log(`   Storage Method: ${hasS3Key ? '☁️ S3 OPTIMIZED' : (hasNetworkPath ? '💾 NETWORK VOLUME' : '❓ UNKNOWN')}`);
      }
      console.log(`   Has S3 Key: ${hasS3Key ? '✅ YES' : '❌ NO'} ${video.s3Key ? `(${video.s3Key.length > 60 ? video.s3Key.substring(0, 60) + '...' : video.s3Key})` : ''}`);
      console.log(`   Has Network Path: ${hasNetworkPath ? '✅ YES' : '❌ NO'} ${video.networkVolumePath ? `(${video.networkVolumePath.length > 60 ? video.networkVolumePath.substring(0, 60) + '...' : video.networkVolumePath})` : ''}`);
      console.log(`   Created: ${video.createdAt.toISOString()}`);
    });

    console.log(`\n📊 VIDEOS SUMMARY:`);
    console.log(`   Total videos analyzed: ${videos.length}`);
    console.log(`   Videos with blob data: ${videosWithBlob} (${((videosWithBlob/videos.length)*100).toFixed(1)}%)`);
    console.log(`   Videos with S3 keys: ${videosWithS3Key} (${((videosWithS3Key/videos.length)*100).toFixed(1)}%)`);
    console.log(`   Videos with network paths: ${videosWithNetworkPath} (${((videosWithNetworkPath/videos.length)*100).toFixed(1)}%)`);
    console.log(`   Total blob storage: ${(totalVideoBlobSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Calculate total file sizes reported vs actual blob usage
    const totalReportedVideoSize = videos.reduce((sum, vid) => sum + (vid.fileSize || 0), 0);
    console.log(`   Total reported file sizes: ${(totalReportedVideoSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Database storage efficiency: ${totalVideoBlobSize === 0 ? '💯 PERFECT (0% blob storage)' : `${((1 - totalVideoBlobSize/totalReportedVideoSize) * 100).toFixed(1)}% saved`}`);

    // Overall summary
    console.log('\n\n🎯 OVERALL STORAGE SUMMARY');
    console.log('=' .repeat(50));
    
    const totalReportedSize = images.reduce((sum, img) => sum + (img.fileSize || 0), 0) + 
                             videos.reduce((sum, vid) => sum + (vid.fileSize || 0), 0);
    const totalBlobUsage = totalBlobSize + totalVideoBlobSize;
    
    console.log(`📊 Total files analyzed: ${images.length + videos.length} (${images.length} images + ${videos.length} videos)`);
    console.log(`📏 Total actual file sizes: ${(totalReportedSize / 1024 / 1024).toFixed(2)} MB (${totalReportedSize.toLocaleString()} bytes)`);
    console.log(`🗄️  Total database blob storage: ${(totalBlobUsage / 1024 / 1024).toFixed(2)} MB (${totalBlobUsage.toLocaleString()} bytes)`);
    console.log(`� Database storage saved: ${((totalReportedSize - totalBlobUsage) / 1024 / 1024).toFixed(2)} MB (${(totalReportedSize - totalBlobUsage).toLocaleString()} bytes)`);
    console.log(`📈 Storage efficiency: ${totalBlobUsage === 0 ? '💯 PERFECT (100% S3 optimized)' : `${((1 - totalBlobUsage/totalReportedSize) * 100).toFixed(1)}% database savings`}`);
    
    // Individual file breakdowns
    console.log(`\n📊 FILE SIZE BREAKDOWN:`);
    images.forEach((img, i) => {
      const size = img.fileSize || 0;
      const hasBlob = img.data && img.data.length > 0;
      console.log(`   🖼️  ${img.filename}: ${(size / 1024 / 1024).toFixed(2)} MB ${hasBlob ? '(🗄️ IN DATABASE)' : '(☁️ S3 OPTIMIZED)'}`);
    });
    videos.forEach((vid, i) => {
      const size = vid.fileSize || 0;
      const hasBlob = vid.data && vid.data.length > 0;
      console.log(`   🎥 ${vid.filename}: ${(size / 1024 / 1024).toFixed(2)} MB ${hasBlob ? '(🗄️ IN DATABASE)' : '(☁️ S3 OPTIMIZED)'}`);
    });
    
    // Optimization recommendations
    console.log('\n\n💡 OPTIMIZATION RECOMMENDATIONS');
    console.log('=' .repeat(50));
    
    if (imagesWithBlob > 0 && imagesWithS3Key > 0) {
      console.log('⚠️  ISSUE: Some images have both blob data AND S3 keys - this is redundant storage!');
      console.log('🔧 RECOMMENDATION: Remove blob data for images that have S3 keys');
    }
    
    if (videosWithBlob > 0 && videosWithS3Key > 0) {
      console.log('⚠️  ISSUE: Some videos have both blob data AND S3 keys - this is redundant storage!');
      console.log('🔧 RECOMMENDATION: Remove blob data for videos that have S3 keys');
    }
    
    if (imagesWithBlob === 0 && videosWithBlob === 0) {
      console.log('✅ EXCELLENT: No blob data found - all using S3/network storage optimization!');
    }
    
    if (imagesWithS3Key === images.length && videosWithS3Key === videos.length) {
      console.log('✅ EXCELLENT: All records have S3 keys - optimal storage configuration!');
    }

    // Check for recent generations to see current behavior
    const recentImages = await prisma.generatedImage.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        id: true,
        filename: true,
        data: true,
        s3Key: true,
        createdAt: true
      }
    });

    const recentVideos = await prisma.generatedVideo.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        id: true,
        filename: true,
        data: true,
        s3Key: true,
        createdAt: true
      }
    });

    console.log('\n\n🕒 RECENT ACTIVITY (Last 24 hours)');
    console.log('=' .repeat(50));
    console.log(`📷 Recent images: ${recentImages.length}`);
    console.log(`🎬 Recent videos: ${recentVideos.length}`);
    
    const recentImagesWithBlob = recentImages.filter(img => img.data && img.data.length > 0).length;
    const recentVideosWithBlob = recentVideos.filter(vid => vid.data && vid.data.length > 0).length;
    
    console.log(`📊 Recent images with blob data: ${recentImagesWithBlob}/${recentImages.length}`);
    console.log(`📊 Recent videos with blob data: ${recentVideosWithBlob}/${recentVideos.length}`);
    
    if (recentImagesWithBlob === 0 && recentVideosWithBlob === 0) {
      console.log('✅ CURRENT STATUS: Recent generations are properly using S3 optimization!');
    } else {
      console.log('⚠️  CURRENT STATUS: Recent generations still storing blob data - check handler configuration');
    }

  } catch (error) {
    console.error('❌ Error analyzing database storage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeTableStorage();