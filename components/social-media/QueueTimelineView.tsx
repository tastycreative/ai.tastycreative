'use client';

import React from 'react';
import { Calendar, Clock, Edit2, Trash2, Check, Video, Image as ImageIcon } from 'lucide-react';
import { InstagramPost } from '@/lib/instagram-posts';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';

// Extended type to include the image blob URL (added at runtime)
interface InstagramPostWithImage extends InstagramPost {
  image?: string;
}

interface QueueTimelineViewProps {
  posts: InstagramPostWithImage[];
  onEditPost: (post: InstagramPostWithImage) => void;
  onDeletePost: (postId: string) => void;
  onStatusChange: (postId: string, newStatus: InstagramPost['status']) => void;
}

export default function QueueTimelineView({
  posts,
  onEditPost,
  onDeletePost,
  onStatusChange,
}: QueueTimelineViewProps) {
  // Group posts by scheduled date
  const groupedPosts = posts
    .filter(post => post.scheduledDate)
    .sort((a, b) => {
      if (!a.scheduledDate || !b.scheduledDate) return 0;
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    })
    .reduce((groups, post) => {
      if (!post.scheduledDate) return groups;
      const dateKey = format(new Date(post.scheduledDate), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(post);
      return groups;
    }, {} as Record<string, InstagramPostWithImage[]>);

  const unscheduledPosts = posts.filter(post => !post.scheduledDate);

  const getStatusColor = (status: InstagramPost['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-500/90';
      case 'REVIEW':
        return 'bg-yellow-500/90';
      case 'APPROVED':
        return 'bg-green-500/90';
      case 'SCHEDULED':
        return 'bg-blue-500/90';
      case 'PUBLISHED':
        return 'bg-purple-500/90';
      default:
        return 'bg-gray-500/90';
    }
  };

  const getStatusLabel = (status: InstagramPost['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const getDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE'); // Day name
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Scheduled Posts by Date */}
      {Object.entries(groupedPosts).map(([dateKey, datePosts]) => (
        <div key={dateKey} className="space-y-3">
          {/* Date Header */}
          <div className="flex items-center gap-3 pb-2 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h3 className="text-base font-semibold text-white">
                {getDateLabel(dateKey)}
              </h3>
            </div>
            <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full">
              {datePosts.length} {datePosts.length === 1 ? 'post' : 'posts'}
            </span>
          </div>

          {/* Posts for this date */}
          <div className="space-y-2">
            {datePosts.map((post) => (
              <div
                key={post.id}
                className="group bg-gradient-to-br from-gray-800/40 to-gray-800/20 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300"
              >
                <div className="flex gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 relative">
                    {post.image ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-900/50">
                        {post.postType === 'REEL' ? (
                          <>
                            <video
                              src={post.image}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Video className="w-6 h-6 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <img
                            src={post.image}
                            alt={post.fileName}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {/* Post Type Badge */}
                        <div className="absolute top-1 right-1">
                          {post.postType === 'REEL' ? (
                            <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
                              REEL
                            </div>
                          ) : post.postType === 'STORY' ? (
                            <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
                              STORY
                            </div>
                          ) : (
                            <div className="bg-blue-500/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
                              POST
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    {/* Top Row: Time & Status */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">
                          {post.scheduledDate && format(new Date(post.scheduledDate), 'h:mm a')}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white shadow-sm ${getStatusColor(
                          post.status
                        )}`}
                      >
                        {getStatusLabel(post.status)}
                      </span>
                    </div>

                    {/* Caption Preview */}
                    <p className="text-sm text-gray-300 line-clamp-2 mb-2 flex-1">
                      {post.caption || <span className="text-gray-600 italic">No caption</span>}
                    </p>

                    {/* Bottom Row: Filename & Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-gray-600 truncate flex-1">
                        {post.fileName}
                      </p>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditPost(post)}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-medium rounded transition-colors"
                          title="Edit post"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>

                        {post.status === 'REVIEW' && (
                          <button
                            onClick={() => onStatusChange(post.id, 'APPROVED')}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600/80 hover:bg-green-600 text-white text-[10px] font-medium rounded transition-colors"
                            title="Approve post"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`Delete "${post.fileName}"?`)) {
                              onDeletePost(post.id);
                            }
                          }}
                          className="p-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                          title="Delete post"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Unscheduled Posts */}
      {unscheduledPosts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-2 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-400">
                Unscheduled
              </h3>
            </div>
            <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full">
              {unscheduledPosts.length} {unscheduledPosts.length === 1 ? 'post' : 'posts'}
            </span>
          </div>

          <div className="space-y-2">
            {unscheduledPosts.map((post) => (
              <div
                key={post.id}
                className="group bg-gradient-to-br from-gray-800/20 to-gray-800/10 backdrop-blur-sm border border-gray-700/30 border-dashed rounded-xl overflow-hidden hover:border-gray-600/50 transition-all duration-300 opacity-60 hover:opacity-100"
              >
                <div className="flex gap-3 p-3">
                  <div className="flex-shrink-0 relative">
                    {post.image ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-900/50">
                        {post.postType === 'REEL' ? (
                          <>
                            <video
                              src={post.image}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Video className="w-6 h-6 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <img
                            src={post.image}
                            alt={post.fileName}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute top-1 right-1">
                          {post.postType === 'REEL' ? (
                            <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
                              REEL
                            </div>
                          ) : post.postType === 'STORY' ? (
                            <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
                              STORY
                            </div>
                          ) : (
                            <div className="bg-blue-500/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
                              POST
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium italic">Not scheduled</span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white shadow-sm ${getStatusColor(
                          post.status
                        )}`}
                      >
                        {getStatusLabel(post.status)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-300 line-clamp-2 mb-2 flex-1">
                      {post.caption || <span className="text-gray-600 italic">No caption</span>}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-gray-600 truncate flex-1">
                        {post.fileName}
                      </p>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditPost(post)}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-medium rounded transition-colors"
                          title="Edit & Schedule"
                        >
                          <Edit2 className="w-3 h-3" />
                          Schedule
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Delete "${post.fileName}"?`)) {
                              onDeletePost(post.id);
                            }
                          }}
                          className="p-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                          title="Delete post"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {Object.keys(groupedPosts).length === 0 && unscheduledPosts.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-4">
            <Calendar className="w-10 h-10 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No posts in queue</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Add images to your feed and schedule them to see your content calendar
          </p>
        </div>
      )}
    </div>
  );
}
