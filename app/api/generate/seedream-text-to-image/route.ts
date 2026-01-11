import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

// BytePlus ModelArk API configuration for SeeDream 4.5
const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_API_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';

// AWS S3 Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

interface SeeDreamRequest {
  prompt: string;
  model?: string;
  size?: string;
  watermark?: boolean;
  negative_prompt?: string;
  sequential_image_generation?: 'auto' | 'disabled';
  sequential_image_generation_options?: {
    max_images?: number;
  };
  response_format?: 'url' | 'b64_json';
  stream?: boolean;
  targetFolder?: string;
}

interface SeeDreamResponse {
  model: string;
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    size?: string;
  }>;
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate API key
    if (!ARK_API_KEY) {
      console.error('❌ Missing ARK API key configuration');
      return NextResponse.json(
        { error: 'SeeDream API configuration missing' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: SeeDreamRequest = await request.json();
    const { 
      prompt, 
      model = 'ep-20260103160511-gxx75',
      size = '2K',
      watermark = false,
      negative_prompt,
      sequential_image_generation = 'disabled',
      sequential_image_generation_options,
      response_format = 'url',
      stream = false
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Starting SeeDream 4.5 generation for user:', userId);
    console.log('📋 Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
    console.log('📐 Size:', size);
    console.log('🎭 Batch mode:', sequential_image_generation);
    console.log('🔢 Batch options:', sequential_image_generation_options);

    // Build request payload
    const payload: any = {
      model,
      prompt: prompt.trim(),
      size,
      watermark,
      response_format,
      stream,
    };

    // Add optional parameters
    if (negative_prompt && negative_prompt.trim()) {
      payload.negative_prompt = negative_prompt.trim();
    }

    if (sequential_image_generation !== 'disabled') {
      payload.sequential_image_generation = sequential_image_generation;
      
      if (sequential_image_generation_options) {
        payload.sequential_image_generation_options = sequential_image_generation_options;
      }
    }

    console.log('📤 Sending request to BytePlus ModelArk API...');
    console.log('📦 Full payload:', JSON.stringify(payload, null, 2));

    // Call BytePlus ModelArk API
    const response = await fetch(ARK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('📥 API Response status:', response.status);

    if (!response.ok) {
      console.error('❌ SeeDream API error:', responseText);
      console.error('❌ Full error response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      let errorMessage = 'Failed to generate images';
      let errorDetails = null;
      
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch (e) {
        // If response is not JSON, use the text
        errorMessage = responseText || errorMessage;
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails 
        },
        { status: response.status }
      );
    }

    const data: SeeDreamResponse = JSON.parse(responseText);
    
    console.log('✅ Generation successful!');
    console.log('📊 Usage:', data.usage);
    console.log('🖼️ Generated images:', data.data.length);

    // Create generation job in database
    const generationJob = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        status: 'COMPLETED',
        type: 'TEXT_TO_IMAGE',
        progress: 100,
        params: {
          source: 'seedream',
          prompt: body.prompt,
          model: body.model || 'ep-20260103160511-gxx75',
          size: body.size,
          watermark: body.watermark,
          negative_prompt: body.negative_prompt,
          targetFolder: body.targetFolder,
        },
      },
    });

    console.log('📝 Created generation job:', generationJob.id);

    // Process and save each generated image
    // FAST MODE: Save BytePlus URLs directly to avoid Lambda timeout (30s limit)
    const savedImages = [];
    
    for (let index = 0; index < data.data.length; index++) {
      const item = data.data[index];
      
      try {
        // Generate filename for reference
        const timestamp = Date.now();
        const filename = `seedream-${timestamp}-${index}.png`;
        
        // Determine subfolder based on folder selection
        let subfolder = '';
        if (body.targetFolder) {
          const parts = body.targetFolder.split('/');
          if (parts.length > 2) {
            subfolder = parts.slice(2).join('/').replace(/\/$/, '');
          }
        }

        // Use BytePlus URL directly (they're temporary but valid for hours)
        const publicUrl = item.url;

        console.log(`✅ Using BytePlus URL directly: ${publicUrl}`);

        // Save to database with BytePlus URL (no S3 upload to avoid timeout)
        const [width, height] = (item.size || body.size || '2048x2048').split('x').map(Number);
        
        const savedImage = await prisma.generatedImage.create({
          data: {
            clerkId: userId,
            jobId: generationJob.id,
            filename,
            subfolder: subfolder,
            type: 'output',
            fileSize: 0, // Unknown size, will be updated if copied to S3 later
            width,
            height,
            format: 'png',
            awsS3Key: '', // Empty for now, will be populated if moved to S3
            awsS3Url: publicUrl, // Store BytePlus URL directly
            metadata: {
              source: 'seedream',
              model: data.model,
              prompt: body.prompt,
              negative_prompt: body.negative_prompt,
              size: body.size,
              watermark: body.watermark,
              byteplusUrl: publicUrl, // Keep original BytePlus URL
              generatedAt: new Date(data.created * 1000).toISOString(),
              pendingS3Upload: true, // Flag for background processing
            },
          },
        });

        console.log(`✅ Saved to database: ${savedImage.id}`);

        savedImages.push({
          id: savedImage.id,
          url: publicUrl,
          size: item.size || body.size,
          prompt: body.prompt,
          model: data.model,
          createdAt: savedImage.createdAt.toISOString(),
        });

      } catch (error: any) {
        console.error(`❌ Error processing image ${index}:`, error);
        // Continue with other images even if one fails
      }
    }

    console.log(`✅ Successfully saved ${savedImages.length}/${data.data.length} images`);

    // Transform response for frontend
    const images = savedImages.length > 0 ? savedImages : data.data.map((item, index) => ({
      id: `${Date.now()}_${index}`,
      url: item.url || `data:image/jpeg;base64,${item.b64_json}`,
      size: item.size,
      prompt,
      model: data.model,
      createdAt: new Date(data.created * 1000).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      images,
      usage: data.usage,
      model: data.model,
    });

  } catch (error: any) {
    console.error('❌ Error in SeeDream generation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for generation history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch recent SeeDream generations from database
    const recentImages = await prisma.generatedImage.findMany({
      where: {
        clerkId: userId,
        job: {
          type: 'TEXT_TO_IMAGE',
          params: {
            path: ['source'],
            equals: 'seedream',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      include: {
        job: {
          select: {
            params: true,
          },
        },
      },
    });

    const images = recentImages.map((img) => ({
      id: img.id,
      imageUrl: img.awsS3Url || '',
      prompt: (img.metadata as any)?.prompt || '',
      modelVersion: (img.metadata as any)?.model || 'SeeDream 4.5',
      size: `${img.width}x${img.height}`,
      createdAt: img.createdAt.toISOString(),
      status: 'completed' as const,
    }));

    return NextResponse.json({
      images,
    });

  } catch (error: any) {
    console.error('❌ Error fetching history:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
