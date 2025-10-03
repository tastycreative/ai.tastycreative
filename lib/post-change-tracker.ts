// Track last change timestamp per user for polling system
const lastChanges = new Map<string, { timestamp: number; postIds: string[] }>();

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
