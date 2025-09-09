import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPartCommand } from '@aws-sdk/client-s3';

// Store multipart upload state (in production, use Redis or database)
const multipartUploads = new Map<string, {
  uploadId: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
  s3Key: string;
  uniqueFileName: string;
  totalParts: number;
}>();

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Multipart upload request received');
    
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      console.log('❌ Authentication failed - no userId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`✅ User authenticated: ${userId}`);

    // Parse request body
    const formData = await request.formData();
    const action = formData.get('action') as string;
    
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

    if (action === 'start') {
      // Start multipart upload
      const fileName = formData.get('fileName') as string;
      const displayName = formData.get('displayName') as string;
      const totalParts = parseInt(formData.get('totalParts') as string);
      
      if (!fileName || !displayName || isNaN(totalParts)) {
        return NextResponse.json({ 
          error: 'Missing required fields: fileName, displayName, totalParts' 
        }, { status: 400 });
      }

      const timestamp = Date.now();
      const uniqueFileName = `${userId}_${timestamp}_${fileName}`;
      const s3Key = `loras/${userId}/${uniqueFileName}`;
      
      console.log(`🚀 Starting multipart upload for ${fileName} with ${totalParts} parts`);

      const createCommand = new CreateMultipartUploadCommand({
        Bucket: '83cljmpqfd',
        Key: s3Key,
        ContentType: 'application/octet-stream',
        Metadata: {
          'original-name': fileName,
          'display-name': displayName,
          'user-id': userId,
          'upload-timestamp': timestamp.toString(),
        },
      });

      const createResponse = await s3Client.send(createCommand);
      const uploadId = createResponse.UploadId!;
      
      // Generate presigned URLs for all parts
      const presignedUrls: Array<{ partNumber: number; url: string }> = [];
      
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const uploadPartCommand = new UploadPartCommand({
          Bucket: '83cljmpqfd',
          Key: s3Key,
          PartNumber: partNumber,
          UploadId: uploadId,
        });

        const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
          expiresIn: 3600 // 1 hour
        });

        presignedUrls.push({
          partNumber,
          url: presignedUrl
        });
      }
      
      // Store upload state
      const sessionId = `${userId}_${timestamp}`;
      multipartUploads.set(sessionId, {
        uploadId,
        parts: [],
        s3Key,
        uniqueFileName,
        totalParts
      });

      console.log(`✅ Multipart upload started: ${uploadId} with ${totalParts} presigned URLs`);

      return NextResponse.json({
        success: true,
        sessionId,
        uploadId,
        uniqueFileName,
        presignedUrls
      });

    } else if (action === 'record-part') {
      // Record part completion (after direct S3 upload)
      const partNumber = parseInt(formData.get('partNumber') as string);
      const etag = formData.get('etag') as string;
      const sessionId = formData.get('sessionId') as string;
      
      if (isNaN(partNumber) || !etag || !sessionId) {
        return NextResponse.json({ 
          error: 'Missing required fields: partNumber, etag, sessionId' 
        }, { status: 400 });
      }

      const uploadState = multipartUploads.get(sessionId);
      if (!uploadState) {
        return NextResponse.json({ 
          error: 'Upload session not found' 
        }, { status: 404 });
      }

      console.log(`✅ Recording part ${partNumber} completion, ETag: ${etag}`);

      // Store part info
      uploadState.parts.push({
        ETag: etag,
        PartNumber: partNumber
      });

      console.log(`📊 Parts completed: ${uploadState.parts.length}/${uploadState.totalParts}`);

      return NextResponse.json({
        success: true,
        partNumber,
        etag,
        partsCompleted: uploadState.parts.length,
        totalParts: uploadState.totalParts
      });

    } else if (action === 'complete') {
      // Complete multipart upload
      const sessionId = formData.get('sessionId') as string;
      
      if (!sessionId) {
        return NextResponse.json({ 
          error: 'Missing required fields: sessionId' 
        }, { status: 400 });
      }

      const uploadState = multipartUploads.get(sessionId);
      if (!uploadState) {
        return NextResponse.json({ 
          error: 'Upload session not found' 
        }, { status: 404 });
      }

      if (uploadState.parts.length !== uploadState.totalParts) {
        return NextResponse.json({ 
          error: `Missing parts: expected ${uploadState.totalParts}, got ${uploadState.parts.length}` 
        }, { status: 400 });
      }

      console.log(`🏁 Completing multipart upload with ${uploadState.totalParts} parts`);

      // Sort parts by part number
      uploadState.parts.sort((a, b) => a.PartNumber - b.PartNumber);

      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: '83cljmpqfd',
        Key: uploadState.s3Key,
        UploadId: uploadState.uploadId,
        MultipartUpload: {
          Parts: uploadState.parts
        }
      });

      await s3Client.send(completeCommand);

      // Clean up
      multipartUploads.delete(sessionId);

      console.log(`✅ Multipart upload completed: ${uploadState.uniqueFileName}`);

      return NextResponse.json({
        success: true,
        completed: true,
        uniqueFileName: uploadState.uniqueFileName,
        s3Key: uploadState.s3Key,
        comfyUIPath: `/runpod-volume/${uploadState.s3Key}`,
        networkVolumePath: `s3://83cljmpqfd/${uploadState.s3Key}`,
      });

    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use: start, upload, or complete' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in multipart S3 upload:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('❌ Error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
