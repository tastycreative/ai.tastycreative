import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { parseDriveLink } from '@/lib/otp-ptr-caption-status';

/**
 * Initialise a Google Drive client using the project service account.
 * The service account can access files/folders that have been shared
 * with it (or are publicly accessible via link).
 */
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
 * POST /api/google-drive/fetch-link
 *
 * Accepts a Google Drive URL (file or folder), resolves it using the
 * service account, and returns a list of media files with metadata.
 *
 * Body: { url: string }
 *
 * Response: {
 *   success: boolean,
 *   type: 'file' | 'folder',
 *   files: Array<{ id, name, mimeType, size, webContentLink, thumbnailLink }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'A Google Drive URL is required' },
        { status: 400 },
      );
    }

    const parsed = parseDriveLink(body.url.trim());
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            'Invalid Google Drive link. Please paste a link like https://drive.google.com/drive/folders/... or https://drive.google.com/file/d/...',
        },
        { status: 400 },
      );
    }

    const drive = getServiceAccountDriveClient();

    if (parsed.type === 'file') {
      // ── Single file ────────────────────────────────────────────
      const fileMeta = await drive.files.get({
        fileId: parsed.id,
        fields: 'id,name,mimeType,size,thumbnailLink',
        supportsAllDrives: true,
      });

      const f = fileMeta.data;
      return NextResponse.json({
        success: true,
        type: 'file' as const,
        files: [
          {
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size ? parseInt(f.size, 10) : null,
            thumbnailLink: f.thumbnailLink ?? null,
          },
        ],
      });
    }

    // ── Folder: list all media files recursively ──────────────────
    const allFiles: {
      id: string;
      name: string;
      mimeType: string;
      size: number | null;
      thumbnailLink: string | null;
    }[] = [];

    async function listFolder(folderId: string) {
      let pageToken: string | undefined;

      do {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields:
            'nextPageToken,files(id,name,mimeType,size,thumbnailLink)',
          pageSize: 200,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageToken,
        });

        for (const file of res.data.files ?? []) {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            // Recurse into sub-folders
            await listFolder(file.id!);
          } else if (
            file.mimeType?.startsWith('image/') ||
            file.mimeType?.startsWith('video/')
          ) {
            allFiles.push({
              id: file.id!,
              name: file.name ?? 'untitled',
              mimeType: file.mimeType,
              size: file.size ? parseInt(file.size, 10) : null,
              thumbnailLink: file.thumbnailLink ?? null,
            });
          }
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    }

    await listFolder(parsed.id);

    return NextResponse.json({
      success: true,
      type: 'folder' as const,
      files: allFiles,
    });
  } catch (error: unknown) {
    console.error('Error fetching Google Drive link:', error);

    const isPermission =
      error instanceof Error &&
      (error.message.includes('File not found') ||
        error.message.includes('403') ||
        error.message.includes('insufficientPermissions') ||
        error.message.includes('notFound'));

    if (isPermission) {
      return NextResponse.json(
        {
          error:
            'Cannot access this Google Drive link. Make sure the file/folder is shared with "Anyone with the link" or shared with the service account.',
          permissionError: true,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch Google Drive contents' },
      { status: 500 },
    );
  }
}
