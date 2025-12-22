import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const targetFilename = 'ComfyUI_00003_.png';
    
    const image = await prisma.generatedImage.findFirst({
      where: {
        filename: targetFilename
      },
      select: {
        id: true,
        filename: true,
        data: true,
        fileSize: true,
        createdAt: true
      }
    });

    if (!image) {
      return NextResponse.json({
        error: 'Image not found',
        filename: targetFilename
      });
    }

    return NextResponse.json({
      success: true,
      filename: targetFilename,
      id: image.id,
      hasData: !!image.data,
      dataSize: image.data ? image.data.length : 0,
      fileSize: image.fileSize,
      createdAt: image.createdAt
    });

  } catch (error) {
    console.error('Error checking image data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
