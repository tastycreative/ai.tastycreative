// Track last change timestamp per user for polling system
const lastChanges = new Map<string, { timestamp: number; postIds: string[] }>();

// Store active SSE connections
const sseClients = new Map<string, ReadableStreamDefaultController>();

// Function to record a change (called from API routes)
export function recordPostChange(postId: string) {
  const now = Date.now();
  
  // Update all users' change records
  lastChanges.forEach((value, userId) => {
    if (!value.postIds.includes(postId)) {
      value.postIds.push(postId);
    }
    value.timestamp = now;
  });
}

// Notify all connected SSE clients about a change
export function notifyPostChange(postId: string, action: 'update' | 'create' | 'delete', data?: any) {
  const message = JSON.stringify({ postId, action, data, timestamp: Date.now() });
  
  sseClients.forEach((controller, clientId) => {
    try {
      controller.enqueue(`data: ${message}\n\n`);
    } catch (error) {
      // Client disconnected, remove it
      sseClients.delete(clientId);
    }
  });
}

// SSE client management
export function addSSEClient(clientId: string, controller: ReadableStreamDefaultController) {
  sseClients.set(clientId, controller);
}

export function removeSSEClient(clientId: string) {
  sseClients.delete(clientId);
}

// Get change info for a user
export function getUserChanges(userId: string) {
  if (!lastChanges.has(userId)) {
    lastChanges.set(userId, { timestamp: Date.now(), postIds: [] });
  }
  return lastChanges.get(userId);
}

// Clear post IDs for a user after they've been sent
export function clearUserPostIds(userId: string) {
  const userChanges = lastChanges.get(userId);
  if (userChanges) {
    userChanges.postIds = [];
  }
}
