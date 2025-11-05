import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJobImages } from '@/lib/imageStorage';
import { getJob } from '@/lib/jobsStorage';
import { prisma } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    console.log('🖼️ Getting images for job:', jobId, 'requested by:', userId);

    // 🔓 SHARED FOLDER SUPPORT: Verify user has permission to view this job
    const job = await getJob(jobId);
    if (!job) {
      console.error('❌ Job not found:', jobId);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user is the job owner
    const isOwner = job.clerkId === userId || job.userId === userId;
    
    // If not owner, check if any images from this job are in a shared folder
    let hasSharedAccess = false;
    if (!isOwner) {
      console.log('🔍 User is not job owner, checking shared folder access...');
      
      // Get images for this job to check their S3 paths
      const jobImagesCheck = await prisma.generatedImage.findFirst({
        where: { jobId },
        select: { awsS3Key: true }
      });

      if (jobImagesCheck && jobImagesCheck.awsS3Key) {
        // Extract folder prefix from S3 key: outputs/{ownerId}/{folderName}/
        const match = jobImagesCheck.awsS3Key.match(/^(outputs\/[^\/]+\/[^\/]+\/)/);
        if (match) {
          const folderPrefix = match[1];
          console.log('🔍 Checking shared access for folder:', folderPrefix);
          
          // Check if this folder is shared with the current user
          const folderShare = await prisma.folderShare.findFirst({
            where: {
              folderPrefix: folderPrefix,
              sharedWithClerkId: userId
            }
          });

          if (folderShare) {
            console.log('✅ User has shared folder access via:', folderPrefix);
            hasSharedAccess = true;
          }
        }
      }
    }

    // Deny access if user is not owner and doesn't have shared access
    if (!isOwner && !hasSharedAccess) {
      console.warn('⚠️ User', userId, 'attempted to access job', jobId, 'without permission');
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view this job' },
        { status: 403 }
      );
    }

    console.log('✅ User has permission to view job', jobId);

    // Get images for job
    const images = await getJobImages(jobId, { includeData: false });
    
    console.log(`📊 Found ${images.length} images for job ${jobId}`);

    return NextResponse.json({
      success: true,
      images: images.map(img => ({
        id: img.id,
        filename: img.filename,
        subfolder: img.subfolder,
        type: img.type,
        fileSize: img.fileSize,
        width: img.width,
        height: img.height,
        format: img.format,
        createdAt: img.createdAt,
        url: img.url,        // ComfyUI direct URL (if available)
        dataUrl: img.dataUrl, // Database-served URL
        s3Key: img.s3Key,    // Legacy S3 key for network volume storage
        networkVolumePath: img.networkVolumePath, // Network volume path
        // AWS S3 fields for direct access
        awsS3Key: img.awsS3Key,
        awsS3Url: img.awsS3Url
      })),
      count: images.length
    });

  } catch (error) {
    console.error('❌ Job images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
