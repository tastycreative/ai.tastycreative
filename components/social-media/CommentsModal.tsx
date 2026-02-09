'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Post, Comment } from './types';
import ImageCarousel from './ImageCarousel';

interface CommentsModalProps {
  isOpen: boolean;
  post: Post | null;
  onClose: () => void;
  currentImageIndexes: Record<string, number>;
  setCurrentImageIndexes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  selectedProfileId: string | null;
}

export default function CommentsModal({
  isOpen,
  post,
  onClose,
  currentImageIndexes,
  setCurrentImageIndexes,
  selectedProfileId
}: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingLikes, setProcessingLikes] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && post) {
      loadComments();
    }
  }, [isOpen, post]);

  if (!isOpen || !post || !mounted) return null;

  const loadComments = async () => {
    if (!post) return;
    
    setLoading(true);
    try {
      const url = selectedProfileId 
        ? `/api/feed/posts/${post.id}/comments?profileId=${selectedProfileId}`
        : `/api/feed/posts/${post.id}/comments`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      } else {
        toast.error('Failed to load comments');
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    const content = commentText.trim();
    console.log('Adding comment with selectedProfileId:', selectedProfileId);
    if (!content || !post || !selectedProfileId) {
      console.log('Validation failed - content:', !!content, 'post:', !!post, 'selectedProfileId:', selectedProfileId);
      return;
    }

    setSubmitting(true);
    try {
      console.log('Sending comment with data:', { content, parentCommentId: replyingTo, profileId: selectedProfileId });
      const response = await fetch(`/api/feed/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          parentCommentId: replyingTo,
          profileId: selectedProfileId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const { comment } = await response.json();

      if (replyingTo) {
        setComments(prevComments => prevComments.map(c => {
          if (c.id === replyingTo) {
            return {
              ...c,
              replies: [...(c.replies || []), comment],
              replyCount: (c.replyCount || 0) + 1,
            };
          }
          return c;
        }));
      } else {
        setComments(prevComments => [comment, ...prevComments]);
      }

      setCommentText('');
      setReplyingTo(null);
      toast.success(replyingTo ? 'Reply added!' : 'Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string, isReply: boolean = false, parentCommentId?: string) => {
    if (processingLikes.has(commentId)) return;

    if (!selectedProfileId) {
      toast.error('Please select a profile first');
      return;
    }

    const comment = isReply 
      ? comments.find(c => c.id === parentCommentId)?.replies?.find(r => r.id === commentId)
      : comments.find(c => c.id === commentId);
    
    if (!comment) return;

    const wasLiked = comment.liked;

    setProcessingLikes(prev => new Set(prev).add(commentId));

    setComments(prevComments => prevComments.map(c => {
      if (isReply && c.id === parentCommentId) {
        return {
          ...c,
          replies: c.replies?.map(r => {
            if (r.id === commentId) {
              return {
                ...r,
                liked: !wasLiked,
                likeCount: wasLiked ? r.likeCount - 1 : r.likeCount + 1,
              };
            }
            return r;
          }),
        };
      } else if (!isReply && c.id === commentId) {
        return {
          ...c,
          liked: !wasLiked,
          likeCount: wasLiked ? c.likeCount - 1 : c.likeCount + 1,
        };
      }
      return c;
    }));

    try {
      const response = await fetch(`/api/feed/comments/${commentId}/like`, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfileId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const { likeCount, liked } = await response.json();

      setComments(prevComments => prevComments.map(c => {
        if (isReply && c.id === parentCommentId) {
          return {
            ...c,
            replies: c.replies?.map(r => {
              if (r.id === commentId) {
                return { ...r, likeCount, liked };
              }
              return r;
            }),
          };
        } else if (!isReply && c.id === commentId) {
          return { ...c, likeCount, liked };
        }
        return c;
      }));
    } catch (error) {
      console.error('Error updating comment like:', error);
      setComments(prevComments => prevComments.map(c => {
        if (isReply && c.id === parentCommentId) {
          return {
            ...c,
            replies: c.replies?.map(r => {
              if (r.id === commentId) {
                return {
                  ...r,
                  liked: wasLiked,
                  likeCount: wasLiked ? r.likeCount + 1 : r.likeCount - 1,
                };
              }
              return r;
            }),
          };
        } else if (!isReply && c.id === commentId) {
          return {
            ...c,
            liked: wasLiked,
            likeCount: wasLiked ? c.likeCount + 1 : c.likeCount - 1,
          };
        }
        return c;
      }));
      toast.error('Failed to update like');
    } finally {
      setProcessingLikes(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const getDisplayName = (comment: Comment) => {
    // Prioritize profile data if available
    if (comment.profile) {
      return comment.profile.name;
    }
    // Fallback to user data
    const user = comment.user;
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.username) {
      return user.username;
    }
    return 'Unknown User';
  };

  const getDisplayUsername = (comment: Comment) => {
    // Show Instagram username if available
    if (comment.profile?.instagramUsername) {
      return `@${comment.profile.instagramUsername}`;
    }
    return null;
  };

  const getProfileImage = (comment: Comment) => {
    // Prioritize profile image if available
    if (comment.profile?.profileImageUrl) {
      return comment.profile.profileImageUrl;
    }
    // Fallback to user image
    return comment.user.imageUrl || '/default-avatar.png';
  };

  const renderComment = (comment: Comment, isReply: boolean = false, parentCommentId?: string) => (
    <div key={comment.id} className={`${isReply ? 'ml-12 mt-3' : 'mb-4'}`}>
      <div className="flex gap-3">
        <img
          src={getProfileImage(comment)}
          alt={getDisplayName(comment)}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1">
          <div className="bg-muted rounded-2xl px-4 py-2">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-foreground">
                {getDisplayName(comment)}
              </h4>
              {getDisplayUsername(comment) && (
                <span className="text-xs text-muted-foreground">
                  {getDisplayUsername(comment)}
                </span>
              )}
            </div>
            <p className="text-foreground text-sm mt-1">
              {comment.content}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-2 ml-4">
            <button
              onClick={() => handleLikeComment(comment.id, isReply, parentCommentId)}
              disabled={processingLikes.has(comment.id)}
              className={`text-xs font-medium transition-colors ${
                comment.liked
                  ? 'text-red-500'
                  : 'text-header-muted hover:text-red-500'
              }`}
            >
              {comment.liked ? 'Liked' : 'Like'} {comment.likeCount > 0 && `(${comment.likeCount})`}
            </button>
            {!isReply && (
              <button
                onClick={() => {
                  setReplyingTo(comment.id);
                  setCommentText('');
                }}
                className="text-xs font-medium text-header-muted hover:text-[#EC67A1] transition-colors"
              >
                Reply
              </button>
            )}
            <span className="text-xs text-header-muted">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              {comment.replies.map(reply => renderComment(reply, true, comment.id))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
        {/* Left Side - Post Image/Video */}
        <div className="md:w-1/2 bg-black flex items-center justify-center">
          <ImageCarousel
            images={post.imageUrls}
            postId={post.id}
            mediaType={post.mediaType}
            currentImageIndexes={currentImageIndexes}
            setCurrentImageIndexes={setCurrentImageIndexes}
            isPaused={false}
          />
        </div>

        {/* Right Side - Comments */}
        <div className="md:w-1/2 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-6 border-b border-modal-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-xl font-bold text-modal-foreground">Comments</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-modal-hover-bg rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-header-muted" />
            </button>
          </div>

          {/* Post Info */}
          <div className="p-6 border-b border-modal-border flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <img
                src={post.user.imageUrl || '/default-avatar.png'}
                alt={post.user.firstName || 'User'}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <h3 className="font-semibold text-modal-foreground">
                  {post.user.firstName && post.user.lastName
                    ? `${post.user.firstName} ${post.user.lastName}`
                    : post.user.username || 'Unknown User'}
                </h3>
                <p className="text-sm text-header-muted">
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="text-modal-foreground">{post.caption}</p>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#EC67A1] animate-spin" />
              </div>
            ) : comments.length > 0 ? (
              <div>
                {comments.map(comment => renderComment(comment))}
              </div>
            ) : (
              <div className="text-center py-8 text-header-muted">
                No comments yet. Be the first to comment!
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div className="p-6 border-t border-modal-border flex-shrink-0">
            {replyingTo && (
              <div className="mb-3 flex items-center justify-between bg-dropdown-selected-bg px-3 py-2 rounded-lg">
                <span className="text-sm text-dropdown-selected-text">
                  Replying to comment
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-dropdown-selected-text hover:text-modal-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder={replyingTo ? 'Write a reply...' : 'Write a comment...'}
                className="flex-1 px-4 py-3 bg-modal-input-bg border border-modal-input-border rounded-xl text-modal-foreground placeholder-header-muted focus:ring-2 focus:ring-[#EC67A1]/30 focus:border-[#EC67A1]"
                disabled={submitting}
              />
              <button
                onClick={handleAddComment}
                disabled={submitting || !commentText.trim()}
                className="px-6 py-3 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-blue)] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
