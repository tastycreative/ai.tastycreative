import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { isUserSuperAdmin } from './adminAuth';

/**
 * Check if the current user is an admin or owner of the specified organization
 * Super admins have access to all organizations
 */
export async function isOrganizationAdmin(organizationSlug: string): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;

    // Check if user is a super admin (they have access to all organizations)
    const isSuperAdmin = await isUserSuperAdmin();
    if (isSuperAdmin) return true;

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!organization) return false;

    // Check if user is an ADMIN or OWNER of this organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    return !!membership;
  } catch (error) {
    console.error('Error checking organization admin status:', error);
    return false;
  }
}

/**
 * Check if the current user is a member of the specified organization
 */
export async function isOrganizationMember(organizationSlug: string): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!organization) return false;

    // Check if user is a member of this organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { clerkId: userId },
      },
    });

    return !!membership;
  } catch (error) {
    console.error('Error checking organization membership:', error);
    return false;
  }
}

/**
 * Get the current user's organization membership info
 */
export async function getOrganizationMembership(organizationSlug: string) {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!organization) return null;

    // Get user's membership
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { clerkId: userId },
      },
      include: {
        organization: true,
        user: true,
      },
    });

    return membership;
  } catch (error) {
    console.error('Error getting organization membership:', error);
    return null;
  }
}

/**
 * Require organization admin access - throws error if user is not admin/owner
 */
export async function requireOrganizationAdmin(organizationSlug: string): Promise<void> {
  const isAdmin = await isOrganizationAdmin(organizationSlug);

  if (!isAdmin) {
    throw new Error('Forbidden - Organization admin access required');
  }
}

/**
 * Require organization member access - throws error if user is not a member
 */
export async function requireOrganizationMember(organizationSlug: string): Promise<void> {
  const isMember = await isOrganizationMember(organizationSlug);

  if (!isMember) {
    throw new Error('Forbidden - Organization access required');
  }
}
