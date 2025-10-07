/**
 * Cleanup script for expired multipart upload sessions
 * Run this periodically to remove old session data from the database
 */

const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function cleanupExpiredSessions() {
  console.log('🧹 Starting cleanup of expired upload sessions...');
  
  try {
    const result = await prisma.multipartUploadSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    console.log(`✅ Cleaned up ${result.count} expired session(s)`);
    
    // Get count of remaining active sessions
    const activeCount = await prisma.multipartUploadSession.count({
      where: {
        expiresAt: {
          gte: new Date()
        }
      }
    });
    
    console.log(`📊 Active sessions remaining: ${activeCount}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupExpiredSessions();
