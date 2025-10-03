// Instagram Post API utilities

export interface InstagramPost {
  id: string;
  clerkId: string;
  driveFileId: string;
  driveFileUrl: string;
  fileName: string;
  caption: string;
  scheduledDate: string | null;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED';
  postType: 'POST' | 'REEL' | 'STORY';
  folder: string;
  order: number;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  driveFileId: string;
  driveFileUrl: string;
  fileName: string;
  caption?: string;
  scheduledDate?: string | null;
  status?: 'DRAFT' | 'REVIEW' | 'APPROVED';
  postType?: 'POST' | 'REEL';
  folder: string;
  mimeType?: string;
}

export interface UpdatePostData {
  caption?: string;
  scheduledDate?: string | null;
  status?: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED';
  postType?: 'POST' | 'REEL' | 'STORY';
}

// Fetch all posts (optionally for a specific user if Admin/Manager)
export async function fetchInstagramPosts(userId?: string): Promise<InstagramPost[]> {
  const url = userId 
    ? `/api/instagram-posts?userId=${encodeURIComponent(userId)}`
    : '/api/instagram-posts';
    
  const response = await fetch(url);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch posts');
  }
  
  return data.posts;
}

// Fetch all users who have Instagram posts (Admin/Manager only)
export async function fetchInstagramPostUsers(): Promise<{
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  role: string;
  postCount: number;
}[]> {
  const response = await fetch('/api/instagram-posts/users');
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch users');
  }
  
  return data.users;
}

// Create a new post
export async function createInstagramPost(postData: CreatePostData): Promise<InstagramPost> {
  const response = await fetch('/api/instagram-posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postData),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create post');
  }
  
  return data.post;
}

// Update a post
export async function updateInstagramPost(id: string, updates: UpdatePostData): Promise<InstagramPost> {
  const response = await fetch(`/api/instagram-posts/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update post');
  }
  
  return data.post;
}

// Delete a post
export async function deleteInstagramPost(
  id: string, 
  options?: { deleteFromDrive?: boolean; accessToken?: string }
): Promise<void> {
  const params = new URLSearchParams();
  if (options?.deleteFromDrive) {
    params.append('deleteFromDrive', 'true');
  }
  if (options?.accessToken) {
    params.append('accessToken', options.accessToken);
  }
  
  const url = `/api/instagram-posts/${id}${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete post');
  }
}

// Update post order (for drag-and-drop)
export async function updatePostsOrder(posts: { id: string; order: number }[]): Promise<void> {
  const response = await fetch('/api/instagram-posts', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ posts }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update post order');
  }
}
