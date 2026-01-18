import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch users directly from Clerk (source of truth - no duplicates)
    const clerk = await clerkClient();
    const clerkUsers = await clerk.users.getUserList({
      limit: 100, // Adjust as needed
      orderBy: 'created_at',
    });

    // Map Clerk users to our format, excluding the current user
    const users = clerkUsers.data
      .filter(user => user.id !== userId)
      .map(user => ({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || null,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
      }))
      .filter(user => user.email || user.firstName || user.lastName) // Only users with some info
      .sort((a, b) => {
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
