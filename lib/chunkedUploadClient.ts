// lib/chunkedUploadClient.ts - Client-side chunked upload utility
export interface ChunkUploadOptions {
  file: File;
  displayName?: string;
  chunkSize?: number;
  onProgress?: (progress: number, currentChunk: number, totalChunks: number) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onError?: (error: Error) => void;
}

export interface ChunkUploadResult {
  success: boolean;
  influencer?: any;
  error?: string;
}

export class ChunkedUploadClient {
  private apiClient: any;

  constructor(apiClient: any) {
    this.apiClient = apiClient;
  }

  async uploadFile(options: ChunkUploadOptions): Promise<ChunkUploadResult> {
    const {
      file,
      displayName,
      chunkSize = 4 * 1024 * 1024, // 4MB chunks
      onProgress,
      onChunkComplete,
      onError
    } = options;

    try {
      console.log(`📦 Starting chunked upload for ${file.name} (${file.size} bytes)`);
      console.log(`🔧 Using chunk size: ${chunkSize} bytes`);

      // Calculate number of chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`📊 File will be split into ${totalChunks} chunks`);

      // Upload each chunk
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        console.log(`📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunk.size} bytes)`);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        formData.append('displayName', displayName || file.name.replace(/\.[^/.]+$/, ''));
        formData.append('uploadId', uploadId);

        const response = await this.apiClient.postFormData('/api/user/influencers/upload-chunked', formData);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Chunk ${chunkIndex + 1} failed: ${errorData.error}`);
        }

        const chunkResult = await response.json();

        if (onChunkComplete) {
          onChunkComplete(chunkIndex, totalChunks);
        }

        if (onProgress) {
          onProgress(chunkResult.progress || ((chunkIndex + 1) / totalChunks * 100), chunkIndex + 1, totalChunks);
        }

        // If this was the last chunk and upload is complete
        if (chunkResult.isComplete) {
          console.log('✅ Chunked upload completed successfully');
          return {
            success: true,
            influencer: chunkResult.influencer
          };
        }
      }

      throw new Error('Upload completed but no completion response received');

    } catch (error) {
      console.error('❌ Chunked upload failed:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  // Helper method to estimate upload time
  static estimateUploadTime(fileSize: number, chunkSize: number = 4 * 1024 * 1024): string {
    const chunks = Math.ceil(fileSize / chunkSize);
    const estimatedSeconds = chunks * 2; // Assume 2 seconds per chunk
    
    if (estimatedSeconds < 60) {
      return `${estimatedSeconds} seconds`;
    } else if (estimatedSeconds < 3600) {
      return `${Math.round(estimatedSeconds / 60)} minutes`;
    } else {
      return `${Math.round(estimatedSeconds / 3600)} hours`;
    }
  }

  // Helper method to format progress
  static formatProgress(progress: number, currentChunk: number, totalChunks: number): string {
    return `Uploading chunk ${currentChunk}/${totalChunks} (${Math.round(progress)}%)`;
  }
}
