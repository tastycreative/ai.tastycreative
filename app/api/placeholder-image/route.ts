import { NextResponse } from 'next/server';

// Simple 1x1 transparent PNG as placeholder
export async function GET() {
  // 1x1 transparent PNG base64
  const transparentPNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );

  return new NextResponse(transparentPNG, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
