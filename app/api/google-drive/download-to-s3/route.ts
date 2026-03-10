import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/database';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getServiceAccountDriveClient() {
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;

  if (!clientEmail || !rawKey) {
    throw new Error('Google Cloud service account credentials not configured');
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  const jwtAuth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth: jwtAuth });
}

/**
 * POST /api/google-drive/download-to-s3
 *
 * Downloads a single file from Google Drive (via service account) and
 * uploads it to S3. Returns the S3 URL and key.
 *
 * Body: {
 *   driveFileId: string,   – Google Drive file ID
 *   fileName: string,      – original file name
 *   mimeType: string,      – MIME type
 *   orgId: string,         – organization ID for S3 path
 *   context: string,       – S3 sub-path context (e.g. "board-items/{itemId}")
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.driveFileId || !body?.fileName || !body?.mimeType) {
      return NextResponse.json(
        { error: 'driveFileId, fileName, and mimeType are required' },
        { status: 400 },
      );
    }

    const { driveFileId, fileName, mimeType } = body;

    // Resolve orgId from the user if not provided
    let orgId = body.orgId;
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { currentOrganizationId: true },
      });
      orgId = user?.currentOrganizationId ?? 'unknown';
    }

    const context = body.context || 'gdrive-imports';

    const drive = getServiceAccountDriveClient();

    // Download file content
    const fileContent = await drive.files.get(
      { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );

    const fileBuffer = Buffer.from(fileContent.data as ArrayBuffer);

    // Build S3 key
    const ext = fileName.split('.').pop() || '';
    const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3FileName = `${Date.now()}_${baseName}${ext ? `.${ext}` : ''}`;
    const s3Key = `organizations/${orgId}/submissions/${context}/${s3FileName}`;

    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_REGION!;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
      }),
    );

    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      success: true,
      s3Key,
      fileUrl,
      fileName,
      fileType: mimeType,
      fileSize: fileBuffer.length,
    });
  } catch (error: unknown) {
    console.error('Error downloading Drive file to S3:', error);

    const isPermission =
      error instanceof Error &&
      (error.message.includes('File not found') ||
        error.message.includes('403') ||
        error.message.includes('notFound'));

    if (isPermission) {
      return NextResponse.json(
        { error: 'Cannot download this file — check sharing permissions' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to download file from Google Drive' },
      { status: 500 },
    );
  }
}
