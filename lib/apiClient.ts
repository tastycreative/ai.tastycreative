// lib/apiClient.ts - Fixed for proper Clerk authentication
import { useAuth } from '@clerk/nextjs';

// Custom fetch function that works with Clerk authentication
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // This function can't use hooks directly, so it needs the token passed to it
  throw new Error('Use the apiClient methods instead of calling authenticatedFetch directly');
}

// API client that properly handles Clerk authentication
class AuthenticatedApiClient {
  private getToken?: () => Promise<string | null>;

  // Initialize with the token getter function
  setTokenGetter(getToken: () => Promise<string | null>) {
    this.getToken = getToken;
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // Enhanced debug logging
    console.log('🌐 === API CLIENT REQUEST (CLERK) ===');
    console.log('📍 Request URL:', url);
    console.log('🔧 Request method:', options.method || 'GET');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Get the Clerk token
    const token = this.getToken ? await this.getToken() : null;
    
    // Build headers with authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };
    
    // Add Authorization header if we have a token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('⚠️ No authentication token available');
    }

    console.log('📋 Request headers:', headers);
    
    if (options.body) {
      console.log('📦 Request body:', 
        typeof options.body === 'string' 
          ? options.body.substring(0, 500) + (options.body.length > 500 ? '...' : '')
          : options.body
      );
    }

    try {
      const startTime = Date.now();
      console.log('🚀 Sending request...');
      
      // Add a timeout to the fetch request - longer timeout for upload operations
      const controller = new AbortController();
      const isUploadOperation = url.includes('/upload') || url.includes('/blob') || url.includes('/sync');
      const timeoutDuration = isUploadOperation ? 300000 : 30000; // 5 minutes for uploads, 30 seconds for others
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      console.log('⏱️ Request duration:', duration + 'ms');
      console.log('📊 Response status:', response.status, response.statusText);
      console.log('🌐 Response URL:', response.url);
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
      console.log(`⏰ Used ${isUploadOperation ? '5-minute' : '30-second'} timeout for this operation`);

      // Log response body for debugging (only for non-successful responses)
      if (!response.ok) {
        try {
          const responseText = await response.text();
          console.error('❌ Error response body:', responseText);
          
          // Create a new response with the same data since we consumed the body
          return new Response(responseText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        } catch (textError) {
          console.error('❌ Failed to read error response body:', textError);
          return response;
        }
      }
      
      console.log('✅ Request completed successfully');
      return response;
      
    } catch (error) {
      console.error('💥 === API CLIENT ERROR ===');
      console.error('🔥 Error type:', error instanceof Error ? error.name : typeof error);
      console.error('🔥 Error message:', error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('⏰ Request timed out after 30 seconds');
          throw new Error('Request timeout - the server took too long to respond');
        }
        
        if (error.message.includes('Failed to fetch')) {
          console.error('🌐 Network connection failed');
          // More helpful error message for production
          const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
          if (isProduction) {
            throw new Error('Network error - unable to connect to server. Please check your internet connection and try again.');
          } else {
            throw new Error('Network error - unable to connect to server. Is the development server running?');
          }
        }
        
        // Handle CORS errors in production
        if (error.message.includes('CORS')) {
          throw new Error('Cross-origin request blocked. Please contact support if this persists.');
        }
      }
      
      console.error('🔥 Full error object:', error);
      throw error;
    }
  }

  async get(url: string): Promise<Response> {
    console.log('📖 API Client GET:', url);
    return this.makeRequest(url, { method: 'GET' });
  }

  async post(url: string, data?: any): Promise<Response> {
    console.log('📝 API Client POST:', url);
    if (data) {
      console.log('📊 POST Data preview:', 
        typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : data
      );
    }
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest(url, { method: 'POST', body });
  }

  async patch(url: string, data?: any): Promise<Response> {
    console.log('🔧 API Client PATCH:', url);
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest(url, { method: 'PATCH', body });
  }

  async delete(url: string): Promise<Response> {
    console.log('🗑️ API Client DELETE:', url);
    return this.makeRequest(url, { method: 'DELETE' });
  }

  // For form data uploads (with authentication)
  async postFormData(url: string, formData: FormData): Promise<Response> {
    console.log('📁 API Client POST FormData:', url);
    
    // Get the token for authentication
    const token = this.getToken ? await this.getToken() : null;
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData (browser sets it with boundary)
    return fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
  }

  // Utility method to handle JSON responses
  async getJson(url: string): Promise<any> {
    const response = await this.get(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }

  // Utility method to post JSON and get JSON response
  async postJson(url: string, data?: any): Promise<any> {
    const response = await this.post(url, data);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }
}

// Create singleton instance
const apiClientInstance = new AuthenticatedApiClient();

// Export the configured client
export const apiClient = apiClientInstance;

// Hook for using authenticated API client in React components
export function useApiClient() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  
  if (!isLoaded) {
    console.log('⏳ Clerk auth not loaded yet');
    return null;
  }
  
  if (!isSignedIn) {
    console.log('❌ User not signed in');
    return null;
  }
  
  // Set the token getter function
  apiClientInstance.setTokenGetter(getToken);
  
  console.log('✅ User authenticated, API client ready with token');
  return apiClient;
}

// Alternative: Direct usage (for use outside of React components)
export function initializeApiClient(getToken: () => Promise<string | null>) {
  apiClientInstance.setTokenGetter(getToken);
  return apiClient;
}