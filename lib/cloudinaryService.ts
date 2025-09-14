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
  original_filename: string;
  format: string;
  resource_type: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
}

export interface UploadOptions {
  folder?: string;
  public_id?: string;
  tags?: string[];
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: object;
}

/**
 * Upload a file buffer to Cloudinary
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  try {
    const uploadOptions = {
      resource_type: 'auto' as const,
      folder: options.folder || 'training-images',
      tags: options.tags || ['training', 'ai-toolkit'],
      ...options,
    };

    console.log(`☁️ Uploading to Cloudinary folder: ${uploadOptions.folder}`);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else if (result) {
            console.log(`✅ Cloudinary upload success: ${result.secure_url}`);
            resolve(result as CloudinaryUploadResult);
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error('❌ Cloudinary service error:', error);
    throw error;
  }
}

/**
 * Upload multiple files to Cloudinary in parallel
 */
export async function uploadMultipleToCloudinary(
  files: Array<{ buffer: Buffer; filename: string; caption?: string }>,
  options: UploadOptions = {}
): Promise<Array<CloudinaryUploadResult & { originalFilename: string; caption?: string }>> {
  try {
    const uploadPromises = files.map(async (file, index) => {
      const fileOptions = {
        ...options,
        public_id: file.filename.replace(/\.[^/.]+$/, '') + '_' + Date.now() + '_' + index,
        tags: [...(options.tags || []), file.caption ? 'captioned' : 'uncaptioned'],
      };

      const result = await uploadToCloudinary(file.buffer, fileOptions);
      
      return {
        ...result,
        originalFilename: file.filename,
        caption: file.caption,
      };
    });

    const results = await Promise.all(uploadPromises);
    console.log(`✅ Successfully uploaded ${results.length} files to Cloudinary`);
    
    return results;
  } catch (error) {
    console.error('❌ Multiple upload error:', error);
    throw error;
  }
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<any> {
  try {
    console.log(`🗑️ Deleting from Cloudinary: ${publicId}`);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`✅ Deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    throw error;
  }
}

/**
 * Get a signed URL for direct uploads from client
 */
export function getCloudinarySignature(
  timestamp: number,
  folder: string = 'training-images'
): { signature: string; timestamp: number; api_key: string; folder: string } {
  const params = {
    timestamp,
    folder,
  };

  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    api_key: process.env.CLOUDINARY_API_KEY!,
    folder,
  };
}

export default cloudinary;
