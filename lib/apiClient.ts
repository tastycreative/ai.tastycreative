// lib/apiClient.ts - Updated for Clerk authentication
import { useAuth } from '@clerk/nextjs';

// Custom fetch function that works with Clerk authentication
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Enhanced debug logging
  console.log('🌐 === API CLIENT REQUEST (CLERK) ===');
  console.log('📍 Request URL:', url);
  console.log('🔧 Request method:', options.method || 'GET');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  // Note: We don't manually add user ID headers for Clerk
  // Clerk handles authentication via cookies/tokens automatically
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    // Remove any manual user ID headers - Clerk handles this
  };

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
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    const duration = Date.now() - startTime;
    console.log('⏱️ Request duration:', duration + 'ms');
    console.log('📊 Response status:', response.status, response.statusText);
    console.log('🌐 Response URL:', response.url);
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Log response body for debugging (only for non-successful responses or if it's small)
    if (!response.ok) {
      const responseText = await response.text();
      console.error('❌ Error response body:', responseText);
      
      // Create a new response with the same data since we consumed the body
      return new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    
    console.log('✅ Request completed successfully');
    return response;
    
  } catch (error) {
    console.error('💥 === API CLIENT ERROR ===');
    console.error('🔥 Fetch error:', error);
    
    if (error instanceof Error) {
      console.error('📛 Error name:', error.name);
      console.error('📝 Error message:', error.message);
      if (error.stack) {
        console.error('📚 Error stack:', error.stack.split('\n').slice(0, 5));
      }
    }
    
    // Re-throw the error so calling code can handle it
    throw error;
  }
}

// Convenience methods for common HTTP operations
export const apiClient = {
  async get(url: string): Promise<Response> {
    console.log('📖 API Client GET:', url);
    return authenticatedFetch(url, { method: 'GET' });
  },

  async post(url: string, data?: any): Promise<Response> {
    console.log('📝 API Client POST:', url);
    if (data) {
      console.log('📊 POST Data preview:', 
        typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : data
      );
    }
    const body = data ? JSON.stringify(data) : undefined;
    return authenticatedFetch(url, { method: 'POST', body });
  },

  async patch(url: string, data?: any): Promise<Response> {
    console.log('🔧 API Client PATCH:', url);
    if (data) {
      console.log('📊 PATCH Data preview:', 
        typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : data
      );
    }
    const body = data ? JSON.stringify(data) : undefined;
    return authenticatedFetch(url, { method: 'PATCH', body });
  },

  async delete(url: string): Promise<Response> {
    console.log('🗑️ API Client DELETE:', url);
    return authenticatedFetch(url, { method: 'DELETE' });
  },

  // For form data uploads (works with Clerk)
  async postFormData(url: string, formData: FormData): Promise<Response> {
    console.log('📁 API Client POST FormData:', url);
    
    // Log FormData contents for debugging
    console.log('📋 FormData contents:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  - ${key}: File(${value.name}, ${value.size} bytes)`);
      } else {
        console.log(`  - ${key}: ${value}`);
      }
    }
    
    // Don't set Content-Type for FormData, and don't add manual auth headers
    // Clerk handles authentication automatically
    return fetch(url, {
      method: 'POST',
      body: formData, // Let browser set Content-Type with boundary
    });
  },

  // Utility method to handle JSON responses with better error handling
  async getJson(url: string): Promise<any> {
    const response = await this.get(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Expected JSON response but got: ${contentType}. Response: ${text.substring(0, 200)}`);
    }
    
    return response.json();
  },

  // Utility method to post JSON and get JSON response
  async postJson(url: string, data?: any): Promise<any> {
    const response = await this.post(url, data);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Expected JSON response but got: ${contentType}. Response: ${text.substring(0, 200)}`);
    }
    
    return response.json();
  }
};

// Hook for using authenticated API client in React components
export function useApiClient() {
  const { isSignedIn, isLoaded } = useAuth();
  
  if (!isLoaded) {
    console.log('⏳ Clerk auth not loaded yet');
    return null;
  }
  
  if (!isSignedIn) {
    console.log('❌ User not signed in');
    return null;
  }
  
  console.log('✅ User authenticated, API client ready');
  return apiClient;
}