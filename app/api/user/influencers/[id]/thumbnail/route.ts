import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { uploadToCloudinary } from "@/lib/cloudinaryService";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

function validateImage(file: File) {
  const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit keeps thumbnails lightweight
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported");
  }

  if (file.size > maxSizeBytes) {
    throw new Error("Image is too large. Please upload a file under 5MB.");
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const influencer = await prisma.influencerLoRA.findFirst({
      where: {
        id,
        clerkId: userId,
      },
      select: {
        id: true,
      },
    });

    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("thumbnail");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thumbnail image is required" }, { status: 400 });
    }

    try {
      validateImage(file);
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "Invalid thumbnail image";

      return NextResponse.json({ error: message }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await uploadToCloudinary(buffer, {
      folder: `influencer-thumbnails/${userId}`,
      tags: ["influencer-thumbnail", userId],
      public_id: `${id}-${Date.now()}`,
      resource_type: "image",
    });

    const updated = await prisma.influencerLoRA.update({
      where: {
        id,
        clerkId: userId,
      },
      data: {
        thumbnailUrl: uploadResult.secure_url,
      },
      select: {
        id: true,
        thumbnailUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      influencer: updated,
    });
  } catch (error) {
    console.error("Error uploading influencer thumbnail:", error);

    const message = error instanceof Error ? error.message : "Failed to upload thumbnail";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
