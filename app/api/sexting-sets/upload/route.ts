import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// POST - Upload images to a sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const setId = formData.get("setId") as string;
    const files = formData.getAll("files") as File[];

    if (!setId) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Verify ownership of the set
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id: setId, userId },
      include: { images: { orderBy: { sequence: "desc" }, take: 1 } },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    // Get current highest sequence number
    let nextSequence = (existingSet.images[0]?.sequence || 0) + 1;

    const uploadedImages = [];
    const bucket = process.env.AWS_S3_BUCKET!;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const uniqueFilename = `${Date.now()}-${nextSequence}.${fileExtension}`;
      const s3Key = `${existingSet.s3FolderPath}/${uniqueFilename}`;

      // Upload to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: file.type,
        })
      );

      const s3Url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

      // Create database record
      const image = await prisma.sextingImage.create({
        data: {
          setId,
          url: s3Url,
          name: file.name,
          type: file.type,
          sequence: nextSequence,
          size: file.size,
        },
      });

      uploadedImages.push(image);
      nextSequence++;
    }

    // Update the set's updatedAt timestamp
    await prisma.sextingSet.update({
      where: { id: setId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ images: uploadedImages });
  } catch (error) {
    console.error("Error uploading to sexting set:", error);
    return NextResponse.json(
      { error: "Failed to upload images" },
      { status: 500 }
    );
  }
}
