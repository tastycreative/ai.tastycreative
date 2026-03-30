import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/database";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// POST - Get presigned URL for uploading (universal, no profile dependency)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fileName, fileType, folderId, isSharedFolder } = body;

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error("AWS credentials not configured");
      return NextResponse.json(
        { error: "AWS credentials not configured" },
        { status: 500 }
      );
    }

    // Determine the S3 owner — for shared folders with EDIT access, use the folder owner
    let s3OwnerId = userId;
    if (isSharedFolder && folderId) {
      const folder = await prisma.reference_folders.findUnique({
        where: { id: folderId },
        select: { clerkId: true },
      });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      // Verify the uploader has EDIT permission on this shared folder
      const memberships = await prisma.teamMember.findMany({
        where: { user: { clerkId: userId } },
        include: { orgTeamMemberships: { select: { teamId: true } } },
      });
      const orgIds = memberships.map((m) => m.organizationId);
      const teamIds = memberships.flatMap((m) => m.orgTeamMemberships.map((t) => t.teamId));

      const share = await prisma.reference_folder_shares.findFirst({
        where: {
          folderId,
          permission: "EDIT",
          OR: [
            { organizationId: { in: orgIds }, orgTeamId: null },
            ...(teamIds.length > 0 ? [{ orgTeamId: { in: teamIds } }] : []),
          ],
        },
      });
      if (!share) {
        return NextResponse.json(
          { error: "You need EDIT permission to upload to this shared folder" },
          { status: 403 }
        );
      }
      s3OwnerId = folder.clerkId;
    }

    // Generate a unique key for the file
    const fileExtension = fileName.split(".").pop() || "";
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    // Store in owner-specific folder, optionally with folder subfolder
    const folderPath = folderId ? `folders/${folderId}` : "unfiled";
    const key = `reference-bank/${s3OwnerId}/${folderPath}/${uniqueFileName}`;

    // Create the presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || "tastycreative",
      Key: key,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    console.log("Generated presigned URL for:", key);

    // Construct the public S3 URL
    const bucket = process.env.AWS_S3_BUCKET || "tastycreative";
    const region = process.env.AWS_REGION || "us-east-1";
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({
      uploadUrl: presignedUrl,
      presignedUrl, // Also include for backwards compatibility with generation components
      key,
      url,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
