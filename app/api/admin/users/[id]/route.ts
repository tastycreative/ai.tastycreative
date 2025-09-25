import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';
import { clerkClient } from '@clerk/nextjs/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  console.log('PATCH /api/admin/users/[id] - Starting request processing');
  
  try {
    console.log('PATCH /api/admin/users/[id] called');
    
    // Check admin access first
    console.log('Checking admin access...');
    await requireAdminAccess();
    console.log('Admin access verified successfully');

    const body = await request.json();
    console.log('Request body:', body);
    const { role } = body;
    const { id } = await params;
    const userId = id;
    console.log('User ID to update:', userId, 'New role:', role);

    // Validate role
    if (!['USER', 'MANAGER', 'ADMIN'].includes(role)) {
      console.log('Invalid role provided:', role);
      return NextResponse.json(
        { error: 'Invalid role. Must be USER, MANAGER, or ADMIN' },
        { status: 400 }
      );
    }

    console.log('Role validation passed, attempting to update user in database...');

    // First, try to update the user if they exist in the database
    try {
      console.log('Attempting to update existing user with clerkId:', userId);
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

      console.log('Successfully updated user:', updatedUser);
      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: `User role updated to ${role}`
      });

    } catch (error: any) {
      console.log('Failed to update user, error code:', error.code);
      // If user doesn't exist in database (P2025 = record not found), create them
      if (error.code === 'P2025') {
        console.log('User not found in database, attempting to create from Clerk data...');
        // Fetch user data from Clerk
        const clerk = await clerkClient();
        try {
          const clerkUser = await clerk.users.getUser(userId);
          console.log('Found user in Clerk:', clerkUser.emailAddresses[0]?.emailAddress);

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

          console.log('Successfully created user in database:', newUser);
          return NextResponse.json({
            success: true,
            user: newUser,
            message: `User created in database and role set to ${role}`,
            created: true
          });
        } catch (clerkError) {
          console.error('Error fetching user from Clerk:', clerkError);
          throw new Error('User not found in Clerk or database');
        }
      }

      // Re-throw other errors
      console.error('Database error:', error);
      throw error;
    }

  } catch (error: any) {
    console.error('Error in PATCH /api/admin/users/[id]:', error);
    console.error('Error stack:', error.stack);
    
    // Check for specific error types
    if (error.message.includes('Unauthorized')) {
      console.log('Returning 401 - Unauthorized');
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error.message.includes('Forbidden')) {
      console.log('Returning 403 - Forbidden');
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Clerk API errors
    if (error.status === 404) {
      console.log('Returning 404 - User not found in Clerk');
      return NextResponse.json(
        { error: 'User not found in Clerk' },
        { status: 404 }
      );
    }
    
    // Database connection errors
    if (error.code && error.code.startsWith('P')) {
      console.log('Database error with code:', error.code);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Generic error
    console.log('Returning 500 - Generic error');
    return NextResponse.json(
      { error: `Failed to update user role: ${error.message}` },
      { status: 500 }
    );
  } finally {
    console.log('PATCH /api/admin/users/[id] - Request processing complete');
  }
}