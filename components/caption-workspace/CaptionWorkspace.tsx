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
import { useCaptionQueue, useUpdateQueueItem, useUpdateContentItemCaption } from '@/lib/hooks/useCaptionQueue.query';
import { useInstagramProfile } from '@/lib/hooks/useInstagramProfile.query';
import { useCaptionQueueSSE, type RemoteCaptionUpdate } from '@/lib/hooks/useCaptionQueueSSE';
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
  
  // Caption drafts stored by "ticketId" (legacy) or "ticketId:itemId" (multi-item)
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});

  // Per-ticket selected content item index
  const [selectedItemIndices, setSelectedItemIndices] = useState<Record<string, number>>({});

  // Per-ticket timestamp of the last local keystroke — used to avoid overwriting
  // text the current user is actively typing with a real-time SSE update from another user.
  const lastLocalEditRef = useRef<Record<string, number>>({});

  // Fetch real queue data
  const { data: queueData, isLoading, error } = useCaptionQueue();
  const updateQueueMutation = useUpdateQueueItem();
  const updateItemCaptionMutation = useUpdateContentItemCaption();
  const queryClient = useQueryClient();

  // Real-time: when another org member saves a caption, push it into our
  // local draft state — unless the current user typed in that ticket within
  // the last 5 seconds (i.e. they're actively editing it themselves).
  const handleRemoteCaption = useCallback((update: RemoteCaptionUpdate) => {
    if (update.captionText === null) return;
    const lastEdit = lastLocalEditRef.current[update.ticketId] ?? 0;
    const idleLongEnough = Date.now() - lastEdit > 5_000;
    if (!idleLongEnough) return; // user is actively typing — don't interrupt
    setCaptionDrafts(prev => ({ ...prev, [update.ticketId]: update.captionText! }));
  }, []);

  // Subscribe to real-time push events.
  useCaptionQueueSSE({ onRemoteCaption: handleRemoteCaption });

  // Transform API data to match QueueTicket interface
  // Show tickets the captioner needs to act on:
  //   - pending, draft, in_progress: normal flow
  //   - in_revision: captioner actively revising rejected items (after QA re-push)
  // Hide: pending_qa (waiting for QA), completed (done),
  //        partially_approved (QA still reviewing — items stay until explicit re-push)
  const allQueue: QueueTicket[] = useMemo(() => 
    (queueData || [])
      .filter(item => !['pending_qa', 'completed', 'partially_approved'].includes(item.status))
      .map(item => ({
      id: item.id,
      status: item.status,
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
      driveLink: item.workflowType === 'otp_ptr'
        ? (item.contentItems?.[0]?.url || item.contentUrl || 'https://drive.google.com/...')
        : (item.contentSourceType === 'gdrive' ? item.contentUrl || 'https://drive.google.com/...' : 'https://drive.google.com/...'),
      videoUrl: item.workflowType === 'otp_ptr' ? null : (item.contentSourceType === 'upload' ? (item.contentUrl || null) : null),
      contentUrl: item.contentUrl,
      // OTP/PTR tickets store the Drive link on the first content item, not at ticket level
      contentSourceType: (item.workflowType === 'otp_ptr' ? 'gdrive' : item.contentSourceType) as 'upload' | 'gdrive' | null,
      contentItems: (item.contentItems || []).map(ci => ({
        id: ci.id,
        url: ci.url,
        sourceType: ci.sourceType as 'upload' | 'gdrive',
        fileName: ci.fileName,
        fileType: ci.fileType as 'image' | 'video' | null,
        sortOrder: ci.sortOrder,
        captionText: ci.captionText,
        requiresCaption: ci.requiresCaption ?? true,
        captionStatus: ci.captionStatus ?? 'pending',
        qaRejectionReason: ci.qaRejectionReason ?? null,
        qaRejectedAt: ci.qaRejectedAt ?? null,
        qaRejectedBy: ci.qaRejectedBy ?? null,
        qaApprovedAt: ci.qaApprovedAt ?? null,
        qaApprovedBy: ci.qaApprovedBy ?? null,
        revisionCount: ci.revisionCount ?? 0,
      })),
      qaRejectionReason: item.qaRejectionReason ?? null,
      workflowType: item.workflowType ?? null,
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

  // Clamp selectedTicket whenever the filtered queue shrinks (e.g. a ticket is completed and filtered out)
  useEffect(() => {
    if (queue.length > 0 && selectedTicket >= queue.length) {
      setSelectedTicket(queue.length - 1);
    }
  }, [queue.length, selectedTicket]);

  // Initialize caption drafts from database when queue data loads
  useEffect(() => {
    if (!queueData) return;
    
    setCaptionDrafts(prev => {
      const newDrafts = { ...prev };
      queueData.forEach(item => {
        // Legacy single-caption tickets (no content items)
        if (!item.contentItems?.length && !newDrafts[item.id] && item.captionText) {
          newDrafts[item.id] = item.captionText;
        }
        // OTP/PTR: ticket-level caption stored in captionText (content items are display-only)
        if (item.workflowType === 'otp_ptr' && !newDrafts[item.id] && item.captionText) {
          newDrafts[item.id] = item.captionText;
        }
        // Per-item captions
        item.contentItems?.forEach(ci => {
          const key = `${item.id}:${ci.id}`;
          if (!newDrafts[key] && ci.captionText) {
            newDrafts[key] = ci.captionText;
          }
        });
      });
      return newDrafts;
    });
  }, [queueData]);

  // Get the actual index in queueData for the filtered item
  // Always look up by ID — queueData includes all statuses so indices don't match queue's filtered indices
  const getOriginalIndex = useCallback((filteredIndex: number) => {
    const filteredItem = queue[filteredIndex];
    if (!filteredItem || !queueData) return filteredIndex;
    const idx = queueData.findIndex(item => item.id === filteredItem.id);
    return idx >= 0 ? idx : filteredIndex;
  }, [queue, queueData]);

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

  // ── Per-item helpers ──────────────────────────────────────────────────
  const hasMultipleItems = (selectedTicketData?.contentItems?.length ?? 0) > 0;
  const currentItemIndex = selectedTicketData
    ? (selectedItemIndices[selectedTicketData.id] ?? 0)
    : 0;
  const currentItem = selectedTicketData?.contentItems?.[currentItemIndex] ?? null;

  // Items that the captioner needs to work on (not approved, not not_required)
  const actionableItemIndices = useMemo(() => {
    if (!selectedTicketData?.contentItems) return [];
    return selectedTicketData.contentItems
      .map((ci, idx) => ({ idx, status: ci.captionStatus }))
      .filter(({ status }) => !['approved', 'not_required'].includes(status))
      .map(({ idx }) => idx);
  }, [selectedTicketData?.contentItems]);

  // Whether the current item is locked (approved or not_required)
  const isCurrentItemLocked = currentItem
    ? ['approved', 'not_required'].includes(currentItem.captionStatus)
    : false;

  // ── OTP/PTR single-caption mode ──────────────────────────────────────
  // OTP/PTR tickets require ONE caption at ticket level (not per-item).
  // We override the per-item signals so the workspace behaves like a legacy
  // single-caption ticket: no item navigation, editor always unlocked.
  const isOtpPtr = selectedTicketData?.workflowType === 'otp_ptr';
  const effectiveCurrentItem     = isOtpPtr ? null : currentItem;
  const effectiveHasMultipleItems = isOtpPtr ? false : hasMultipleItems;
  const effectiveIsLocked         = isOtpPtr ? false : isCurrentItemLocked;

  // Auto-navigate to first actionable item when selecting a ticket
  // (skip approved items so the captioner lands on work that needs doing)
  useEffect(() => {
    if (!selectedTicketData?.id) return;
    const storedIdx = selectedItemIndices[selectedTicketData.id];
    if (storedIdx !== undefined) return; // user already navigated manually
    if (actionableItemIndices.length > 0 && actionableItemIndices[0] !== 0) {
      setSelectedItemIndices(prev => ({ ...prev, [selectedTicketData.id]: actionableItemIndices[0] }));
    }
  }, [selectedTicketData?.id, actionableItemIndices]); // eslint-disable-line react-hooks/exhaustive-deps

  const captionDraftKey = selectedTicketData
    ? (effectiveCurrentItem ? `${selectedTicketData.id}:${effectiveCurrentItem.id}` : selectedTicketData.id)
    : '';

  // Current caption (item-aware)
  const currentCaption = captionDraftKey ? (captionDrafts[captionDraftKey] ?? '') : '';

  // Update caption (item-aware)
  const handleCaptionChange = useCallback((newCaption: string) => {
    if (!captionDraftKey) return;
    lastLocalEditRef.current[captionDraftKey] = Date.now();
    setCaptionDrafts(prev => ({ ...prev, [captionDraftKey]: newCaption }));
  }, [captionDraftKey]);

  // Navigate to a specific item within the current ticket.
  // Flush the current item's draft immediately (fire-and-forget) so rapid
  // navigation can't lose text that hasn't hit the 3-second auto-save debounce yet.
  const handleSelectItem = useCallback((itemIndex: number) => {
    if (!selectedTicketData) return;

    // Flush current item draft before switching
    if (effectiveCurrentItem && captionDraftKey) {
      const draftText = captionDrafts[captionDraftKey];
      if (draftText && draftText.length > 0) {
        // Fire-and-forget — navigation is instant, save runs in background
        updateItemCaptionMutation.mutate({ itemId: effectiveCurrentItem.id, captionText: draftText });
      }
    }

    setSelectedItemIndices(prev => ({ ...prev, [selectedTicketData.id]: itemIndex }));
  }, [selectedTicketData, effectiveCurrentItem, captionDraftKey, captionDrafts, updateItemCaptionMutation]);

  // Check if current slot has a draft
  const hasDraft = !!captionDraftKey && (captionDrafts[captionDraftKey]?.length ?? 0) > 0;

  // Save draft handler (item-aware)
  const handleSaveDraft = useCallback(async (captionText: string) => {
    if (!selectedTicketData || !queueData) return;
    
    if (effectiveCurrentItem) {
      // Save to the specific content item
      await updateItemCaptionMutation.mutateAsync({ itemId: effectiveCurrentItem.id, captionText });
    } else {
      // Legacy single-caption ticket OR OTP/PTR: save to ticket's captionText field
      const ticketId = selectedTicketData.id;
      await updateQueueMutation.mutateAsync({ id: ticketId, data: { captionText, status: 'draft' } });
    }
  }, [selectedTicketData, queueData, effectiveCurrentItem, updateItemCaptionMutation, updateQueueMutation]);

  // Submit ALL items at once — saves every in-memory draft and marks the ticket pending_qa.
  // Empty items are allowed through: we only save items that have text in draft.
  const handleSubmitAll = useCallback(async () => {
    if (!selectedTicketData || !queueData) return;
    const ticketId = selectedTicketData.id;

    // Save every actionable item that has a draft in memory (even if it hasn't auto-saved yet)
    const itemsToSave = selectedTicketData.contentItems
      .filter(ci => !['approved', 'not_required'].includes(ci.captionStatus))
      .filter(ci => {
        const key = `${ticketId}:${ci.id}`;
        const draft = captionDrafts[key];
        // Save if the in-memory draft differs from what's persisted
        return draft !== undefined && draft !== (ci.captionText ?? '');
      });

    if (itemsToSave.length > 0) {
      await Promise.all(
        itemsToSave.map(ci =>
          updateItemCaptionMutation.mutateAsync({
            itemId: ci.id,
            captionText: captionDrafts[`${ticketId}:${ci.id}`] ?? '',
          }),
        ),
      );
    }

    // Mark the whole ticket as pending_qa
    await updateQueueMutation.mutateAsync({ id: ticketId, data: { status: 'pending_qa' } });

    // Clear all item drafts for this ticket
    setCaptionDrafts(prev => {
      const next = { ...prev };
      selectedTicketData.contentItems.forEach(ci => {
        delete next[`${ticketId}:${ci.id}`];
      });
      return next;
    });

    const captionedCount = selectedTicketData.contentItems.filter(ci => {
      const key = `${ticketId}:${ci.id}`;
      return captionDrafts[key] || ci.captionText;
    }).length;
    toast.success(`Submitted for QA (${captionedCount}/${selectedTicketData.contentItems.length} captioned) ✓`);
    setSelectedTicket(0);
    setSelectedItemIndices({});
  }, [selectedTicketData, queueData, captionDrafts, updateItemCaptionMutation, updateQueueMutation]);

  // Submit caption handler (item-aware)
  const handleSubmitCaption = useCallback(async (captionText: string) => {
    if (!selectedTicketData || !queueData) return;
    // Use the ticket ID directly from selectedTicketData — never derive via array index
    const ticketId = selectedTicketData.id;

    // OTP/PTR: single ticket-level caption — save + move to pending_qa immediately
    if (isOtpPtr) {
      await updateQueueMutation.mutateAsync({ id: ticketId, data: { captionText, status: 'pending_qa' } });
      setCaptionDrafts(prev => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      // Guaranteed real-time update — don't depend solely on Ably delivering the event.
      // Invalidate caption-queue so queue count & ticket list refresh immediately,
      // and board-items so the OTP/PTR modal status flips to AWAITING_APPROVAL.
      queryClient.invalidateQueries({ queryKey: ['caption-queue'] });
      queryClient.invalidateQueries({ queryKey: ['board-items'] });
      toast.success('Caption submitted for QA approval ✓');
      setSelectedTicket(0);
      return;
    }

    if (effectiveCurrentItem) {
      // Save the item caption
      await updateItemCaptionMutation.mutateAsync({ itemId: effectiveCurrentItem.id, captionText });
      // Clear this item's draft
      setCaptionDrafts(prev => {
        const next = { ...prev };
        delete next[captionDraftKey];
        return next;
      });

      // Find the next actionable item (skip approved/not_required items)
      const remainingActionable = actionableItemIndices.filter(idx => idx > currentItemIndex);

      if (remainingActionable.length > 0) {
        // Advance to next actionable item
        setSelectedItemIndices(prev => ({ ...prev, [ticketId]: remainingActionable[0] }));
      } else {
        // Safety net: flush any other actionable items that still have unsaved drafts in memory.
        // This handles the case where the user typed quickly and navigated before the
        // 3-second auto-save debounce could fire (which resets/cancels on item change).
        const otherUnsavedItems = actionableItemIndices
          .filter(idx => idx !== currentItemIndex)
          .map(idx => selectedTicketData.contentItems[idx])
          .filter(ci => {
            const key = `${ticketId}:${ci.id}`;
            const draft = captionDrafts[key];
            return draft && draft.length > 0 && draft !== ci.captionText;
          });

        if (otherUnsavedItems.length > 0) {
          await Promise.all(
            otherUnsavedItems.map(ci =>
              updateItemCaptionMutation.mutateAsync({
                itemId: ci.id,
                captionText: captionDrafts[`${ticketId}:${ci.id}`],
              })
            )
          );
        }

        // All actionable items done — mark ticket as pending_qa
        await updateQueueMutation.mutateAsync({ id: ticketId, data: { status: 'pending_qa' } });
        const totalActionable = actionableItemIndices.length;
        const totalApproved = selectedTicketData.contentItems.filter(ci => ci.captionStatus === 'approved').length;
        if (totalApproved > 0) {
          toast.success(`${totalActionable} caption${totalActionable > 1 ? 's' : ''} resubmitted for QA (${totalApproved} already approved) ✓`);
        } else {
          toast.success('All captions submitted! Ticket moved to QA ✓');
        }
        // Reset to first ticket — the completed ticket will be filtered out after refetch
        setSelectedTicket(0);
        setSelectedItemIndices({});
      }
    } else {
      // Legacy single-caption ticket
      await updateQueueMutation.mutateAsync({ id: ticketId, data: { captionText, status: 'pending_qa' } });
      setCaptionDrafts(prev => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      toast.success('Caption submitted! Ticket moved to QA ✓');
      setSelectedTicket(0);
    }
  }, [selectedTicketData, queueData, isOtpPtr, effectiveCurrentItem, currentItemIndex, captionDraftKey,
      actionableItemIndices, updateItemCaptionMutation, updateQueueMutation]);

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
    <div className="h-[85vh] overflow-hidden bg-brand-off-white dark:bg-gray-950 border border-brand-mid-pink/20 rounded-2xl shadow-lg">
      {/* Responsive grid: stack on mobile, 3-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] grid-rows-[60px_1fr] h-full">
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
        <div className="hidden lg:flex lg:flex-col h-full overflow-hidden">
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
        <div className="flex flex-col h-full overflow-hidden">
          {/* OTP/PTR: rejection banner — shown when PGT Team sent the caption back */}
          {isOtpPtr && selectedTicketData?.status === 'in_revision' && (
            <div className="flex items-start gap-2.5 px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-[11px] shrink-0">
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <span className="font-semibold text-red-400">Needs Revision — </span>
                <span className="text-red-300">
                  {selectedTicketData?.qaRejectionReason
                    ? selectedTicketData.qaRejectionReason
                    : 'PGT Team has sent this caption back for revision. Please update and resubmit.'}
                </span>
              </div>
            </div>
          )}
          {/* OTP/PTR single-caption mode indicator */}
          {isOtpPtr && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue/10 border-b border-brand-blue/20 text-[11px] font-medium text-brand-blue dark:text-brand-blue shrink-0">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              OTP/PTR — Write one caption for the Drive content below, then submit for PGT Team approval.
            </div>
          )}
          <ResizablePanel initialHeight={40} minHeight={25} maxHeight={65}>
            <ErrorBoundary componentName="Content Viewer">
              <ContentViewer
                key={queue[selectedTicket]?.id ?? 'empty'}
                ticket={queue[selectedTicket]}
                selectedItemIndex={currentItemIndex}
                onSelectItem={handleSelectItem}
              />
            </ErrorBoundary>
            <ErrorBoundary componentName="Caption Editor">
              <CaptionEditor
                caption={currentCaption}
                onCaptionChange={handleCaptionChange}
                modelContext={modelContext}
                restrictedWordsFound={restrictedWordsFound}
                isDraft={hasDraft}
                ticketId={captionDraftKey || selectedTicketData?.id}
                onSaveDraft={effectiveIsLocked ? undefined : handleSaveDraft}
                onSubmit={effectiveIsLocked ? undefined : handleSubmitCaption}
                onSubmitAll={effectiveIsLocked || !effectiveHasMultipleItems ? undefined : handleSubmitAll}
                currentItemIndex={effectiveHasMultipleItems ? currentItemIndex : undefined}
                totalItems={effectiveHasMultipleItems ? (selectedTicketData?.contentItems.length ?? 0) : undefined}
                actionableCount={effectiveHasMultipleItems ? actionableItemIndices.length : undefined}
                qaRejectionReason={effectiveCurrentItem?.qaRejectionReason ?? selectedTicketData?.qaRejectionReason}
                itemCaptionStatus={effectiveCurrentItem?.captionStatus}
                isLocked={effectiveIsLocked}
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
