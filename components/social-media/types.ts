// Shared types for social media components

export interface Post {
  id: string;
  userId: string;
  user: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    email: string | null;
    imageUrl: string | null;
  };
  imageUrls: string[];
  mediaType?: 'image' | 'video';
  caption: string;
  likes: number;
  comments: number;
  createdAt: string;
  liked: boolean;
  bookmarked: boolean;
  isFriend: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  liked: boolean;
  likeCount: number;
  replyCount: number;
  parentCommentId?: string | null;
  replies?: Comment[];
  user: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    imageUrl: string | null;
  };
  profile?: {
    id: string;
    name: string;
    instagramUsername: string | null;
    profileImageUrl: string | null;
  } | null;
}

export interface Profile {
  id: string;
  clerkId: string;
  name: string;
  description: string | null;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    posts: number;
    feedPosts: number;
    friends: number;
  };
}
