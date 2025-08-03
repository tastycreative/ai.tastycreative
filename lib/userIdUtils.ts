// lib/userIdUtils.ts
export function getUserId(): string {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    return 'server-user';
  }

  // Try to get existing user ID from localStorage
  let userId = localStorage.getItem('app-user-id');
  
  // If no user ID exists, generate a new one
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('app-user-id', userId);
  }
  
  return userId;
}

// Function to clear user ID (for logout or reset)
export function clearUserId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('app-user-id');
  }
}

// Function to set a specific user ID (for login scenarios)
export function setUserId(userId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('app-user-id', userId);
  }
}