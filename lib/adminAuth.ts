import { currentUser } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Check if the current user is a super admin (system-wide administrator)
 */
export async function isUserSuperAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    if (!user) return false;

    // Check database role
    try {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { role: true }
      });

      return dbUser?.role === 'SUPER_ADMIN';
    } catch (dbError) {
      console.error('Could not check database role:', dbError);
      return false;
    }
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}

/**
 * Check if the current user is an admin (SUPER_ADMIN or ADMIN)
 */
export async function isUserAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    if (!user) return false;

    // Check if super admin first
    if (await isUserSuperAdmin()) {
      return true;
    }

    // Check database role
    try {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { role: true, isAdmin: true }
      });

      // Check role enum or isAdmin boolean field for backwards compatibility
      return dbUser?.role === 'ADMIN' || dbUser?.isAdmin === true;
    } catch (dbError) {
      console.error('Could not check database role:', dbError);
      return false;
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if the current user is a manager or admin
 */
// Note: MANAGER is now a TeamRole (organization-specific), not a global UserRole.
// For organization-specific permissions, check TeamMember.role in the relevant organization context.
export async function isUserManagerOrAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    if (!user) return false;

    // Check admin role (ADMIN or SUPER_ADMIN)
    return await isUserAdmin();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Require super admin access - throws error if user is not a super admin
 */
export async function requireSuperAdminAccess(): Promise<void> {
  try {
    const user = await currentUser();

    if (!user) {
      console.log('requireSuperAdminAccess: No authenticated user found');
      throw new Error('Unauthorized - Authentication required');
    }

    console.log('requireSuperAdminAccess: Checking super admin status for user:', user.id);
    const isSuperAdmin = await isUserSuperAdmin();

    if (!isSuperAdmin) {
      console.log('requireSuperAdminAccess: User is not super admin:', user.id);
      throw new Error('Forbidden - Super admin access required');
    }

    console.log('requireSuperAdminAccess: Super admin access granted for user:', user.id);
  } catch (error) {
    console.error('requireSuperAdminAccess error:', error);
    throw error;
  }
}

/**
 * Require admin access - throws error if user is not admin
 */
export async function requireAdminAccess(): Promise<void> {
  try {
    const user = await currentUser();

    if (!user) {
      console.log('requireAdminAccess: No authenticated user found');
      throw new Error('Unauthorized - Authentication required');
    }

    console.log('requireAdminAccess: Checking admin status for user:', user.id);
    const isAdmin = await isUserAdmin();

    if (!isAdmin) {
      console.log('requireAdminAccess: User is not admin:', user.id);
      throw new Error('Forbidden - Admin access required');
    }

    console.log('requireAdminAccess: Admin access granted for user:', user.id);
  } catch (error) {
    console.error('requireAdminAccess error:', error);
    throw error;
  }
}

/**
 * Require admin access, also allowing org OWNER/ADMIN/MANAGER.
 * Checks system admin first, then falls back to checking if the user
 * holds OWNER, ADMIN, or MANAGER role in any of their organizations.
 */
export async function requireOrgAdminAccess(): Promise<void> {
  try {
    const user = await currentUser();
    if (!user) {
      throw new Error('Unauthorized - Authentication required');
    }

    // System admin passes immediately
    if (await isUserAdmin()) {
      return;
    }

    // Check if user has OWNER/ADMIN/MANAGER role in any organization
    const { userId } = await auth();
    if (!userId) {
      throw new Error('Unauthorized - Authentication required');
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
      },
    });

    if (!membership) {
      throw new Error('Forbidden - Admin access required');
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Forbidden - Admin access required');
  }
}

/**
 * Check if the current user is an admin for a specific tenant.
 * Returns true if the user is a system admin (ADMIN/SUPER_ADMIN)
 * OR an organization OWNER/ADMIN for the tenant's organization.
 */
export async function isAdminForTenant(tenantSlug: string): Promise<boolean> {
  try {
    // Check system-level admin first
    if (await isUserAdmin()) {
      return true;
    }

    // Check organization-level OWNER/ADMIN
    const { userId } = await auth();
    if (!userId) return false;

    const organization = await prisma.organization.findUnique({
      where: { slug: tenantSlug },
    });

    if (!organization) return false;

    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    return !!membership;
  } catch (error) {
    console.error('Error checking admin for tenant:', error);
    return false;
  }
}