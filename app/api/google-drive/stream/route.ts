import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * Reusable JWT client — cached across requests so the token is reused
 * within its validity window.
 */
let cachedJwt: InstanceType<typeof google.auth.JWT> | null = null;

function getJwtClient() {
  if (cachedJwt) return cachedJwt;

  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  if (!clientEmail || !rawKey) {
    throw new Error('Google Cloud service account credentials not configured');
  }

  cachedJwt = new google.auth.JWT({
    email: clientEmail,
    key: rawKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return cachedJwt;
}

/**
 * GET /api/google-drive/stream?fileId=XXXX
 *
 * True streaming proxy for Google Drive files. Uses native `fetch` to
 * pipe data directly from Google → browser without buffering. Supports
 * HTTP Range requests so <video> can seek and progressively load.
 * Works for files of any size (even 10GB+).
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return NextResponse.json({ error: 'Valid fileId is required' }, { status: 400 });
  }

  try {
    const jwt = getJwtClient();
    const { token } = await jwt.getAccessToken();
    if (!token) throw new Error('Failed to get access token');

    // Build headers — forward Range if the browser sent one
    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    // Stream file directly from Google Drive API.
    // The response body is a ReadableStream — no memory buffering.
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: fetchHeaders },
    );

    if (!driveRes.ok && driveRes.status !== 206) {
      if (driveRes.status === 404) {
        return NextResponse.json(
          { error: 'File not found — it may still be uploading to Google Drive' },
          { status: 404 },
        );
      }
      if (driveRes.status === 403) {
        return NextResponse.json(
          { error: 'Cannot access this file — check sharing permissions' },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch file from Google Drive' },
        { status: driveRes.status },
      );
    }

    // Forward relevant headers from Google's response
    const responseHeaders: Record<string, string> = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600, immutable',
    };

    const contentType = driveRes.headers.get('content-type');
    const contentLength = driveRes.headers.get('content-length');
    const contentRange = driveRes.headers.get('content-range');

    if (contentType) responseHeaders['Content-Type'] = contentType;
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    // Pipe the Google response body straight through — zero buffering.
    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    console.error('Error streaming Google Drive file:', error);
    return NextResponse.json(
      { error: 'Failed to stream file from Google Drive' },
      { status: 500 },
    );
  }
}
