import { NextResponse } from 'next/server';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

export interface ResponseCompressionOptions {
  enableCompression?: boolean;
  cacheControl?: string;
  additionalHeaders?: Record<string, string>;
}

export async function createCompressedResponse(
  data: any,
  options: ResponseCompressionOptions = {}
): Promise<NextResponse> {
  const {
    enableCompression = true,
    cacheControl = 'no-cache',
    additionalHeaders = {}
  } = options;

  const headers = new Headers();
  
  // Set cache control
  headers.set('Cache-Control', cacheControl);
  
  // Add additional headers
  Object.entries(additionalHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // Create JSON response
  const jsonString = JSON.stringify(data);
  
  if (enableCompression && jsonString.length > 1024) { // Only compress if > 1KB
    try {
      // Compress the response
      const compressedData = await gzipAsync(Buffer.from(jsonString, 'utf8'));
      
      // Set compression headers
      headers.set('Content-Encoding', 'gzip');
      headers.set('Vary', 'Accept-Encoding');
      headers.set('Content-Type', 'application/json');
      
      console.log(`🗜️ Response compressed: ${jsonString.length} → ${compressedData.length} bytes (${Math.round(((jsonString.length - compressedData.length) / jsonString.length) * 100)}% reduction)`);
      
      return new NextResponse(new Uint8Array(compressedData), {
        status: 200,
        headers
      });
    } catch (compressionError) {
      console.warn('⚠️ Response compression failed:', compressionError);
      // Fall back to uncompressed response
    }
  }

  // Return uncompressed response
  headers.set('Content-Type', 'application/json');
  return new NextResponse(jsonString, {
    status: 200,
    headers
  });
}

export function createErrorResponse(
  error: string,
  status: number = 500,
  options: ResponseCompressionOptions = {}
): NextResponse {
  const errorData = { error };
  const headers = new Headers();
  
  // Set basic headers
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-cache');
  
  // Add additional headers
  Object.entries(options.additionalHeaders || {}).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return NextResponse.json(errorData, {
    status,
    headers
  });
}

export function formatDataSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}