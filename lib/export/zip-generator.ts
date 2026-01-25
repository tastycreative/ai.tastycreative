/**
 * V1a ZIP Generator - Create platform-ready export packages
 *
 * Generates structured ZIP files with content organized by platform,
 * including properly sized images and caption.txt files.
 */

import JSZip from 'jszip';
import { PlatformId, PLATFORM_FOLDER_NAMES } from './platform-specs';

/**
 * Content item to include in the export
 */
export interface ExportContentItem {
  /** Original filename */
  filename: string;
  /** File data as Buffer, Blob, or base64 string */
  data: Buffer | Blob | string;
  /** MIME type */
  mimeType: string;
  /** Caption text (will be written to caption.txt) */
  caption?: string;
  /** Optional metadata to include */
  metadata?: Record<string, unknown>;
}

/**
 * Platform export configuration
 */
export interface PlatformExportConfig {
  platformId: PlatformId;
  /** Content items for this platform (already resized) */
  items: ExportContentItem[];
  /** Optional subfolder within the platform folder */
  subfolder?: string;
}

/**
 * Export package configuration
 */
export interface ExportPackageConfig {
  /** Name for the export (used in ZIP filename and root folder) */
  name: string;
  /** Platform configurations */
  platforms: PlatformExportConfig[];
  /** Include a manifest.json with export details */
  includeManifest?: boolean;
  /** Optional model name for the manifest */
  modelName?: string;
  /** Compression level (0-9, default 6) */
  compressionLevel?: number;
}

/**
 * Export result with ZIP data and metadata
 */
export interface ExportResult {
  /** ZIP file as Blob */
  blob: Blob;
  /** ZIP file as Buffer (for server-side) */
  buffer: Buffer;
  /** Suggested filename */
  filename: string;
  /** Total number of files in the ZIP */
  fileCount: number;
  /** Total uncompressed size in bytes */
  totalSize: number;
  /** Platforms included */
  platforms: PlatformId[];
  /** Manifest data if included */
  manifest?: ExportManifest;
}

/**
 * Manifest structure for export tracking
 */
export interface ExportManifest {
  version: string;
  exportedAt: string;
  exportName: string;
  modelName?: string;
  platforms: {
    platformId: PlatformId;
    folderName: string;
    itemCount: number;
    items: {
      filename: string;
      hasCaption: boolean;
    }[];
  }[];
  totalItems: number;
}

/**
 * Generate a clean filename from the export name
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Get file extension from filename or mime type
 */
function getExtension(filename: string, mimeType?: string): string {
  const fromFilename = filename.split('.').pop()?.toLowerCase();
  if (fromFilename && fromFilename.length <= 4) {
    return fromFilename;
  }

  // Fallback to mime type
  const mimeExtensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  };

  return mimeType ? mimeExtensions[mimeType] || 'bin' : 'bin';
}

/**
 * Convert various data formats to Uint8Array for JSZip
 */
async function toUint8Array(data: Buffer | Blob | string): Promise<Uint8Array> {
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }

  if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // Assume base64 string
  if (typeof data === 'string') {
    // Remove data URL prefix if present
    const base64 = data.replace(/^data:[^;]+;base64,/, '');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error('Unsupported data format');
}

/**
 * Create a manifest for the export
 */
function createManifest(config: ExportPackageConfig): ExportManifest {
  const platforms = config.platforms.map(p => ({
    platformId: p.platformId,
    folderName: PLATFORM_FOLDER_NAMES[p.platformId],
    itemCount: p.items.length,
    items: p.items.map(item => ({
      filename: item.filename,
      hasCaption: !!item.caption,
    })),
  }));

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportName: config.name,
    modelName: config.modelName,
    platforms,
    totalItems: platforms.reduce((sum, p) => sum + p.itemCount, 0),
  };
}

/**
 * Generate a platform-ready export ZIP package
 */
export async function generateExportZip(config: ExportPackageConfig): Promise<ExportResult> {
  const zip = new JSZip();
  const rootFolder = sanitizeFilename(config.name) || 'export';
  const compressionLevel = config.compressionLevel ?? 6;

  let fileCount = 0;
  let totalSize = 0;
  const includedPlatforms: PlatformId[] = [];

  // Create root folder
  const root = zip.folder(rootFolder);
  if (!root) {
    throw new Error('Failed to create root folder in ZIP');
  }

  // Process each platform
  for (const platformConfig of config.platforms) {
    const { platformId, items, subfolder } = platformConfig;

    if (items.length === 0) continue;

    includedPlatforms.push(platformId);
    const platformFolderName = PLATFORM_FOLDER_NAMES[platformId];

    // Create platform folder path
    let platformFolder = root.folder(platformFolderName);
    if (!platformFolder) continue;

    // Add subfolder if specified
    if (subfolder) {
      platformFolder = platformFolder.folder(subfolder);
      if (!platformFolder) continue;
    }

    // Track captions for this platform folder
    const captions: string[] = [];

    // Add each content item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const ext = getExtension(item.filename, item.mimeType);

      // Generate sequential filename: image-001.jpg, image-002.jpg, etc.
      const paddedIndex = String(i + 1).padStart(3, '0');
      const newFilename = `image-${paddedIndex}.${ext}`;

      // Convert and add file data
      const fileData = await toUint8Array(item.data);
      platformFolder.file(newFilename, fileData, {
        compression: 'DEFLATE',
        compressionOptions: { level: compressionLevel },
      });

      fileCount++;
      totalSize += fileData.length;

      // Collect caption
      if (item.caption) {
        captions.push(`[${newFilename}]\n${item.caption}`);
      }
    }

    // Add combined caption.txt file for this platform
    if (captions.length > 0) {
      const captionContent = captions.join('\n\n---\n\n');
      const header = `Captions for ${platformFolderName}\nExported: ${new Date().toLocaleString()}\nTotal items: ${items.length}\n${'='.repeat(50)}\n\n`;
      platformFolder.file('captions.txt', header + captionContent);
      fileCount++;
    }
  }

  // Add manifest if requested
  let manifest: ExportManifest | undefined;
  if (config.includeManifest) {
    manifest = createManifest(config);
    root.file('manifest.json', JSON.stringify(manifest, null, 2));
    fileCount++;
  }

  // Add a README
  const readmeContent = `# ${config.name} Export

Exported: ${new Date().toLocaleString()}
${config.modelName ? `Model: ${config.modelName}` : ''}

## Contents

${includedPlatforms.map(p => `- ${PLATFORM_FOLDER_NAMES[p]}/`).join('\n')}

## Usage

Each platform folder contains:
- Resized images optimized for that platform
- captions.txt with suggested captions for each image

---
Generated by Tastyy.AI Platform Export
`;

  root.file('README.txt', readmeContent);
  fileCount++;

  // Generate the ZIP
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${rootFolder}-${timestamp}.zip`;

  return {
    blob,
    buffer,
    filename,
    fileCount,
    totalSize,
    platforms: includedPlatforms,
    manifest,
  };
}

/**
 * Generate a simple ZIP with files (no platform organization)
 */
export async function generateSimpleZip(
  files: { filename: string; data: Buffer | Blob | string }[],
  zipName: string = 'export'
): Promise<{ blob: Blob; buffer: Buffer; filename: string }> {
  const zip = new JSZip();

  for (const file of files) {
    const fileData = await toUint8Array(file.data);
    zip.file(file.filename, fileData);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
  });

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `${sanitizeFilename(zipName)}.zip`;

  return { blob, buffer, filename };
}

/**
 * Add files to an existing JSZip instance (for streaming/chunked exports)
 */
export function createZipBuilder() {
  const zip = new JSZip();
  let fileCount = 0;

  return {
    /**
     * Add a file to the ZIP
     */
    async addFile(path: string, data: Buffer | Blob | string) {
      const fileData = await toUint8Array(data);
      zip.file(path, fileData);
      fileCount++;
    },

    /**
     * Add a folder
     */
    addFolder(path: string) {
      return zip.folder(path);
    },

    /**
     * Generate the final ZIP
     */
    async generate(): Promise<{ blob: Blob; buffer: Buffer; fileCount: number }> {
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
      });
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { blob, buffer, fileCount };
    },

    /**
     * Get current file count
     */
    getFileCount() {
      return fileCount;
    },
  };
}
