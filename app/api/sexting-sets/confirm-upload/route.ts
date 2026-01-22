import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// This endpoint confirms uploads after direct S3 upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { setId, uploadedFiles } = await request.json();

    if (!setId || !uploadedFiles || !Array.isArray(uploadedFiles)) {
      return NextResponse.json(
        { error: "Set ID and uploaded files array required" },
        { status: 400 }
      );
    }

    // Verify the set belongs to the user
    const set = await prisma.sextingSet.findFirst({
      where: {
        id: setId,
        userId: userId,
      },
    });

    if (!set) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 });
    }

    // Create database records for the uploaded files
    const images = await prisma.$transaction(
      uploadedFiles.map((file: {
        fileId: string;
        finalUrl: string;
        originalName: string;
        type: string;
        size: number;
        sequence: number;
      }) =>
        prisma.sextingImage.create({
          data: {
            id: file.fileId,
            setId: setId,
            url: file.finalUrl,
            name: file.originalName,
            type: file.type,
            size: file.size,
            sequence: file.sequence,
          },
        })
      )
    );

    return NextResponse.json({ 
      success: true, 
      images,
      message: `${images.length} file(s) uploaded successfully` 
    });
  } catch (error) {
    console.error("Error confirming uploads:", error);
    return NextResponse.json(
      { error: "Failed to confirm uploads" },
      { status: 500 }
    );
  }
}
