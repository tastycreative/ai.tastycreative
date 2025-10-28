/**
 * S3 helper for Instagram Staging Tool
 * Provides a simplified interface for browsing and uploading to S3
 * Replaces Google Drive OAuth complexity
 */

export interface S3File {
  id: string;
  name: string;
  url: string;
  key: string;
  size: number;
  lastModified: string;
  mimeType: string;
  isImage: boolean;
  isVideo: boolean;
}

export interface S3Folder {
  name: string;
  prefix: string;
  files: S3File[];
  loading?: boolean;
  error?: string;
}

// Predefined S3 folder structure for Instagram - mirrors workflow statuses
export const S3_FOLDERS: { name: string; prefix: string }[] = [
  { name: "All Generations", prefix: "instagram/" }, // Shows all Instagram staging files
  { name: "IG Posts", prefix: "instagram/posts/" }, // Original upload folder
  { name: "IG Reels", prefix: "instagram/reels/" }, // Original upload folder
  { name: "Misc", prefix: "instagram/misc/" }, // Original upload folder
  { name: "Draft", prefix: "instagram/draft/" }, // Initial status when added to queue
  { name: "Review", prefix: "instagram/review/" }, // Submitted for review
  { name: "Approved", prefix: "instagram/approved/" }, // Approved posts
  { name: "Rejected", prefix: "instagram/rejected/" }, // Rejected posts
  { name: "Scheduled", prefix: "instagram/scheduled/" }, // Scheduled for publishing
  { name: "Published", prefix: "instagram/published/" }, // Published posts
];

// Upload-only folders (excludes "All Generations" which is view-only)
export const S3_UPLOAD_FOLDERS: { name: string; prefix: string }[] = [
  { name: "IG Posts", prefix: "instagram/posts/" },
  { name: "IG Reels", prefix: "instagram/reels/" },
  { name: "Misc", prefix: "instagram/misc/" },
];

/**
 * Load files from an S3 folder
 */
export async function loadS3Folder(prefix: string): Promise<S3File[]> {
  try {
    const response = await fetch(`/api/s3/folders?prefix=${encodeURIComponent(prefix)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to load S3 folder: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error loading S3 folder:', error);
    throw error;
  }
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(file: File, folder: string): Promise<S3File> {
  try {
    console.log('🚀 Starting S3 upload:', { 
      fileName: file.name, 
      size: file.size, 
      type: file.type,
      folder 
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await fetch('/api/s3/upload', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - let browser set it with boundary for FormData
    });

    console.log('📡 Upload response status:', response.status, response.statusText);

    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.error('❌ Server error details:', errorData);
      } catch (e) {
        // Response might not be JSON
        console.error('❌ Could not parse error response');
      }
      throw new Error(`Upload failed: ${errorMessage}`);
    }

    const data = await response.json();
    console.log('✅ Upload successful:', data);
    return data.file;
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    // Provide more context in the error message
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Could not connect to upload endpoint. Please check your connection and try again.');
    }
    throw error;
  }
}

/**
 * Initialize S3 folders (no OAuth needed!)
 */
export function initializeS3Folders(): S3Folder[] {
  return S3_FOLDERS.map(folder => ({
    ...folder,
    files: [],
    loading: false,
  }));
}
