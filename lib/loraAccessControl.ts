/**
 * Utility functions for LoRA access control
 */

import { prisma } from '@/lib/database';

/**
 * Extract just the filename from a full path
 * e.g., "user_123/my_lora.safetensors" -> "my_lora.safetensors"
 */
function extractFileName(filePath: string): string {
  // If path contains a slash, get the last part (filename)
  if (filePath.includes('/')) {
    return filePath.split('/').pop() || filePath;
  }
  return filePath;
}

/**
 * Check if a user has access to use a specific LoRA
 * @param loraFileName - The file name or path of the LoRA
 * @param userId - The clerkId of the user
 * @returns true if user owns the LoRA or has USE permission via sharing
 */
export async function userHasLoRAAccess(
  loraFileName: string,
  userId: string
): Promise<boolean> {
  try {
    // Extract just the filename from the path (in case it includes user folder)
    const fileName = extractFileName(loraFileName);
    
    console.log('🔍 Checking LoRA access:', { original: loraFileName, extracted: fileName, userId });

    // First check if user owns the LoRA
    const ownedLora = await prisma.influencerLoRA.findFirst({
      where: {
        fileName: fileName,
        clerkId: userId,
        isActive: true,
      },
    });

    if (ownedLora) {
      console.log('✅ User owns this LoRA');
      return true;
    }

    // Check if LoRA is shared with user
    const sharedLora = await prisma.influencerLoRA.findFirst({
      where: {
        fileName: fileName,
        isActive: true,
        shares: {
          some: {
            sharedWithClerkId: userId,
          },
        },
      },
    });

    if (sharedLora) {
      console.log('✅ LoRA is shared with user');
      return true;
    }

    console.log('❌ User does not have access to this LoRA');
    return false;
  } catch (error) {
    console.error('Error checking LoRA access:', error);
    return false;
  }
}

/**
 * Get all LoRAs accessible by a user (owned + shared)
 * @param userId - The clerkId of the user
 * @returns Array of accessible LoRA file names
 */
export async function getUserAccessibleLoRAs(userId: string): Promise<string[]> {
  try {
    // Get owned LoRAs
    const ownedLoRAs = await prisma.influencerLoRA.findMany({
      where: {
        clerkId: userId,
        isActive: true,
      },
      select: {
        fileName: true,
      },
    });

    // Get shared LoRAs
    const sharedLoRAs = await prisma.influencerLoRA.findMany({
      where: {
        isActive: true,
        shares: {
          some: {
            sharedWithClerkId: userId,
          },
        },
      },
      select: {
        fileName: true,
      },
    });

    // Combine and deduplicate
    const allFileNames = [
      ...ownedLoRAs.map(l => l.fileName),
      ...sharedLoRAs.map(l => l.fileName),
    ];

    return Array.from(new Set(allFileNames));
  } catch (error) {
    console.error('Error getting accessible LoRAs:', error);
    return [];
  }
}

/**
 * Verify LoRA access and throw error if not accessible
 * @param loraFileName - The file name or path of the LoRA
 * @param userId - The clerkId of the user
 * @throws Error if user doesn't have access
 */
export async function verifyLoRAAccess(
  loraFileName: string,
  userId: string
): Promise<void> {
  const hasAccess = await userHasLoRAAccess(loraFileName, userId);
  
  if (!hasAccess) {
    const fileName = extractFileName(loraFileName);
    throw new Error(
      `You don't have permission to use this LoRA model: ${fileName}. ` +
      'Make sure you own it or it has been shared with you.'
    );
  }
}
