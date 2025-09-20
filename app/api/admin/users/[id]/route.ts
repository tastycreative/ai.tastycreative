import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';
import { clerkClient } from '@clerk/nextjs/server';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check admin access
    await requireAdminAccess();

    const { role } = await request.json();
    const userId = params.id;

    // Validate role
    if (!['USER', 'MANAGER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be USER, MANAGER, or ADMIN' },
        { status: 400 }
      );
    }

    // First, try to update the user if they exist in the database
    try {
      const updatedUser = await prisma.user.update({
        where: { clerkId: userId },
        data: { role },
        select: {
          id: true,
          clerkId: true,
          role: true,
          email: true,
          firstName: true,
          lastName: true,
        }
      });

      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: `User role updated to ${role}`
      });

    } catch (error: any) {
      // If user doesn't exist in database (P2025 = record not found), create them
      if (error.code === 'P2025') {
        // Fetch user data from Clerk
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(userId);

        // Create user in database with the specified role
        const newUser = await prisma.user.create({
          data: {
            clerkId: userId,
            email: clerkUser.emailAddresses[0]?.emailAddress || null,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            imageUrl: clerkUser.imageUrl,
            role: role as any, // TypeScript cast since we validated it above
          },
          select: {
            id: true,
            clerkId: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        });

        return NextResponse.json({
          success: true,
          user: newUser,
          message: `User created in database and role set to ${role}`,
          created: true
        });
      }

      // Re-throw other errors
      throw error;
    }

  } catch (error: any) {
    console.error('Error updating user role:', error);
    
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.status === 404) {
      return NextResponse.json(
        { error: 'User not found in Clerk' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}