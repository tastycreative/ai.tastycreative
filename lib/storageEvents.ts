/**
 * Storage event tracking utilities
 * Automatically updates organization storage when files are added/removed
 */

import { prisma } from './database';
import { updateOrganizationStorageUsage } from './storageTracking';

/**
 * Track storage change when a file is uploaded
 * Call this after successfully uploading an image or video
 */
export async function trackStorageUpload(
  userId: string,
  fileSize: number
): Promise<void> {
  try {
    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      console.warn(`⚠️ User ${userId} has no organization, skipping storage tracking`);
      return;
    }

    // Update storage in the background (non-blocking)
    updateOrganizationStorageUsage(user.currentOrganizationId)
      .then((newStorage) => {
        console.log(`✅ Storage updated for org ${user.currentOrganizationId}: ${newStorage} GB`);
      })
      .catch((error) => {
        console.error(`❌ Failed to update storage for org ${user.currentOrganizationId}:`, error);
      });

  } catch (error) {
    console.error('❌ Error in trackStorageUpload:', error);
  }
}

/**
 * Track storage change when a file is deleted
 * Call this after successfully deleting an image or video
 */
export async function trackStorageDelete(
  userId: string,
  fileSize: number
): Promise<void> {
  try {
    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      console.warn(`⚠️ User ${userId} has no organization, skipping storage tracking`);
      return;
    }

    // Update storage in the background (non-blocking)
    updateOrganizationStorageUsage(user.currentOrganizationId)
      .then((newStorage) => {
        console.log(`✅ Storage updated for org ${user.currentOrganizationId}: ${newStorage} GB`);
      })
      .catch((error) => {
        console.error(`❌ Failed to update storage for org ${user.currentOrganizationId}:`, error);
      });

  } catch (error) {
    console.error('❌ Error in trackStorageDelete:', error);
  }
}

/**
 * Batch update storage for an organization (useful for bulk operations)
 */
export async function batchUpdateOrgStorage(organizationId: string): Promise<void> {
  try {
    await updateOrganizationStorageUsage(organizationId);
    console.log(`✅ Batch storage update complete for org ${organizationId}`);
  } catch (error) {
    console.error(`❌ Batch storage update failed for org ${organizationId}:`, error);
    throw error;
  }
}
