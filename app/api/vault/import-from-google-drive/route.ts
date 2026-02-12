import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { google } from "googleapis";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { trackStorageUpload } from "@/lib/storageEvents";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
  }

  // Check if it's a shared organization profile
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        organizationId: user.currentOrganizationId,
      },
      include: {
        user: {
          select: { clerkId: true },
        },
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

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

// POST - Import files from Google Drive to Vault
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderId, profileId, fileIds, accessToken } = body;

    if (!folderId) {
      return NextResponse.json(
        { error: "Folder ID is required" },
        { status: 400 }
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: "File IDs are required" },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Drive access token is required" },
        { status: 400 }
      );
    }

    // Check if user has access to this profile
    const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this profile" },
        { status: 403 }
      );
    }

    // Verify the folder exists and belongs to this profile
    const vaultFolder = await prisma.vaultFolder.findFirst({
      where: {
        id: folderId,
        profileId: profileId,
      },
    });

    if (!vaultFolder) {
      return NextResponse.json(
        { error: "Folder not found or unauthorized" },
        { status: 404 }
      );
    }

    // Determine the profile owner's clerkId for consistency
    const profileOwnerClerkId = profile?.clerkId || profile?.user?.clerkId || userId;

    // Initialize Google Drive client
    const drive = getDriveClient(accessToken);

    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_REGION!;

    // Import each file from Google Drive
    const createdItems = [];
    const errors = [];

    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i];

      try {
        // Get file metadata from Google Drive (with support for all drives)
        const fileMetadata = await drive.files.get({
          fileId,
          fields: "id,name,mimeType,size",
          supportsAllDrives: true,
        });

        const fileName = fileMetadata.data.name || `file_${Date.now()}`;
        const mimeType = fileMetadata.data.mimeType || "application/octet-stream";
        const fileSize = parseInt(fileMetadata.data.size || "0", 10);

        // Download file content from Google Drive (with support for all drives)
        const fileContent = await drive.files.get(
          {
            fileId,
            alt: "media",
            supportsAllDrives: true,
          },
          { responseType: "arraybuffer" }
        );

        const fileBuffer = Buffer.from(fileContent.data as ArrayBuffer);

        // Get user's organization slug
        const user = await prisma.user.findUnique({
          where: { clerkId: profileOwnerClerkId },
          select: {
            currentOrganizationId: true,
            currentOrganization: {
              select: { slug: true }
            }
          },
        });

        // Generate S3 key with organization prefix
        const fileExtension = fileName.split(".").pop() || "";
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const newFileName = `${Date.now()}_${i}_${sanitizedBaseName}.${fileExtension}`;
        const s3Key = user?.currentOrganization?.slug
          ? `organizations/${user.currentOrganization.slug}/vault/${profileOwnerClerkId}/${profileId}/${folderId}/${newFileName}`
          : `vault/${profileOwnerClerkId}/${profileId}/${folderId}/${newFileName}`;

        // Upload to S3
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: mimeType,
          })
        );

        // Generate S3 URL
        const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

        // Create vault item record
        const vaultItem = await prisma.vaultItem.create({
          data: {
            clerkId: profileOwnerClerkId,
            folderId: folderId,
            profileId: profileId,
            fileName: fileName,
            fileType: mimeType,
            fileSize: fileSize || fileBuffer.length,
            awsS3Key: s3Key,
            awsS3Url: s3Url,
            metadata: {
              source: "google-drive",
              googleDriveFileId: fileId,
              importedAt: new Date().toISOString(),
            },
          },
        });

        createdItems.push(vaultItem);

        // Track storage usage (non-blocking)
        const itemFileSize = fileSize || fileBuffer.length;
        if (itemFileSize > 0) {
          trackStorageUpload(profileOwnerClerkId, itemFileSize).catch((error) => {
            console.error('Failed to track storage upload for imported file:', error);
          });
        }
      } catch (error: any) {
        console.error(`Error importing file ${fileId}:`, error);
        
        // Check for auth errors
        if (error?.code === 401 || error?.message?.includes("Invalid Credentials")) {
          return NextResponse.json(
            { error: "Google Drive authentication expired", authError: true },
            { status: 401 }
          );
        }
        
        errors.push({
          fileId,
          error: error?.message || "Unknown error",
        });
      }
    }

    // Return results
    return NextResponse.json({
      success: true,
      itemCount: createdItems.length,
      items: createdItems,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error importing from Google Drive:", error);
    
    // Check for auth errors
    if (error?.code === 401 || error?.message?.includes("Invalid Credentials")) {
      return NextResponse.json(
        { error: "Google Drive authentication expired", authError: true },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error?.message || "Failed to import from Google Drive" },
      { status: 500 }
    );
  }
}
