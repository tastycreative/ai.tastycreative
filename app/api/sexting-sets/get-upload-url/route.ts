import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/database";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tastycreative-media";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { setId, files } = await request.json();

    if (!setId || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: "Set ID and files array required" },
        { status: 400 }
      );
    }

    // Verify the set belongs to the user
    const set = await prisma.sextingSet.findFirst({
      where: {
        id: setId,
        userId: userId,
      },
      include: {
        images: {
          orderBy: { sequence: "desc" },
          take: 1,
        },
      },
    });

    if (!set) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 });
    }

    // Get the current max sequence
    let currentSequence = set.images[0]?.sequence || 0;

    // Generate presigned URLs for each file
    const uploadUrls = await Promise.all(
      files.map(async (file: { name: string; type: string; size: number }) => {
        const fileId = uuidv4();
        const extension = file.name.split(".").pop() || "";
        const key = `sexting-sets/${userId}/${setId}/${fileId}.${extension}`;
        
        currentSequence++;

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: file.type,
          // Add metadata for the file
          Metadata: {
            originalName: encodeURIComponent(file.name),
            setId: setId,
            userId: userId,
          },
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
          expiresIn: 3600, // 1 hour
        });

        // The final URL after upload
        const finalUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;

        return {
          fileId,
          uploadUrl,
          finalUrl,
          key,
          originalName: file.name,
          type: file.type,
          size: file.size,
          sequence: currentSequence,
        };
      })
    );

    return NextResponse.json({ uploadUrls });
  } catch (error) {
    console.error("Error generating upload URLs:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URLs" },
      { status: 500 }
    );
  }
}
