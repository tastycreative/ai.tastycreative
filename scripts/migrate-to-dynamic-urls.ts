// scripts/migrate-to-dynamic-urls.ts - Migration from URLs to path components
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// Helper function to parse ComfyUI URLs
function parseComfyUIUrl(url: string): { filename: string; subfolder: string; type: string } | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    return {
      filename: params.get('filename') || '',
      subfolder: params.get('subfolder') || '',
      type: params.get('type') || 'output'
    };
  } catch (error) {
    console.error('Error parsing URL:', url, error);
    return null;
  }
}

async function migrateToPathComponents() {
  console.log('🔄 === MIGRATING TO DYNAMIC URL SYSTEM ===');
  
  try {
    // Step 1: Run the new migration to add the new columns
    console.log('📋 Step 1: Ensure database schema is updated');
    console.log('   Please run: npx prisma migrate dev --name add-path-components');
    console.log('   Then run: npx prisma generate');
    
    // Step 2: Migrate existing GenerationJob.resultUrls to GeneratedImage records
    console.log('\n📊 Step 2: Migrating GenerationJob resultUrls to GeneratedImage records...');
    
    const jobs = await prisma.generationJob.findMany({
      where: {
        resultUrls: { isEmpty: false }
      }
    });
    
    console.log(`📋 Found ${jobs.length} jobs with result URLs`);
    
    let totalMigrated = 0;
    
    for (const job of jobs) {
      console.log(`🔄 Processing job ${job.id} with ${job.resultUrls.length} URLs`);
      
      for (const url of job.resultUrls) {
        const pathInfo = parseComfyUIUrl(url);
        
        if (pathInfo) {
          // Check if this image already exists
          const existing = await prisma.generatedImage.findFirst({
            where: {
              jobId: job.id,
              filename: pathInfo.filename,
              subfolder: pathInfo.subfolder,
              type: pathInfo.type
            }
          });
          
          if (!existing) {
            try {
              await prisma.generatedImage.create({
                data: {
                  clerkId: job.clerkId,
                  jobId: job.id,
                  filename: pathInfo.filename,
                  subfolder: pathInfo.subfolder,
                  type: pathInfo.type,
                  metadata: {
                    migratedFrom: url,
                    migratedAt: new Date().toISOString()
                  }
                }
              });
              
              totalMigrated++;
              console.log(`✅ Migrated: ${pathInfo.filename}`);
            } catch (error) {
              console.error(`❌ Failed to migrate ${pathInfo.filename}:`, error);
            }
          } else {
            console.log(`⏭️ Already exists: ${pathInfo.filename}`);
          }
        } else {
          console.warn(`⚠️ Could not parse URL: ${url}`);
        }
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Total images migrated: ${totalMigrated}`);
    
    // Step 3: Verify migration
    console.log('\n🔍 Step 3: Verifying migration...');
    
    const totalGeneratedImages = await prisma.generatedImage.count();
    const imagesWithPathComponents = await prisma.generatedImage.count({
      where: {
        AND: [
          { filename: { not: '' } },
          { subfolder: { not: '' } },
          { type: { not: '' } }
        ]
      }
    });
    
    console.log(`📊 Total GeneratedImage records: ${totalGeneratedImages}`);
    console.log(`📊 Records with path components: ${imagesWithPathComponents}`);
    
    if (totalGeneratedImages === imagesWithPathComponents) {
      console.log('✅ All images have proper path components!');
    } else {
      console.log('⚠️ Some images may be missing path components');
    }
    
    // Step 4: Show sample of migrated data
    console.log('\n📋 Sample of migrated images:');
    const sampleImages = await prisma.generatedImage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        filename: true,
        subfolder: true,
        type: true,
        metadata: true
      }
    });
    
    sampleImages.forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.filename} (${img.subfolder || 'root'}/${img.type})`);
    });
    
    console.log('\n🎉 === MIGRATION COMPLETE ===');
    console.log('🔄 Your system now uses dynamic URLs!');
    console.log('📍 URLs will always use the current COMFYUI_URL environment variable');
    console.log('🚀 No more URL migration needed when ComfyUI server changes!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

// Dry run function
async function dryRunMigration() {
  console.log('🔍 === DRY RUN - PREVIEW MIGRATION ===');
  
  try {
    const jobs = await prisma.generationJob.findMany({
      where: {
        resultUrls: { isEmpty: false }
      }
    });
    
    console.log(`📋 Found ${jobs.length} jobs with result URLs`);
    
    let urlsToMigrate = 0;
    let existingImages = 0;
    
    for (const job of jobs) {
      for (const url of job.resultUrls) {
        const pathInfo = parseComfyUIUrl(url);
        
        if (pathInfo) {
          const existing = await prisma.generatedImage.findFirst({
            where: {
              jobId: job.id,
              filename: pathInfo.filename,
              subfolder: pathInfo.subfolder,
              type: pathInfo.type
            }
          });
          
          if (!existing) {
            urlsToMigrate++;
          } else {
            existingImages++;
          }
        }
      }
    }
    
    console.log('\n📊 DRY RUN SUMMARY:');
    console.log(`🆕 New images to migrate: ${urlsToMigrate}`);
    console.log(`✅ Images already migrated: ${existingImages}`);
    
    if (urlsToMigrate > 0) {
      console.log('\n🔍 Sample URLs to migrate:');
      
      for (const job of jobs.slice(0, 2)) {
        for (const url of job.resultUrls.slice(0, 2)) {
          const pathInfo = parseComfyUIUrl(url);
          if (pathInfo) {
            console.log(`  📍 ${url}`);
            console.log(`    → filename: ${pathInfo.filename}`);
            console.log(`    → subfolder: ${pathInfo.subfolder || '(empty)'}`);
            console.log(`    → type: ${pathInfo.type}`);
          }
        }
      }
    }
    
    console.log('\n⚠️ Run with --execute to perform actual migration');
    
  } catch (error) {
    console.error('💥 Dry run error:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const shouldExecute = args.includes('--execute');
  
  try {
    if (shouldExecute) {
      console.log('⚠️ EXECUTING MIGRATION - This will modify your database!');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      await migrateToPathComponents();
    } else {
      await dryRunMigration();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});

export { migrateToPathComponents, dryRunMigration };