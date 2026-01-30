import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Flux Kontext webhook received:', JSON.stringify(body, null, 2));

    const { jobId, status, stage, message, progress, resultImages, error, elapsedTime } = body;

    if (!jobId) {
      console.error('❌ No jobId in webhook payload');
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      );
    }

    // Find the job in database
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      console.error(`❌ Job ${jobId} not found in database`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    console.log(`📝 Updating job ${jobId}: status=${status}, stage=${stage}, progress=${progress}`);

    // Prepare update data
    const updateData: any = {
      status: status || job.status,
      progress: progress !== undefined ? progress : job.progress,
      stage: stage || job.stage,
      message: message || job.message,
      lastChecked: new Date(),
    };

    if (error) {
      updateData.error = error;
    }

    if (elapsedTime !== undefined) {
      updateData.elapsedTime = elapsedTime;
    }

    // Update job in database
    await prisma.generationJob.update({
      where: { id: jobId },
      data: updateData
    });

    // If job is completed and we have result images, save them to database
    if (status === 'COMPLETED' && resultImages && Array.isArray(resultImages) && resultImages.length > 0) {
      console.log(`✅ Saving ${resultImages.length} result images for job ${jobId}`);

      // Check if this job should save to vault
      const jobParams = job.params as any;
      const shouldSaveToVault = jobParams?.saveToVault === true && jobParams?.vaultProfileId && jobParams?.vaultFolderId;

      for (const imageData of resultImages) {
        try {
          // Check if image already exists
          const existing = await prisma.generatedImage.findFirst({
            where: {
              jobId: jobId,
              filename: imageData.filename,
              subfolder: imageData.subfolder || '',
              type: imageData.type || 'output'
            }
          });

          if (existing) {
            console.log(`⏭️  Image already exists: ${imageData.filename}`);
            continue;
          }

          // Determine the correct clerkId to use
          // If the image is in a shared folder, we need to use the folder owner's clerkId
          let ownerClerkId = job.clerkId; // Default to job creator
          
          if (imageData.awsS3Key) {
            // Extract the folder prefix from awsS3Key
            // Format: "outputs/user_id/folder-name/filename.png"
            const s3KeyParts = imageData.awsS3Key.split('/');
            if (s3KeyParts.length >= 3 && s3KeyParts[0] === 'outputs') {
              const potentialOwnerClerkId = s3KeyParts[1]; // User ID from S3 path
              const folderName = s3KeyParts[2]; // Folder name
              
              // Check if this is different from the job creator (indicating a shared folder)
              if (potentialOwnerClerkId !== job.clerkId) {
                console.log(`📁 Detected shared folder: ${imageData.awsS3Key}`);
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

          // Always save to GeneratedImage table for history tracking
          const generatedImageData = {
            clerkId: ownerClerkId,
            jobId: jobId,
            filename: imageData.filename,
            subfolder: imageData.subfolder || '',
            type: imageData.type || 'output',
            fileSize: imageData.fileSize,
            awsS3Key: imageData.awsS3Key,
            awsS3Url: imageData.awsS3Url,
            format: 'png',
            metadata: {
              source: "flux-kontext",
              generationType: "image-editing",
              model: jobParams?.model || "flux-kontext",
              prompt: jobParams?.prompt || "",
              vaultProfileId: jobParams?.vaultProfileId,
              vaultFolderId: jobParams?.vaultFolderId,
              referenceImageUrl: jobParams?.referenceImageUrl,
              referenceImageUrls: jobParams?.referenceImageUrls,
              steps: jobParams?.steps,
              guidance: jobParams?.guidance,
              seed: jobParams?.seed,
              generatedAt: new Date().toISOString(),
            },
          };

          await prisma.generatedImage.create({
            data: generatedImageData
          });

          console.log(`✅ Saved image to GeneratedImage: ${imageData.filename} (owner: ${ownerClerkId})`);

          // Additionally save to vault if configured
          if (shouldSaveToVault) {
            console.log(`💾 Also saving to vault - Profile: ${jobParams.vaultProfileId}, Folder: ${jobParams.vaultFolderId}`);
            
            const vaultItem = await prisma.vaultItem.create({
              data: {
                clerkId: ownerClerkId,
                profileId: jobParams.vaultProfileId,
                folderId: jobParams.vaultFolderId,
                fileName: imageData.filename,
                fileType: 'image/png',
                fileSize: imageData.fileSize || 0,
                awsS3Key: imageData.awsS3Key,
                awsS3Url: imageData.awsS3Url,
                metadata: {
                  source: "flux-kontext",
                  generationType: "image-editing",
                  model: jobParams?.model || "flux-kontext",
                  prompt: jobParams?.prompt || "",
                  generatedAt: new Date().toISOString(),
                  generatedByClerkId: job.clerkId, // Track who generated this item
                },
              },
            });

            console.log(`✅ Saved image to vault: ${imageData.filename} (vault item: ${vaultItem.id})`);
          }
        } catch (imageError) {
          console.error(`❌ Error saving image ${imageData.filename}:`, imageError);
        }
      }

      // Update job with result URLs
      const resultUrls = resultImages
        .map(img => img.awsS3Url)
        .filter(url => url);

      await prisma.generationJob.update({
        where: { id: jobId },
        data: { resultUrls }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('❌ Error processing Flux Kontext webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
