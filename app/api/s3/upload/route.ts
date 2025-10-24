import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative';

// Configure larger body size limit for this route (up to 50MB for video uploads)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds timeout

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ Unauthorized upload attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data with error handling
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      console.error('❌ Failed to parse form data:', parseError);
      return NextResponse.json({ 
        error: 'Failed to parse request body. File may be too large.' 
      }, { status: 400 });
    }

    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'instagram/misc';
    
    if (!file) {
      console.error('❌ No file in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📤 Uploading to S3:', { 
      fileName: file.name, 
      folder, 
      size: file.size,
      type: file.type,
      userId 
    });

    // Validate file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      console.error('❌ File too large:', file.size);
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      }, { status: 400 });
    }

    // Convert file to buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (bufferError) {
      console.error('❌ Failed to convert file to buffer:', bufferError);
      return NextResponse.json({ 
        error: 'Failed to process file data' 
      }, { status: 500 });
    }
    
    // Generate S3 key
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // For Instagram staging folders, don't use userId subfolder (flat structure for easy browsing)
    // For outputs folder, use userId subfolder (organized by user)
    const isInstagramFolder = folder.startsWith('instagram/');
    const s3Key = isInstagramFolder 
      ? `${folder}${timestamp}_${sanitizedName}`  // instagram/posts/timestamp_filename.png
      : `${folder}${userId}/${timestamp}_${sanitizedName}`; // outputs/userId/timestamp_filename.png

    // Determine content type
    const contentType = file.type || 'application/octet-stream';

    // Upload to S3 with timeout handling
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        // Note: ACL removed - bucket uses bucket policy for public access instead
      });

      await s3Client.send(command);
    } catch (s3Error) {
      console.error('❌ S3 upload failed:', s3Error);
      return NextResponse.json({ 
        error: 'Failed to upload to S3: ' + (s3Error instanceof Error ? s3Error.message : 'Unknown error')
      }, { status: 500 });
    }

    // Generate public URL
    const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;

    console.log('✅ Upload successful:', url);

    // Return response with CORS headers
    return NextResponse.json({
      success: true,
      file: {
        id: s3Key,
        name: sanitizedName,
        key: s3Key,
        url,
        size: file.size,
        mimeType: contentType,
        lastModified: new Date().toISOString(),
        isImage: contentType.startsWith('image/'),
        isVideo: contentType.startsWith('video/'),
      },
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('❌ S3 upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to S3' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
