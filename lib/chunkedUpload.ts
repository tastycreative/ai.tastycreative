// lib/chunkedUpload.ts - Chunked upload utility for large files
export interface ChunkUploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  currentChunk?: number;
  totalChunks?: number;
}

export interface ChunkedUploadOptions {
  chunkSize?: number; // Default 4MB (under Vercel's 4.5MB limit)
  onProgress?: (progress: ChunkUploadProgress) => void;
}

export class ChunkedUploader {
  private readonly chunkSize: number;
  
  constructor(options: ChunkedUploadOptions = {}) {
    this.chunkSize = options.chunkSize || 4 * 1024 * 1024; // 4MB chunks
  }

  async uploadFile(
    file: File, 
    metadata: { displayName: string; description?: string },
    onProgress?: (progress: ChunkUploadProgress) => void
  ): Promise<any> {
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    console.log(`📦 Starting chunked upload: ${file.name} (${file.size} bytes, ${totalChunks} chunks)`);

    // Start upload session
    try {
      const initResponse = await fetch('/api/models/upload-chunked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'init',
          sessionId,
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
          metadata
        })
      });

      if (!initResponse.ok) {
        const error = await initResponse.text();
        throw new Error(`Failed to initialize upload: ${error}`);
      }

      console.log(`✅ Upload session initialized: ${sessionId}`);

      // Upload chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        
        onProgress?.({
          fileName: file.name,
          progress,
          status: 'uploading',
          currentChunk: chunkIndex + 1,
          totalChunks
        });

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('sessionId', sessionId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('chunk', chunk);

        const chunkResponse = await fetch('/api/models/upload-chunked', {
          method: 'POST',
          body: formData
        });

        if (!chunkResponse.ok) {
          const error = await chunkResponse.text();
          throw new Error(`Failed to upload chunk ${chunkIndex + 1}: ${error}`);
        }

        const result = await chunkResponse.json();
        
        // If this was the final chunk, return the result
        if (result.uploadComplete) {
          onProgress?.({
            fileName: file.name,
            progress: 100,
            status: 'completed'
          });
          
          console.log(`🎉 Chunked upload completed: ${file.name}`);
          return result;
        }
      }
      
    } catch (error) {
      console.error('💥 Chunked upload failed:', error);
      onProgress?.({
        fileName: file.name,
        progress: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed'
      });
      throw error;
    }
  }
}
