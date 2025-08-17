// app/api/models/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';
import { PrismaClient } from '@/lib/generated/prisma';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const loraId = formData.get('loraId') as string;

    if (!file || !loraId) {
      return NextResponse.json({ 
        error: 'Missing file or loraId' 
      }, { status: 400 });
    }

    // Verify the LoRA belongs to the user
    const lora = await prisma.influencerLoRA.findFirst({
      where: {
        id: loraId,
        clerkId: userId
      }
    });

    if (!lora) {
      return NextResponse.json({ 
        error: 'LoRA not found or unauthorized' 
      }, { status: 404 });
    }

    console.log(`📁 Uploading model file for LoRA: ${lora.name} (${loraId})`);

    // Validate file type
    if (!file.name.endsWith('.safetensors')) {
      return NextResponse.json({ 
        error: 'Only .safetensors files are allowed' 
      }, { status: 400 });
    }

    // Create models directory
    const modelsDir = path.join(process.cwd(), 'public', 'models');
    const userModelsDir = path.join(modelsDir, userId);
    
    await fs.mkdir(modelsDir, { recursive: true });
    await fs.mkdir(userModelsDir, { recursive: true });

    // Save file
    const fileName = lora.fileName;
    const filePath = path.join(userModelsDir, fileName);
    
    const buffer = await file.arrayBuffer();
    await fs.writeFile(filePath, new Uint8Array(buffer));

    // Update LoRA record
    await prisma.influencerLoRA.update({
      where: { id: loraId },
      data: {
        fileSize: file.size,
        syncStatus: 'SYNCED',
        isActive: true,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Model uploaded successfully: ${fileName} (${file.size} bytes)`);

    return NextResponse.json({
      success: true,
      message: 'Model uploaded successfully',
      lora: {
        id: lora.id,
        name: lora.name,
        fileName: fileName,
        fileSize: file.size,
        isActive: true
      },
      filePath: `/models/${userId}/${fileName}`
    });

  } catch (error) {
    console.error('❌ Error uploading model:', error);
    return NextResponse.json({
      error: 'Failed to upload model',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
