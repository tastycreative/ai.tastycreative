import { google } from 'googleapis';
import { parseDriveLink } from '@/lib/otp-ptr-caption-status';

/**
 * Category-specific placeholder thumbnails for gallery items that have
 * neither a GIF, media attachment, nor a resolvable Google Drive thumbnail.
 *
 * These use inline SVG data URIs so no external assets are required.
 * Each produces a 400x300 branded card with the category icon and label.
 */
const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  GAME: '/gallery-placeholder-game.svg',
  PPV: '/gallery-placeholder-ppv.svg',
  VIP: '/gallery-placeholder-vip.svg',
  LIVE: '/gallery-placeholder-live.svg',
  TIP_ME: '/gallery-placeholder-tipme.svg',
  DM_FUNNEL: '/gallery-placeholder-dmfunnel.svg',
  RENEW_ON: '/gallery-placeholder-renewon.svg',
};

const DEFAULT_PLACEHOLDER = '/placeholder-gallery.png';

/**
 * Return a category-specific placeholder URL, or the generic one.
 */
export function getCategoryPlaceholder(postOrigin: string | null | undefined): string {
  if (postOrigin && CATEGORY_PLACEHOLDERS[postOrigin]) {
    return CATEGORY_PLACEHOLDERS[postOrigin];
  }
  return DEFAULT_PLACEHOLDER;
}

/**
 * Initialise a Google Drive client using the project service account.
 * Mirrors the implementation in `app/api/google-drive/fetch-link/route.ts`.
 */
function getServiceAccountDriveClient() {
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;

  if (!clientEmail || !rawKey) {
    return null;
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  const jwtAuth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth: jwtAuth });
}

export interface DriveThumbnailResult {
  url: string;
  isGif: boolean;
}

/**
 * Given a Google Drive URL (folder or file), attempt to resolve a thumbnail.
 *
 * For **folders**: lists children, **prioritises GIF files** (Game tickets
 * always have a GIF in their Drive folder), then falls back to any
 * image/video.  Returns the proxy URL with `full=1` so the stream endpoint
 * sends the whole file (required for images — the default 2 MB chunk
 * truncates them).
 *
 * For **files**: returns the file ID directly.
 *
 * Returns `null` if the Drive API is unavailable, the folder is empty,
 * or the link can't be parsed.
 */
export async function resolveDriveThumbnail(
  driveUrl: string,
): Promise<DriveThumbnailResult | null> {
  const parsed = parseDriveLink(driveUrl);
  if (!parsed) return null;

  // If it's already a direct file link, return a proxy URL for it
  if (parsed.type === 'file') {
    return {
      url: `/api/google-drive/stream?fileId=${encodeURIComponent(parsed.id)}&full=1`,
      isGif: false,
    };
  }

  // It's a folder — try to find a GIF first, then fall back to any image/video
  const drive = getServiceAccountDriveClient();
  if (!drive) return null;

  try {
    // 1. Prioritise GIF files — Game folders always contain one
    const gifRes = await drive.files.list({
      q: `'${parsed.id}' in parents and trashed=false and mimeType='image/gif'`,
      fields: 'files(id,name,mimeType)',
      pageSize: 1,
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const gifFile = gifRes.data.files?.[0];
    if (gifFile?.id) {
      return {
        url: `/api/google-drive/stream?fileId=${encodeURIComponent(gifFile.id)}&full=1`,
        isGif: true,
      };
    }

    // 2. Fallback — any image or video
    const anyRes = await drive.files.list({
      q: `'${parsed.id}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`,
      fields: 'files(id,name,mimeType)',
      pageSize: 1,
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const anyFile = anyRes.data.files?.[0];
    if (!anyFile?.id) return null;

    return {
      url: `/api/google-drive/stream?fileId=${encodeURIComponent(anyFile.id)}&full=1`,
      isGif: anyFile.mimeType === 'image/gif',
    };
  } catch (error) {
    console.error('[resolveDriveThumbnail] Failed to list Drive folder:', error);
    return null;
  }
}
