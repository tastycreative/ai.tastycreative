import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';

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
      
      console.log(`🚀 Starting server-side multipart upload for ${fileName} with ${totalParts} parts`);

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
      
      // Store upload state
      const sessionId = `${userId}_${timestamp}`;
      multipartUploads.set(sessionId, {
        uploadId,
        parts: [],
        s3Key,
        uniqueFileName,
        totalParts
      });

      console.log(`✅ Multipart upload started: ${uploadId}`);

      return NextResponse.json({
        success: true,
        sessionId,
        uploadId,
        uniqueFileName
      });

    } else if (action === 'upload') {
      // Upload part via server (streaming to avoid memory limits)
      const chunk = formData.get('chunk') as File;
      const partNumber = parseInt(formData.get('partNumber') as string);
      const sessionId = formData.get('sessionId') as string;
      
      if (!chunk || isNaN(partNumber) || !sessionId) {
        return NextResponse.json({ 
          error: 'Missing required fields: chunk, partNumber, sessionId' 
        }, { status: 400 });
      }

      const uploadState = multipartUploads.get(sessionId);
      if (!uploadState) {
        return NextResponse.json({ 
          error: 'Upload session not found' 
        }, { status: 404 });
      }

      console.log(`📤 Server uploading part ${partNumber} (${Math.round(chunk.size / 1024)}KB)`);

      try {
        // Stream the chunk directly to S3 without storing in memory
        const chunkArrayBuffer = await chunk.arrayBuffer();
        const chunkBuffer = new Uint8Array(chunkArrayBuffer);

        const uploadPartCommand = new UploadPartCommand({
          Bucket: '83cljmpqfd',
          Key: uploadState.s3Key,
          PartNumber: partNumber,
          UploadId: uploadState.uploadId,
          Body: chunkBuffer,
        });

        const partResponse = await s3Client.send(uploadPartCommand);
        const etag = partResponse.ETag!;

        // Store part info
        uploadState.parts.push({
          ETag: etag,
          PartNumber: partNumber
        });

        console.log(`✅ Part ${partNumber} uploaded via server, ETag: ${etag}`);
        console.log(`📊 Parts completed: ${uploadState.parts.length}/${uploadState.totalParts}`);

        return NextResponse.json({
          success: true,
          partNumber,
          etag,
          partsCompleted: uploadState.parts.length,
          totalParts: uploadState.totalParts
        });

      } catch (error) {
        console.error(`❌ Failed to upload part ${partNumber}:`, error);
        return NextResponse.json({ 
          error: `Failed to upload part ${partNumber}: ${error}` 
        }, { status: 500 });
      }

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
