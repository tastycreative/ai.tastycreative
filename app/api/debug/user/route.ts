// Debug API route to check user creation
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user exists in database
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    // Create user if doesn't exist
    if (!existingUser) {
      const newUser = await prisma.user.create({
        data: {
          clerkId: userId
        }
      });
      
      return NextResponse.json({
        message: 'User created successfully',
        user: newUser,
        clerkId: userId
      });
    }

    return NextResponse.json({
      message: 'User already exists',
      user: existingUser,
      clerkId: userId
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check/create user',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
