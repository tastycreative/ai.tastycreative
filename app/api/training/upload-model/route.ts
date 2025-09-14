import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Training model upload to network volume...');
    
    // Parse form data from training handler
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobId = formData.get('jobId') as string;
    const userId = formData.get('userId') as string;
    const modelName = formData.get('modelName') as string;
    const originalFileName = formData.get('originalFileName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'No job ID provided' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'No user ID provided' }, { status: 400 });
    }

    console.log(`📝 Training job: ${jobId}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📦 Model: ${modelName || 'unnamed'}`);
    console.log(`📁 File size: ${Math.round(file.size / 1024 / 1024)}MB`);

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${originalFileName || file.name}`;

    // Upload to network volume storage via S3
    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      throw new Error('S3 credentials not configured');
    }

    console.log('☁️ Uploading to network volume via S3...');

    // Create S3 client for RunPod network volume
    const s3Client = new S3Client({
      region: 'us-ks-2',
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    // Create the S3 key path for user-specific LoRA storage
    const s3Key = `loras/${userId}/${uniqueFileName}`;
    const networkVolumePath = `/runpod-volume/${s3Key}`;

    console.log(`📤 Uploading to S3 key: ${s3Key}`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to network volume via S3
    const uploadCommand = new PutObjectCommand({
      Bucket: '83cljmpqfd',
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        'original-filename': originalFileName || file.name,
        'model-name': modelName || 'trained-model',
        'user-id': userId,
        'job-id': jobId,
        'upload-timestamp': timestamp.toString(),
        'source': 'training',
      },
    });

    await s3Client.send(uploadCommand);
    
    console.log(`✅ Network volume upload successful: s3://83cljmpqfd/${s3Key}`);

    // Create database record
    try {
      const influencerRecord = await prisma.influencerLoRA.create({
        data: {
          clerkId: userId, // Use clerkId instead of userId
          name: modelName || `Trained Model ${timestamp}`,
          displayName: modelName || `Trained Model ${timestamp}`,
          fileName: uniqueFileName,
          originalFileName: originalFileName || file.name,
          fileSize: file.size,
          uploadedAt: new Date(),
          description: `Trained model from job ${jobId}`,
          isActive: true,
          usageCount: 0,
          syncStatus: 'SYNCED',
          comfyUIPath: networkVolumePath,
          cloudinaryUrl: null,
          cloudinaryPublicId: null,
          trainingJobId: jobId, // Link to training job
        }
      });

      console.log(`✅ Created influencer record: ${influencerRecord.id}`);

      // Update training job with completion info
      try {
        await prisma.trainingJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            completedAt: new Date(),
            finalModelUrl: networkVolumePath, // Use finalModelUrl instead of resultUrl
          }
        });
        console.log(`✅ Updated training job ${jobId} with completion`);
      } catch (jobError) {
        console.log(`⚠️ Could not update training job (might not exist): ${jobError}`);
      }

    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      // Don't fail the upload if database fails - model is still saved
    }

    return NextResponse.json({
      success: true,
      fileName: uniqueFileName,
      s3Key: s3Key,
      networkVolumePath: networkVolumePath,
      serverlessPath: `/runpod-volume/loras/${userId}/${uniqueFileName}`,
      bucketName: '83cljmpqfd',
      message: 'Trained model uploaded to network volume storage',
      uploadLocation: 'network_volume_s3',
      jobId: jobId,
    });

  } catch (error) {
    console.error('❌ Training model upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}