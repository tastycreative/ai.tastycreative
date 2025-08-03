// lib/apiClient.ts
import { getUserId } from './userIdUtils';

// Custom fetch function that includes user ID
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const userId = getUserId();
  
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

// Convenience methods for common HTTP operations
export const apiClient = {
  async get(url: string): Promise<Response> {
    return authenticatedFetch(url, { method: 'GET' });
  },

  async post(url: string, data?: any): Promise<Response> {
    const body = data ? JSON.stringify(data) : undefined;
    return authenticatedFetch(url, { method: 'POST', body });
  },

  async patch(url: string, data?: any): Promise<Response> {
    const body = data ? JSON.stringify(data) : undefined;
    return authenticatedFetch(url, { method: 'PATCH', body });
  },

  async delete(url: string): Promise<Response> {
    return authenticatedFetch(url, { method: 'DELETE' });
  },

  // For form data uploads
  async postFormData(url: string, formData: FormData): Promise<Response> {
    const userId = getUserId();
    return fetch(url, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      body: formData,
    });
  },
};