import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Check if the current user is an admin
 */
export async function isUserAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    if (!user) return false;

    // Check if user email is admin email (fallback for existing admins)
    const adminEmails = ['admin@tastycreative.com', 'rapdeleon0404@gmail.com'];
    const isAdminEmail = adminEmails.includes(user.emailAddresses[0]?.emailAddress || '');
    
    // Check if user has admin role in Clerk metadata (fallback)
    const hasAdminRole = user.publicMetadata?.role === 'admin';
    
    // Check database role (primary method)
    try {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { role: true }
      });
      
      if (dbUser?.role === 'ADMIN') {
        return true;
      }
    } catch (dbError) {
      console.warn('Could not check database role, falling back to email/metadata check:', dbError);
    }
    
    // Fallback to email or metadata check for backwards compatibility
    return isAdminEmail || hasAdminRole;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if the current user is a manager or admin
 */
export async function isUserManagerOrAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    if (!user) return false;

    // Check admin first
    if (await isUserAdmin()) return true;

    // Check database role for manager
    try {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { role: true }
      });
      
      return dbUser?.role === 'MANAGER';
    } catch (dbError) {
      console.warn('Could not check database role for manager:', dbError);
      return false;
    }
  } catch (error) {
    console.error('Error checking manager status:', error);
    return false;
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