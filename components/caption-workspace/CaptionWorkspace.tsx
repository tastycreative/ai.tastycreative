'use client';

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import QueuePanel from './QueuePanel';
import ContentViewer from './ContentViewer';
import CaptionEditor from './CaptionEditor';
import ContextPanel from './ContextPanel';
import ReferencePanel from './ReferencePanel';
import { CaptionWorkspaceSkeleton } from './Skeletons';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { QueueTicket, ModelContext, TopCaption, formatPageStrategy } from './types';
import { useCaptionQueue, useUpdateQueueItem } from '@/lib/hooks/useCaptionQueue.query';
import { useInstagramProfile } from '@/lib/hooks/useInstagramProfile.query';

// Resizable panel component
const ResizablePanel = memo(function ResizablePanel({ 
  children, 
  initialHeight = 45,
  minHeight = 25,
  maxHeight = 75
}: { 
  children: React.ReactNode;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}) {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      setHeight(Math.min(Math.max(newHeight, minHeight), maxHeight));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minHeight, maxHeight]);

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div style={{ height: `${height}%` }} className="shrink-0 overflow-hidden">
        {Array.isArray(children) ? children[0] : children}
      </div>
      
      {/* Drag handle */}
      <div 
        className={`h-1.5 cursor-row-resize flex items-center justify-center group transition-colors ${
          isDragging ? 'bg-brand-mid-pink/30' : 'bg-brand-mid-pink/10 hover:bg-brand-mid-pink/20'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`w-12 h-1 rounded-full transition-colors ${
          isDragging ? 'bg-brand-mid-pink' : 'bg-brand-mid-pink/40 group-hover:bg-brand-mid-pink/60'
        }`} />
      </div>
      
      <div className="flex-1 overflow-hidden">
        {Array.isArray(children) && children[1]}
      </div>
    </div>
  );
});

export default function CaptionWorkspace() {
  const [selectedTicket, setSelectedTicket] = useState(0);
  const [activeTab, setActiveTab] = useState<'context' | 'reference'>('context');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Caption drafts stored by ticket ID
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});

  // Fetch real queue data
  const { data: queueData, isLoading, error } = useCaptionQueue();
  const updateQueueMutation = useUpdateQueueItem();
  const queryClient = useQueryClient();

  // Transform API data to match QueueTicket interface
  const allQueue: QueueTicket[] = useMemo(() => 
    queueData?.map(item => ({
      id: item.id,
      model: { 
        name: item.modelName, 
        avatar: item.modelAvatar,
        imageUrl: item.profileImageUrl
      },
      contentTypes: item.contentTypes,
      messageType: item.messageTypes,
      urgency: item.urgency as 'low' | 'medium' | 'high' | 'urgent',
      releaseDate: new Date(item.releaseDate).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      description: item.description,
      driveLink: item.contentSourceType === 'gdrive' ? item.contentUrl || 'https://drive.google.com/...' : 'https://drive.google.com/...',
      videoUrl: item.contentSourceType === 'upload' ? (item.contentUrl || null) : null,
      contentUrl: item.contentUrl,
      contentSourceType: item.contentSourceType as 'upload' | 'gdrive' | null,
    })) || [],
  [queueData]);

  // Filter queue based on search
  const queue = useMemo(() => {
    if (!searchQuery.trim()) return allQueue;
    const search = searchQuery.toLowerCase();
    return allQueue.filter(ticket => 
      ticket.model.name.toLowerCase().includes(search) ||
      ticket.description.toLowerCase().includes(search) ||
      ticket.contentTypes.some(ct => ct.toLowerCase().includes(search))
    );
  }, [allQueue, searchQuery]);

  // Initialize caption drafts from database when queue data loads
  useEffect(() => {
    if (!queueData) return;
    
    setCaptionDrafts(prev => {
      const newDrafts = { ...prev };
      queueData.forEach(item => {
        // Only set if not already in local state and has saved caption
        if (!newDrafts[item.id] && item.captionText) {
          newDrafts[item.id] = item.captionText;
        }
      });
      return newDrafts;
    });
  }, [queueData]);

  // Get the actual index in queueData for the filtered item
  const getOriginalIndex = useCallback((filteredIndex: number) => {
    if (!searchQuery.trim()) return filteredIndex;
    const filteredItem = queue[filteredIndex];
    return queueData?.findIndex(item => item.id === filteredItem.id) ?? filteredIndex;
  }, [queue, queueData, searchQuery]);

  // Fetch profile data for the selected ticket
  const selectedTicketData = queue[selectedTicket];
  const originalIndex = getOriginalIndex(selectedTicket);
  const profileId = queueData?.[originalIndex]?.profileId;
  const { data: profileData } = useInstagramProfile(profileId);

  // Prefetch adjacent profiles for smoother navigation
  useEffect(() => {
    if (!queueData || queueData.length === 0) return;
    
    const indicesToPrefetch = [
      originalIndex - 1,
      originalIndex + 1,
      originalIndex + 2
    ].filter(i => i >= 0 && i < queueData.length);

    indicesToPrefetch.forEach(index => {
      const profileIdToPrefetch = queueData[index]?.profileId;
      if (profileIdToPrefetch) {
        queryClient.prefetchQuery({
          queryKey: ['instagram-profile', profileIdToPrefetch],
          queryFn: async () => {
            const response = await fetch(`/api/instagram-profiles/${profileIdToPrefetch}`);
            if (!response.ok) throw new Error('Failed to fetch profile');
            return response.json();
          },
          staleTime: 1000 * 60 * 5,
        });
      }
    });
  }, [originalIndex, queueData, queryClient]);

  // Get current caption for selected ticket (supports draft persistence)
  const currentCaption = selectedTicketData 
    ? (captionDrafts[selectedTicketData.id] ?? '') 
    : '';

  // Update caption for current ticket
  const handleCaptionChange = useCallback((newCaption: string) => {
    if (!selectedTicketData) return;
    setCaptionDrafts(prev => ({
      ...prev,
      [selectedTicketData.id]: newCaption
    }));
  }, [selectedTicketData]);

  // Check if current ticket has a draft
  const hasDraft = selectedTicketData && captionDrafts[selectedTicketData.id]?.length > 0;

  // Save draft handler
  const handleSaveDraft = useCallback(async (captionText: string) => {
    if (!selectedTicketData || !queueData) return;
    
    const ticketId = queueData[originalIndex]?.id;
    if (!ticketId) return;

    await updateQueueMutation.mutateAsync({
      id: ticketId,
      data: { captionText, status: 'draft' },
    });
  }, [selectedTicketData, queueData, originalIndex, updateQueueMutation]);

  // Submit for QA handler
  const handleSubmitCaption = useCallback(async (captionText: string) => {
    if (!selectedTicketData || !queueData) return;
    
    const ticketId = queueData[originalIndex]?.id;
    if (!ticketId) return;

    await updateQueueMutation.mutateAsync({
      id: ticketId,
      data: { captionText, status: 'pending_qa' },
    });

    // Clear draft after submission
    setCaptionDrafts(prev => {
      const next = { ...prev };
      delete next[selectedTicketData.id];
      return next;
    });

    // Move to next ticket if available
    if (selectedTicket < queue.length - 1) {
      setSelectedTicket(selectedTicket + 1);
    }
  }, [selectedTicketData, queueData, originalIndex, updateQueueMutation, selectedTicket, queue.length]);

  // Handle queue reorder (local state update)
  const handleQueueReorder = useCallback((startIndex: number, endIndex: number) => {
    // If selected ticket is being dragged, update selection
    if (selectedTicket === startIndex) {
      setSelectedTicket(endIndex);
    } else if (startIndex < selectedTicket && endIndex >= selectedTicket) {
      setSelectedTicket(selectedTicket - 1);
    } else if (startIndex > selectedTicket && endIndex <= selectedTicket) {
      setSelectedTicket(selectedTicket + 1);
    }
  }, [selectedTicket]);

  // Transform profile data to ModelContext
  const modelContext: ModelContext = useMemo(() => {
    if (!profileData || !selectedTicketData) {
      return {
        name: selectedTicketData?.model.name || 'Model',
        avatar: selectedTicketData?.model.avatar || 'M',
        imageUrl: selectedTicketData?.model.imageUrl || null,
        pageStrategy: 'Not configured',
        personality: 'No personality data available. Please configure in My Influencers.',
        background: 'No background data available.',
        lingo: [],
        emojis: [],
        restrictions: [],
        wordingToAvoid: [],
      };
    }

    const bible = profileData.modelBible || {};
    
    return {
      name: profileData.name,
      avatar: selectedTicketData.model.avatar,
      imageUrl: profileData.profileImageUrl || selectedTicketData.model.imageUrl || null,
      pageStrategy: formatPageStrategy(profileData.pageStrategy || 'Not configured'),
      personality: bible.personalityDescription || 'No personality data available. Please configure in My Influencers.',
      background: bible.backstory || 'No background data available.',
      lingo: bible.lingoKeywords || [],
      emojis: bible.preferredEmojis || [],
      restrictions: [
        ...(bible.restrictions?.contentLimitations ? [bible.restrictions.contentLimitations] : []),
        ...(bible.restrictions?.wallRestrictions ? [bible.restrictions.wallRestrictions] : []),
        ...(bible.restrictions?.mmExclusions ? [bible.restrictions.mmExclusions] : []),
        ...(bible.restrictions?.customsToAvoid ? [bible.restrictions.customsToAvoid] : []),
      ].filter(Boolean),
      wordingToAvoid: bible.restrictions?.wordingToAvoid || [],
    };
  }, [profileData, selectedTicketData]);

  // Top performing captions
  const topCaptions: TopCaption[] = [
    {
      id: 1,
      caption: "Hey babe 💕 I've been thinking about you all day... finally got some alone time and I made this just for you. I got SO carried away 🙈 Want to see? 😘",
      contentType: 'Solo',
      revenue: 3200,
      sales: 128,
      model: 'Sophia Valentine',
    },
    {
      id: 2,
      caption: "Omg babe... I have to show you what happened last night 🔥 My friend came over and things got... intense. I've never done anything like this before 💕 This is just for you though 🥰",
      contentType: 'BG',
      revenue: 4800,
      sales: 160,
      model: 'Sophia Valentine',
    },
    {
      id: 3,
      caption: "Good morning baby ☀️ I woke up thinking about you... couldn't help myself 🙈 Made a little something in bed just now. Still feels warm 💕 Want to see what you do to me? 😘",
      contentType: 'Solo',
      revenue: 2400,
      sales: 96,
      model: 'Sophia Valentine',
    },
    {
      id: 4,
      caption: "I literally can't stop watching this back 🙈🔥 We made such a mess... but it felt SO good. You have to see this babe 💦 Only sharing with my favorites 💕",
      contentType: 'BG',
      revenue: 5200,
      sales: 173,
      model: 'Sophia Valentine',
    },
    {
      id: 5,
      caption: "Babe... I tried something new today and I'm literally shaking 🥰 I've never felt anything like that before 💦 Had to share it with you immediately 😘✨",
      contentType: 'Solo',
      revenue: 2800,
      sales: 112,
      model: 'Sophia Valentine',
    },
  ];

  // Restricted word checker - memoized
  const restrictedWordsFound = useMemo(() => {
    const found: string[] = [];
    modelContext.wordingToAvoid.forEach(word => {
      if (currentCaption.toLowerCase().includes(word.toLowerCase())) {
        found.push(word);
      }
    });
    return found;
  }, [currentCaption, modelContext.wordingToAvoid]);

  const handleAddToCaption = useCallback((text: string) => {
    if (!selectedTicketData) return;
    setCaptionDrafts(prev => ({
      ...prev,
      [selectedTicketData.id]: (prev[selectedTicketData.id] || '') + text
    }));
  }, [selectedTicketData]);

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-brand-off-white dark:bg-gray-950 border border-brand-mid-pink/20 rounded-2xl shadow-lg custom-scrollbar">
      {/* Responsive grid: stack on mobile, 3-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] grid-rows-[60px_1fr] h-[85vh]">
        {/* Header */}
        <div className="col-span-1 lg:col-span-3 px-4 lg:px-6 border-b border-brand-mid-pink/20 flex items-center justify-between bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl sticky top-0 z-40 rounded-t-2xl">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-linear-to-br from-brand-mid-pink to-brand-light-pink shadow-lg shadow-brand-mid-pink/30">
              <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Caption Workspace</h1>
              <p className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400">Write and manage captions</p>
            </div>
            <span className="hidden sm:inline-block px-2 py-1 bg-brand-mid-pink/15 text-brand-mid-pink dark:text-brand-light-pink rounded text-[10px] lg:text-xs font-semibold">
              {queue.length}{searchQuery && `/${allQueue.length}`} in queue
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasDraft && (
              <span className="hidden sm:inline-block px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-[10px] font-medium">
                Draft
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="col-span-1 lg:col-span-3">
            <CaptionWorkspaceSkeleton />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="col-span-1 lg:col-span-3 p-6">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">Failed to load queue. Please refresh the page.</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && allQueue.length === 0 && (
          <div className="col-span-1 lg:col-span-3 flex items-center justify-center py-20">
            <div className="text-center max-w-md px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-mid-pink/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-brand-mid-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No tasks in queue</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Add caption tasks from the Caption Queue page or wait for tasks to be assigned from OTP/PTR submissions.
              </p>
              <a 
                href="caption-queue" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-brand-mid-pink/30"
              >
                Go to Caption Queue
              </a>
            </div>
          </div>
        )}

        {/* Main Content - Only show if we have queue items */}
        {!isLoading && !error && queue.length > 0 && (
          <>
        {/* Left Panel: Queue - Hidden on mobile, shown with toggle */}
        <div className="hidden lg:block">
          <ErrorBoundary componentName="Queue Panel">
            <QueuePanel 
              queue={queue} 
              selectedTicket={selectedTicket} 
              onSelectTicket={setSelectedTicket}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onReorder={handleQueueReorder}
            />
          </ErrorBoundary>
        </div>

        {/* Center Panel: Content Viewer + Editor with Resizable */}
        <div className="overflow-hidden">
          <ResizablePanel initialHeight={40} minHeight={25} maxHeight={65}>
            <ErrorBoundary componentName="Content Viewer">
              <ContentViewer ticket={queue[selectedTicket]} />
            </ErrorBoundary>
            <ErrorBoundary componentName="Caption Editor">
              <CaptionEditor
                caption={currentCaption}
                onCaptionChange={handleCaptionChange}
                modelContext={modelContext}
                restrictedWordsFound={restrictedWordsFound}
                isDraft={hasDraft}
                ticketId={selectedTicketData?.id}
                onSaveDraft={handleSaveDraft}
                onSubmit={handleSubmitCaption}
              />
            </ErrorBoundary>
          </ResizablePanel>
        </div>

        {/* Right Panel: Context + Reference - Hidden on mobile */}
        <div className="hidden lg:flex border-l border-brand-mid-pink/20 flex-col overflow-hidden bg-white dark:bg-gray-900/80">
          {/* Tabs */}
          <div className="flex border-b border-brand-mid-pink/20">
            <button
              onClick={() => setActiveTab('context')}
              className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'context'
                  ? 'bg-brand-off-white dark:bg-gray-800 border-brand-mid-pink text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Model Context
            </button>
            <button
              onClick={() => setActiveTab('reference')}
              className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'reference'
                  ? 'bg-brand-off-white dark:bg-gray-800 border-brand-mid-pink text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Top Captions
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'context' ? (
              <ErrorBoundary componentName="Context Panel">
                <ContextPanel 
                  modelContext={modelContext} 
                  onAddToCaption={handleAddToCaption} 
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary componentName="Reference Panel">
                <ReferencePanel topCaptions={topCaptions} />
              </ErrorBoundary>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
