'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DragDropContext } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';
import { useSpaceBySlug, useUpdateSpace } from '@/lib/hooks/useSpaces.query';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import { useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { BoardSkeleton } from '@/components/ui/BoardSkeleton';
import {
  BoardLayout,
  BoardColumn,
  AddColumnButton,
  BoardScrollIndicator,
  type BoardFilters,
} from '../board';
import { useSpaceBoard } from './useSpaceBoard';
import { TEMPLATE_CONFIG } from './templates/template-config';
import { TimelineTab } from './templates/summary';
import { ResourcesTab } from './templates/ResourcesTab';
import { CalendarTab } from './templates/CalendarTab';
import { MODEL_ONBOARDING_METADATA_DEFAULTS, getDefaultChecklist } from '@/lib/spaces/template-metadata';
import { SubmissionFormModal } from '@/components/content-submission/SubmissionFormModal';
import { ContentGenTaskRequestModal } from '@/components/spaces/ContentGenTaskRequestModal';

interface SpaceBoardViewProps {
  slug: string;
}

export function SpaceBoardView({ slug }: SpaceBoardViewProps) {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const { data: space, isLoading, error } = useSpaceBySlug(slug);

  // Redirect to spaces list if space not found (including archived spaces)
  useEffect(() => {
    if (!isLoading && !space) {
      router.push(`/${params.tenant}/spaces`);
    }
  }, [isLoading, space, router, params.tenant]);

  if (isLoading) {
    return <BoardSkeleton />;
  }

  if (!space) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Redirecting...
        </span>
      </div>
    );
  }

  const config = TEMPLATE_CONFIG[space.templateType];

  if (!config) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-brand-mid-pink/30 bg-gray-50/70 dark:bg-gray-900/50 px-4 py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Unknown template type: <strong>{space.templateType}</strong>
        </p>
      </div>
    );
  }

  return <TemplateBoardView slug={slug} />;
}

/**
 * Inner component that renders after space is confirmed to exist.
 * Separated so hooks are only called when we have valid data.
 */
function TemplateBoardView({ slug }: { slug: string }) {
  const { user } = useUser();
  const { data: space } = useSpaceBySlug(slug);
  const { data: members = [] } = useSpaceMembers(space?.id);
  const { data: orgMembers = [] } = useOrgMembers();
  const { currentOrganization } = useOrganization();
  const updateSpaceMutation = useUpdateSpace(space?.id ?? '');
  const queryClient = useQueryClient();
  const config = TEMPLATE_CONFIG[space!.templateType];
  const { DetailModal, CardComponent, SummaryComponent } = config;
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0, hasMoved: false });

  // Submission form modal state (for + button on OTP_PTR / WALL_POST / SEXTING_SETS boards)
  const [submissionModal, setSubmissionModal] = useState<{
    isOpen: boolean;
    templateType: 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS';
    spaceSlugs: string[];
  }>({ isOpen: false, templateType: 'OTP_PTR', spaceSlugs: [] });

  // Content Generation task request modal state
  const [cgModalOpen, setCgModalOpen] = useState(false);

  const handleOpenSubmissionModal = useCallback((templateType: string, spaceSlug: string) => {
    if (templateType === 'CONTENT_GENERATION') {
      setCgModalOpen(true);
    } else {
      setSubmissionModal({
        isOpen: true,
        templateType: templateType as 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS',
        spaceSlugs: [spaceSlug],
      });
    }
  }, []);

  const handleCloseSubmissionModal = useCallback(() => {
    setSubmissionModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only grab-scroll on the board background / column headers, not on task cards (handled by dnd)
    const target = e.target as HTMLElement;
    if (target.closest('[data-rfd-draggable-id]') || target.closest('button') || target.closest('a') || target.closest('input')) return;

    const container = boardContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    dragState.current = { startX: e.clientX, scrollLeft: container.scrollLeft, hasMoved: false };
    container.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const container = boardContainerRef.current;
    if (!container) return;

    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 3) dragState.current.hasMoved = true;
    container.scrollLeft = dragState.current.scrollLeft - dx;
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    const container = boardContainerRef.current;
    if (container) container.releasePointerCapture(e.pointerId);
  }, [isDragging]);

  // Get current user's role in the space
  const currentMember = members.find((m) => m.user.clerkId === user?.id);
  const userRole = currentMember?.role;
  const organizationRole = currentOrganization?.role;

  const resolveMemberName = (id?: string) => {
    if (!id) return undefined;
    const m = orgMembers.find((mb) => mb.clerkId === id || mb.id === id);
    if (!m) return id;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  };

  // Handler for updating space name
  const handleSpaceNameUpdate = async (newName: string) => {
    await updateSpaceMutation.mutateAsync({ name: newName });
  };

  const defaultBoard = space?.boards?.[0];

  // Handler for "Mark as Final" — moves item to Posted + creates gallery entry
  const handleMarkFinal = useCallback(
    async (taskId: string) => {
      if (!space?.id || !defaultBoard?.id) return;
      try {
        const res = await fetch(
          `/api/spaces/${space.id}/boards/${defaultBoard.id}/items/${taskId}/mark-final`,
          { method: 'POST' },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error('Mark as final failed:', data.error);
          return;
        }
        // Invalidate board items to refresh the board
        queryClient.invalidateQueries({ queryKey: ['board-items'] });
      } catch (err) {
        console.error('Mark as final error:', err);
      }
    },
    [space?.id, defaultBoard?.id, queryClient],
  );

  const {
    boardData,
    itemsLoading,
    effectiveColumns,
    effectiveTasks,
    effectiveColumnOrder,
    selectedTask,
    selectedColumnTitle,
    handleDragEnd,
    handleAddTask,
    handleAddColumn,
    handleColumnColorUpdate,
    handleColumnTitleUpdate,
    handleTaskClick,
    handleTaskUpdate,
    handleColumnChange,
    handleTitleUpdate,
    handleDeleteTask,
    closeTaskModal,
  } = useSpaceBoard({ space, itemToTask: config.itemToTask });

  // Wrap handleAddTask to inject default metadata for MODEL_ONBOARDING
  const handleAddTaskWithDefaults = useCallback(
    (columnId: string, title: string) => {
      if (space?.templateType === 'MODEL_ONBOARDING') {
        const spaceConfig = (space?.config as Record<string, unknown>) ?? null;
        handleAddTask(columnId, title, {
          ...MODEL_ONBOARDING_METADATA_DEFAULTS,
          checklist: getDefaultChecklist(spaceConfig),
        });
      } else {
        handleAddTask(columnId, title);
      }
    },
    [handleAddTask, space?.templateType, space?.config],
  );

  // Extract unique assignees from all tasks (resolve IDs to display names)
  const uniqueAssignees = Array.from(
    new Set(
      Object.values(effectiveTasks)
        .map((t) => resolveMemberName(t.assignee))
        .filter(Boolean) as string[],
    ),
  ).sort();

  const totalTaskCount = Object.keys(effectiveTasks).length;

  return (
    <>
      <BoardLayout
        spaceName={space!.name}
        spaceSlug={slug}
        userRole={userRole}
        organizationRole={organizationRole}
        onSpaceNameUpdate={handleSpaceNameUpdate}
        templateLabel={config.label}
        tabs={config.tabs}
        defaultTab="board"
        columns={boardData?.columns.map((c) => ({ id: c.id, name: c.name })) ?? []}
        assignees={uniqueAssignees}
        totalTaskCount={totalTaskCount}
        currentUserId={user?.id}
      >
        {(activeTab, filters) => {
          // Summary tab
          if (activeTab === 'summary' && SummaryComponent) {
            return (
              <SummaryComponent
                tasks={effectiveTasks}
                columns={effectiveColumns}
                columnOrder={effectiveColumnOrder}
                resolveMemberName={resolveMemberName}
              />
            );
          }

          // Timeline tab
          if (activeTab === 'timeline') {
            return (
              <TimelineTab
                tasks={effectiveTasks}
                columns={effectiveColumns}
                columnOrder={effectiveColumnOrder}
                resolveMemberName={resolveMemberName}
                onTaskClick={handleTaskClick}
                workspaceId={space!.id}
              />
            );
          }

          // Calendar tab
          if (activeTab === 'calendar') {
            return <CalendarTab workspaceId={space!.id} />;
          }

          // Resources tab
          if (activeTab === 'resources') {
            return <ResourcesTab workspaceId={space!.id} />;
          }

          // Any non-board tab → placeholder
          if (activeTab !== 'board') {
            return (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-brand-mid-pink/20 bg-white/50 dark:bg-gray-900/40 px-6 py-10 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} view
                  coming soon.
                </p>
              </div>
            );
          }

          if (itemsLoading) {
            return <BoardSkeleton />;
          }

          const query = filters.searchQuery.toLowerCase();

          return (
            <div className="relative rounded-2xl overflow-hidden">
              {/* Ambient gradient for glassmorphism effect */}
              <div className="absolute inset-0 dark:bg-gradient-to-br dark:from-brand-dark-pink/[0.08] dark:via-transparent dark:to-brand-blue/[0.06] pointer-events-none" />
              <div
                ref={boardContainerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`relative rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/50 dark:bg-white/[0.02] p-3 sm:p-4 overflow-x-auto select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-3 sm:gap-4 min-w-max items-stretch">
                  {effectiveColumnOrder.map((colId) => {
                    const col = effectiveColumns[colId];
                    if (!col) return null;

                    // Hide columns toggled off in Columns picker
                    if (filters.hiddenColumns.has(colId)) return null;

                    // Apply filters
                    const colTasks = col.taskIds
                      .map((id) => effectiveTasks[id])
                      .filter(Boolean)
                      .filter((t) => {
                        // Search query filter
                        if (query) {
                          const matchesSearch =
                            t.title.toLowerCase().includes(query) ||
                            t.taskKey.toLowerCase().includes(query) ||
                            t.assignee?.toLowerCase().includes(query) ||
                            t.tags?.some((tag) => tag.toLowerCase().includes(query));
                          if (!matchesSearch) return false;
                        }

                        // Status filter (column filter)
                        if (filters.statusFilter && colId !== filters.statusFilter) {
                          return false;
                        }

                        // Assignee filter (compare resolved name)
                        if (filters.assigneeFilter && resolveMemberName(t.assignee) !== filters.assigneeFilter) {
                          return false;
                        }

                        // Priority filter
                        if (filters.priorityFilter && t.priority !== filters.priorityFilter) {
                          return false;
                        }

                        // My tasks filter
                        if (filters.myTasksOnly && t.assignee !== user?.id) {
                          return false;
                        }

                        return true;
                      });

                    // Check if this column is the second-to-last visible column
                    const visibleColumnOrder = effectiveColumnOrder.filter(
                      (cId) => !filters.hiddenColumns.has(cId)
                    );
                    const isSecondToLast =
                      visibleColumnOrder.length >= 2 &&
                      colId === visibleColumnOrder[visibleColumnOrder.length - 2];
                    const lastColId = visibleColumnOrder.length >= 2
                      ? visibleColumnOrder[visibleColumnOrder.length - 1]
                      : undefined;

                    return (
                      <BoardColumn
                        key={col.id}
                        column={col}
                        tasks={colTasks}
                        onAddTask={handleAddTaskWithDefaults}
                        onTaskClick={handleTaskClick}
                        onTaskTitleUpdate={handleTitleUpdate}
                        onColumnTitleUpdate={handleColumnTitleUpdate}
                        onColumnColorUpdate={handleColumnColorUpdate}
                        onMarkFinal={handleMarkFinal}
                        onTaskDelete={handleDeleteTask}
                        CardComponent={CardComponent}
                        templateType={space!.templateType}
                        isSecondToLastColumn={isSecondToLast}
                        onMoveToColumn={handleColumnChange}
                        lastColumnId={lastColId}
                        onUpdateTask={handleTaskUpdate}
                        onOpenSubmissionModal={handleOpenSubmissionModal}
                      />
                    );
                  })}

                  <AddColumnButton onAddColumn={handleAddColumn} />
                </div>
              </DragDropContext>
              </div>
            </div>
          );
        }}
      </BoardLayout>

      <BoardScrollIndicator
        totalColumns={effectiveColumnOrder.length}
        containerRef={boardContainerRef}
      />

      {selectedTask && (
        <DetailModal
          task={selectedTask}
          columnTitle={selectedColumnTitle}
          columns={boardData?.columns.map((c) => ({ id: c.id, name: c.name })) ?? []}
          onColumnChange={(colId) => handleColumnChange(selectedTask.id, colId)}
          isOpen={!!selectedTask}
          onClose={closeTaskModal}
          onUpdate={handleTaskUpdate}
        />
      )}

      <SubmissionFormModal
        isOpen={submissionModal.isOpen}
        onClose={handleCloseSubmissionModal}
        templateType={submissionModal.templateType}
        spaceSlugs={submissionModal.spaceSlugs}
      />

      {space?.templateType === 'CONTENT_GENERATION' && defaultBoard && effectiveColumnOrder.length > 0 && (
        <ContentGenTaskRequestModal
          isOpen={cgModalOpen}
          onClose={() => setCgModalOpen(false)}
          spaceId={space.id}
          boardId={defaultBoard.id}
          firstColumnId={effectiveColumnOrder[0]}
        />
      )}
    </>
  );
}
