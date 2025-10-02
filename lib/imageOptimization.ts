import sharp from 'sharp';

export interface ImageOptimizationOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export async function optimizeImageBuffer(
  imageBuffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<Buffer> {
  const {
    quality = 75,
    maxWidth = 1920,
    maxHeight = 1080,
    format = 'jpeg'
  } = options;

  try {
    let pipeline = sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });

    // Apply format-specific optimizations
    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true 
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({ 
          quality,
          effort: 6 
        });
        break;
      case 'png':
        pipeline = pipeline.png({ 
          compressionLevel: 9,
          quality 
        });
        break;
    }

    return await pipeline.toBuffer();
  } catch (error) {
    console.error('❌ Image optimization failed:', error);
    return imageBuffer; // Return original if optimization fails
  }
}

export async function optimizeBase64Image(
  base64Data: string,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  try {
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const optimizedBuffer = await optimizeImageBuffer(imageBuffer, options);
    return optimizedBuffer.toString('base64');
  } catch (error) {
    console.error('❌ Base64 image optimization failed:', error);
    return base64Data; // Return original if optimization fails
  }
}

export function getImageSizeReduction(originalSize: number, optimizedSize: number): {
  reductionBytes: number;
  reductionPercent: number;
} {
  const reductionBytes = originalSize - optimizedSize;
  const reductionPercent = Math.round((reductionBytes / originalSize) * 100);
  
  return {
    reductionBytes,
    reductionPercent
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
