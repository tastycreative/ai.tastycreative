// lib/userIdUtils.ts - Fixed user ID utilities
export function getUserId(): string {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    console.log('🖥️ Server-side environment detected');
    return 'server-user';
  }

  try {
    // Try to get existing user ID from localStorage
    let userId = localStorage.getItem('app-user-id');
    
    if (!userId) {
      // Generate a new user ID
      userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆔 Generated new user ID:', userId);
      
      try {
        localStorage.setItem('app-user-id', userId);
        console.log('💾 Saved user ID to localStorage');
      } catch (storageError) {
        console.error('⚠️ Failed to save user ID to localStorage:', storageError);
        // Continue with the generated ID even if we can't save it
      }
    } else {
      console.log('🔍 Retrieved existing user ID:', userId);
    }
    
    return userId;
  } catch (error) {
    console.error('💥 Error in getUserId:', error);
    // Fallback to a session-based ID if localStorage fails
    const fallbackId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🔄 Using fallback user ID:', fallbackId);
    return fallbackId;
  }
}

// Function to clear user ID (for logout or reset)
export function clearUserId(): void {
  if (typeof window === 'undefined') {
    console.log('🖥️ Server-side environment - cannot clear user ID');
    return;
  }

  try {
    localStorage.removeItem('app-user-id');
    console.log('🗑️ User ID cleared from localStorage');
  } catch (error) {
    console.error('⚠️ Error clearing user ID:', error);
  }
}

// Function to set a specific user ID (for login scenarios)
export function setUserId(userId: string): void {
  if (typeof window === 'undefined') {
    console.log('🖥️ Server-side environment - cannot set user ID');
    return;
  }

  if (!userId || typeof userId !== 'string') {
    console.error('❌ Invalid user ID provided:', userId);
    return;
  }

  try {
    localStorage.setItem('app-user-id', userId);
    console.log('💾 User ID set:', userId);
  } catch (error) {
    console.error('⚠️ Error setting user ID:', error);
  }
}

// Function to validate user ID format
export function isValidUserId(userId: string): boolean {
  if (!userId || typeof userId !== 'string') {
    return false;
  }

  // Valid formats:
  // - user-{timestamp}-{random}
  // - session-{timestamp}-{random}
  // - server-user
  // - Or any string that's not empty and reasonable length
  
  return userId.length > 0 && userId.length < 100;
}

// Function to get user ID for server-side use
export function getUserIdFromRequest(request: Request): string {
  try {
    // Try to get from headers first
    const headerUserId = request.headers.get('x-user-id');
    if (headerUserId && isValidUserId(headerUserId)) {
      console.log('👤 User ID from request headers:', headerUserId);
      return headerUserId;
    }

    // Try to get from cookies as fallback
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      const cookieUserId = cookies['app-user-id'];
      if (cookieUserId && isValidUserId(cookieUserId)) {
        console.log('🍪 User ID from cookies:', cookieUserId);
        return cookieUserId;
      }
    }

    // Generate a temporary server-side user ID
    const tempUserId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🔄 Generated temporary user ID for request:', tempUserId);
    return tempUserId;

  } catch (error) {
    console.error('💥 Error getting user ID from request:', error);
    return 'unknown-user';
  }
}

// Debug function to get user ID info
export function getUserIdInfo(): {
  userId: string;
  source: 'localStorage' | 'generated' | 'server';
  isValid: boolean;
  browserSupport: {
    localStorage: boolean;
    cookies: boolean;
  };
} {
  const userId = getUserId();
  let source: 'localStorage' | 'generated' | 'server' = 'server';

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('app-user-id');
    source = stored ? 'localStorage' : 'generated';
  }

  const browserSupport = {
    localStorage: typeof window !== 'undefined' && typeof localStorage !== 'undefined',
    cookies: typeof window !== 'undefined' && typeof document !== 'undefined'
  };

  return {
    userId,
    source,
    isValid: isValidUserId(userId),
    browserSupport
  };
}