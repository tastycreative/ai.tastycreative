import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(request: NextRequest) {
  try {
    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      return NextResponse.json({ error: 'S3 credentials not configured' }, { status: 500 });
    }

    console.log('🧪 Testing S3 upload to network volume...');

    // Create S3 client
    const s3Client = new S3Client({
      region: 'us-ks-2',
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    // Create a small test file
    const testContent = `Test upload at ${new Date().toISOString()}`;
    const testKey = `loras/test-user/test_upload_${Date.now()}.txt`;

    console.log(`📤 Attempting upload to: ${testKey}`);

    // Try to upload a test file
    const uploadCommand = new PutObjectCommand({
      Bucket: '83cljmpqfd',
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
      Metadata: {
        'test-upload': 'true',
        'timestamp': Date.now().toString(),
      },
    });

    await s3Client.send(uploadCommand);
    
    console.log('✅ S3 upload test successful!');

    return NextResponse.json({
      success: true,
      bucket: '83cljmpqfd',
      uploadedKey: testKey,
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      message: 'S3 upload successful - network volume is accessible for LoRA uploads!',
      networkVolumePath: `/runpod-volume/${testKey}`,
    });

  } catch (error) {
    console.error('❌ S3 upload test failed:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'S3 upload test failed',
        bucket: '83cljmpqfd',
        endpoint: 'https://s3api-us-ks-2.runpod.io',
      },
      { status: 500 }
    );
  }
}
