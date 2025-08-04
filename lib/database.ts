// lib/database.ts - Updated with Clerk integration
import { PrismaClient, SyncStatus } from './generated/prisma';
import { auth } from '@clerk/nextjs/server';

// Global Prisma instance (singleton pattern for Next.js)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Types
export interface InfluencerLoRA {
  id: string;
  clerkId: string;
  name: string;
  displayName: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
  thumbnailUrl?: string;
  isActive: boolean;
  usageCount: number;
  comfyUIPath?: string;
  syncStatus?: 'pending' | 'synced' | 'missing' | 'error';
  lastUsedAt?: string;
}

// Helper functions with Prisma + Clerk
export async function getUserInfluencers(clerkId: string): Promise<InfluencerLoRA[]> {
  console.log('📚 Getting influencers for Clerk user:', clerkId);
  
  try {
    // Ensure user exists
    await ensureUserExists(clerkId);
    
    const influencers = await prisma.influencerLoRA.findMany({
      where: { clerkId },
      orderBy: { uploadedAt: 'desc' }
    });
    
    console.log('📊 Found', influencers.length, 'influencers for user:', clerkId);
    
    // Convert Prisma types to our interface
    return influencers.map(inf => ({
      id: inf.id,
      clerkId: inf.clerkId,
      name: inf.name,
      displayName: inf.displayName,
      fileName: inf.fileName,
      originalFileName: inf.originalFileName,
      fileSize: inf.fileSize,
      uploadedAt: inf.uploadedAt.toISOString(),
      description: inf.description || undefined,
      thumbnailUrl: inf.thumbnailUrl || undefined,
      isActive: inf.isActive,
      usageCount: inf.usageCount,
      comfyUIPath: inf.comfyUIPath || undefined,
      syncStatus: inf.syncStatus.toLowerCase() as any,
      lastUsedAt: inf.lastUsedAt?.toISOString()
    }));
  } catch (error) {
    console.error('💥 Error getting user influencers:', error);
    return [];
  }
}

export async function addUserInfluencer(clerkId: string, influencer: Omit<InfluencerLoRA, 'id' | 'clerkId'>): Promise<InfluencerLoRA | null> {
  console.log('➕ Adding influencer for Clerk user:', clerkId);
  console.log('📋 Influencer details:', {
    fileName: influencer.fileName,
    displayName: influencer.displayName,
    syncStatus: influencer.syncStatus
  });
  
  try {
    // Ensure user exists
    await ensureUserExists(clerkId);
    
    const created = await prisma.influencerLoRA.create({
      data: {
        clerkId,
        name: influencer.name,
        displayName: influencer.displayName,
        fileName: influencer.fileName,
        originalFileName: influencer.originalFileName,
        fileSize: influencer.fileSize,
        description: influencer.description,
        thumbnailUrl: influencer.thumbnailUrl,
        isActive: influencer.isActive,
        usageCount: influencer.usageCount,
        comfyUIPath: influencer.comfyUIPath,
        syncStatus: (influencer.syncStatus?.toUpperCase() as SyncStatus) || 'PENDING',
        lastUsedAt: influencer.lastUsedAt ? new Date(influencer.lastUsedAt) : null
      }
    });
    
    console.log('✅ Influencer added successfully:', created.id);
    
    return {
      id: created.id,
      clerkId: created.clerkId,
      name: created.name,
      displayName: created.displayName,
      fileName: created.fileName,
      originalFileName: created.originalFileName,
      fileSize: created.fileSize,
      uploadedAt: created.uploadedAt.toISOString(),
      description: created.description || undefined,
      thumbnailUrl: created.thumbnailUrl || undefined,
      isActive: created.isActive,
      usageCount: created.usageCount,
      comfyUIPath: created.comfyUIPath || undefined,
      syncStatus: created.syncStatus.toLowerCase() as any,
      lastUsedAt: created.lastUsedAt?.toISOString()
    };
  } catch (error) {
    console.error('💥 Error adding influencer:', error);
    return null;
  }
}

export async function updateUserInfluencer(
  clerkId: string, 
  influencerId: string, 
  updates: Partial<InfluencerLoRA>
): Promise<InfluencerLoRA | null> {
  console.log('🔄 Updating influencer:', influencerId, 'for Clerk user:', clerkId);
  console.log('📝 Updates:', updates);
  
  try {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.usageCount !== undefined) updateData.usageCount = updates.usageCount;
    if (updates.comfyUIPath !== undefined) updateData.comfyUIPath = updates.comfyUIPath;
    if (updates.syncStatus !== undefined) {
      updateData.syncStatus = updates.syncStatus.toUpperCase() as SyncStatus;
    }
    if (updates.lastUsedAt !== undefined) {
      updateData.lastUsedAt = new Date(updates.lastUsedAt);
    }
    
    const updated = await prisma.influencerLoRA.update({
      where: { 
        id: influencerId,
        clerkId // Ensure user can only update their own influencers
      },
      data: updateData
    });
    
    console.log('✅ Influencer updated successfully');
    
    return {
      id: updated.id,
      clerkId: updated.clerkId,
      name: updated.name,
      displayName: updated.displayName,
      fileName: updated.fileName,
      originalFileName: updated.originalFileName,
      fileSize: updated.fileSize,
      uploadedAt: updated.uploadedAt.toISOString(),
      description: updated.description || undefined,
      thumbnailUrl: updated.thumbnailUrl || undefined,
      isActive: updated.isActive,
      usageCount: updated.usageCount,
      comfyUIPath: updated.comfyUIPath || undefined,
      syncStatus: updated.syncStatus.toLowerCase() as any,
      lastUsedAt: updated.lastUsedAt?.toISOString()
    };
  } catch (error) {
    console.error('💥 Error updating influencer:', error);
    return null;
  }
}

export async function deleteUserInfluencer(clerkId: string, influencerId: string): Promise<InfluencerLoRA | null> {
  console.log('🗑️ Deleting influencer:', influencerId, 'for Clerk user:', clerkId);
  
  try {
    const deleted = await prisma.influencerLoRA.delete({
      where: { 
        id: influencerId,
        clerkId // Ensure user can only delete their own influencers
      }
    });
    
    console.log('✅ Influencer deleted successfully:', deleted.fileName);
    
    return {
      id: deleted.id,
      clerkId: deleted.clerkId,
      name: deleted.name,
      displayName: deleted.displayName,
      fileName: deleted.fileName,
      originalFileName: deleted.originalFileName,
      fileSize: deleted.fileSize,
      uploadedAt: deleted.uploadedAt.toISOString(),
      description: deleted.description || undefined,
      thumbnailUrl: deleted.thumbnailUrl || undefined,
      isActive: deleted.isActive,
      usageCount: deleted.usageCount,
      comfyUIPath: deleted.comfyUIPath || undefined,
      syncStatus: deleted.syncStatus.toLowerCase() as any,
      lastUsedAt: deleted.lastUsedAt?.toISOString()
    };
  } catch (error) {
    console.error('💥 Error deleting influencer:', error);
    return null;
  }
}

export async function findUserInfluencer(clerkId: string, influencerId: string): Promise<InfluencerLoRA | null> {
  console.log('🔍 Finding influencer:', influencerId, 'for Clerk user:', clerkId);
  
  try {
    const influencer = await prisma.influencerLoRA.findFirst({
      where: { 
        id: influencerId,
        clerkId
      }
    });
    
    if (!influencer) {
      console.log('❌ Influencer not found');
      return null;
    }
    
    console.log('✅ Influencer found:', influencer.fileName);
    
    return {
      id: influencer.id,
      clerkId: influencer.clerkId,
      name: influencer.name,
      displayName: influencer.displayName,
      fileName: influencer.fileName,
      originalFileName: influencer.originalFileName,
      fileSize: influencer.fileSize,
      uploadedAt: influencer.uploadedAt.toISOString(),
      description: influencer.description || undefined,
      thumbnailUrl: influencer.thumbnailUrl || undefined,
      isActive: influencer.isActive,
      usageCount: influencer.usageCount,
      comfyUIPath: influencer.comfyUIPath || undefined,
      syncStatus: influencer.syncStatus.toLowerCase() as any,
      lastUsedAt: influencer.lastUsedAt?.toISOString()
    };
  } catch (error) {
    console.error('💥 Error finding influencer:', error);
    return null;
  }
}

export async function incrementInfluencerUsage(clerkId: string, fileName: string): Promise<void> {
  console.log('📈 Incrementing usage for:', fileName, 'Clerk user:', clerkId);
  
  try {
    const updated = await prisma.influencerLoRA.updateMany({
      where: { 
        clerkId, 
        fileName 
      },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });
    
    console.log('✅ Usage incremented for', updated.count, 'influencers');
  } catch (error) {
    console.error('💥 Error incrementing usage:', error);
  }
}

// Helper to ensure user exists in database
async function ensureUserExists(clerkId: string): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: { 
        clerkId,
        // You can add more user data from Clerk here if needed
      }
    });
  } catch (error) {
    console.error('💥 Error ensuring user exists:', error);
  }
}

// Get current user's Clerk ID from server-side
export async function getCurrentClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      console.log('❌ No authenticated user found');
      return null;
    }
    
    console.log('👤 Current Clerk user ID:', userId);
    return userId;
  } catch (error) {
    console.error('💥 Error getting current Clerk user:', error);
    return null;
  }
}

// Auth helper for server-side use (updated for Clerk)
export async function getUserId(request: Request): Promise<string | null> {
  try {
    // For API routes, we need to get the Clerk user ID differently
    // This will work in API routes with Clerk middleware
    const { userId } = await auth();
    
    if (userId) {
      console.log('👤 Clerk user ID from auth:', userId);
      return userId;
    }
    
    // Fallback: try to get from headers (if you're passing it manually)
    const headerUserId = request.headers.get('x-clerk-user-id');
    if (headerUserId) {
      console.log('👤 Clerk user ID from header:', headerUserId);
      return headerUserId;
    }
    
    console.log('❌ No authenticated user found in request');
    return null;
    
  } catch (error) {
    console.error('💥 Error getting Clerk user ID from request:', error);
    return null;
  }
}

// Debug functions
export async function debugDatabase(): Promise<any> {
  try {
    const userCount = await prisma.user.count();
    const influencerCount = await prisma.influencerLoRA.count();
    const jobCount = await prisma.generationJob.count();
    
    const recentInfluencers = await prisma.influencerLoRA.findMany({
      take: 5,
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        clerkId: true,
        fileName: true,
        syncStatus: true,
        isActive: true
      }
    });
    
    const debug = {
      totalUsers: userCount,
      totalInfluencers: influencerCount,
      totalJobs: jobCount,
      recentInfluencers,
      timestamp: new Date().toISOString()
    };
    
    console.log('🔍 Database debug info:', debug);
    return debug;
  } catch (error) {
    console.error('💥 Database debug error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}