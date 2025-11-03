import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative';

/**
 * POST /api/s3/folders/create
 * Create a new custom folder in user's S3 storage
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { folderName } = body;

    // Validate folder name
    if (!folderName || typeof folderName !== 'string') {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    const trimmedName = folderName.trim();
    
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: 'Folder name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: 'Folder name must be less than 50 characters' },
        { status: 400 }
      );
    }

    // Validate folder name format (only allow safe characters)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      return NextResponse.json(
        { error: 'Folder name can only contain letters, numbers, spaces, hyphens, and underscores' },
        { status: 400 }
      );
    }

    // Convert folder name to S3-safe format
    const safeFolderName = trimmedName
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9\-_]/g, ''); // Remove any other special characters

    // Create folder path: outputs/{userId}/{safeFolderName}/
    const folderPrefix = `outputs/${userId}/${safeFolderName}/`;

    console.log('📁 Creating new folder for user:', userId);
    console.log('📝 Folder name:', trimmedName);
    console.log('🔑 S3 prefix:', folderPrefix);

    // Create a placeholder object to establish the folder in S3
    // S3 doesn't have actual folders, but we create an empty object to represent it
    const placeholderKey = `${folderPrefix}.folderinfo`;
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: placeholderKey,
      Body: JSON.stringify({
        createdBy: userId,
        createdAt: new Date().toISOString(),
        folderName: trimmedName,
        folderType: 'custom',
      }),
      ContentType: 'application/json',
      Metadata: {
        userId: userId,
        folderName: trimmedName,
        createdAt: new Date().toISOString(),
      },
    });

    await s3Client.send(putCommand);

    console.log('✅ Folder created successfully in S3');

    // Optionally: Store folder metadata in database for faster retrieval
    try {
      // Check if your schema has a UserFolder or similar table
      // If not, you can skip this part or create a new table
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });

      if (user) {
        // You could store custom folder preferences in user metadata
        // or create a separate table for user folders
        console.log('✅ User found:', user.id);
      }
    } catch (dbError) {
      // Database operation is optional - folder is already created in S3
      console.warn('⚠️ Could not store folder metadata in database:', dbError);
    }

    return NextResponse.json({
      success: true,
      folderName: trimmedName,
      folderPrefix: `outputs/${userId}/${safeFolderName}/`,
      s3Key: placeholderKey,
      message: 'Folder created successfully',
    });

  } catch (error) {
    console.error('❌ Error creating folder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create folder' },
      { status: 500 }
    );
  }
}
