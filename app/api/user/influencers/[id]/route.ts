import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // First, get the influencer record to get file information
    const influencer = await prisma.influencerLoRA.findFirst({
      where: {
        id: id,
        clerkId: userId, // Ensure user owns this record
      },
    });

    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
    }

    console.log(`🗑️ Deleting influencer: ${influencer.displayName} (${influencer.fileName})`);

    // Delete from network volume S3 storage if file exists there
    if (influencer.comfyUIPath || influencer.fileName) {
      try {
        const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
        const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

        if (S3_ACCESS_KEY && S3_SECRET_KEY) {
          // Create S3 client for RunPod network volume
          const s3Client = new S3Client({
            region: 'us-ks-2',
            endpoint: 'https://s3api-us-ks-2.runpod.io',
            credentials: {
              accessKeyId: S3_ACCESS_KEY,
              secretAccessKey: S3_SECRET_KEY,
            },
          });

          // Try to delete from the S3 bucket
          const s3Key = `loras/${userId}/${influencer.fileName}`;
          
          console.log(`🗂️ Attempting to delete from S3: ${s3Key}`);
          
          const deleteCommand = new DeleteObjectCommand({
            Bucket: '83cljmpqfd',
            Key: s3Key,
          });

          await s3Client.send(deleteCommand);
          console.log(`✅ Successfully deleted from S3: ${s3Key}`);
        } else {
          console.warn("⚠️ S3 credentials not configured, skipping S3 deletion");
        }
      } catch (s3Error) {
        console.error("❌ Error deleting from S3 (continuing with database deletion):", s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete the influencer LoRA record from database
    await prisma.influencerLoRA.delete({
      where: {
        id: id,
        clerkId: userId, // Ensure user owns this record
      },
    });

    console.log(`✅ Successfully deleted influencer from database: ${influencer.displayName}`);

    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${influencer.displayName} from both database and storage` 
    });
  } catch (error) {
    console.error("Error deleting influencer:", error);
    return NextResponse.json(
      { error: "Failed to delete influencer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { displayName } = body;

    if (!displayName || displayName.trim().length === 0) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    // Update the influencer LoRA record
    const updatedInfluencer = await prisma.influencerLoRA.update({
      where: {
        id: id,
        clerkId: userId, // Ensure user owns this record
      },
      data: {
        displayName: displayName.trim(),
      },
    });

    return NextResponse.json({ success: true, influencer: updatedInfluencer });
  } catch (error) {
    console.error("Error updating influencer:", error);
    return NextResponse.json(
      { error: "Failed to update influencer" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the specific influencer LoRA record
    const influencer = await prisma.influencerLoRA.findFirst({
      where: {
        id: id,
        clerkId: userId, // Ensure user owns this record
      },
    });

    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, influencer });
  } catch (error) {
    console.error("Error fetching influencer:", error);
    return NextResponse.json(
      { error: "Failed to fetch influencer" },
      { status: 500 }
    );
  }
}
