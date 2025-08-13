import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Simple MIME type detection
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', 
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Join the path segments to get the full file path
    const filePath = params.path.join('/');
    
    // Construct the absolute path to the file
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', filePath);
    
    // Security check - ensure the path is within the uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!absolutePath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Read the file
    const fileBuffer = fs.readFileSync(absolutePath);
    
    // Get the MIME type
    const mimeType = getMimeType(absolutePath);
    
    // Create response with proper headers
    const response = new NextResponse(fileBuffer);
    response.headers.set('Content-Type', mimeType);
    response.headers.set('Cache-Control', 'public, max-age=31536000');
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    response.headers.set('Access-Control-Allow-Headers', '*');
    
    return response;
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
