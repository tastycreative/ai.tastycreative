import { NextRequest } from 'next/server';

/**
 * Edge runtime — enables true streaming without buffering the full
 * response body in memory (which caused OOM on the Node.js runtime).
 */
export const runtime = 'edge';

// ---------------------------------------------------------------------------
// Lightweight Google service-account auth via Web Crypto API (no googleapis)
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Base64url-encode a buffer or string. */
function b64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Strip PEM armour and decode the base-64 key body to an ArrayBuffer. */
function pemToBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s/g, '');
  const binary = atob(lines);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

/** Create a signed JWT and exchange it for a Google access token. */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60 s margin)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  if (!clientEmail || !rawKey) {
    throw new Error('Google Cloud service account credentials not configured');
  }

  const pem = rawKey.replace(/\\n/g, '\n');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const sigInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(sigInput),
  );
  const jwt = `${sigInput}.${b64url(sig)}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }
  const { access_token, expires_in } = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

// ---------------------------------------------------------------------------
// Streaming proxy
// ---------------------------------------------------------------------------

/**
 * GET /api/google-drive/stream?fileId=XXXX
 *
 * True streaming proxy for Google Drive files. Runs on the Edge runtime
 * so the response body is piped directly from Google → browser with zero
 * memory buffering. Supports HTTP Range requests for <video> seeking.
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return Response.json({ error: 'Valid fileId is required' }, { status: 400 });
  }

  try {
    const token = await getAccessToken();

    // Build headers — forward Range if the browser sent one
    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: fetchHeaders },
    );

    if (!driveRes.ok && driveRes.status !== 206) {
      if (driveRes.status === 404) {
        return Response.json(
          { error: 'File not found — it may still be uploading to Google Drive' },
          { status: 404 },
        );
      }
      if (driveRes.status === 403) {
        return Response.json(
          { error: 'Cannot access this file — check sharing permissions' },
          { status: 403 },
        );
      }
      return Response.json(
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
    return Response.json(
      { error: 'Failed to stream file from Google Drive' },
      { status: 500 },
    );
  }
}
