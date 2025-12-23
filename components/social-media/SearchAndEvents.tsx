'use client';

import React, { useState, useEffect } from 'react';
import { Search, Calendar, User, Image as ImageIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface SearchResult {
  type: 'profile';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

interface ScheduledEvent {
  id: string;
  type: 'reel' | 'post' | 'story' | 'feed';
  title: string;
  scheduledDate: Date;
  thumbnail?: string;
  source: 'instagram' | 'feed-planner';
}

interface SearchAndEventsProps {
  selectedProfileId?: string | null;
  onOpenScheduledPost?: (postData: any) => void;
}

export default function SearchAndEvents({ selectedProfileId, onOpenScheduledPost }: SearchAndEventsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadScheduledEvents();
  }, [selectedProfileId]);

  // Listen for feed post creation events
  useEffect(() => {
    const handleFeedPostCreated = () => {
      loadScheduledEvents();
    };

    window.addEventListener('feedPostCreated', handleFeedPostCreated);
    return () => window.removeEventListener('feedPostCreated', handleFeedPostCreated);
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/feed/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const loadScheduledEvents = async () => {
    try {
      setLoadingEvents(true);
      
      // Fetch Instagram scheduled events
      const instagramResponse = await fetch('/api/instagram/scheduled-events');
      const instagramEvents: ScheduledEvent[] = [];
      if (instagramResponse.ok) {
        const data = await instagramResponse.json();
        instagramEvents.push(...data
          .filter((event: any) => new Date(event.scheduledDate) > new Date())
          .map((event: any) => ({
            id: event.id,
            type: event.postType?.toLowerCase() || 'post',
            title: event.caption || event.fileName || 'Untitled',
            scheduledDate: new Date(event.scheduledDate),
            thumbnail: event.awsS3Url || event.driveFileUrl,
            source: 'instagram' as const,
          })));
      }

      // Fetch Feed Planner posts
      const feedPlannerEvents: ScheduledEvent[] = [];
      if (selectedProfileId && selectedProfileId !== 'all') {
        try {
          const today = new Date();
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 30); // Get posts for next 30 days
          
          const params = new URLSearchParams({
            startDate: today.toISOString().split('T')[0],
            endDate: futureDate.toISOString().split('T')[0],
            profileId: selectedProfileId,
          });
          
          const feedResponse = await fetch(`/api/instagram/feed-post-slots?${params}`);
          if (feedResponse.ok) {
            const feedData = await feedResponse.json();
            const slots = feedData.slots || [];
            feedPlannerEvents.push(...slots
              .filter((slot: any) => {
                if (!slot.timeSlot) return false;
                const slotDate = new Date(slot.timeSlot);
                return slotDate > new Date() && !slot.isPosted;
              })
              .map((slot: any) => ({
                id: slot.id,
                type: 'feed' as const,
                title: slot.caption || 'Feed Post',
                scheduledDate: new Date(slot.timeSlot),
                thumbnail: slot.files?.[0]?.awsS3Url,
                source: 'feed-planner' as const,
              })));
          }
        } catch (error) {
          console.error('Error loading feed planner events:', error);
        }
      }

      // Combine and sort all events
      const allEvents = [...instagramEvents, ...feedPlannerEvents]
        .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
        .slice(0, 5);

      setScheduledEvents(allEvents);
    } catch (error) {
      console.error('Error loading scheduled events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSearchResultClick = (result: SearchResult) => {
    router.push(`/profile/${result.id}`);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleEventClick = async (event: ScheduledEvent) => {
    if (event.source === 'feed-planner') {
      // Fetch full post data and open create modal
      try {
        const response = await fetch(`/api/instagram/feed-post-slots/${event.id}`);
        if (response.ok) {
          const data = await response.json();
          const postData = data.slot || data;
          if (onOpenScheduledPost) {
            onOpenScheduledPost(postData);
          }
        } else {
          // Fallback to routing if fetch fails
          const dateStr = event.scheduledDate.toISOString().split('T')[0];
          router.push(`/workspace/user-feed?view=planner&date=${dateStr}&highlight=${event.id}`);
        }
      } catch (error) {
        console.error('Error fetching scheduled post:', error);
        const dateStr = event.scheduledDate.toISOString().split('T')[0];
        router.push(`/workspace/user-feed?view=planner&date=${dateStr}&highlight=${event.id}`);
      }
    } else {
      router.push(`/workspace/instagram-scheduling?highlight=${event.id}`);
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'reel':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
      case 'story':
        return 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400';
      case 'feed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    }
  };

  const formatTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `in ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `in ${minutes} min${minutes > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="sticky top-4 space-y-6">
      {/* Search Section */}
      <div className="bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20 rounded-2xl shadow-xl border-2 border-purple-200/50 dark:border-purple-800/50 overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-purple-100/50 dark:border-purple-900/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-950/30">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
            Search & Discover
          </h2>
        </div>
        
        <div className="p-6">
          {/* Search Input */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-500 dark:text-purple-400 transition-transform group-focus-within:scale-110" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Instagram profiles..."
              className="w-full pl-12 pr-12 py-4 bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-full transition-all hover:scale-110"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
              {isSearching ? (
                <div className="text-center py-8">
                  <div className="inline-block w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Searching...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSearchResultClick(result)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 rounded-xl transition-all text-left hover:scale-[1.02] border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                  >
                    {result.imageUrl ? (
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-[2px]">
                          <div className="w-full h-full rounded-full bg-white dark:bg-gray-900"></div>
                        </div>
                        <img
                          src={result.imageUrl}
                          alt={result.title}
                          className="relative w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">
                        {result.title}
                      </h4>
                      {result.subtitle && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-purple-500 dark:text-purple-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No results found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Events Section */}
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-950/20 dark:to-purple-950/20 rounded-2xl shadow-xl border-2 border-blue-200/50 dark:border-blue-800/50 overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-blue-100/50 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                Upcoming Posts
              </h2>
            </div>
            <button
              onClick={() => router.push('/workspace/instagram-staging?tab=feed-posts')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-bold"
            >
              View All
            </button>
          </div>
        </div>

        <div className="p-6">
          {loadingEvents ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : scheduledEvents.length > 0 ? (
            <div className="space-y-3">
              {scheduledEvents.map((event, index) => (
                <div key={event.id} className="relative">
                  {/* Timeline connector */}
                  {index < scheduledEvents.length - 1 && (
                    <div className="absolute left-6 top-20 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-purple-300 dark:from-blue-700 dark:to-purple-700"></div>
                  )}
                  
                  <button
                    onClick={() => handleEventClick(event)}
                    className="relative w-full p-4 flex items-center gap-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 rounded-xl transition-all text-left group hover:scale-[1.02] border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-4 w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full ring-4 ring-white dark:ring-gray-900 group-hover:scale-125 transition-transform shadow-lg"></div>
                    
                    {/* Thumbnail or Icon */}
                    {event.thumbnail ? (
                      <img
                        src={event.thumbnail}
                        alt={event.title}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-lg ml-8"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg ml-8">
                        <Calendar className="w-8 h-8 text-white" />
                      </div>
                    )}

                    {/* Event Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase shadow-sm ${
                          event.type === 'reel' 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                            : event.type === 'story'
                            ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        }`}>
                          {event.type}
                        </span>
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-bold">
                          {formatTimeUntil(event.scheduledDate)}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white truncate mb-1">
                        {event.title}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        📅 {event.scheduledDate.toLocaleDateString()} • 🕐 {event.scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 p-6 rounded-full">
                  <Calendar className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 font-medium">
                No upcoming posts scheduled
              </p>
              <button
                onClick={() => router.push('/workspace/instagram-staging?tab=feed-posts')}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 font-bold"
              >
                Schedule a Post
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
