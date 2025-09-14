import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export class CloudinaryService {
  /**
   * Upload an image buffer to Cloudinary
   */
  static async uploadImage(
    buffer: Buffer,
    options: {
      filename?: string;
      folder?: string;
      public_id?: string;
      transformation?: any;
    } = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      return new Promise((resolve, reject) => {
        const uploadOptions = {
          resource_type: 'image' as const,
          folder: options.folder || 'training-images',
          public_id: options.public_id,
          transformation: options.transformation,
          overwrite: true,
          invalidate: true,
        };

        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              reject(error);
            } else if (result) {
              console.log('✅ Cloudinary upload successful:', result.secure_url);
              resolve(result as CloudinaryUploadResult);
            } else {
              reject(new Error('Upload failed - no result'));
            }
          }
        ).end(buffer);
      });
    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload multiple images to Cloudinary
   */
  static async uploadMultipleImages(
    images: Array<{
      buffer: Buffer;
      filename: string;
      caption?: string;
    }>,
    options: {
      folder?: string;
      transformation?: any;
    } = {}
  ): Promise<Array<{
    originalFilename: string;
    cloudinaryUrl: string;
    cloudinaryPublicId: string;
    caption?: string;
    width: number;
    height: number;
    bytes: number;
  }>> {
    const uploadPromises = images.map(async (image, index) => {
      try {
        // Generate a unique public_id for the image
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const originalName = image.filename.replace(/\.[^/.]+$/, ''); // Remove extension
        const public_id = `${originalName}_${timestamp}_${randomSuffix}`;

        const result = await CloudinaryService.uploadImage(image.buffer, {
          folder: options.folder,
          public_id: public_id,
          transformation: options.transformation,
        });

        return {
          originalFilename: image.filename,
          cloudinaryUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          caption: image.caption,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        };
      } catch (error) {
        console.error(`❌ Failed to upload image ${index + 1}:`, error);
        throw new Error(`Failed to upload image ${image.filename}: ${error}`);
      }
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Delete an image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('🗑️ Cloudinary delete result:', result);
    } catch (error) {
      console.error('❌ Failed to delete from Cloudinary:', error);
      throw error;
    }
  }
}

export default CloudinaryService;