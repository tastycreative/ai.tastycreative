"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Draggable } from "@hello-pangea/dnd";
import { Pencil, Check, X, Calendar, AtSign } from "lucide-react";
import type { BoardTaskCardProps } from "../../board/BoardTaskCard";

export function WallPostTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
}: BoardTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = task.metadata ?? {};
  const platform = meta.platform as string | undefined;
  const scheduledDate =
    task.dueDate || (meta.scheduledDate as string | undefined);
  const hashtags = Array.isArray(meta.hashtags)
    ? (meta.hashtags as string[])
    : [];

  // Calculate photo status counts from captionItems
  const captionItems = Array.isArray(meta.captionItems)
    ? (meta.captionItems as Array<{
        captionStatus?: string | null;
        captionText?: string | null;
        isPosted?: boolean;
      }>)
    : [];

  const statusCounts = captionItems.reduce(
    (counts, item) => {
      const hasCaption = !!item.captionText;

      if (item.isPosted) {
        counts.posted++;
      } else if (item.captionStatus === 'approved') {
        counts.approved++;
      } else if (item.captionStatus === 'submitted') {
        counts.submitted++;
      } else if (item.captionStatus === 'rejected') {
        counts.rejected++;
      } else if (!hasCaption) {
        // Awaiting caption: no caption text exists yet
        counts.awaitingCaption++;
      } else if (
        !item.captionStatus ||
        ['pending', 'in_progress', 'not_required'].includes(item.captionStatus)
      ) {
        counts.pending++;
      }
      return counts;
    },
    { pending: 0, submitted: 0, approved: 0, rejected: 0, posted: 0, awaitingCaption: 0 }
  );

  useEffect(() => {
    setDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) {
      onTitleUpdate?.(task, trimmed);
    } else {
      setDraft(task.title);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => {
        const card = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => {
              if (!editing) onClick?.(task);
            }}
            className={[
            "group/card relative rounded-xl bg-white dark:bg-gray-900/90 border px-3.5 py-3 cursor-pointer select-none",
            snapshot.isDragging
              ? "shadow-xl border-brand-light-pink/70 ring-2 ring-brand-light-pink/30"
              : "shadow-sm border-gray-200 dark:border-brand-mid-pink/20 hover:shadow-md hover:border-brand-light-pink/50",
          ].join(" ")}
        >
          {/* Task key */}
          <span className="text-[10px] font-semibold tracking-wide text-brand-blue/80 dark:text-brand-blue/70 mb-1 block">
            {task.taskKey}
          </span>

          {/* Title */}
          {editing ? (
            <div className="flex items-center gap-1.5 mb-2">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setDraft(task.title);
                  }
                }}
                onBlur={saveTitle}
                className="flex-1 bg-white dark:bg-gray-800 border border-brand-light-pink/50 rounded-lg px-2 py-1 text-sm font-medium text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink/60"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  saveTitle();
                }}
                className="p-1 rounded hover:bg-brand-light-pink/10 text-brand-light-pink"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(false);
                  setDraft(task.title);
                }}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-brand-off-white line-clamp-2 flex-1">
                {task.title}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="opacity-0 group-hover/card:opacity-100 p-1 rounded hover:bg-brand-light-pink/10 text-brand-light-pink transition-opacity"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Platform badge and assignee row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {platform && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-light-pink/10 text-brand-light-pink border border-brand-light-pink/20 capitalize">
                  {platform}
                </span>
              )}
            </div>
            {task.assignee && (
              <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <AtSign className="h-3 w-3" />
                <span className="truncate max-w-[100px] font-medium">{task.assignee}</span>
              </div>
            )}
          </div>

          {/* Photo status counts - Dynamic */}
          {captionItems.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              {/* Awaiting Caption */}
              {statusCounts.awaitingCaption > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    {statusCounts.awaitingCaption}
                  </span>
                </div>
              )}
              {/* Pending */}
              {statusCounts.pending > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    {statusCounts.pending}
                  </span>
                </div>
              )}
              {/* Submitted */}
              {statusCounts.submitted > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-brand-blue" />
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    {statusCounts.submitted}
                  </span>
                </div>
              )}
              {/* Approved */}
              {statusCounts.approved > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    {statusCounts.approved}
                  </span>
                </div>
              )}
              {/* Rejected */}
              {statusCounts.rejected > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    {statusCounts.rejected}
                  </span>
                </div>
              )}
              {/* Posted */}
              {statusCounts.posted > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    {statusCounts.posted}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Metadata row */}
          {scheduledDate && (
            <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-500 dark:text-gray-400">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(scheduledDate)}</span>
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {hashtags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-brand-blue/10 text-brand-blue dark:text-brand-blue/90 border border-brand-blue/20"
                >
                  #{String(tag)}
                </span>
              ))}
              {hashtags.length > 3 && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-gray-400">
                  +{hashtags.length - 3}
                </span>
              )}
            </div>
          )}
          </div>
        );

        if (snapshot.isDragging) {
          return createPortal(card, document.body);
        }

        return card;
      }}
    </Draggable>
  );
}
