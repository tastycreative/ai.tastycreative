import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

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

// Validate Drive file ID: alphanumeric, hyphens, underscores only
const VALID_FILE_ID = /^[a-zA-Z0-9_-]{10,100}$/;

/**
 * GET /api/google-drive/proxy/[fileId]
 *
 * Streams a Google Drive file through the server via the service account.
 * Used to display Drive-referenced media without copying to S3.
 *
 * Auth note: This route is public (like S3 CDN URLs) because it's used in
 * <img> src attributes. Security relies on Drive file IDs being unguessable.
 * The proxy is read-only and only accesses files shared with the service account.
 *
 * Browser-side caching (24h) minimises repeat requests.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;

    if (!fileId || !VALID_FILE_ID.test(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const drive = getServiceAccountDriveClient();

    // Get file metadata first for content type + size
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType,size,name',
      supportsAllDrives: true,
    });

    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const fileSize = meta.data.size ? parseInt(meta.data.size, 10) : undefined;

    // Stream file content
    const fileContent = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );

    const buffer = Buffer.from(fileContent.data as ArrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        ...(fileSize ? { 'Content-Length': String(fileSize) } : {}),
        // Cache aggressively — Drive content doesn't change often
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
        // Prevent the proxy from being used as an open redirect
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    console.error('Drive proxy error:', error);

    const isNotFound =
      error instanceof Error &&
      (error.message.includes('File not found') ||
        error.message.includes('notFound') ||
        error.message.includes('404'));

    if (isNotFound) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500 },
    );
  }
}
