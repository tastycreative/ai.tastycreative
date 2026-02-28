'use client';

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  Pencil,
  Users,
  CheckSquare,
  UserCheck,
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  UserCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { type CaptionQueueItem } from '@/lib/hooks/useCaptionQueue.query';
import { useInstagramProfiles } from '@/lib/hooks/useInstagramProfiles.query';
import { useOrgCreators, type OrgCreator } from '@/lib/hooks/useOrgCreators.query';
import { useOrgRole } from '@/lib/hooks/useOrgRole.query';

const MESSAGE_TYPE_OPTIONS = [
  'Mass DM',
  'Tip Me',
  'Renew',
  'Bundle Unlock',
  'Wall Post',
  'Wall Post Campaign',
  'PPV',
  'Welcome Message',
  'Expired Fan',
  'Sexting Script',
];

interface CaptionQueueEditModalProps {
  item: CaptionQueueItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CaptionQueueEditModal({ item, isOpen, onClose }: CaptionQueueEditModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');

  const queryClient = useQueryClient();
  const { canManageQueue } = useOrgRole();
  const { data: profiles } = useInstagramProfiles();
  const { data: creators = [], isLoading: creatorsLoading } = useOrgCreators(canManageQueue);

  // Parse persisted releaseDate into date + time parts
  const parsedDate = item ? new Date(item.releaseDate) : new Date();
  const defaultDate = parsedDate.toISOString().split('T')[0];
  const defaultTime = parsedDate.toTimeString().slice(0, 5);

  const [formData, setFormData] = useState({
    description: '',
    urgency: 'medium',
    releaseDate: defaultDate,
    releaseTime: defaultTime,
    contentTypes: [] as string[],
    messageTypes: [] as string[],
    assignedCreatorClerkIds: [] as string[],
  });

  // Reset form whenever the item changes (new card opened)
  useEffect(() => {
    if (!item) return;
    const d = new Date(item.releaseDate);
    setFormData({
      description: item.description,
      urgency: item.urgency,
      releaseDate: d.toISOString().split('T')[0],
      releaseTime: d.toTimeString().slice(0, 5),
      contentTypes: [...item.contentTypes],
      messageTypes: [...item.messageTypes],
      assignedCreatorClerkIds: item.assignees?.map((a) => a.clerkId) ?? [],
    });
    setError(null);
    setCreatorSearchQuery('');
  }, [item]);

  // Mount guard for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Drive enter / exit animation
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Available content types for the item's profile
  const availableContentTypes = useMemo(() => {
    if (!item?.profileId || !profiles) return item?.contentTypes ?? [];
    const profile = profiles.find((p) => p.id === item.profileId);
    if (!profile) return item.contentTypes;
    return Array.from(new Set([
      ...profile.selectedContentTypes,
      ...profile.customContentTypes,
      ...item.contentTypes, // always keep currently selected types
    ].filter(Boolean)));
  }, [item, profiles]);

  // Creator filtering
  const filteredCreators = useMemo(() => {
    if (!creatorSearchQuery.trim()) return creators;
    const q = creatorSearchQuery.toLowerCase();
    return creators.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q),
    );
  }, [creators, creatorSearchQuery]);

  const allCreatorsSelected =
    creators.length > 0 &&
    creators.every((c) => formData.assignedCreatorClerkIds.includes(c.clerkId));

  const handleAssignAll = () => {
    setFormData((prev) => ({
      ...prev,
      assignedCreatorClerkIds: allCreatorsSelected ? [] : creators.map((c) => c.clerkId),
    }));
  };

  const toggleCreator = (clerkId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedCreatorClerkIds: prev.assignedCreatorClerkIds.includes(clerkId)
        ? prev.assignedCreatorClerkIds.filter((id) => id !== clerkId)
        : [...prev.assignedCreatorClerkIds, clerkId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }
    if (formData.contentTypes.length === 0) {
      setError('Please select at least one content type');
      return;
    }
    if (formData.messageTypes.length === 0) {
      setError('Please select at least one message type');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const releaseDatetime = `${formData.releaseDate}T${formData.releaseTime}:00.000Z`;

      const response = await fetch(`/api/caption-queue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description.trim(),
          urgency: formData.urgency,
          releaseDate: new Date(releaseDatetime),
          contentTypes: formData.contentTypes,
          messageTypes: formData.messageTypes,
          assignedCreatorClerkIds: formData.assignedCreatorClerkIds,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || 'Failed to update queue item');
      }

      await queryClient.invalidateQueries({ queryKey: ['caption-queue'] });
      toast.success('Queue item updated');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update queue item');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared style constants (mirrors CaptionQueueForm) ──────────────────
  const inputCls = 'w-full px-3.5 py-2.5 bg-white dark:bg-[#0f0d18] border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/15 focus:border-brand-mid-pink dark:focus:border-brand-mid-pink/60 focus:ring-2 focus:ring-brand-mid-pink/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/25 text-sm rounded-xl outline-none transition-all';
  const chipBase = 'px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none';
  const chipOff  = 'bg-white dark:bg-white/4 border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-white/40 hover:border-brand-mid-pink/40 hover:text-brand-mid-pink dark:hover:border-brand-mid-pink/35 dark:hover:text-brand-mid-pink/80';
  const chipOn   = 'bg-brand-mid-pink/12 dark:bg-brand-mid-pink/15 border-brand-mid-pink/45 text-brand-mid-pink shadow-sm shadow-brand-mid-pink/10';
  const sectionCard = 'rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/3 p-4 space-y-4';
  const urgencyOptions = [
    { value: 'low',    label: 'Low',    active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/10', dot: 'bg-emerald-500' },
    { value: 'medium', label: 'Medium', active: 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm shadow-amber-500/10',   dot: 'bg-amber-500' },
    { value: 'high',   label: 'High',   active: 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400 shadow-sm shadow-orange-500/10', dot: 'bg-orange-500' },
    { value: 'urgent', label: 'Urgent', active: 'bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400 shadow-sm shadow-red-500/10',            dot: 'bg-red-500' },
  ];
  const sectionLabel = (icon: React.ReactNode, title: string, sub?: string) => (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-brand-mid-pink/10 dark:bg-brand-mid-pink/15 text-brand-mid-pink shrink-0">
        {icon}
      </div>
      <div>
        <span className="text-xs font-semibold text-zinc-700 dark:text-white/70 tracking-tight">{title}</span>
        {sub && <span className="ml-1.5 text-[11px] text-zinc-400 dark:text-white/30">{sub}</span>}
      </div>
    </div>
  );

  if (!isOpen || !mounted || !item) return null;

  const selectedModel = profiles?.find((p) => p.id === item.profileId);

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? 'bg-black/65 backdrop-blur-md' : 'bg-transparent backdrop-blur-none'
      }`}
      onClick={onClose}
    >
      {/* Ambient glow behind the panel */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-87.5 bg-brand-mid-pink/8 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-125 h-62.5 bg-brand-blue/6 blur-[100px] rounded-full" />
      </div>

      {/* Panel */}
      <div
        className={`relative max-w-3xl w-full max-h-[90vh] overflow-hidden rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] border transition-all duration-300
          bg-white dark:bg-[#0d0b16]
          border-zinc-200/80 dark:border-white/8
          ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-3'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-brand-mid-pink/70 to-transparent" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-white/6">
          {/* Subtle header tint */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-brand-mid-pink/4 to-transparent" />

          <div className="relative flex items-center gap-3.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-mid-pink/10 dark:bg-brand-mid-pink/15 border border-brand-mid-pink/20 dark:border-brand-mid-pink/25 shadow-sm shadow-brand-mid-pink/10">
              <Pencil className="w-4 h-4 text-brand-mid-pink" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
                Edit Queue Item
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-white/35 mt-0.5">
                #{item.id.slice(0, 8).toUpperCase()} &middot; {item.modelName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="relative flex items-center justify-center w-7 h-7 rounded-lg
              bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10
              border border-zinc-200 dark:border-white/8 hover:border-zinc-300 dark:hover:border-white/15
              text-zinc-400 hover:text-zinc-600 dark:text-white/40 dark:hover:text-white/70
              transition-all duration-200"
            aria-label="Close modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto max-h-[calc(90vh-73px)] custom-scrollbar bg-zinc-50 dark:bg-[#0a0812]">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-900/40 rounded-xl">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400 leading-snug">{error}</p>
              </div>
            )}

            {/* ── Section 1: Task Details ──────────────────────────────── */}
            <div className={sectionCard}>
              {sectionLabel(<UserCircle className="w-3.5 h-3.5" />, 'Task Details')}

              {/* Read-only model badge */}
              <div className="flex items-center gap-2.5">
                <div className="shrink-0">
                  {item.profileImageUrl ? (
                    <img
                      src={item.profileImageUrl}
                      alt={item.modelName}
                      className="w-9 h-9 rounded-full object-cover border-2 border-brand-mid-pink/20 shadow-sm"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-xs font-semibold text-white border-2 border-brand-mid-pink/20 shadow-sm">
                      {item.modelAvatar}
                    </div>
                  )}
                </div>
                <div className="flex-1 px-3.5 py-2 bg-zinc-50 dark:bg-white/3 border border-zinc-200 dark:border-white/10 rounded-xl">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.modelName}</p>
                  <p className="text-[11px] text-zinc-400 dark:text-white/30">Model — cannot be changed after creation</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-white/40 mb-1.5">
                  Description <span className="text-brand-mid-pink">*</span>
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`${inputCls} resize-none`}
                  rows={3}
                  placeholder="Brief description of the content…"
                />
              </div>
            </div>

            {/* ── Section 2: Tags ──────────────────────────────────────── */}
            <div className={sectionCard}>
              {sectionLabel(<FileText className="w-3.5 h-3.5" />, 'Tags')}

              <div className="grid grid-cols-2 gap-4">
                {/* Content Types */}
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-white/40 mb-2">
                    Content Types <span className="text-brand-mid-pink">*</span>
                  </p>
                  {availableContentTypes.length === 0 ? (
                    <p className="text-xs text-zinc-400 dark:text-white/25 italic">No content types available</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableContentTypes.map((type) => {
                        const on = formData.contentTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                contentTypes: on
                                  ? formData.contentTypes.filter((t) => t !== type)
                                  : [...formData.contentTypes, type],
                              })
                            }
                            className={`${chipBase} ${on ? chipOn : chipOff}`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Message Types */}
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-white/40 mb-2">
                    Message Types <span className="text-brand-mid-pink">*</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MESSAGE_TYPE_OPTIONS.map((type) => {
                      const on = formData.messageTypes.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              messageTypes: on
                                ? formData.messageTypes.filter((t) => t !== type)
                                : [...formData.messageTypes, type],
                            })
                          }
                          className={`${chipBase} ${on ? chipOn : chipOff}`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 3: Schedule ──────────────────────────────────── */}
            <div className={sectionCard}>
              {sectionLabel(<Calendar className="w-3.5 h-3.5" />, 'Schedule')}

              {/* Urgency */}
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-white/40 mb-2">
                  Urgency <span className="text-brand-mid-pink">*</span>
                </p>
                <div className="flex gap-2">
                  {urgencyOptions.map((opt) => {
                    const isActive = formData.urgency === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, urgency: opt.value })}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                          isActive
                            ? opt.active
                            : 'bg-white dark:bg-white/4 border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-white/35 hover:border-zinc-300 dark:hover:border-white/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? opt.dot : 'bg-zinc-300 dark:bg-white/20'}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date + Time */}
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-white/40 mb-2">
                  Release Date & Time <span className="text-brand-mid-pink">*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-white/25 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={formData.releaseDate}
                      onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-white/25 pointer-events-none" />
                    <input
                      type="time"
                      required
                      value={formData.releaseTime}
                      onChange={(e) => setFormData({ ...formData, releaseTime: e.target.value })}
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 4: Assign Creators ───────────────────────────── */}
            {canManageQueue && (
              <div className={sectionCard}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-brand-mid-pink/10 dark:bg-brand-mid-pink/15 text-brand-mid-pink shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-white/70 tracking-tight">Assign Creators</span>
                      <span className="ml-1.5 text-[11px] text-zinc-400 dark:text-white/30">(optional)</span>
                    </div>
                  </div>

                  {creators.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAssignAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all
                        border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-white/40
                        hover:border-brand-mid-pink/40 hover:text-brand-mid-pink dark:hover:border-brand-mid-pink/30 dark:hover:text-brand-mid-pink/80"
                    >
                      {allCreatorsSelected ? (
                        <><CheckSquare size={12} /> Deselect All</>
                      ) : (
                        <><UserCheck size={12} /> Assign All</>
                      )}
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-white/2 overflow-hidden">
                  {creatorsLoading ? (
                    <div className="px-4 py-3.5 flex items-center gap-2 text-xs text-zinc-400 dark:text-white/30">
                      <span className="w-3 h-3 rounded-full border-2 border-brand-mid-pink/40 border-t-brand-mid-pink animate-spin inline-block" />
                      Loading creators…
                    </div>
                  ) : creators.length === 0 ? (
                    <div className="px-4 py-3.5 text-xs text-zinc-400 dark:text-white/30">
                      No creators in this organization.
                    </div>
                  ) : (
                    <>
                      {creators.length > 5 && (
                        <div className="px-3 pt-3 pb-2 border-b border-zinc-100 dark:border-white/6">
                          <input
                            type="text"
                            placeholder="Search creators…"
                            value={creatorSearchQuery}
                            onChange={(e) => setCreatorSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-mid-pink/30 focus:border-brand-mid-pink/50 transition-all"
                          />
                        </div>
                      )}
                      <div className="max-h-44 overflow-y-auto custom-scrollbar py-1">
                        {filteredCreators.length === 0 ? (
                          <p className="px-4 py-2.5 text-xs text-zinc-400 dark:text-white/25">No results match your search.</p>
                        ) : (
                          filteredCreators.map((creator: OrgCreator) => {
                            const selected = formData.assignedCreatorClerkIds.includes(creator.clerkId);
                            const displayName = creator.name || creator.email || 'Unknown';
                            const initials = displayName.substring(0, 2).toUpperCase();
                            return (
                              <button
                                key={creator.clerkId}
                                type="button"
                                onClick={() => toggleCreator(creator.clerkId)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                  selected
                                    ? 'bg-brand-mid-pink/8 dark:bg-brand-mid-pink/10'
                                    : 'hover:bg-zinc-100 dark:hover:bg-white/4'
                                }`}
                              >
                                <div className="shrink-0">
                                  {creator.imageUrl ? (
                                    <img
                                      src={creator.imageUrl}
                                      alt={displayName}
                                      className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-white/10"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-[10px] font-semibold text-white">
                                      {initials}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-zinc-800 dark:text-white/80 truncate">{displayName}</p>
                                  {creator.name && creator.email && (
                                    <p className="text-[11px] text-zinc-400 dark:text-white/30 truncate">{creator.email}</p>
                                  )}
                                </div>
                                <div className="shrink-0">
                                  {selected ? (
                                    <div className="w-4 h-4 rounded-full bg-brand-mid-pink flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-white/15" />
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {formData.assignedCreatorClerkIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formData.assignedCreatorClerkIds.map((cId) => {
                      const creator = creators.find((c) => c.clerkId === cId);
                      if (!creator) return null;
                      const name = creator.name || creator.email || cId;
                      return (
                        <span
                          key={cId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/12 border border-brand-mid-pink/20 text-brand-mid-pink rounded-full text-[11px] font-medium"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => toggleCreator(cId)}
                            className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-brand-mid-pink/20 transition-colors text-brand-mid-pink/60 hover:text-brand-mid-pink leading-none"
                            aria-label={`Remove ${name}`}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-5 py-2.5 bg-white dark:bg-white/5 hover:bg-zinc-50 dark:hover:bg-white/8 border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/15 rounded-xl text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white/80 text-sm font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  formData.contentTypes.length === 0 ||
                  formData.messageTypes.length === 0 ||
                  !formData.description.trim()
                }
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-brand-mid-pink/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
