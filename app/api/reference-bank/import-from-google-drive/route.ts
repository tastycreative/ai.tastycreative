import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { google } from "googleapis";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

// POST - Import files from Google Drive to Reference Bank
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderId, fileIds, accessToken } = body;

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

    // If folderId is provided, verify ownership
    if (folderId) {
      const referenceFolder = await prisma.reference_folders.findFirst({
        where: {
          id: folderId,
          clerkId: userId,
        },
      });

      if (!referenceFolder) {
        return NextResponse.json(
          { error: "Folder not found or unauthorized" },
          { status: 404 }
        );
      }
    }

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
          fields: "id,name,mimeType,size,imageMediaMetadata,videoMediaMetadata",
          supportsAllDrives: true,
        });

        const fileName = fileMetadata.data.name || `file_${Date.now()}`;
        const mimeType = fileMetadata.data.mimeType || "application/octet-stream";
        const fileSize = parseInt(fileMetadata.data.size || "0", 10);
        
        // Get dimensions if available
        const width = fileMetadata.data.imageMediaMetadata?.width || 
                     fileMetadata.data.videoMediaMetadata?.width || null;
        const height = fileMetadata.data.imageMediaMetadata?.height || 
                      fileMetadata.data.videoMediaMetadata?.height || null;
        const duration = fileMetadata.data.videoMediaMetadata?.durationMillis 
          ? Math.round(parseInt(fileMetadata.data.videoMediaMetadata.durationMillis) / 1000)
          : null;

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

        // Generate S3 key
        const fileExtension = fileName.split(".").pop() || "";
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const newFileName = `${Date.now()}_${i}_${sanitizedBaseName}.${fileExtension}`;
        const s3Key = `reference-bank/${userId}/${folderId || 'unfiled'}/${newFileName}`;

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

        // Determine file type (image or video)
        const fileType = mimeType.startsWith("video/") ? "video" : "image";

        // Create reference item record
        const referenceItem = await prisma.reference_items.create({
          data: {
            clerkId: userId,
            name: baseName,
            description: `Imported from Google Drive`,
            fileType: fileType,
            mimeType: mimeType,
            fileSize: fileSize || fileBuffer.length,
            width: width,
            height: height,
            duration: duration,
            awsS3Key: s3Key,
            awsS3Url: s3Url,
            tags: ["google-drive-import"],
            folderId: folderId || null,
            isFavorite: false,
            usageCount: 0,
          },
        });

        createdItems.push(referenceItem);
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
