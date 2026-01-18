import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all users except the current user from database
    const dbUsers = await prisma.user.findMany({
      where: {
        clerkId: {
          not: userId, // Exclude current user
        },
      },
      select: {
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
        { email: 'asc' },
      ],
    });

    // If we have users with missing data, try to enrich from Clerk
    const usersNeedingEnrichment = dbUsers.filter(
      user => !user.email && !user.firstName && !user.lastName
    );

    if (usersNeedingEnrichment.length > 0) {
      try {
        const clerk = await clerkClient();
        
        // Fetch and update each user that needs enrichment
        for (const user of usersNeedingEnrichment) {
          try {
            const clerkUser = await clerk.users.getUser(user.clerkId);
            
            // Update the database with Clerk data
            await prisma.user.update({
              where: { clerkId: user.clerkId },
              data: {
                email: clerkUser.emailAddresses[0]?.emailAddress || null,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
              },
            });

            // Update the local object for the response
            user.email = clerkUser.emailAddresses[0]?.emailAddress || null;
            user.firstName = clerkUser.firstName;
            user.lastName = clerkUser.lastName;
            user.imageUrl = clerkUser.imageUrl;
          } catch (clerkError) {
            console.warn(`Could not fetch Clerk data for user ${user.clerkId}:`, clerkError);
          }
        }
      } catch (clerkInitError) {
        console.warn('Could not initialize Clerk client for enrichment:', clerkInitError);
      }
    }

    // Filter out users that still have no identifiable information after enrichment
    // and ensure we use clerkId as a unique key (in case there were any issues)
    const uniqueUsersMap = new Map<string, typeof dbUsers[0]>();
    
    for (const user of dbUsers) {
      // Only include users with at least some identifiable info
      if (user.email || user.firstName || user.lastName) {
        // Use clerkId as unique key to prevent any duplicates
        if (!uniqueUsersMap.has(user.clerkId)) {
          uniqueUsersMap.set(user.clerkId, user);
        }
      }
    }

    const users = Array.from(uniqueUsersMap.values()).sort((a, b) => {
      const nameA = a.firstName || a.lastName || a.email || '';
      const nameB = b.firstName || b.lastName || b.email || '';
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    );
  }
}
