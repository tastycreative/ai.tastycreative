'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Clapperboard,
  CalendarDays,
  Hash,
  User,
  Users,
  FileText,
  Loader2,
  Search,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useInstagramProfiles, type InstagramProfile } from '@/lib/hooks/useInstagramProfiles.query';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import {
  CONTENT_GEN_METADATA_DEFAULTS,
  CONTENT_GEN_TASK_TYPE_OPTIONS,
  type ContentGenTaskType,
  type ContentGenItemMetadata,
} from '@/lib/spaces/template-metadata';

/* ── Types ──────────────────────────────────────────────── */

interface ContentGenTaskRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  boardId: string;
  firstColumnId: string;
  prefilledClientId?: string;
}

/* ── Component ──────────────────────────────────────────── */

export function ContentGenTaskRequestModal({
  isOpen,
  onClose,
  spaceId,
  boardId,
  firstColumnId,
  prefilledClientId,
}: ContentGenTaskRequestModalProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useInstagramProfiles();
  const { data: rawSpaceMembers = [] } = useSpaceMembers(spaceId);
  const orgMembers = useMemo(
    () =>
      rawSpaceMembers.map((m) => ({
        clerkId: m.user.clerkId,
        name:
          m.user.name ||
          [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') ||
          null,
        email: m.user.email,
      })),
    [rawSpaceMembers],
  );

  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [taskType, setTaskType] = useState<ContentGenTaskType>('WALL_POSTS');
  const [quantity, setQuantity] = useState(1);
  const [clientId, setClientId] = useState(prefilledClientId ?? '');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');

  // Dropdown states
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Auto-generate title from client + task type
  useEffect(() => {
    const client = profiles.find((p) => p.id === clientId);
    const taskLabel = CONTENT_GEN_TASK_TYPE_OPTIONS.find((o) => o.value === taskType)?.label ?? taskType;
    if (client) {
      setTitle(`${client.name} — ${taskLabel} x${quantity}`);
    }
  }, [clientId, taskType, quantity, profiles]);

  const selectedClient = useMemo(
    () => profiles.find((p) => p.id === clientId),
    [profiles, clientId],
  );

  const filteredClients = useMemo(() => {
    if (!clientSearch) return profiles;
    const q = clientSearch.toLowerCase();
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q),
    );
  }, [profiles, clientSearch]);

  const filteredMembers = useMemo(() => {
    if (!assigneeSearch) return orgMembers;
    const q = assigneeSearch.toLowerCase();
    return orgMembers.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q),
    );
  }, [orgMembers, assigneeSearch]);

  const toggleAssignee = useCallback((clerkId: string) => {
    setAssignedTo((prev) =>
      prev.includes(clerkId) ? prev.filter((id) => id !== clerkId) : [...prev, clerkId],
    );
  }, []);

  const handleSubmit = async () => {
    if (!clientId || !deadline || !title.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const metadata: ContentGenItemMetadata = {
      ...CONTENT_GEN_METADATA_DEFAULTS,
      taskType,
      quantity,
      clientId,
      clientName: selectedClient?.name ?? '',
      assignedTo,
      deadline,
      notes,
      requestedBy: user?.id ?? '',
      requestedByName: user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? '',
      vaultAssets: [],
    };

    try {
      const res = await fetch(`/api/spaces/${spaceId}/boards/${boardId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          columnId: firstColumnId,
          metadata,
          assigneeId: assignedTo[0] ?? undefined,
          dueDate: deadline || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to create task');
      }

      const createdItem = await res.json();

      // Fire notification for each assigned CG
      if (assignedTo.length > 0) {
        fetch('/api/spaces/content-gen/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: createdItem.id,
            itemTitle: title.trim(),
            itemNo: createdItem.itemNo,
            assigneeClerkIds: assignedTo,
            spaceId,
            taskType,
            quantity,
            clientName: selectedClient?.name ?? '',
            deadline,
          }),
        }).catch(() => {});
      }

      queryClient.invalidateQueries({ queryKey: ['board-items'] });
      handleReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTaskType('WALL_POSTS');
    setQuantity(1);
    setClientId(prefilledClientId ?? '');
    setAssignedTo([]);
    setDeadline('');
    setNotes('');
    setTitle('');
    setError(null);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mt-[5vh] max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border border-zinc-700/50 bg-[#0a0a0b] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-[#0a0a0b]/95 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-light-pink/15 border border-brand-light-pink/20">
              <Clapperboard className="w-5 h-5 text-brand-light-pink" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">New Content Generation Task</h2>
              <p className="text-xs text-zinc-500">Create a task request for content generators</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Client picker */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <User className="w-4 h-4 text-brand-blue" />
              Client / Model <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-700/50 bg-zinc-900/50 text-left text-sm hover:border-zinc-600 transition-colors"
              >
                {selectedClient ? (
                  <span className="text-white">{selectedClient.name}</span>
                ) : (
                  <span className="text-zinc-500">Select a client...</span>
                )}
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              </button>

              {clientDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-xl">
                  <div className="sticky top-0 p-2 bg-zinc-900 border-b border-zinc-800/50">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search clients..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-blue/50"
                        autoFocus
                      />
                    </div>
                  </div>
                  {filteredClients.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-zinc-500">No clients found</div>
                  ) : (
                    filteredClients.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => {
                          setClientId(profile.id);
                          setClientDropdownOpen(false);
                          setClientSearch('');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-800/50 transition-colors ${
                          clientId === profile.id ? 'bg-brand-blue/10 text-brand-blue' : 'text-zinc-300'
                        }`}
                      >
                        {profile.profileImageUrl ? (
                          <img src={profile.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-400">
                            {profile.name.charAt(0)}
                          </div>
                        )}
                        <div className="text-left">
                          <div className="font-medium">{profile.name}</div>
                          {profile.username && (
                            <div className="text-xs text-zinc-500">@{profile.username}</div>
                          )}
                        </div>
                        {clientId === profile.id && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Task type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Clapperboard className="w-4 h-4 text-violet-400" />
              Task Type <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CONTENT_GEN_TASK_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTaskType(opt.value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    taskType === opt.value
                      ? 'border-brand-light-pink/50 bg-brand-light-pink/15 text-brand-light-pink'
                      : 'border-zinc-700/50 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + Deadline row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Hash className="w-4 h-4 text-emerald-400" />
                Quantity <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-3 rounded-xl border border-zinc-700/50 bg-zinc-900/50 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-blue/50"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <CalendarDays className="w-4 h-4 text-amber-400" />
                Deadline <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-700/50 bg-zinc-900/50 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-blue/50 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Assign to (multi-select) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Users className="w-4 h-4 text-cyan-400" />
              Assign To
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-700/50 bg-zinc-900/50 text-left text-sm hover:border-zinc-600 transition-colors"
              >
                {assignedTo.length > 0 ? (
                  <span className="text-white">
                    {assignedTo.length} member{assignedTo.length > 1 ? 's' : ''} selected
                  </span>
                ) : (
                  <span className="text-zinc-500">Select team members...</span>
                )}
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              </button>

              {/* Selected chips */}
              {assignedTo.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {assignedTo.map((clerkId) => {
                    const member = orgMembers.find((m) => m.clerkId === clerkId);
                    return (
                      <span
                        key={clerkId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-blue/15 border border-brand-blue/25 text-brand-blue text-xs font-medium"
                      >
                        {member?.name || member?.email || clerkId}
                        <button
                          type="button"
                          onClick={() => toggleAssignee(clerkId)}
                          className="hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {assigneeDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-xl">
                  <div className="sticky top-0 p-2 bg-zinc-900 border-b border-zinc-800/50">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        placeholder="Search members..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-blue/50"
                        autoFocus
                      />
                    </div>
                  </div>
                  {filteredMembers.map((member) => {
                    const isSelected = assignedTo.includes(member.clerkId);
                    return (
                      <button
                        key={member.clerkId}
                        type="button"
                        onClick={() => toggleAssignee(member.clerkId)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-800/50 transition-colors ${
                          isSelected ? 'bg-brand-blue/10 text-brand-blue' : 'text-zinc-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-brand-blue border-brand-blue' : 'border-zinc-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{member.name || 'Unknown'}</div>
                          <div className="text-xs text-zinc-500">{member.email}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Title (auto-generated, editable) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <FileText className="w-4 h-4 text-brand-light-pink" />
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated from client + type..."
              className="w-full px-4 py-3 rounded-xl border border-zinc-700/50 bg-zinc-900/50 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-blue/50"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <FileText className="w-4 h-4 text-zinc-400" />
              Special Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any special instructions, references, or notes for the content generator..."
              className="w-full px-4 py-3 rounded-xl border border-zinc-700/50 bg-zinc-900/50 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-blue/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800/50 bg-[#0a0a0b]/95 backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-zinc-700/50 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !clientId || !deadline || !title.trim()}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink text-sm font-medium text-white hover:from-brand-dark-pink hover:to-brand-light-pink disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-light-pink/20"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </span>
            ) : (
              'Create Task'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
