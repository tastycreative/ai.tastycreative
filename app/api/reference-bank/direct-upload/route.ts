import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";
import crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, fileName, fileType, width, height } = body;

    if (!imageUrl || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch the image directly from Instagram with bypass headers
    console.log("Fetching image from Instagram:", imageUrl);
    
    // Try multiple strategies to fetch the image
    const bypassStrategies: { name: string; headers: Record<string, string> }[] = [
      {
        name: "Facebook Bot",
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        }
      },
      {
        name: "Instagram App",
        headers: {
          "User-Agent": "Instagram 219.0.0.12.117 Android (26/8.0.0; 480dpi; 1080x1920; samsung; SM-G960F; starlte; samsungexynos9810; en_US; 346138365)",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          "X-IG-App-ID": "936619743392459",
        }
      },
      {
        name: "Chrome Desktop",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.instagram.com/",
        }
      },
    ];

    let imageBuffer: Buffer | null = null;
    let lastError: Error | null = null;

    for (const strategy of bypassStrategies) {
      try {
        console.log(`Trying ${strategy.name} strategy...`);
        const response = await fetch(imageUrl, {
          headers: strategy.headers,
          redirect: "follow",
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType?.startsWith("image/")) {
            imageBuffer = Buffer.from(await response.arrayBuffer());
            if (imageBuffer.length > 0) {
              console.log(`✅ ${strategy.name} strategy succeeded: ${imageBuffer.length} bytes`);
              break;
            }
          }
        }
        console.log(`❌ ${strategy.name} strategy failed: ${response.status}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.log(`❌ ${strategy.name} strategy error:`, lastError.message);
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error(`Failed to fetch image from Instagram after trying all strategies. Last error: ${lastError?.message || "Unknown"}`);
    }

    const fileSize = imageBuffer.length;

    console.log(`Image fetched: ${fileSize} bytes`);

    // Generate unique S3 key
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `reference-bank/${userId}/${timestamp}-${randomString}-${sanitizedFileName}`;

    // Upload directly to S3
    console.log("Uploading to S3:", s3Key);
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: fileType || "image/jpeg",
      CacheControl: "max-age=31536000",
    });

    await s3Client.send(uploadCommand);

    // Generate S3 URL
    const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log("S3 URL:", s3Url);

    // Create reference bank item in database using Prisma
    const newItem = await prisma.reference_items.create({
      data: {
        clerkId: userId,
        name: fileName,
        description: "Imported from Instagram",
        fileType: fileType || "image/jpeg",
        mimeType: fileType || "image/jpeg",
        fileSize,
        width: width || null,
        height: height || null,
        duration: null,
        awsS3Key: s3Key,
        awsS3Url: s3Url,
        thumbnailUrl: s3Url,
        tags: ["instagram"],
        usageCount: 0,
        lastUsedAt: null,
        isFavorite: false,
        folderId: null,
      },
    });

    console.log("Reference bank item created:", newItem.id);

    return NextResponse.json({
      success: true,
      item: newItem,
    });
  } catch (error) {
    console.error("Error in direct upload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
