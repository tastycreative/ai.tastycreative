"use client";

import React, { useState } from "react";
import { Lock, DollarSign } from "lucide-react";
import {
  isTaskLocked,
  TASK_FIELD_DEFS,
  MM_SUB_TYPE_ICONS,
} from "@/lib/hooks/useScheduler.query";
import { SchedulerTaskModal } from "../SchedulerTaskModal";
import {
  TaskCardProps,
  TASK_TYPE_COLORS,
  STATUS_OPTIONS,
  FieldRow,
  StatusBadge,
  TypeBadge,
  DeleteButton,
  TimeDisplay,
  useFieldSave,
  useFlagToggle,
  CaptionPreview,
  FlyerPreview,
  FlagButton,
  PostedBadge,
} from "./shared";

const TYPE_COLOR = TASK_TYPE_COLORS["MM"];

export function MMCard({
  task,
  team,
  onUpdate,
  onDelete,
  compact,
  schedulerToday,
  weekStart,
  profileName,
}: TaskCardProps) {
  const [showModal, setShowModal] = useState(false);
  const { fields, save } = useFieldSave(task, onUpdate);
  const statusOpt =
    STATUS_OPTIONS.find((s) => s.key === task.status) || STATUS_OPTIONS[0];
  const isFlagged =
    fields.flagged === "true" || fields.flagged === (true as unknown as string);
  const locked = schedulerToday ? isTaskLocked(task, schedulerToday) : false;
  const toggleFlag = useFlagToggle(task.id, isFlagged);
  const subType = fields.type || "";
  const subIcon = MM_SUB_TYPE_ICONS[subType] || "";

  // ── Compact: two-row, click → modal ──
  if (compact) {
    const label = fields.type || task.taskName || "";
    const isFollowUp =
      label.toLowerCase().includes("follow up") ||
      label.toLowerCase().includes("follow-up");
    const isUnlock = label.toLowerCase().includes("unlock");
    const hasSubType = !!(fields.subType && (isFollowUp || isUnlock));
    return (
      <>
        <div
          onClick={() => setShowModal(true)}
          className={`rounded-sm pl-2 pr-1 py-[3px] cursor-pointer transition-colors ${
            isFlagged
              ? "bg-amber-100/80 dark:bg-amber-900/20"
              : "hover:bg-pink-50/60 dark:hover:bg-pink-950/20"
          }`}
          style={{
            borderLeft: `3px solid ${isFlagged ? "#f59e0b" : TYPE_COLOR}`,
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 leading-none">
              <div
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: statusOpt.color }}
              />
              {fields.time && (
                <span
                  className="text-[8px] font-mono shrink-0"
                  style={{ color: TYPE_COLOR }}
                >
                  {fields.time}
                </span>
              )}
              <span className="text-[8px] font-semibold truncate text-gray-700 dark:text-gray-300 flex-1 min-w-0">
                {label}
              </span>
              <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                {locked && (
                  <Lock className="h-2.5 w-2.5 shrink-0 text-gray-400 dark:text-gray-600" />
                )}
                <FlagButton
                  flagged={isFlagged}
                  onToggle={() => save("flagged", isFlagged ? "" : "true")}
                />
                {task.status === "DONE" && <PostedBadge />}
              </div>
            </div>
            {hasSubType && (
              <div
                className=" text-[7px] font-bold   ml-[13px]"
                style={{ color: TYPE_COLOR }}
              >
                {fields.subType}
              </div>
            )}

            {(fields.captionBankText || fields.caption) && (
              <div className="text-[8px] font-mono truncate text-gray-500 ml-[13px] dark:text-gray-600 mt-0.5">
                {fields.captionBankText || fields.caption}
              </div>
            )}
          </div>

          {/* Row 3: content/preview + price */}
          {(fields.contentPreview || fields.price) && (
            <div className="flex items-center gap-1.5 ml-[13px] mt-px">
              {fields.contentPreview && (
                <span className="text-[7px] font-mono truncate text-gray-400 dark:text-gray-600 flex-1 min-w-0">
                  {fields.contentPreview}
                </span>
              )}
              {fields.price && (
                <span className="text-[7px] font-mono text-green-600 dark:text-green-500 shrink-0 ml-auto">
                  {fields.price}
                </span>
              )}
            </div>
          )}
        </div>
        <SchedulerTaskModal
          task={task}
          open={showModal}
          onClose={() => setShowModal(false)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          schedulerToday={schedulerToday}
          weekStart={weekStart}
          profileName={profileName}
        />
      </>
    );
  }

  // Dynamic field defs based on sub-type
  const fieldDefs = TASK_FIELD_DEFS["MM"];

  // ── Expanded: full inline editable, click opens modal ──
  const expandedLabel = fields.type || task.taskName || "";
  const expandedIsFollowUp =
    expandedLabel.toLowerCase().includes("follow up") ||
    expandedLabel.toLowerCase().includes("follow-up");
  const expandedIsUnlock = expandedLabel.toLowerCase().includes("unlock");
  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className={`flex flex-col gap-1.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
          isFlagged
            ? "bg-amber-100/80 dark:bg-amber-900/20 border-amber-400/30 dark:border-amber-500/20"
            : "bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#111124] hover:bg-pink-50/40 dark:hover:bg-pink-950/10"
        }`}
        style={{
          borderLeftWidth: 3,
          borderLeftColor: isFlagged ? "#f59e0b" : TYPE_COLOR,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TypeBadge task={task} onUpdate={onUpdate} />

            {/* Unlock / Follow-up sub-type badge */}
            {(expandedIsFollowUp || expandedIsUnlock) && fields.subType && (
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: TYPE_COLOR + "18",
                  color: TYPE_COLOR,
                  border: `1px solid ${TYPE_COLOR}30`,
                }}
              >
                {fields.subType}
              </span>
            )}
            <StatusBadge task={task} onUpdate={onUpdate} />
          </div>
          <div className="flex items-center gap-0.5">
            <FlagButton
              flagged={isFlagged}
              onToggle={() => save("flagged", isFlagged ? "" : "true")}
            />
            {onDelete && <DeleteButton onDelete={() => onDelete(task.id)} />}
          </div>
        </div>

        {!task.fields && task.taskName && (
          <div className="text-xs truncate px-1 font-mono text-gray-700 dark:text-gray-300">
            {task.taskName}
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {fieldDefs
            .filter((def) => def.key !== "caption" && def.key !== "subType")
            .map((def) => (
              <FieldRow
                key={def.key}
                label={def.label}
                value={fields[def.key] || ""}
                placeholder={def.placeholder}
                onSave={(v) => save(def.key, v)}
              />
            ))}
          <CaptionPreview fields={fields} typeColor={TYPE_COLOR} />
          <FlyerPreview fields={fields} />
        </div>

        <TimeDisplay task={task} />
        {task.updatedBy && (
          <div className="text-[8px] px-1 truncate font-mono text-gray-400 dark:text-gray-700">
            updated by {task.updatedBy}
          </div>
        )}
      </div>
      <SchedulerTaskModal
        task={task}
        open={showModal}
        onClose={() => setShowModal(false)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        schedulerToday={schedulerToday}
        weekStart={weekStart}
      />
    </>
  );
}
