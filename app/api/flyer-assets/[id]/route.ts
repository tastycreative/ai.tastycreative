import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'tastycreative';

// GET /api/flyer-assets/[id] — Get a single flyer asset
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const asset = await prisma.flyerAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Flyer asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Error fetching flyer asset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flyer asset' },
      { status: 500 }
    );
  }
}

// DELETE /api/flyer-assets/[id] — Delete a flyer asset and its S3 object
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const asset = await prisma.flyerAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Flyer asset not found' },
        { status: 404 }
      );
    }

    // Delete from S3
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: asset.s3Key,
        })
      );
    } catch (s3Error) {
      console.error('Failed to delete S3 object:', s3Error);
      // Continue with DB deletion even if S3 fails
    }

    // Delete from database
    await prisma.flyerAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flyer asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete flyer asset' },
      { status: 500 }
    );
  }
}
