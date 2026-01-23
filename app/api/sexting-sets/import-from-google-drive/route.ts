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

// POST - Import files from Google Drive to a sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { setId, fileIds, accessToken } = body;

    if (!setId) {
      return NextResponse.json(
        { error: "Set ID is required" },
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

    // Verify ownership of the sexting set
    const sextingSet = await prisma.sextingSet.findFirst({
      where: { id: setId, userId },
      include: {
        images: {
          orderBy: { sequence: "desc" },
          take: 1,
        },
      },
    });

    if (!sextingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    // Get starting sequence number (after existing images)
    const startSequence = (sextingSet.images[0]?.sequence || 0) + 1;

    // Initialize Google Drive client
    const drive = getDriveClient(accessToken);

    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_REGION!;

    // Import each file from Google Drive
    const createdImages = [];
    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i];
      const sequence = startSequence + i;

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

        // Generate S3 key
        const fileExtension = fileName.split(".").pop() || "";
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const newFileName = `${Date.now()}_${sanitizedBaseName}.${fileExtension}`;
        const s3Key = `${sextingSet.s3FolderPath}/${newFileName}`;

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

        // Create sexting image record
        const sextingImage = await prisma.sextingImage.create({
          data: {
            setId: sextingSet.id,
            url: s3Url,
            name: fileName,
            type: mimeType,
            sequence,
            size: fileSize || fileBuffer.length,
          },
        });

        createdImages.push(sextingImage);
      } catch (fileError: unknown) {
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`Error importing file ${fileId}:`, errorMessage);
        
        // Log more details about the error
        if (fileError instanceof Error && 'response' in fileError) {
          const response = (fileError as { response?: { status?: number; data?: unknown } }).response;
          console.error(`Google Drive API error - Status: ${response?.status}, Data:`, response?.data);
        }
        // Continue with other files even if one fails
      }
    }

    // Fetch updated set with all images
    const updatedSet = await prisma.sextingSet.findUnique({
      where: { id: setId },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Imported ${createdImages.length} files from Google Drive`,
      itemCount: createdImages.length,
      set: updatedSet,
    });
  } catch (error) {
    console.error("Error importing from Google Drive:", error);
    
    // Check if it's an authentication error
    const isAuthError = error instanceof Error && 
      (error.message.includes("authentication") || 
       error.message.includes("OAuth") ||
       error.message.includes("credentials") ||
       error.message.includes("invalid_grant"));

    return NextResponse.json(
      { 
        error: isAuthError 
          ? "Google Drive authentication expired. Please reconnect."
          : "Failed to import from Google Drive",
        authError: isAuthError
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
