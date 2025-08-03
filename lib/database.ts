// lib/database.ts - Shared database instance
export interface InfluencerLoRA {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
  thumbnailUrl?: string;
  isActive: boolean;
  usageCount: number;
  comfyUIPath?: string;
  syncStatus?: 'pending' | 'synced' | 'missing' | 'error';
  lastUsedAt?: string;
}

// Shared database instance
export const influencersDb: Map<string, InfluencerLoRA[]> = new Map();

// Helper functions
export function getUserInfluencers(userId: string): InfluencerLoRA[] {
  return influencersDb.get(userId) || [];
}

export function setUserInfluencers(userId: string, influencers: InfluencerLoRA[]): void {
  influencersDb.set(userId, influencers);
}

export function addUserInfluencer(userId: string, influencer: InfluencerLoRA): void {
  const userInfluencers = getUserInfluencers(userId);
  userInfluencers.push(influencer);
  setUserInfluencers(userId, userInfluencers);
}

export function updateUserInfluencer(userId: string, influencerId: string, updates: Partial<InfluencerLoRA>): InfluencerLoRA | null {
  const userInfluencers = getUserInfluencers(userId);
  const index = userInfluencers.findIndex(inf => inf.id === influencerId);
  
  if (index === -1) return null;
  
  userInfluencers[index] = { ...userInfluencers[index], ...updates };
  setUserInfluencers(userId, userInfluencers);
  
  return userInfluencers[index];
}

export function deleteUserInfluencer(userId: string, influencerId: string): InfluencerLoRA | null {
  const userInfluencers = getUserInfluencers(userId);
  const index = userInfluencers.findIndex(inf => inf.id === influencerId);
  
  if (index === -1) return null;
  
  const deleted = userInfluencers.splice(index, 1)[0];
  setUserInfluencers(userId, userInfluencers);
  
  return deleted;
}

export function findUserInfluencer(userId: string, influencerId: string): InfluencerLoRA | null {
  const userInfluencers = getUserInfluencers(userId);
  return userInfluencers.find(inf => inf.id === influencerId) || null;
}

export function incrementInfluencerUsage(userId: string, fileName: string): void {
  const userInfluencers = getUserInfluencers(userId);
  const influencer = userInfluencers.find(inf => inf.fileName === fileName);
  
  if (influencer) {
    influencer.usageCount = (influencer.usageCount || 0) + 1;
    influencer.lastUsedAt = new Date().toISOString();
    setUserInfluencers(userId, userInfluencers);
  }
}

// Auth helper
export function getUserId(request: Request): string {
  // Implement your auth logic here
  // For now, using header or default
  return (request as any).headers?.get?.('x-user-id') || 'default-user';
}