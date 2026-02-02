import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { clerkClient } from '@clerk/nextjs/server';

// GET - Fetch all users who have Instagram posts (for Admin/Manager to select)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    // Get current user's role from database
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    // Only allow SUPER_ADMIN and ADMIN to view all users
    if (!currentUser || (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - insufficient permissions' },
        { status: 403 }
      );
    }

    // Get all users who have created Instagram posts
    const usersWithPosts = await prisma.instagramPost.findMany({
      select: {
        clerkId: true,
      },
      distinct: ['clerkId'],
    });

    const uniqueClerkIds = [...new Set(usersWithPosts.map(post => post.clerkId))];

    // Fetch user details from Clerk
    const client = await clerkClient();
    const userDetailsPromises = uniqueClerkIds.map(async (clerkId) => {
      try {
        const clerkUser = await client.users.getUser(clerkId);
        
        // Get role from database
        const dbUser = await prisma.user.findUnique({
          where: { clerkId },
          select: { role: true }
        });

        // Count posts for this user
        const postCount = await prisma.instagramPost.count({
          where: { clerkId }
        });

        return {
          clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress || 'No email',
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
          role: dbUser?.role || 'USER',
          postCount,
        };
      } catch (error: any) {
        // If user not found in Clerk (deleted), use database fallback
        if (error?.status === 404) {
          const dbUser = await prisma.user.findUnique({
            where: { clerkId },
            select: { 
              role: true,
              email: true,
              firstName: true,
              lastName: true,
              imageUrl: true
            }
          });

          const postCount = await prisma.instagramPost.count({
            where: { clerkId }
          });

          if (dbUser) {
            return {
              clerkId,
              email: dbUser.email || 'Unknown User',
              firstName: dbUser.firstName || 'Deleted',
              lastName: dbUser.lastName || 'User',
              imageUrl: dbUser.imageUrl || null,
              role: dbUser.role || 'USER',
              postCount,
            };
          }
        }
        
        console.error(`Error fetching user ${clerkId}:`, error);
        return null;
      }
    });

    const users = (await Promise.all(userDetailsPromises)).filter(Boolean);

    // Sort by role priority and name
    users.sort((a, b) => {
      const rolePriority = { ADMIN: 0, MANAGER: 1, CONTENT_CREATOR: 2, USER: 3 };
      const priorityDiff = (rolePriority[a!.role as keyof typeof rolePriority] || 999) - 
                           (rolePriority[b!.role as keyof typeof rolePriority] || 999);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      const nameA = `${a!.firstName || ''} ${a!.lastName || ''}`.trim();
      const nameB = `${b!.firstName || ''} ${b!.lastName || ''}`.trim();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('❌ Error fetching Instagram post users:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch users',
      },
      { status: 500 }
    );
  }
}
