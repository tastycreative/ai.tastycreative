import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, CopyObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// POST /api/vault/items/[id]/copy - Copy item to a different folder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { folderId } = body;

    if (!folderId) {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }

    // Find the source item
    const sourceItem = await prisma.vaultItem.findUnique({
      where: { id },
    });

    if (!sourceItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if user is the owner OR has at least VIEW permission on the source folder
    const isOwner = sourceItem.clerkId === userId;
    
    if (!isOwner) {
      // Check if user has permission on the folder via sharing
      const sharePermission = await prisma.vaultFolderShare.findUnique({
        where: {
          vaultFolderId_sharedWithClerkId: {
            vaultFolderId: sourceItem.folderId,
            sharedWithClerkId: userId,
          },
        },
      });

      if (!sharePermission) {
        return NextResponse.json(
          { error: "You don't have access to this item" },
          { status: 403 }
        );
      }
      // VIEW or EDIT permission is sufficient for copying
    }

    // Verify the destination folder exists
    const destinationFolder = await prisma.vaultFolder.findUnique({
      where: { id: folderId },
    });

    if (!destinationFolder) {
      return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
    }

    // Check if user owns the destination folder OR has EDIT permission on it
    const isDestinationOwner = destinationFolder.clerkId === userId;
    
    if (!isDestinationOwner) {
      // Check if user has EDIT permission on destination folder
      const destSharePermission = await prisma.vaultFolderShare.findUnique({
        where: {
          vaultFolderId_sharedWithClerkId: {
            vaultFolderId: folderId,
            sharedWithClerkId: userId,
          },
        },
      });

      if (!destSharePermission || destSharePermission.permission !== 'EDIT') {
        return NextResponse.json(
          { error: "You need EDIT permission to copy items to this folder" },
          { status: 403 }
        );
      }
    }

    // Extract S3 key from the source item
    const sourceKey = sourceItem.awsS3Key;
    
    // Generate a new key for the copied file - use destination folder owner's clerkId
    const timestamp = Date.now();
    const newKey = `vault/${destinationFolder.clerkId}/${destinationFolder.profileId}/${folderId}/${timestamp}-${sourceItem.fileName}`;
    
    // Copy the S3 object
    const bucketName = process.env.AWS_S3_BUCKET!;
    
    // CopySource format: bucket/key - the key part must be URL-encoded
    // Encode each path segment separately to handle special characters
    const encodedSourceKey = sourceKey.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const copySource = `${bucketName}/${encodedSourceKey}`;
    
    console.log("S3 Copy operation:", {
      sourceBucket: bucketName,
      sourceKey,
      encodedSourceKey,
      destinationKey: newKey,
      copySource,
    });
    
    try {
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: copySource,
          Key: newKey,
        })
      );
    } catch (s3Error: any) {
      console.error("S3 copy error details:", {
        message: s3Error.message,
        code: s3Error.Code || s3Error.code,
        name: s3Error.name,
        sourceKey,
        copySource,
      });
      return NextResponse.json(
        { error: "Failed to copy file in storage" },
        { status: 500 }
      );
    }

    // Generate the new S3 URL
    const newAwsS3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${newKey}`;

    // Create a new VaultItem record with the destination folder owner's info
    const copiedItem = await prisma.vaultItem.create({
      data: {
        fileName: sourceItem.fileName,
        fileType: sourceItem.fileType,
        fileSize: sourceItem.fileSize,
        awsS3Key: newKey,
        awsS3Url: newAwsS3Url,
        clerkId: destinationFolder.clerkId, // Use destination folder owner
        profileId: destinationFolder.profileId,
        folderId: folderId,
      },
    });

    return NextResponse.json(copiedItem);
  } catch (error) {
    console.error("Error copying vault item:", error);
    return NextResponse.json(
      { error: "Failed to copy item" },
      { status: 500 }
    );
  }
}
