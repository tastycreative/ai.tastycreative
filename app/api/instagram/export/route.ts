import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import JSZip from 'jszip';

/**
 * POST /api/instagram/export - Export posts as downloadable files
 * Body: { postIds: string[], format: 'json' | 'csv' | 'zip' }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { postIds, format = 'zip' } = body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'No posts selected for export' },
        { status: 400 }
      );
    }

    // Fetch the selected posts
    const posts = await prisma.instagramPost.findMany({
      where: {
        id: { in: postIds },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    });

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found' },
        { status: 404 }
      );
    }

    // Format based on requested type
    if (format === 'json') {
      // Export as JSON
      const exportData = posts.map(post => ({
        fileName: post.fileName,
        caption: post.caption,
        scheduledDate: post.scheduledDate,
        status: post.status,
        postType: post.postType,
        imageUrl: post.driveFileUrl,
        instagramUrl: post.instagramUrl || null,
        publishedAt: post.publishedAt || null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }));

      return NextResponse.json({
        success: true,
        data: exportData,
        count: posts.length,
      });

    } else if (format === 'csv') {
      // Export as CSV
      const headers = [
        'File Name',
        'Caption',
        'Scheduled Date',
        'Status',
        'Post Type',
        'Image URL',
        'Instagram URL',
        'Published Date',
        'Created At',
      ];

      const rows = posts.map(post => [
        post.fileName,
        `"${(post.caption || '').replace(/"/g, '""')}"`, // Escape quotes
        post.scheduledDate?.toISOString() || '',
        post.status,
        post.postType,
        post.driveFileUrl,
        post.instagramUrl || '',
        post.publishedAt?.toISOString() || '',
        post.createdAt.toISOString(),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="instagram-posts-${Date.now()}.csv"`,
        },
      });

    } else if (format === 'zip') {
      // Export as ZIP with images and metadata
      // Note: This returns instructions for client-side download
      // Since we can't easily stream large files from Drive on server
      
      const exportData = {
        posts: posts.map(post => ({
          id: post.id,
          fileName: post.fileName,
          caption: post.caption,
          scheduledDate: post.scheduledDate,
          status: post.status,
          postType: post.postType,
          imageUrl: post.driveFileUrl,
          driveFileId: post.driveFileId,
        })),
        exportDate: new Date().toISOString(),
        totalPosts: posts.length,
      };

      return NextResponse.json({
        success: true,
        format: 'zip',
        data: exportData,
        message: 'Use client-side download for ZIP format',
      });
    }

    return NextResponse.json(
      { error: 'Invalid format' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error exporting posts:', error);
    return NextResponse.json(
      { error: 'Failed to export posts' },
      { status: 500 }
    );
  }
}
