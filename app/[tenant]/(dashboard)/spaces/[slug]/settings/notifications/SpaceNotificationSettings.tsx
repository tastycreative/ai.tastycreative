'use client';

import { useState } from 'react';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import {
  useUpdateSpaceNotifications,
  type MemberNotifyMode,
  type NotificationConfig,
} from '@/lib/hooks/useSpaceNotifications.query';
import { Loader2, Info, ChevronDown, X } from 'lucide-react';

interface Props {
  slug: string;
}

export function SpaceNotificationSettings({ slug }: Props) {
  const { data: space, isLoading } = useSpaceBySlug(slug);
  const { data: members } = useSpaceMembers(space?.id);

  const config = (space?.config as Record<string, unknown>) ?? {};
  const notifications = (config.notifications as NotificationConfig | undefined) ?? {
    memberEnabled: false,
    memberMode: 'all' as MemberNotifyMode,
    notifyAssigned: false,
  };

  const memberEnabled = notifications.memberEnabled ?? false;
  const memberMode = notifications.memberMode ?? 'all';
  const notifyAssigned = notifications.notifyAssigned ?? false;
  const notifyOnboarding = notifications.notifyOnboarding ?? false;
  const columnMembers = notifications.columnMembers ?? {};

  const mutation = useUpdateSpaceNotifications(space?.id, config);

  const save = (patch: Partial<NotificationConfig>) => {
    mutation.mutate({
      memberEnabled,
      memberMode,
      notifyAssigned,
      notifyOnboarding,
      columnMembers,
      ...patch,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading settings...
        </span>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400">Space not found</p>
      </div>
    );
  }

  const columns = space.boards?.flatMap((b) => b.columns) ?? [];

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Notifications
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Configure email notifications when board items are moved between columns
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6 space-y-1">
        {/* Member notifications toggle + mode */}
        <div className="py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Member notifications
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Notify space members when an item is moved between columns
              </p>
            </div>
            <Toggle
              checked={memberEnabled}
              onChange={(v) => save({ memberEnabled: v })}
              disabled={mutation.isPending}
            />
          </div>

          {/* Mode selector — visible when enabled */}
          {memberEnabled && (
            <div className="mt-4 ml-1 flex gap-2">
              <button
                type="button"
                onClick={() => save({ memberMode: 'all' })}
                disabled={mutation.isPending}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  memberMode === 'all'
                    ? 'bg-brand-light-pink/10 border-brand-light-pink/40 text-brand-dark-pink dark:text-brand-light-pink'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                ].join(' ')}
              >
                All members
              </button>
              <button
                type="button"
                onClick={() => save({ memberMode: 'column' })}
                disabled={mutation.isPending}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  memberMode === 'column'
                    ? 'bg-brand-light-pink/10 border-brand-light-pink/40 text-brand-dark-pink dark:text-brand-light-pink'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                ].join(' ')}
              >
                Column members only
              </button>
            </div>
          )}
        </div>

        {/* Notify assigned users + creator */}
        <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="pr-4">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Notify assigned users
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Notify the item assignee and creator when their item is moved
            </p>
          </div>
          <Toggle
            checked={notifyAssigned}
            onChange={(v) => save({ notifyAssigned: v })}
            disabled={mutation.isPending}
          />
        </div>

        {/* Webhook onboarding notifications */}
        <div className="flex items-center justify-between py-4">
          <div className="pr-4">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Onboarding webhook notifications
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Notify space members when a new item is created via the onboarding webhook
            </p>
          </div>
          <Toggle
            checked={notifyOnboarding}
            onChange={(v) => save({ notifyOnboarding: v })}
            disabled={mutation.isPending}
          />
        </div>
      </div>

      {/* Column member assignment — visible when memberMode is 'column' and enabled */}
      {memberEnabled && memberMode === 'column' && columns.length > 0 && (
        <div className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Assign members to columns
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            When an item moves to a column, only the assigned members will be notified
          </p>

          <div className="space-y-4">
            {columns.map((col) => (
              <ColumnMemberPicker
                key={col.id}
                columnName={col.name}
                columnColor={col.color}
                selectedClerkIds={columnMembers[col.id] ?? []}
                members={members ?? []}
                onChange={(clerkIds) => {
                  save({ columnMembers: { ...columnMembers, [col.id]: clerkIds } });
                }}
                disabled={mutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/15 px-4 py-3">
        <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 dark:text-gray-400">
          The person who moves the item will not be notified.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-light-pink focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50',
        checked ? 'bg-brand-light-pink' : 'bg-gray-200 dark:bg-gray-700',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Column member picker                                               */
/* ------------------------------------------------------------------ */

interface ColumnMemberPickerProps {
  columnName: string;
  columnColor?: string | null;
  selectedClerkIds: string[];
  members: Array<{
    id: string;
    userId: string;
    role: string;
    user: {
      id: string;
      clerkId: string;
      name: string | null;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }>;
  onChange: (clerkIds: string[]) => void;
  disabled: boolean;
}

function ColumnMemberPicker({
  columnName,
  columnColor,
  selectedClerkIds,
  members,
  onChange,
  disabled,
}: ColumnMemberPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(selectedClerkIds);

  const toggleMember = (clerkId: string) => {
    const next = new Set(selectedClerkIds);
    if (next.has(clerkId)) next.delete(clerkId);
    else next.add(clerkId);
    onChange([...next]);
  };

  const removeMember = (clerkId: string) => {
    onChange(selectedClerkIds.filter((id) => id !== clerkId));
  };

  const getMemberName = (clerkId: string) => {
    const m = members.find((m) => m.user.clerkId === clerkId);
    if (!m) return clerkId;
    return m.user.name || [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;
  };

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: columnColor || '#94a3b8' }}
        />
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {columnName}
        </p>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {selectedClerkIds.length} member{selectedClerkIds.length !== 1 ? 's' : ''}
        </span>
      </div>

      {selectedClerkIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedClerkIds.map((clerkId) => (
            <span
              key={clerkId}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-light-pink/10 dark:bg-brand-light-pink/15 text-xs font-medium text-brand-dark-pink dark:text-brand-light-pink"
            >
              {getMemberName(clerkId)}
              <button
                type="button"
                onClick={() => removeMember(clerkId)}
                disabled={disabled}
                className="hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <span>Add members...</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            {members.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No members in this space</p>
            ) : (
              members.map((m) => {
                const isSelected = selectedSet.has(m.user.clerkId);
                const displayName =
                  m.user.name || [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;

                return (
                  <button
                    key={m.user.clerkId}
                    type="button"
                    onClick={() => toggleMember(m.user.clerkId)}
                    className={[
                      'flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-colors',
                      isSelected
                        ? 'bg-brand-light-pink/10 text-brand-dark-pink dark:text-brand-light-pink'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        isSelected
                          ? 'bg-brand-light-pink border-brand-light-pink'
                          : 'border-gray-300 dark:border-gray-600',
                      ].join(' ')}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{displayName}</p>
                      {m.user.name && (
                        <p className="text-[10px] text-gray-400 truncate">{m.user.email}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
