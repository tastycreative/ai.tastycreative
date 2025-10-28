require('dotenv').config();

const { PrismaClient } = require('../lib/generated/prisma');
const { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

// Map status to folder name
function getS3FolderFromStatus(status) {
  const folderMap = {
    DRAFT: 'instagram/draft',
    REVIEW: 'instagram/review',
    APPROVED: 'instagram/approved',
    REJECTED: 'instagram/rejected',
    SCHEDULED: 'instagram/scheduled',
    PUBLISHED: 'instagram/published',
  };
  return folderMap[status] || 'instagram/posts';
}

// Extract the filename from a full S3 key
function getFilenameFromKey(key) {
  return key.split('/').pop();
}

// Check if file exists in S3
async function fileExists(key) {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error) {
    return false;
  }
}

// Move file in S3
async function moveS3File(oldKey, newKey) {
  try {
    // Copy to new location
    await s3Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${oldKey}`,
      Key: newKey,
    }));

    // Delete old location
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: oldKey,
    }));

    return true;
  } catch (error) {
    console.error(`❌ Error moving ${oldKey} to ${newKey}:`, error.message);
    return false;
  }
}

async function migrateS3Files() {
  console.log('🔄 Starting S3 file migration to status folders...\n');
  console.log('📍 Bucket:', BUCKET_NAME);
  console.log('📍 Endpoint:', process.env.AWS_ENDPOINT_URL_S3 || 'default AWS');
  console.log('');

  try {
    // Fetch all posts with S3 URLs
    const posts = await prisma.instagramPost.findMany({
      where: {
        awsS3Key: { not: null },
      },
      select: {
        id: true,
        awsS3Url: true,
        awsS3Key: true,
        status: true,
        clerkId: true,
        folder: true,
      },
    });

    console.log(`Found ${posts.length} posts to process\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      // Skip if no S3 Key
      if (!post.awsS3Key) {
        console.log(`⏭️  Skipped post ${post.id} - no S3 key`);
        skippedCount++;
        continue;
      }

      const currentKey = post.awsS3Key;
      const filename = getFilenameFromKey(currentKey);
      const targetFolder = getS3FolderFromStatus(post.status);
      const targetKey = `${targetFolder}/${post.clerkId}/${filename}`;

      // Skip if already in correct location
      if (currentKey === targetKey) {
        console.log(`⏭️  Skipped "${filename}" - already in correct folder (${post.status})`);
        skippedCount++;
        continue;
      }

      // Check if file is in the old structure (instagram/posts/)
      if (!currentKey.startsWith('instagram/posts/')) {
        console.log(`⏭️  Skipped "${filename}" - not in instagram/posts/ folder (at: ${currentKey})`);
        skippedCount++;
        continue;
      }

      // Move the file without checking if it exists first (trust the database)
      console.log(`📦 Moving "${filename}" from posts → ${targetFolder.split('/')[1]}/`);
      const moved = await moveS3File(currentKey, targetKey);
      
      if (moved) {
        // Update the database with new URL, key, and folder
        const newUrl = post.awsS3Url.replace(currentKey, targetKey);
        const newFolder = targetFolder.split('/')[1].charAt(0).toUpperCase() + targetFolder.split('/')[1].slice(1); // Capitalize folder name
        
        await prisma.instagramPost.update({
          where: { id: post.id },
          data: { 
            awsS3Url: newUrl,
            awsS3Key: targetKey,
            folder: newFolder,
          },
        });

        console.log(`✅ Moved "${filename}" → ${targetFolder}/ (${post.status})`);
        successCount++;
      } else {
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully moved: ${successCount} files`);
    console.log(`   ⏭️  Skipped: ${skippedCount} files`);
    console.log(`   ❌ Errors: ${errorCount} files`);

    console.log('\n✨ Migration complete!');
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some files failed to move. Please check the errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ Script finished successfully');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateS3Files();
