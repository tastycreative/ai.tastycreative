/**
 * Migration script to populate originalFolder for existing Instagram posts
 * This sets originalFolder based on the current folder or a default value
 */

const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function migrateOriginalFolder() {
  console.log('🔄 Starting originalFolder migration...\n');

  try {
    // Get all posts that don't have an originalFolder set
    const postsToUpdate = await prisma.instagramPost.findMany({
      where: {
        originalFolder: null,
      },
      select: {
        id: true,
        fileName: true,
        folder: true,
        awsS3Key: true,
      },
    });

    console.log(`Found ${postsToUpdate.length} posts to update\n`);

    if (postsToUpdate.length === 0) {
      console.log('✅ No posts need updating. All posts already have originalFolder set.');
      return;
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const post of postsToUpdate) {
      try {
        // All existing files came from "IG Posts" folder
        const originalFolder = 'IG Posts';

        // Update the post
        await prisma.instagramPost.update({
          where: { id: post.id },
          data: { originalFolder },
        });

        updatedCount++;
        console.log(`✅ Updated "${post.fileName}" → originalFolder: "${originalFolder}"`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to update post ${post.id}:`, error.message);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully updated: ${updatedCount} posts`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed to update: ${errorCount} posts`);
    }
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateOriginalFolder()
  .then(() => {
    console.log('\n✅ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
