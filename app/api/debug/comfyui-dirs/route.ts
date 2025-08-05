// app/api/debug/comfyui-dirs/route.ts - Debug ComfyUI directory access
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('=== COMFYUI DIRECTORY DEBUG ===');

    // Check possible ComfyUI directories
    const possibleDirs = [
      process.env.COMFYUI_INPUT_DIR,
      '../ComfyUI/input',
      './ComfyUI/input',
      '/app/ComfyUI/input',
      '/ComfyUI/input',
      process.env.HOME + '/ComfyUI/input',
      // Additional common paths
      '../comfyui/input',
      './comfyui/input',
      process.env.PWD + '/../ComfyUI/input',
      process.cwd() + '/../ComfyUI/input'
    ].filter(Boolean);

    const dirStatus = [];

    for (const dir of possibleDirs) {
      try {
        const exists = existsSync(dir!);
        let files: string[] = [];
        let isWritable = false;

        if (exists) {
          try {
            files = readdirSync(dir!).slice(0, 5); // First 5 files
            const stats = statSync(dir!);
            isWritable = stats.isDirectory();
          } catch (readError) {
            console.log('Cannot read directory:', dir, readError);
          }
        }

        dirStatus.push({
          path: dir,
          exists,
          isWritable,
          fileCount: exists ? files.length : 0,
          sampleFiles: files,
          absolutePath: exists ? path.resolve(dir!) : null
        });
      } catch (error) {
        dirStatus.push({
          path: dir,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Check current working directory and nearby paths
    const currentDir = process.cwd();
    const parentDir = path.dirname(currentDir);
    
    const systemInfo = {
      currentWorkingDir: currentDir,
      parentDir,
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      homeDir: process.env.HOME,
      pwdEnv: process.env.PWD
    };

    // Check our upload directory
    const uploadDir = process.env.UPLOAD_DIR || './public/uploads';
    const uploadDirStatus = {
      path: uploadDir,
      exists: existsSync(uploadDir),
      absolutePath: existsSync(uploadDir) ? path.resolve(uploadDir) : null,
      files: existsSync(uploadDir) ? readdirSync(uploadDir).slice(0, 10) : []
    };

    return NextResponse.json({
      success: true,
      systemInfo,
      uploadDirStatus,
      possibleComfyUIDirs: dirStatus,
      recommendations: [
        'If no ComfyUI directory found, create symlink: ln -s /path/to/ComfyUI/input ./comfyui/input',
        'Or set COMFYUI_INPUT_DIR environment variable',
        'Or copy files manually to ComfyUI input directory',
        'Check ComfyUI is running and accessible'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: 'Debug failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}