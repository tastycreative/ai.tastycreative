import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// Instagram Graph API endpoints
const INSTAGRAM_GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * Publish a post to Instagram using the Graph API
 * POST /api/instagram/publish
 */
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
    const { postId, imageUrl, caption, accessToken, instagramAccountId } = body;

    if (!postId || !imageUrl || !accessToken || !instagramAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields: postId, imageUrl, accessToken, instagramAccountId' },
        { status: 400 }
      );
    }

    // Get the post from database
    const post = await prisma.instagramPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user has permission
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    const canPublish = 
      post.clerkId === userId || 
      (user && user.role === 'ADMIN');

    if (!canPublish) {
      return NextResponse.json(
        { error: 'Unauthorized to publish this post' },
        { status: 403 }
      );
    }

    console.log(`📸 Publishing Instagram post: ${postId}`);

    // Step 1: Create a container (media object)
    const isVideo = post.mimeType?.startsWith('video/');
    const containerEndpoint = `${INSTAGRAM_GRAPH_API}/${instagramAccountId}/media`;
    
    const containerParams: any = {
      access_token: accessToken,
    };

    if (isVideo) {
      containerParams.media_type = 'VIDEO';
      containerParams.video_url = imageUrl;
      if (caption) {
        containerParams.caption = caption;
      }
    } else {
      containerParams.image_url = imageUrl;
      if (caption) {
        containerParams.caption = caption;
      }
    }

    const containerResponse = await fetch(containerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(containerParams),
    });

    if (!containerResponse.ok) {
      const error = await containerResponse.json();
      console.error('❌ Failed to create Instagram container:', error);
      return NextResponse.json(
        { 
          error: 'Failed to create Instagram media container',
          details: error 
        },
        { status: containerResponse.status }
      );
    }

    const containerData = await containerResponse.json();
    const creationId = containerData.id;

    console.log(`✅ Created Instagram container: ${creationId}`);

    // Step 2: Publish the container
    const publishEndpoint = `${INSTAGRAM_GRAPH_API}/${instagramAccountId}/media_publish`;
    const publishResponse = await fetch(publishEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    });

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      console.error('❌ Failed to publish Instagram post:', error);
      return NextResponse.json(
        { 
          error: 'Failed to publish Instagram post',
          details: error 
        },
        { status: publishResponse.status }
      );
    }

    const publishData = await publishResponse.json();
    const mediaId = publishData.id;

    console.log(`✅ Published Instagram post: ${mediaId}`);

    // Update post status in database
    await prisma.instagramPost.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      mediaId,
      message: 'Post published successfully to Instagram',
    });

  } catch (error) {
    console.error('❌ Error publishing to Instagram:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to publish to Instagram',
      },
      { status: 500 }
    );
  }
}
