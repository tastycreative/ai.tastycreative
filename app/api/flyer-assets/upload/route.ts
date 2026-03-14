import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { convertS3ToCdnUrl } from '@/lib/cdnUtils';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'tastycreative';

// POST /api/flyer-assets/upload — Upload a flyer file to S3 and create record
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const profileId = formData.get('profileId') as string;
    const boardItemId = (formData.get('boardItemId') as string) || null;

    if (!file || !profileId) {
      return NextResponse.json(
        { error: 'file and profileId are required' },
        { status: 400 }
      );
    }

    // Get user's current org
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'No active organization' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;

    // S3 key: flyers/{orgId}/{profileId}/{filename}
    const s3Key = `flyers/${user.currentOrganizationId}/${profileId}/${uniqueFileName}`;

    // Convert file to buffer and upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // Generate CDN URL
    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
    const cdnUrl = convertS3ToCdnUrl(s3Url);

    // Determine file type category
    let fileType = 'png';
    if (file.type === 'image/gif') fileType = 'gif';
    else if (file.type === 'image/jpeg') fileType = 'jpeg';
    else if (file.type === 'image/png') fileType = 'png';
    else if (file.type === 'image/webp') fileType = 'webp';

    // Create database record
    const asset = await prisma.flyerAsset.create({
      data: {
        organizationId: user.currentOrganizationId,
        profileId,
        clerkId: userId,
        boardItemId,
        fileName: file.name,
        fileType,
        url: cdnUrl,
        s3Key,
        fileSize: file.size,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error('Error uploading flyer asset:', error);
    return NextResponse.json(
      { error: 'Failed to upload flyer asset' },
      { status: 500 }
    );
  }
}
