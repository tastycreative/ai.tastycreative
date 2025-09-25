const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGenerateImage() {
  console.log('🧪 Testing network volume storage...');
  
  try {
    // Get latest generations to establish baseline
    const beforeGeneration = await prisma.generatedImage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { id: true, createdAt: true }
    });
    
    const beforeId = beforeGeneration[0]?.id || 0;
    console.log(`📊 Baseline: Latest image ID is ${beforeId}`);
    
    // For actual testing, we'd trigger a RunPod generation here
    // But since we can't easily test that programmatically, 
    // let's just show what we're looking for
    
    console.log('\n🎯 What to test:');
    console.log('1. Trigger a text-to-image generation through your app');
    console.log('2. Check if new images have s3Key but NO database blob');
    console.log('3. Verify images are stored in network volume');
    
    console.log('\n📋 After generation, run this to check:');
    console.log('   node check-storage.js');
    
    console.log('\n🔍 Looking for images with:');
    console.log('   ✅ s3Key: "outputs/USER_ID/IMAGE_NAME.png"');
    console.log('   ✅ networkVolumePath: "/runpod-volume/outputs/USER_ID/IMAGE_NAME.png"');
    console.log('   ❌ data: null (no database blob)');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGenerateImage();