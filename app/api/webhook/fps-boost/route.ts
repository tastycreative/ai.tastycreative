// app/api/webhook/fps-boost/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, status, progress, videos, stage, message, elapsedTime, error } = body;

    console.log("=== FPS BOOST WEBHOOK ===");
    console.log("Job ID:", jobId);
    console.log("Status:", status);
    console.log("Progress:", progress);

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // Update job in database
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status.toUpperCase();
    }

    if (progress !== undefined) {
      updateData.progress = progress;
    }

    if (stage) {
      updateData.stage = stage;
    }

    if (message) {
      updateData.message = message;
    }

    if (elapsedTime !== undefined) {
      updateData.elapsedTime = elapsedTime;
    }

    if (error) {
      updateData.error = error;
    }

    // Update the job
    const job = await prisma.generationJob.update({
      where: { id: jobId },
      data: updateData,
    });

    console.log("✅ Job updated:", job.id);

    // If completed and videos are provided, save them to database
    if (status === "completed" && videos && Array.isArray(videos)) {
      console.log(`📹 Saving ${videos.length} video(s) to database...`);

      // Check if this job should save to vault
      const jobParams = job.params as any;
      const shouldSaveToVault = jobParams?.saveToVault === true;
      const vaultProfileId = jobParams?.vaultProfileId;
      const vaultFolderId = jobParams?.vaultFolderId;

      console.log("📁 Storage destination:", shouldSaveToVault ? "Vault" : "S3/GeneratedVideo");
      if (shouldSaveToVault) {
        console.log("🗄️ Vault Profile ID:", vaultProfileId);
        console.log("🗄️ Vault Folder ID:", vaultFolderId);
      }

      for (const video of videos) {
        try {
          if (shouldSaveToVault && vaultProfileId && vaultFolderId) {
            // Save to VaultItem instead of GeneratedVideo
            console.log("💾 Creating VaultItem for:", video.filename);
            
            await prisma.vaultItem.create({
              data: {
                clerkId: job.clerkId,
                profileId: vaultProfileId,
                folderId: vaultFolderId,
                fileName: video.filename || `fps_boosted_${Date.now()}.mp4`,
                fileType: "video/mp4",
                fileSize: video.fileSize || 0,
                awsS3Key: video.awsS3Key,
                awsS3Url: video.awsS3Url,
              },
            });

            console.log(`✅ VaultItem saved: ${video.filename} to folder ${vaultFolderId}`);
          } else {
            // Save to GeneratedVideo (original behavior)
            // Determine the correct clerkId to use
            // If the video is in a shared folder, we need to use the folder owner's clerkId
            let ownerClerkId = job.clerkId; // Default to job creator
            
            if (video.awsS3Key) {
              // Extract the folder prefix from awsS3Key
              // Format: "outputs/user_id/folder-name/filename.mp4"
              const s3KeyParts = video.awsS3Key.split('/');
              if (s3KeyParts.length >= 3 && s3KeyParts[0] === 'outputs') {
                const potentialOwnerClerkId = s3KeyParts[1]; // User ID from S3 path
                const folderName = s3KeyParts[2]; // Folder name
                
                // Check if this is different from the job creator (indicating a shared folder)
                if (potentialOwnerClerkId !== job.clerkId) {
                  console.log(`📁 Detected shared folder: ${video.awsS3Key}`);
                  console.log(`🔄 Switching from ${job.clerkId} to ${potentialOwnerClerkId}`);
                  
                  // Verify the folder owner exists in the database
                  const folderOwner = await prisma.user.findUnique({
                    where: { clerkId: potentialOwnerClerkId },
                  });
                  
                  if (folderOwner) {
                    ownerClerkId = potentialOwnerClerkId;
                    console.log(`✅ Using folder owner's clerkId: ${ownerClerkId}`);
                  } else {
                    console.warn(`⚠️ Folder owner not found, using job creator: ${job.clerkId}`);
                  }
                }
              }
            }

            await prisma.generatedVideo.create({
              data: {
                clerkId: ownerClerkId, // Use the determined owner's clerkId
                jobId: job.id,
                filename: video.filename,
                subfolder: video.subfolder || "fps_boost",
                type: video.type || "output",
                awsS3Key: video.awsS3Key,
                awsS3Url: video.awsS3Url,
                fileSize: video.fileSize,
                format: "mp4",
              },
            });

            console.log(`✅ Video saved: ${video.filename} (owner: ${ownerClerkId})`);
          }
        } catch (error) {
          console.error(`❌ Error saving video ${video.filename}:`, error);
        }
      }

      console.log("✅ All videos saved to database");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ FPS boost webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
