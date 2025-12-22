import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  S3Client, 
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { action, fileName, totalParts, uploadId, s3Key, parts } = body;

    // Check environment variables
    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      return NextResponse.json({ 
        error: 'S3 credentials not configured' 
      }, { status: 500 });
    }

    // Configure S3 client for RunPod network volume
    const s3Client = new S3Client({
      region: 'us-ks-2',
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    const BUCKET = '83cljmpqfd';

    // ✅ START MULTIPART UPLOAD
    if (action === 'start') {
      if (!fileName || !totalParts) {
        return NextResponse.json({ 
          error: 'Missing required fields: fileName, totalParts' 
        }, { status: 400 });
      }

      // Validate file type
      const validExtensions = ['.safetensors', '.pt', '.ckpt'];
      const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        return NextResponse.json({ 
          error: 'Invalid file type. Only .safetensors, .pt, and .ckpt files are allowed.' 
        }, { status: 400 });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const uniqueFileName = `${userId}_${timestamp}_${fileName}`;
      const key = `loras/${userId}/${uniqueFileName}`;

      // Create multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: 'application/octet-stream',
        Metadata: {
          'original-name': fileName,
          'user-id': userId,
          'upload-timestamp': timestamp.toString(),
        },
      });

      const { UploadId } = await s3Client.send(createCommand);

      // Generate presigned URLs for each part
      const presignedUrls: string[] = [];
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const uploadPartCommand = new UploadPartCommand({
          Bucket: BUCKET,
          Key: key,
          UploadId,
          PartNumber: partNumber,
        });

        const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
          expiresIn: 3600, // 1 hour
        });

        presignedUrls.push(presignedUrl);
      }

      console.log(`✅ Started multipart upload for: ${uniqueFileName} (${totalParts} parts)`);

      return NextResponse.json({
        success: true,
        uploadId: UploadId,
        s3Key: key,
        uniqueFileName,
        presignedUrls,
        comfyUIPath: `/runpod-volume/loras/${userId}/${uniqueFileName}`,
      });
    }

    // ✅ COMPLETE MULTIPART UPLOAD
    if (action === 'complete') {
      if (!uploadId || !s3Key || !parts) {
        return NextResponse.json({ 
          error: 'Missing required fields: uploadId, s3Key, parts' 
        }, { status: 400 });
      }

      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: s3Key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts,
        },
      });

      await s3Client.send(completeCommand);

      const uniqueFileName = s3Key.split('/').pop() || '';
      
      console.log(`✅ Completed multipart upload: ${uniqueFileName}`);

      return NextResponse.json({
        success: true,
        uniqueFileName,
        comfyUIPath: `/runpod-volume/${s3Key}`,
        networkVolumePath: `s3://${BUCKET}/${s3Key}`,
      });
    }

    // ✅ ABORT MULTIPART UPLOAD
    if (action === 'abort') {
      if (!uploadId || !s3Key) {
        return NextResponse.json({ 
          error: 'Missing required fields: uploadId, s3Key' 
        }, { status: 400 });
      }

      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: BUCKET,
        Key: s3Key,
        UploadId: uploadId,
      });

      await s3Client.send(abortCommand);

      console.log(`⚠️ Aborted multipart upload: ${s3Key}`);

      return NextResponse.json({
        success: true,
        message: 'Upload aborted',
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action. Use: start, complete, or abort' 
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Error in presigned upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process upload' },
      { status: 500 }
    );
  }
}
