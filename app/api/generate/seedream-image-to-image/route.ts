import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

const BYTEPLUSES_API_KEY = process.env.ARK_API_KEY!;
const BYTEPLUSES_API_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations";

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

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      prompt,
      model = "ep-20260103160511-gxx75",
      image, // Can be a single string or array of strings
      watermark = false,
      sequential_image_generation = "disabled",
      sequential_image_generation_options,
      size = "2048x2048",
      targetFolder,
      // Vault folder support
      saveToVault,
      vaultProfileId,
      vaultFolderId,
    } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    // Prepare BytePlus API request payload
    const payload: any = {
      model,
      prompt,
      image, // Pass as-is (single string or array)
      watermark,
      size,
    };

    // Log image count if array
    if (Array.isArray(image)) {
      console.log(`Processing ${image.length} images (1 primary + ${image.length - 1} reference)`);
    }

    // Add sequential image generation config if batch size > 1
    if (sequential_image_generation && sequential_image_generation !== "disabled") {
      payload.sequential_image_generation = sequential_image_generation;
      
      if (sequential_image_generation_options) {
        payload.sequential_image_generation_options = sequential_image_generation_options;
        console.log("Batch generation enabled:", {
          mode: sequential_image_generation,
          options: sequential_image_generation_options,
        });
      }
    }

    console.log("Sending Image-to-Image request to BytePlus API with payload:", JSON.stringify(payload, null, 2));

    // Call BytePlus API
    const response = await fetch(BYTEPLUSES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BYTEPLUSES_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("BytePlus API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        fullResponse: errorText
      });
      return NextResponse.json(
        { 
          error: errorData.message || errorData.error || "Image generation failed",
          details: errorData 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("BytePlus API response:", {
      numImages: data.data?.length || 0,
      hasImages: !!data.data,
    });

    // Create generation job in database
    const generationJob = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        status: 'COMPLETED',
        type: 'IMAGE_TO_IMAGE',
        progress: 100,
        params: {
          source: 'seedream-i2i',
          prompt: body.prompt,
          model: body.model || 'ep-20260103160511-gxx75',
          size: body.size,
          watermark: body.watermark,
          targetFolder: body.targetFolder,
          numReferenceImages: Array.isArray(image) ? image.length : 1,
          saveToVault: body.saveToVault,
          vaultProfileId: body.vaultProfileId,
          vaultFolderId: body.vaultFolderId,
        },
      },
    });

    console.log('📝 Created generation job:', generationJob.id);

    // Check if saving to vault - verify folder exists and user has access
    let vaultFolder = null;
    if (saveToVault && vaultProfileId && vaultFolderId) {
      vaultFolder = await prisma.vaultFolder.findFirst({
        where: {
          id: vaultFolderId,
          clerkId: userId,
          profileId: vaultProfileId,
        },
      });

      if (!vaultFolder) {
        console.error('❌ Vault folder not found or access denied');
        return NextResponse.json(
          { error: 'Vault folder not found or access denied' },
          { status: 404 }
        );
      }
      console.log('📂 Saving to vault folder:', vaultFolder.name);
    }

    // Process and save each generated image
    const savedImages = [];
    
    for (let index = 0; index < data.data.length; index++) {
      const item = data.data[index];
      
      try {
        // Get image data (either from URL or base64)
        let imageBuffer: Buffer;
        
        if (item.url) {
          // Download from URL
          console.log(`📥 Downloading image ${index + 1} from URL...`);
          const imageResponse = await fetch(item.url);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        } else if (item.b64_json) {
          // Decode base64
          console.log(`📥 Decoding base64 image ${index + 1}...`);
          imageBuffer = Buffer.from(item.b64_json, 'base64');
        } else {
          console.error('❌ No image data found for index:', index);
          continue;
        }

        // Generate filename
        const timestamp = Date.now();
        const filename = `seedream-i2i-${timestamp}-${index}.png`;
        
        // Determine S3 key based on storage type (vault vs regular S3)
        let s3Key: string;
        let subfolder = '';
        let publicUrl: string;
        
        if (saveToVault && vaultProfileId && vaultFolderId) {
          // Save to vault storage: vault/{clerkId}/{profileId}/{folderId}/{fileName}
          s3Key = `vault/${userId}/${vaultProfileId}/${vaultFolderId}/${filename}`;
          console.log(`📤 Uploading to Vault S3: ${s3Key}`);
        } else if (body.targetFolder) {
          // Use selected folder (already includes outputs/{userId}/ prefix)
          s3Key = `${body.targetFolder.replace(/\/$/, '')}/${filename}`;
          // Extract subfolder name from prefix for database
          const parts = body.targetFolder.split('/');
          if (parts.length > 2) {
            subfolder = parts.slice(2).join('/').replace(/\/$/, '');
          }
        } else {
          // Use default: outputs/{userId}/{filename}
          s3Key = `outputs/${userId}/${filename}`;
        }

        console.log(`📤 Uploading to S3: ${s3Key}`);

        // Upload to AWS S3
        const uploadCommand = new PutObjectCommand({
          Bucket: AWS_S3_BUCKET,
          Key: s3Key,
          Body: imageBuffer,
          ContentType: 'image/png',
          CacheControl: 'public, max-age=31536000',
        });

        await s3Client.send(uploadCommand);

        // Generate public URL
        publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

        console.log(`✅ Image uploaded: ${publicUrl}`);

        // Save to database - different handling for vault vs regular
        const [width, height] = (item.size || body.size || '2048x2048').split('x').map(Number);
        
        if (saveToVault && vaultProfileId && vaultFolderId) {
          // Save to vault database
          const vaultItem = await prisma.vaultItem.create({
            data: {
              clerkId: userId,
              profileId: vaultProfileId,
              folderId: vaultFolderId,
              fileName: filename,
              fileType: 'image/png',
              fileSize: imageBuffer.length,
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
            },
          });

          console.log(`✅ Saved to vault database: ${vaultItem.id}`);

          savedImages.push({
            id: vaultItem.id,
            url: publicUrl,
            size: item.size || body.size,
            prompt: body.prompt,
            model: data.model,
            createdAt: vaultItem.createdAt.toISOString(),
            savedToVault: true,
          });
        } else {
          // Save to regular generated images database
          const savedImage = await prisma.generatedImage.create({
            data: {
              clerkId: userId,
              jobId: generationJob.id,
              filename,
              subfolder: subfolder,
              type: 'output',
              fileSize: imageBuffer.length,
              width,
              height,
              format: 'png',
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
              metadata: {
                source: 'seedream-i2i',
                model: data.model,
                prompt: body.prompt,
                size: body.size,
                watermark: body.watermark,
                numReferenceImages: Array.isArray(image) ? image.length : 1,
                generatedAt: new Date().toISOString(),
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
        }

      } catch (error: any) {
        console.error(`❌ Error processing image ${index}:`, error);
        // Continue with other images even if one fails
      }
    }

    console.log(`✅ Successfully saved ${savedImages.length}/${data.data.length} images`);

    // Extract images from response
    const images = savedImages.length > 0 ? savedImages : data.data?.map((item: any) => ({
      url: item.url,
      b64_json: item.b64_json,
      size: size,
    })) || [];

    return NextResponse.json({
      success: true,
      images,
      metadata: {
        model,
        size,
        prompt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Image-to-Image generation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint for fetching generation history
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch recent SeeDream Image-to-Image generations from database
    const recentImages = await prisma.generatedImage.findMany({
      where: {
        clerkId: userId,
        job: {
          type: 'IMAGE_TO_IMAGE',
          params: {
            path: ['source'],
            equals: 'seedream-i2i',
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

    return NextResponse.json({ images });
  } catch (error: any) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
