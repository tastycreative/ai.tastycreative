// lib/comfyUIAuth.ts - Helper functions for ComfyUI authentication

/**
 * Get headers with RunPod authentication for ComfyUI requests
 */
export function getComfyUIHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...additionalHeaders };
  
  const runpodApiKey = process.env.RUNPOD_API_KEY;
  if (runpodApiKey) {
    headers['Authorization'] = `Bearer ${runpodApiKey}`;
  }
  
  return headers;
}

/**
 * Make an authenticated fetch request to ComfyUI
 */
export async function fetchComfyUI(url: string, options: RequestInit = {}): Promise<Response> {
  const { headers: originalHeaders, ...otherOptions } = options;
  
  const headers = getComfyUIHeaders(
    originalHeaders ? Object.fromEntries(new Headers(originalHeaders)) : {}
  );
  
  return fetch(url, {
    ...otherOptions,
    headers
  });
}
