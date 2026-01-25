import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { google } from "googleapis";

// Initialize Google Drive API with OAuth2
function getDriveClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

// GET - Browse files in any Google Drive folder or search globally
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get("accessToken");
    const folderId = searchParams.get("folderId"); // Optional - null means root
    const searchQuery = searchParams.get("search"); // Optional - global search

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    const drive = getDriveClient(accessToken);

    let query: string;
    // Always enable access to all drives (Shared Drives, folders shared via link, etc.)
    const supportsAllDrives = true;
    const includeItemsFromAllDrives = true;

    // If browsing a specific folder, verify access first
    if (folderId && !searchQuery) {
      try {
        await drive.files.get({
          fileId: folderId,
          fields: "id,name,mimeType",
          supportsAllDrives,
        });
      } catch (verifyError) {
        console.error("Error verifying folder access:", verifyError);
        return NextResponse.json(
          {
            error: "You don't have permission to access this folder. Make sure the link is shared with you.",
            permissionError: true,
          },
          { status: 403 }
        );
      }
    }

    if (searchQuery && searchQuery.trim()) {
      // Global search mode - search across ALL accessible files
      // This includes My Drive, Shared with me, Shared Drives, etc.
      const escapedQuery = searchQuery.replace(/'/g, "\\'");
      query = `name contains '${escapedQuery}' and trashed=false`;
    } else {
      // Browse mode - get files from specific folder or root
      const parentQuery = folderId ? `'${folderId}' in parents` : "'root' in parents";
      query = `${parentQuery} and trashed=false`;
    }

    // Fetch files
    // Note: thumbnailLink is requested but may not be returned for all videos
    // For videos, Google Drive generates thumbnails which may take time to be available
    const response = await drive.files.list({
      q: query,
      fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,thumbnailLink,hasThumbnail,videoMediaMetadata,shared,owners,parents)",
      orderBy: "folder,name",
      pageSize: 200,
      supportsAllDrives,
      includeItemsFromAllDrives,
    });

    const files = response.data.files || [];

    // Separate folders and media files
    const folders = files.filter(
      (file) => file.mimeType === "application/vnd.google-apps.folder"
    );
    const mediaFiles = files.filter(
      (file) =>
        file.mimeType?.startsWith("image/") ||
        file.mimeType?.startsWith("video/") ||
        file.mimeType?.startsWith("audio/")
    );

    return NextResponse.json({
      success: true,
      folders,
      mediaFiles,
      total: mediaFiles.length,
      folderId: folderId || "root",
      isSearchResult: !!searchQuery,
    });
  } catch (error) {
    console.error("Error browsing Google Drive:", error);

    const isAuthError =
      error instanceof Error &&
      (error.message.includes("authentication") ||
        error.message.includes("OAuth") ||
        error.message.includes("credentials") ||
        error.message.includes("invalid_grant"));

    const isPermissionError =
      error instanceof Error &&
      (error.message.includes("File not found") ||
        error.message.includes("insufficientFilePermissions") ||
        error.message.includes("403") ||
        error.message.includes("does not have sufficient permissions") ||
        error.message.includes("The user does not have access"));

    if (isPermissionError) {
      return NextResponse.json(
        {
          error: "You don't have permission to access this folder. Make sure the link is shared with you.",
          permissionError: true,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: isAuthError
          ? "Google Drive authentication expired. Please reconnect."
          : "Failed to browse Google Drive",
        authError: isAuthError,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
