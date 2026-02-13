/**
 * Organization-based storage tracking utilities
 * Monitors and calculates storage usage across AWS S3, database, and other storage backends
 */

import { prisma } from "./database";



export interface StorageBreakdown {
  organizationId: string;
  totalGB: number;
  totalBytes: number;
  byType: {
    images: { count: number; bytes: number; gb: number };
    videos: { count: number; bytes: number; gb: number };
    vault: { count: number; bytes: number; gb: number };
  };
  byStorage: {
    awsS3: { count: number; bytes: number; gb: number };
    database: { count: number; bytes: number; gb: number };
    other: { count: number; bytes: number; gb: number };
  };
  byUser: Array<{
    userId: string;
    userName: string | null;
    bytes: number;
    gb: number;
    imageCount: number;
    videoCount: number;
    vaultCount: number;
  }>;
}

/**
 * Calculate total storage usage for an organization
 */
export async function calculateOrganizationStorage(
  organizationId: string
): Promise<StorageBreakdown> {
  console.log(`📊 Calculating storage for organization: ${organizationId}`);

  // Get the organization's slug for filtering vault items
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  const organizationSlug = organization?.slug;

  // Get all team members of the organization
  const teamMembers = await prisma.teamMember.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          clerkId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const userIds = teamMembers.map((m) => m.user.clerkId);

  // Get all images for organization members
  const images = await prisma.generatedImage.findMany({
    where: {
      clerkId: { in: userIds },
    },
    select: {
      id: true,
      clerkId: true,
      fileSize: true,
      awsS3Key: true,
      awsS3Url: true,
      s3Key: true,
      data: true,
    },
  });

  // Get all videos for organization members
  const videos = await prisma.generatedVideo.findMany({
    where: {
      clerkId: { in: userIds },
    },
    select: {
      id: true,
      clerkId: true,
      fileSize: true,
      awsS3Key: true,
      awsS3Url: true,
      s3Key: true,
      data: true,
    },
  });

  // Get all vault items for organization members, filtered by organization slug
  // Vault items belong to folders, and folders have organizationSlug
  const vaultItemsWhereClause: any = {
    clerkId: { in: userIds },
  };
  
  // If organization has a slug, filter vault items by their folder's organizationSlug
  if (organizationSlug) {
    vaultItemsWhereClause.folder = {
      organizationSlug: organizationSlug,
    };
  }
  
  const vaultItems = await prisma.vaultItem.findMany({
    where: vaultItemsWhereClause,
    select: {
      id: true,
      clerkId: true,
      fileSize: true,
      awsS3Key: true,
      awsS3Url: true,
      fileType: true,
    },
  });

  // Calculate totals
  let totalBytes = 0;
  let imageBytes = 0;
  let videoBytes = 0;
  let vaultBytes = 0;
  let awsS3Bytes = 0;
  let databaseBytes = 0;
  let otherBytes = 0;

  const userStorageMap = new Map<string, {
    bytes: number;
    imageCount: number;
    videoCount: number;
    vaultCount: number;
  }>();

  // Process images
  for (const image of images) {
    const size = image.fileSize || 0;
    totalBytes += size;
    imageBytes += size;

    // Track by storage type
    if (image.awsS3Key || image.awsS3Url) {
      awsS3Bytes += size;
    } else if (image.data) {
      databaseBytes += size;
    } else if (image.s3Key) {
      otherBytes += size; // Legacy RunPod S3
    }

    // Track by user
    if (!userStorageMap.has(image.clerkId)) {
      userStorageMap.set(image.clerkId, { bytes: 0, imageCount: 0, videoCount: 0, vaultCount: 0 });
    }
    const userStats = userStorageMap.get(image.clerkId)!;
    userStats.bytes += size;
    userStats.imageCount += 1;
  }

  // Process videos
  for (const video of videos) {
    const size = video.fileSize || 0;
    totalBytes += size;
    videoBytes += size;

    // Track by storage type
    if (video.awsS3Key || video.awsS3Url) {
      awsS3Bytes += size;
    } else if (video.data) {
      databaseBytes += size;
    } else if (video.s3Key) {
      otherBytes += size; // Legacy RunPod S3
    }

    // Track by user
    if (!userStorageMap.has(video.clerkId)) {
      userStorageMap.set(video.clerkId, { bytes: 0, imageCount: 0, videoCount: 0, vaultCount: 0 });
    }
    const userStats = userStorageMap.get(video.clerkId)!;
    userStats.bytes += size;
    userStats.videoCount += 1;
  }

  // Process vault items
  for (const vaultItem of vaultItems) {
    const size = vaultItem.fileSize || 0;
    totalBytes += size;
    vaultBytes += size;

    // Vault items are always on AWS S3
    awsS3Bytes += size;

    // Track by user
    if (!userStorageMap.has(vaultItem.clerkId)) {
      userStorageMap.set(vaultItem.clerkId, { bytes: 0, imageCount: 0, videoCount: 0, vaultCount: 0 });
    }
    const userStats = userStorageMap.get(vaultItem.clerkId)!;
    userStats.bytes += size;
    userStats.vaultCount += 1;
  }

  // Build user breakdown
  const byUser = Array.from(userStorageMap.entries()).map(([userId, stats]) => {
    const member = teamMembers.find((m) => m.user.clerkId === userId);
    const userName = member
      ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || null
      : null;

    return {
      userId,
      userName,
      bytes: stats.bytes,
      gb: bytesToGB(stats.bytes),
      imageCount: stats.imageCount,
      videoCount: stats.videoCount,
      vaultCount: stats.vaultCount,
    };
  });

  const breakdown: StorageBreakdown = {
    organizationId,
    totalBytes,
    totalGB: bytesToGB(totalBytes),
    byType: {
      images: {
        count: images.length,
        bytes: imageBytes,
        gb: bytesToGB(imageBytes),
      },
      videos: {
        count: videos.length,
        bytes: videoBytes,
        gb: bytesToGB(videoBytes),
      },
      vault: {
        count: vaultItems.length,
        bytes: vaultBytes,
        gb: bytesToGB(vaultBytes),
      },
    },
    byStorage: {
      awsS3: {
        count: images.filter((i) => i.awsS3Key || i.awsS3Url).length +
               videos.filter((v) => v.awsS3Key || v.awsS3Url).length +
               vaultItems.length, // All vault items are on AWS S3
        bytes: awsS3Bytes,
        gb: bytesToGB(awsS3Bytes),
      },
      database: {
        count: images.filter((i) => i.data).length +
               videos.filter((v) => v.data).length,
        bytes: databaseBytes,
        gb: bytesToGB(databaseBytes),
      },
      other: {
        count: images.filter((i) => i.s3Key && !i.awsS3Key).length +
               videos.filter((v) => v.s3Key && !v.awsS3Key).length,
        bytes: otherBytes,
        gb: bytesToGB(otherBytes),
      },
    },
    byUser,
  };

  console.log(`✅ Storage calculation complete:`, {
    totalGB: breakdown.totalGB,
    images: breakdown.byType.images.count,
    videos: breakdown.byType.videos.count,
    vault: breakdown.byType.vault.count,
  });

  return breakdown;
}

/**
 * Update organization's currentStorageGB field
 */
export async function updateOrganizationStorageUsage(
  organizationId: string
): Promise<number> {
  console.log(`🔄 Updating storage usage for organization: ${organizationId}`);

  const breakdown = await calculateOrganizationStorage(organizationId);

  await prisma.organization.update({
    where: { id: organizationId },
    data: { currentStorageGB: breakdown.totalGB },
  });

  console.log(`✅ Updated organization storage to ${breakdown.totalGB} GB`);

  return breakdown.totalGB;
}

/**
 * Calculate storage for all organizations (admin utility)
 */
export async function recalculateAllOrganizationStorage(): Promise<void> {
  console.log(`🔄 Recalculating storage for all organizations...`);

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  for (const org of organizations) {
    try {
      const storageGB = await updateOrganizationStorageUsage(org.id);
      console.log(`  ✅ ${org.name}: ${storageGB} GB`);
    } catch (error) {
      console.error(`  ❌ Failed to calculate storage for ${org.name}:`, error);
    }
  }

  console.log(`✅ Storage recalculation complete for ${organizations.length} organizations`);
}

/**
 * Helper: Convert bytes to GB
 */
function bytesToGB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}

/**
 * Helper: Convert GB to bytes
 */
export function gbToBytes(gb: number): number {
  return Math.round(gb * 1024 * 1024 * 1024);
}

/**
 * Check if organization is within storage limits
 */
export async function checkStorageLimit(
  organizationId: string
): Promise<{
  isWithinLimit: boolean;
  currentGB: number;
  maxGB: number;
  percentageUsed: number;
  bytesRemaining: number;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscriptionPlan: true },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  const maxGB = org.customMaxStorageGB ?? org.subscriptionPlan?.maxStorageGB ?? 5;
  const currentGB = org.currentStorageGB;
  const percentageUsed = (currentGB / maxGB) * 100;
  const bytesRemaining = gbToBytes(maxGB - currentGB);

  return {
    isWithinLimit: currentGB < maxGB,
    currentGB,
    maxGB,
    percentageUsed,
    bytesRemaining,
  };
}

/**
 * Get storage breakdown by organization (for admin dashboard)
 */
export async function getStorageBreakdownByOrganization(): Promise<
  Array<{
    organizationId: string;
    organizationName: string;
    currentGB: number;
    maxGB: number;
    percentageUsed: number;
    memberCount: number;
  }>
> {
  const organizations = await prisma.organization.findMany({
    include: {
      subscriptionPlan: true,
    },
  });

  const results = await Promise.all(
    organizations.map(async (org) => {
      const memberCount = await prisma.teamMember.count({
        where: { organizationId: org.id },
      });

      const maxGB = org.customMaxStorageGB ?? org.subscriptionPlan?.maxStorageGB ?? 5;
      return {
        organizationId: org.id,
        organizationName: org.name,
        currentGB: org.currentStorageGB,
        maxGB,
        percentageUsed: (org.currentStorageGB / maxGB) * 100,
        memberCount,
      };
    })
  );

  return results;
}
