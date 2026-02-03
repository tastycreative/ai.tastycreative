/**
 * Reference Bank API Service
 * Centralized API calls with proper error handling, retry logic, and caching
 */

import SparkMD5 from "spark-md5";

// Types
export interface ReferenceItem {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  fileType: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  awsS3Key: string;
  awsS3Url: string;
  thumbnailUrl: string | null;
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
  isFavorite: boolean;
  folderId: string | null;
  fileHash?: string | null;
  folder?: {
    id: string;
    name: string;
    color: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceFolder {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  parentId: string | null;
  sortBy?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

export interface Stats {
  total: number;
  favorites: number;
  unfiled: number;
  images: number;
  videos: number;
  storageUsed?: number;
  storageLimit?: number;
}

export interface FetchDataParams {
  folderId?: string | null;
  favorites?: boolean;
  fileType?: "all" | "image" | "video";
  search?: string;
  recentlyUsed?: boolean;
  limit?: number;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  description: string;
  tags: string[];
  folderId: string | null;
  status: "pending" | "uploading" | "success" | "error" | "duplicate";
  progress: number;
  error?: string;
  hash?: string;
  retryCount: number;
}

// API Error class
export class APIError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
  }
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Helper: Sleep function
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Fetch with retry
async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || `Request failed with status ${response.status}`,
          response.status,
          errorData.code
        );
      }

      return response.json();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (client errors)
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Wait before retry
      if (attempt < retries) {
        await sleep(RETRY_DELAY * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error("Request failed after retries");
}

// Calculate file hash for duplicate detection
export async function calculateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer();
    const chunkSize = 2097152; // 2MB chunks
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;

    const reader = new FileReader();

    reader.onload = (e) => {
      spark.append(e.target?.result as ArrayBuffer);
      currentChunk++;

      if (currentChunk < chunks) {
        loadNext();
      } else {
        resolve(spark.end());
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));

    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      reader.readAsArrayBuffer(file.slice(start, end));
    }

    loadNext();
  });
}

// API Functions
export const referenceBankAPI = {
  // Fetch reference items and folders
  async fetchData(params: FetchDataParams = {}): Promise<{
    items: ReferenceItem[];
    folders: ReferenceFolder[];
    stats: Stats;
  }> {
    const searchParams = new URLSearchParams();

    if (params.folderId === "root") {
      searchParams.set("folderId", "root");
    } else if (params.folderId) {
      searchParams.set("folderId", params.folderId);
    }

    if (params.favorites) {
      searchParams.set("favorites", "true");
    }

    if (params.fileType && params.fileType !== "all") {
      searchParams.set("fileType", params.fileType);
    }

    if (params.search) {
      searchParams.set("search", params.search);
    }

    if (params.recentlyUsed) {
      searchParams.set("recentlyUsed", "true");
      searchParams.set("limit", String(params.limit || 10));
    }

    return fetchWithRetry<{
      items: ReferenceItem[];
      folders: ReferenceFolder[];
      stats: Stats;
    }>(`/api/reference-bank?${searchParams.toString()}`);
  },

  // Check for duplicate by hash
  async checkDuplicate(hash: string): Promise<{ exists: boolean; item?: ReferenceItem }> {
    try {
      return await fetchWithRetry<{ exists: boolean; item?: ReferenceItem }>(
        `/api/reference-bank/check-duplicate?hash=${encodeURIComponent(hash)}`
      );
    } catch {
      return { exists: false };
    }
  },

  // Get presigned URL for upload
  async getPresignedUrl(
    fileName: string,
    fileType: string,
    folderId?: string | null
  ): Promise<{ uploadUrl: string; key: string }> {
    return fetchWithRetry<{ uploadUrl: string; key: string }>(
      "/api/reference-bank/presigned-url",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, fileType, folderId }),
      }
    );
  },

  // Upload file to S3
  async uploadToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed")));
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  },

  // Create reference item record
  async createItem(data: {
    name: string;
    description?: string;
    tags?: string[];
    fileType: string;
    mimeType: string;
    fileSize: number;
    awsS3Key: string;
    folderId?: string | null;
    fileHash?: string;
  }): Promise<ReferenceItem> {
    return fetchWithRetry<ReferenceItem>("/api/reference-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  // Update reference item
  async updateItem(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      tags: string[];
      isFavorite: boolean;
      folderId: string | null;
    }>
  ): Promise<ReferenceItem> {
    return fetchWithRetry<ReferenceItem>(`/api/reference-bank/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  // Delete reference item
  async deleteItem(id: string): Promise<void> {
    await fetchWithRetry<{ success: boolean }>(`/api/reference-bank/${id}`, {
      method: "DELETE",
    });
  },

  // Bulk move items
  async bulkMove(itemIds: string[], folderId: string | null): Promise<void> {
    await fetchWithRetry<{ success: boolean }>("/api/reference-bank/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds, folderId }),
    });
  },

  // Bulk favorite items
  async bulkFavorite(itemIds: string[], isFavorite: boolean): Promise<void> {
    await fetchWithRetry<{ success: boolean }>("/api/reference-bank/bulk-favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds, isFavorite }),
    });
  },

  // Bulk add tags
  async bulkAddTags(itemIds: string[], tags: string[]): Promise<void> {
    await fetchWithRetry<{ success: boolean }>("/api/reference-bank/bulk-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds, tags }),
    });
  },

  // Track usage
  async trackUsage(id: string): Promise<void> {
    try {
      await fetch(`/api/reference-bank/${id}/use`, { method: "POST" });
    } catch {
      // Silent fail for usage tracking
    }
  },

  // Download file
  async downloadFile(item: ReferenceItem): Promise<Blob> {
    const fileName = `${item.name}.${item.mimeType.split("/")[1]}`;
    const proxyUrl = `/api/reference-bank/download?url=${encodeURIComponent(
      item.awsS3Url
    )}&fileName=${encodeURIComponent(fileName)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Download failed");
    return response.blob();
  },

  // Folder operations
  folders: {
    async create(data: {
      name: string;
      description?: string;
      color: string;
      sortBy?: string;
    }): Promise<ReferenceFolder> {
      return fetchWithRetry<ReferenceFolder>("/api/reference-bank/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    async update(
      id: string,
      data: Partial<{
        name: string;
        description: string;
        color: string;
        sortBy: string;
      }>
    ): Promise<ReferenceFolder> {
      return fetchWithRetry<ReferenceFolder>(`/api/reference-bank/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    async delete(id: string): Promise<void> {
      await fetchWithRetry<{ success: boolean }>(`/api/reference-bank/folders/${id}`, {
        method: "DELETE",
      });
    },
  },

  // Google Drive
  googleDrive: {
    async getAuthUrl(redirectPath: string): Promise<{ authUrl: string }> {
      return fetchWithRetry<{ authUrl: string }>(
        `/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`
      );
    },

    async browse(
      accessToken: string,
      folderId?: string
    ): Promise<{
      folders: Array<{ id: string; name: string; mimeType: string; shared?: boolean }>;
      mediaFiles: Array<{
        id: string;
        name: string;
        mimeType: string;
        thumbnailLink?: string;
      }>;
      authError?: boolean;
      error?: string;
    }> {
      const params = new URLSearchParams({ accessToken });
      if (folderId) params.append("folderId", folderId);

      return fetchWithRetry(`/api/google-drive/browse?${params}`);
    },

    async import(
      accessToken: string,
      fileIds: string[],
      folderId?: string | null
    ): Promise<{ itemCount: number }> {
      return fetchWithRetry<{ itemCount: number }>(
        "/api/reference-bank/import-from-google-drive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            fileIds,
            folderId: folderId === "root" ? null : folderId,
          }),
        }
      );
    },
  },

  // Storage quota
  async getStorageQuota(): Promise<{ used: number; limit: number }> {
    try {
      return await fetchWithRetry<{ used: number; limit: number }>(
        "/api/reference-bank/storage-quota"
      );
    } catch {
      return { used: 0, limit: 5 * 1024 * 1024 * 1024 }; // Default 5GB
    }
  },
};

// Recent searches management
const RECENT_SEARCHES_KEY = "reference-bank-recent-searches";
const MAX_RECENT_SEARCHES = 10;

export const recentSearches = {
  get(): string[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  add(query: string): void {
    if (typeof window === "undefined" || !query.trim()) return;
    try {
      const searches = this.get().filter((s) => s !== query);
      searches.unshift(query);
      localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
      );
    } catch {
      // Silent fail
    }
  },

  remove(query: string): void {
    if (typeof window === "undefined") return;
    try {
      const searches = this.get().filter((s) => s !== query);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch {
      // Silent fail
    }
  },

  clear(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Silent fail
    }
  },
};

// Folder sort preferences
const FOLDER_SORT_KEY = "reference-bank-folder-sorts";

export const folderSortPreferences = {
  get(folderId: string | null): "recent" | "name" | "usage" {
    if (typeof window === "undefined") return "recent";
    try {
      const stored = localStorage.getItem(FOLDER_SORT_KEY);
      const prefs = stored ? JSON.parse(stored) : {};
      return prefs[folderId || "all"] || "recent";
    } catch {
      return "recent";
    }
  },

  set(folderId: string | null, sortBy: "recent" | "name" | "usage"): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(FOLDER_SORT_KEY);
      const prefs = stored ? JSON.parse(stored) : {};
      prefs[folderId || "all"] = sortBy;
      localStorage.setItem(FOLDER_SORT_KEY, JSON.stringify(prefs));
    } catch {
      // Silent fail
    }
  },
};

// Parse search query with filters
export function parseSearchQuery(query: string): {
  text: string;
  tags: string[];
  type: "all" | "image" | "video";
} {
  const tags: string[] = [];
  let type: "all" | "image" | "video" = "all";
  let text = query;

  // Extract tag filters (tag:value)
  const tagMatches = query.match(/tag:(\w+)/gi);
  if (tagMatches) {
    tagMatches.forEach((match) => {
      const tag = match.replace(/tag:/i, "");
      tags.push(tag.toLowerCase());
      text = text.replace(match, "").trim();
    });
  }

  // Extract type filter (type:image or type:video)
  const typeMatch = query.match(/type:(image|video)/i);
  if (typeMatch) {
    type = typeMatch[1].toLowerCase() as "image" | "video";
    text = text.replace(typeMatch[0], "").trim();
  }

  return { text: text.trim(), tags, type };
}
