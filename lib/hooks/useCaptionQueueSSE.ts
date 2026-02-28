'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import * as Ably from 'ably';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import { queueChannel } from '@/lib/ably-server';

export interface RemoteCaptionUpdate {
  ticketId: string;
  captionText: string | null;
  status: string | null;
}

interface UseCaptionQueueSSEOptions {
  /**
   * Called when another user (not the current one) saves a caption.
   * Use this to push remote caption text into local editor state.
   */
  onRemoteCaption?: (update: RemoteCaptionUpdate) => void;
}

/**
 * Opens an Ably Realtime subscription on the org's caption-queue channel.
 *
 * Events:
 *  - NEW_TICKET      → invalidates cache + toast
 *  - TICKET_UPDATED  → invalidates cache; if the update came from another user
 *                      AND includes captionText, calls onRemoteCaption so the
 *                      editor can show the remote changes live
 *  - TICKET_DELETED  → invalidates cache
 *
 * Strict Mode note: deferred close (200 ms) prevents the async
 * "Connection closed" error from Ably's state machine during Strict Mode's
 * intentional unmount+remount cycle.
 */
export function useCaptionQueueSSE(options?: UseCaptionQueueSSEOptions) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { currentOrganization } = useOrganization();

  // Keep callback in a ref so changing the parent callback never re-fires the effect.
  const onRemoteCaptionRef = useRef(options?.onRemoteCaption);
  useEffect(() => { onRemoteCaptionRef.current = options?.onRemoteCaption; });

  const clientRef = useRef<Ably.Realtime | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !currentOrganization?.id) return;

    const orgId = currentOrganization.id;
    // Clerk exposes externalId for mapped IDs; fall back to Clerk's own user.id
    const currentClerkId = (user.externalId ?? (user as { id?: string }).id) ?? '';

    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (!clientRef.current) {
      clientRef.current = new Ably.Realtime({
        authCallback: async (_tokenParams, callback) => {
          try {
            const res = await fetch('/api/ably-token');
            if (!res.ok) throw new Error('Failed to fetch Ably token');
            const { tokenRequest } = (await res.json()) as { tokenRequest: Ably.TokenRequest };
            callback(null, tokenRequest);
          } catch (err) {
            callback(err as Ably.ErrorInfo, null);
          }
        },
      });
    }

    const client = clientRef.current;
    const channel = client.channels.get(queueChannel(orgId));

    const handler = (msg: Ably.Message) => {
      if (msg.name === 'NEW_TICKET') {
        queryClient.invalidateQueries({ queryKey: ['caption-queue'] });
        const newTicketPayload = msg.data as {
          senderClerkId?: string;
          assignedCreatorClerkIds?: string[];
        };
        // Only show the toast to creators who are explicitly assigned to the ticket.
        // The submitter (owner/admin/manager) and other non-assigned org members are excluded.
        const isAssigned = newTicketPayload.assignedCreatorClerkIds?.includes(currentClerkId) ?? false;
        if (isAssigned) {
          toast.info('A new caption task was added to your queue', {
            id: 'new-queue-ticket',
            duration: 4000,
          });
        }
      }

      if (msg.name === 'TICKET_UPDATED') {
        // Keep every client's cache fresh regardless of who made the change.
        queryClient.invalidateQueries({ queryKey: ['caption-queue'] });

        // Push caption text into the editor ONLY for updates from other users.
        // Self-echoes (same senderClerkId) are silently dropped so we don't
        // interrupt what the current user is actively typing.
        const payload = msg.data as {
          senderClerkId?: string;
          ticketId?: string;
          captionText?: string | null;
          status?: string | null;
        };

        if (
          payload.senderClerkId &&
          payload.senderClerkId !== currentClerkId &&
          payload.ticketId &&
          payload.captionText !== undefined
        ) {
          onRemoteCaptionRef.current?.({
            ticketId: payload.ticketId,
            captionText: payload.captionText ?? null,
            status: payload.status ?? null,
          });
        }
      }

      if (msg.name === 'TICKET_DELETED') {
        queryClient.invalidateQueries({ queryKey: ['caption-queue'] });
      }
    };

    channel.subscribe(handler);

    return () => {
      channel.unsubscribe(handler);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        clientRef.current = null;
        try { client.close(); } catch { /* ignore */ }
      }, 200);
    };
  }, [user?.id, currentOrganization?.id, queryClient]);
}
