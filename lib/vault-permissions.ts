import { prisma } from '@/lib/database';

/**
 * Check if a user has access to a profile
 * A user has access if:
 * 1. It's their own profile (clerkId matches)
 * 2. The profile belongs to an organization they're a member of
 * 3. They have been assigned to the profile as a creator (via ProfileAssignment)
 */
export async function hasAccessToProfile(
  userId: string,
  profileId: string
): Promise<{ hasAccess: boolean; profile: any | null }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
  }

  // Get the profile details
  const profile = await prisma.instagramProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      clerkId: true,
    },
  });

  if (!profile) {
    return { hasAccess: false, profile: null };
  }

  // Check if user has been assigned to this profile as a creator
  const profileAssignment = await prisma.profileAssignment.findFirst({
    where: {
      profileId: profileId,
      assignedToClerkId: userId,
    },
  });

  if (profileAssignment) {
    return { hasAccess: true, profile };
  }

  // If the profile belongs to an organization, check membership
  if (profile.organizationId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
        teamMemberships: {
          where: {
            organizationId: profile.organizationId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return { hasAccess: false, profile: null };
    }

    // User has access if they're a member of the organization
    if (user.teamMemberships.length > 0) {
      return { hasAccess: true, profile };
    }

    // Fallback: check if currentOrganizationId matches (for backward compatibility)
    if (user.currentOrganizationId === profile.organizationId) {
      return { hasAccess: true, profile };
    }
  }

  return { hasAccess: false, profile: null };
}

/**
 * Check if a user can modify a specific folder
 * A user can modify a folder if:
 * 1. It's not a default folder (default folders are immutable)
 * 2. They own the folder (personal folder)
 * 3. They have organization-level permissions (OWNER, ADMIN, MANAGER)
 * 4. They have been assigned to the profile that owns the folder
 */
export async function canModifyFolder(
  userId: string,
  folderId: string
): Promise<boolean> {
  const folder = await prisma.vaultFolder.findUnique({
    where: { id: folderId },
    select: {
      clerkId: true,
      organizationSlug: true,
      isDefault: true,
      profileId: true,
    },
  });

  if (!folder) return false;

  // Can't modify default folders
  if (folder.isDefault) return false;

  // If it's a personal folder (no organization), check ownership
  if (!folder.organizationSlug) {
    // Check if user owns the folder directly
    if (folder.clerkId === userId) {
      return true;
    }

    // Check if user has access to the profile
    if (folder.profileId) {
      const { hasAccess } = await hasAccessToProfile(userId, folder.profileId);
      return hasAccess;
    }

    return false;
  }

  // If it's an organization folder, check membership and role
  const membership = await prisma.teamMember.findFirst({
    where: {
      user: { clerkId: userId },
      organization: { slug: folder.organizationSlug },
      role: {
        in: ['OWNER', 'ADMIN', 'MANAGER'],
      },
    },
  });

  if (membership) {
    return true;
  }

  // Check if user has been assigned to the profile that owns this folder
  if (folder.profileId) {
    const { hasAccess } = await hasAccessToProfile(userId, folder.profileId);
    return hasAccess;
  }

  return false;
}

/**
 * Simple boolean version of hasAccessToProfile for backwards compatibility
 */
export async function hasAccessToProfileSimple(
  userId: string,
  profileId: string
): Promise<boolean> {
  const { hasAccess } = await hasAccessToProfile(userId, profileId);
  return hasAccess;
}
