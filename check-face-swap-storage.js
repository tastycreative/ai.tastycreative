const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkFaceSwapFiles() {
  console.log('🔍 Checking face swap file patterns...\n');
  
  const faceSwapImages = await prisma.generatedImage.findMany({
    where: {
      OR: [
        { filename: { contains: 'PureInpaint_FaceSwap' } },
        { filename: { contains: 'ComfyUI_temp' } },
        { filename: { contains: 'comfyui_temp' } }
      ]
    },
    select: {
      id: true,
      filename: true,
      fileSize: true,
      jobId: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📊 Found ${faceSwapImages.length} face swap related files:`);
  
  let finalOutputs = 0;
  let tempFiles = 0;
  let totalWastedStorage = 0;
  
  faceSwapImages.forEach((img, i) => {
    const isTemp = img.filename.toLowerCase().includes('temp');
    const size = img.fileSize || 0;
    
    if (isTemp) {
      tempFiles++;
      totalWastedStorage += size;
      console.log(`❌ TEMP: ${img.filename} (${(size/1024/1024).toFixed(2)} MB) - Job: ${img.jobId}`);
    } else {
      finalOutputs++;
      console.log(`✅ FINAL: ${img.filename} (${(size/1024/1024).toFixed(2)} MB) - Job: ${img.jobId}`);
    }
  });
  
  console.log(`\n📈 Summary:`);
  console.log(`   Final outputs: ${finalOutputs}`);
  console.log(`   Temp files: ${tempFiles}`);
  console.log(`   Wasted storage: ${(totalWastedStorage/1024/1024).toFixed(2)} MB`);
  
  if (tempFiles > 0) {
    const reductionPercent = ((tempFiles/(finalOutputs+tempFiles))*100).toFixed(1);
    console.log(`   Storage reduction potential: ${reductionPercent}% reduction by filtering temp files`);
    console.log(`   🎯 Deploy updated handler to eliminate ${tempFiles} duplicate temp files`);
  } else {
    console.log(`   ✅ Already optimized - no temp files found`);
  }
  
  // Group by job to see duplicates
  const jobGroups = {};
  faceSwapImages.forEach(img => {
    if (!jobGroups[img.jobId]) jobGroups[img.jobId] = [];
    jobGroups[img.jobId].push(img);
  });
  
  console.log(`\n🔍 Job Analysis:`);
  Object.entries(jobGroups).forEach(([jobId, files]) => {
    if (files.length > 1) {
      console.log(`   Job ${jobId}: ${files.length} files (${files.map(f => f.filename.includes('temp') ? 'TEMP' : 'FINAL').join(', ')})`);
    }
  });
  
  await prisma.$disconnect();
}

checkFaceSwapFiles().catch(console.error);