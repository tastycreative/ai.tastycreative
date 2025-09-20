import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    await requireAdminAccess();

    // Fetch all users from database with counts
    const dbUsers = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            images: true,
            videos: true,
            jobs: true,
            influencers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch all users from Clerk to get complete user data
    const clerk = await clerkClient();
    const clerkUsers = await clerk.users.getUserList({
      limit: 500, // Adjust as needed
    });

    // Merge the data: prioritize Clerk data for user info, database for activity data
    const mergedUsers = clerkUsers.data.map((clerkUser: any) => {
      // Find corresponding database user
      const dbUser = dbUsers.find(db => db.clerkId === clerkUser.id);
      
      return {
        id: dbUser?.id || clerkUser.id,
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || null,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        role: dbUser?.role || 'USER', // Default to USER if not in database
        createdAt: dbUser?.createdAt?.toISOString() || clerkUser.createdAt.toString(),
        lastSignInAt: clerkUser.lastSignInAt?.toString() || null,
        inDatabase: !!dbUser, // Track if user exists in database
        _count: dbUser?._count || {
          images: 0,
          videos: 0,
          jobs: 0,
          influencers: 0,
        },
      };
    });

    // Also add users that exist in database but not in Clerk (orphaned records)
    const orphanedDbUsers = dbUsers.filter(dbUser => 
      !clerkUsers.data.some((clerkUser: any) => clerkUser.id === dbUser.clerkId)
    );

    const orphanedUsers = orphanedDbUsers.map(dbUser => ({
      id: dbUser.id,
      clerkId: dbUser.clerkId,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      imageUrl: dbUser.imageUrl,
      role: dbUser.role,
      createdAt: dbUser.createdAt.toISOString(),
      lastSignInAt: null,
      inDatabase: true,
      isOrphaned: true, // Mark as orphaned (in DB but not in Clerk)
      _count: dbUser._count,
    }));

    // Combine all users
    const allUsers = [...mergedUsers, ...orphanedUsers];

    return NextResponse.json(allUsers);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}