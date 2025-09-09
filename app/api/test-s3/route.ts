import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const RUNPOD_S3_ENDPOINT = 'https://s3api-us-ks-2.runpod.io';
const RUNPOD_BUCKET_NAME = '83cljmpqfd';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      return NextResponse.json({ error: 'S3 credentials not configured' }, { status: 500 });
    }

    console.log('🔑 Testing S3 connection with bucket 83cljmpqfd...');

    // Try different S3 client configurations for RunPod
    const configs = [
      {
        name: 'Virtual Hosted Style',
        config: {
          region: 'us-ks-2',
          endpoint: 'https://s3api-us-ks-2.runpod.io',
          credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
          },
          forcePathStyle: false, // Try virtual hosted style
        }
      },
      {
        name: 'Path Style (original)',
        config: {
          region: 'us-ks-2',
          endpoint: 'https://s3api-us-ks-2.runpod.io',
          credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
          },
          forcePathStyle: true,
        }
      },
      {
        name: 'Direct Bucket Endpoint',
        config: {
          region: 'us-ks-2',
          endpoint: 'https://83cljmpqfd.s3api-us-ks-2.runpod.io',
          credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
          },
          forcePathStyle: false,
        }
      },
      {
        name: 'Root Only Access',
        config: {
          region: 'us-ks-2',
          endpoint: 'https://s3api-us-ks-2.runpod.io',
          credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
          },
          forcePathStyle: true,
          useAccelerateEndpoint: false,
          useDualstackEndpoint: false,
          maxAttempts: 1,
        }
      }
    ];

    for (const { name, config } of configs) {
      try {
        console.log(`🧪 Testing ${name}...`);
        
        const s3Client = new S3Client(config);
        
        // Test with a simple list command, limiting to root only
        const listCommand = new ListObjectsV2Command({
          Bucket: '83cljmpqfd',
          MaxKeys: 1,
          Delimiter: '/', // Only get root level items
        });

        const result = await s3Client.send(listCommand);
        
        console.log(`✅ ${name} succeeded!`);

        return NextResponse.json({
          success: true,
          working_config: name,
          bucket: '83cljmpqfd',
          endpoint: 'https://s3api-us-ks-2.runpod.io',
          objects_found: result.Contents?.length || 0,
          prefixes_found: result.CommonPrefixes?.length || 0,
          root_objects: result.Contents?.map(obj => obj.Key) || [],
          root_prefixes: result.CommonPrefixes?.map(p => p.Prefix) || [],
          message: 'S3 connection successful - ready for LoRA uploads'
        });

      } catch (error) {
        console.log(`❌ ${name} failed:`, error instanceof Error ? error.message : error);
      }
    }

    return NextResponse.json({
      success: false,
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      bucket: '83cljmpqfd',
      message: 'All S3 configurations failed',
      next_step: 'May need to check bucket permissions or try a different approach'
    }, { status: 500 });

  } catch (error) {
    console.error('❌ S3 connection test failed:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'S3 connection failed',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
