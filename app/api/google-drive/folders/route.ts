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

// GET - List folders from user's Google Drive
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get("accessToken");
    const parentId = searchParams.get("parentId"); // Optional - for subfolder navigation
    const includeShared = searchParams.get("includeShared") === "true";

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    const drive = getDriveClient(accessToken);

    // Build query for folders
    let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
    
    if (parentId) {
      // Get folders inside a specific folder
      query += ` and '${parentId}' in parents`;
    } else if (!includeShared) {
      // Get root level folders in My Drive
      query += " and 'root' in parents";
    }

    // Fetch user's own folders
    const ownFoldersResponse = await drive.files.list({
      q: query,
      fields: "files(id,name,mimeType,modifiedTime,shared,owners,sharingUser)",
      orderBy: "name",
      pageSize: 100,
    });

    const ownFolders = (ownFoldersResponse.data.files || []).map(folder => ({
      ...folder,
      type: "owned" as const,
    }));

    // Fetch shared folders (only at root level)
    let sharedFolders: any[] = [];
    if (includeShared && !parentId) {
      const sharedFoldersResponse = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and sharedWithMe=true and trashed=false",
        fields: "files(id,name,mimeType,modifiedTime,shared,owners,sharingUser)",
        orderBy: "name",
        pageSize: 100,
      });

      sharedFolders = (sharedFoldersResponse.data.files || []).map(folder => ({
        ...folder,
        type: "shared" as const,
        sharedBy: folder.sharingUser?.displayName || folder.owners?.[0]?.displayName || "Unknown",
      }));
    }

    return NextResponse.json({
      success: true,
      folders: [...ownFolders, ...sharedFolders],
      parentId: parentId || null,
    });
  } catch (error) {
    console.error("Error listing Google Drive folders:", error);

    const isAuthError =
      error instanceof Error &&
      (error.message.includes("authentication") ||
        error.message.includes("OAuth") ||
        error.message.includes("credentials") ||
        error.message.includes("invalid_grant"));

    return NextResponse.json(
      {
        error: isAuthError
          ? "Google Drive authentication expired. Please reconnect."
          : "Failed to list folders",
        authError: isAuthError,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
