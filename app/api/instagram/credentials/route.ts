import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Get Instagram credentials for current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        instagramAccountId: true,
        instagramTokenExpiry: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Don't return the access token for security
    return NextResponse.json({
      success: true,
      hasCredentials: !!(user.instagramAccountId),
      instagramAccountId: user.instagramAccountId,
      tokenExpiry: user.instagramTokenExpiry,
      tokenValid: user.instagramTokenExpiry ? new Date(user.instagramTokenExpiry) > new Date() : false,
    });

  } catch (error) {
    console.error('❌ Error getting Instagram credentials:', error);
    return NextResponse.json(
      { error: 'Failed to get Instagram credentials' },
      { status: 500 }
    );
  }
}

// POST - Save Instagram credentials for current user
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accessToken, accountId } = body;

    if (!accessToken || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: accessToken, accountId' },
        { status: 400 }
      );
    }

    // Verify token is valid by making a test call to Instagram API
    const testResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}?fields=id,username&access_token=${accessToken}`
    );

    if (!testResponse.ok) {
      const error = await testResponse.json();
      return NextResponse.json(
        { 
          error: 'Invalid Instagram credentials',
          details: error 
        },
        { status: 400 }
      );
    }

    const instagramData = await testResponse.json();

    // Long-lived tokens expire in 60 days
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 60);

    // Save to database
    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        instagramAccessToken: accessToken,
        instagramAccountId: accountId,
        instagramTokenExpiry: tokenExpiry,
      },
    });

    console.log(`✅ Saved Instagram credentials for user ${userId}`);

    return NextResponse.json({
      success: true,
      username: instagramData.username,
      accountId: accountId,
      tokenExpiry: tokenExpiry.toISOString(),
    });

  } catch (error) {
    console.error('❌ Error saving Instagram credentials:', error);
    return NextResponse.json(
      { error: 'Failed to save Instagram credentials' },
      { status: 500 }
    );
  }
}

// DELETE - Remove Instagram credentials
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        instagramAccessToken: null,
        instagramAccountId: null,
        instagramTokenExpiry: null,
      },
    });

    console.log(`✅ Removed Instagram credentials for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Instagram credentials removed',
    });

  } catch (error) {
    console.error('❌ Error removing Instagram credentials:', error);
    return NextResponse.json(
      { error: 'Failed to remove Instagram credentials' },
      { status: 500 }
    );
  }
}
