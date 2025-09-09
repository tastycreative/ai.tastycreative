import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Store chunks temporarily on the server filesystem
const TEMP_DIR = path.join(os.tmpdir(), 'chunked-uploads');

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for chunk upload
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const fileName = formData.get('fileName') as string;
    const displayName = formData.get('displayName') as string;
    const uploadId = formData.get('uploadId') as string;

    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !fileName || !displayName) {
      return NextResponse.json({ 
        error: 'Missing required fields: chunk, chunkIndex, totalChunks, fileName, displayName' 
      }, { status: 400 });
    }

    // Generate unique filename and upload session ID
    let uniqueFileName: string;
    let sessionId: string;
    
    if (chunkIndex === 0) {
      const timestamp = Date.now();
      uniqueFileName = `${userId}_${timestamp}_${fileName}`;
      sessionId = `${userId}_${timestamp}`;
    } else {
      sessionId = uploadId;
      // Reconstruct unique filename from session ID
      uniqueFileName = `${sessionId}_${fileName}`;
    }

    console.log(`📦 Processing chunk ${chunkIndex + 1}/${totalChunks} for ${fileName} (${Math.round(chunk.size / 1024)}KB)`);

    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Save chunk to temporary file
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkFilePath = path.join(TEMP_DIR, `${sessionId}_chunk_${chunkIndex}`);
    fs.writeFileSync(chunkFilePath, chunkBuffer);

    console.log(`💾 Saved chunk ${chunkIndex + 1}/${totalChunks} to temp file`);

    // If this is the last chunk, reassemble file and upload to S3
    if (chunkIndex === totalChunks - 1) {
      console.log(`🔧 Reassembling ${totalChunks} chunks for ${fileName}...`);

      // Combine all chunks into final file
      const finalFilePath = path.join(TEMP_DIR, `${sessionId}_final`);
      const writeStream = fs.createWriteStream(finalFilePath);

      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(TEMP_DIR, `${sessionId}_chunk_${i}`);
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        
        // Clean up chunk file
        fs.unlinkSync(chunkPath);
      }
      writeStream.end();

      console.log(`✅ File reassembled, uploading to S3...`);

      // Check environment variables
      const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
      const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

      if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
        // Clean up
        fs.unlinkSync(finalFilePath);
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

      // Upload reassembled file to S3
      const s3Key = `loras/${userId}/${uniqueFileName}`;
      const fileBuffer = fs.readFileSync(finalFilePath);

      const uploadCommand = new PutObjectCommand({
        Bucket: '83cljmpqfd',
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/octet-stream',
        Metadata: {
          'original-name': fileName,
          'display-name': displayName,
          'user-id': userId,
          'upload-timestamp': Date.now().toString(),
        },
      });

      await s3Client.send(uploadCommand);

      // Clean up temporary file
      fs.unlinkSync(finalFilePath);

      console.log(`✅ Chunked S3 upload completed: ${uniqueFileName}`);
      
      return NextResponse.json({
        success: true,
        completed: true,
        uniqueFileName,
        s3Key,
        comfyUIPath: `/runpod-volume/loras/${userId}/${uniqueFileName}`,
        networkVolumePath: `s3://83cljmpqfd/${s3Key}`,
        message: 'Upload completed successfully'
      });
    } else {
      // Return progress info for intermediate chunks
      return NextResponse.json({
        success: true,
        completed: false,
        chunkIndex,
        totalChunks,
        uploadId: sessionId,
        progress: Math.round(((chunkIndex + 1) / totalChunks) * 100)
      });
    }

  } catch (error) {
    console.error('❌ Error in chunked S3 upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload chunk to S3' },
      { status: 500 }
    );
  }
}
