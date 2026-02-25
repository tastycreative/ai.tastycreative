'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Layers, ChevronUp, ChevronDown, MoreHorizontal, Clock, ChevronRight, Grid3x3, Settings as SettingsIcon, UserPlus, Archive, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { CreateSpaceModal } from './CreateSpaceModal';
import { AddPeopleModal } from './AddPeopleModal';
import { useSpaces, useArchiveSpace, useDeleteSpace } from '@/lib/hooks/useSpaces.query';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface SpacesDropdownProps {
  tenant: string;
  sidebarOpen: boolean;
}

export function SpacesDropdown({ tenant, sidebarOpen }: SpacesDropdownProps) {
  const [isOpen, setIsOpen] = useState(true); // Default to open for Recent section
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [showMoreSpacesModal, setShowMoreSpacesModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [recentSpaces, setRecentSpaces] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState<string | null>(null);
  const [spaceMenuPosition, setSpaceMenuPosition] = useState({ x: 0, y: 0 });
  const [spacesTabMenuOpen, setSpacesTabMenuOpen] = useState(false);
  const [spacesTabMenuPosition, setSpacesTabMenuPosition] = useState({ x: 0, y: 0 });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'archive' | 'delete' | null;
    spaceId: string | null;
  }>({ isOpen: false, type: null, spaceId: null });
  const [addPeopleModal, setAddPeopleModal] = useState<{
    isOpen: boolean;
    spaceId: string | null;
    spaceName: string | null;
  }>({ isOpen: false, spaceId: null, spaceName: null });
  const moreSpacesButtonRef = useRef<HTMLButtonElement>(null);
  const moreSpacesModalRef = useRef<HTMLDivElement>(null);
  const spaceMenuRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const spaceMenuModalRef = useRef<HTMLDivElement>(null);
  const spacesTabMenuButtonRef = useRef<HTMLButtonElement>(null);
  const spacesTabMenuModalRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { data, isLoading } = useSpaces();
  const { mutateAsync: archiveSpace } = useArchiveSpace();
  const { mutateAsync: deleteSpace } = useDeleteSpace();

  const spaces = data?.spaces ?? [];
  const isActive = pathname?.startsWith(`/${tenant}/spaces`);

  // Get localStorage key unique to user
  const getStorageKey = () => {
    return `recent-spaces-${user?.id || 'anonymous'}`;
  };

  // Load recent spaces from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        try {
          setRecentSpaces(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse recent spaces', e);
        }
      }
    }
  }, [user?.id]);

  // Track space access
  const trackSpaceAccess = (spaceId: string) => {
    if (typeof window === 'undefined') return;

    const updated = [spaceId, ...recentSpaces.filter(id => id !== spaceId)].slice(0, 3);
    setRecentSpaces(updated);
    localStorage.setItem(getStorageKey(), JSON.stringify(updated));
  };

  // Track current space if we're on a space page
  useEffect(() => {
    if (pathname?.startsWith(`/${tenant}/spaces/`)) {
      const spaceSlug = pathname.split('/spaces/')[1]?.split('/')[0];
      const currentSpace = spaces.find(s => s.slug === spaceSlug);
      if (currentSpace?.id) {
        trackSpaceAccess(currentSpace.id);
      }
    }
  }, [pathname, spaces]);

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCreateModalOpen(true);
  };

  // Get recent spaces objects
  const recentSpacesData = recentSpaces
    .map(id => spaces.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .slice(0, 3);

  // Get remaining spaces (not in recent)
  const remainingSpaces = spaces.filter(
    s => !recentSpaces.includes(s.id)
  );

  // Set mounted state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check more spaces modal
      if (
        showMoreSpacesModal &&
        moreSpacesModalRef.current &&
        !moreSpacesModalRef.current.contains(target) &&
        moreSpacesButtonRef.current &&
        !moreSpacesButtonRef.current.contains(target)
      ) {
        setShowMoreSpacesModal(false);
      }

      // Check space menu modal
      if (spaceMenuOpen) {
        const menuButton = spaceMenuRefs.current.get(spaceMenuOpen);
        if (
          spaceMenuModalRef.current &&
          !spaceMenuModalRef.current.contains(target) &&
          menuButton &&
          !menuButton.contains(target)
        ) {
          setSpaceMenuOpen(null);
        }
      }

      // Check spaces tab menu modal
      if (
        spacesTabMenuOpen &&
        spacesTabMenuModalRef.current &&
        !spacesTabMenuModalRef.current.contains(target) &&
        spacesTabMenuButtonRef.current &&
        !spacesTabMenuButtonRef.current.contains(target)
      ) {
        setSpacesTabMenuOpen(false);
      }
    };

    if (showMoreSpacesModal || spaceMenuOpen || spacesTabMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreSpacesModal, spaceMenuOpen, spacesTabMenuOpen]);

  const handleMoreSpacesClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (moreSpacesButtonRef.current) {
      const rect = moreSpacesButtonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate available space below and above the button
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Determine if we should position above or below
      // We want to show it aligned with the button top, but adjust if it would overflow
      let yPosition = rect.top;

      // If there's not enough space below (less than 400px for modal), adjust upward
      const modalHeight = Math.min(500, remainingSpaces.length * 50 + 150); // Estimate modal height
      if (spaceBelow < modalHeight && spaceAbove > spaceBelow) {
        // Position so modal fits in viewport, aligned to bottom of viewport with padding
        yPosition = Math.max(20, viewportHeight - modalHeight - 20);
      }

      setModalPosition({
        x: rect.right + 8,
        y: yPosition
      });
    }
    setShowMoreSpacesModal(!showMoreSpacesModal);
  };

  const handleSpaceMenuClick = (e: React.MouseEvent<HTMLButtonElement>, spaceId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const button = spaceMenuRefs.current.get(spaceId);
    if (button) {
      const rect = button.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate position - show to the right of the meatballs icon
      let xPosition = rect.right + 8;
      let yPosition = rect.top;

      // Adjust if would overflow right edge
      const estimatedWidth = 220;
      if (xPosition + estimatedWidth > viewportWidth) {
        xPosition = rect.left - estimatedWidth - 8;
      }

      // Adjust if would overflow bottom
      const estimatedHeight = 200;
      if (yPosition + estimatedHeight > viewportHeight) {
        yPosition = Math.max(20, viewportHeight - estimatedHeight - 20);
      }

      setSpaceMenuPosition({ x: xPosition, y: yPosition });
    }

    setSpaceMenuOpen(spaceMenuOpen === spaceId ? null : spaceId);
  };

  const handleSpacesTabMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (spacesTabMenuButtonRef.current) {
      const rect = spacesTabMenuButtonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate position - show to the right of the meatballs icon
      let xPosition = rect.right + 8;
      let yPosition = rect.top;

      // Adjust if would overflow right edge
      const estimatedWidth = 200;
      if (xPosition + estimatedWidth > viewportWidth) {
        xPosition = rect.left - estimatedWidth - 8;
      }

      // Adjust if would overflow bottom
      const estimatedHeight = 100;
      if (yPosition + estimatedHeight > viewportHeight) {
        yPosition = Math.max(20, viewportHeight - estimatedHeight - 20);
      }

      setSpacesTabMenuPosition({ x: xPosition, y: yPosition });
    }

    setSpacesTabMenuOpen(!spacesTabMenuOpen);
  };

  const handleArchiveSpace = (spaceId: string) => {
    setSpaceMenuOpen(null);
    setConfirmModal({
      isOpen: true,
      type: 'archive',
      spaceId,
    });
  };

  const handleDeleteSpace = (spaceId: string) => {
    setSpaceMenuOpen(null);
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      spaceId,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.spaceId) return;

    try {
      // Find the space being archived/deleted to get its slug
      const targetSpace = spaces.find(s => s.id === confirmModal.spaceId);
      const isOnTargetSpace = targetSpace && pathname === `/${tenant}/spaces/${targetSpace.slug}`;

      if (confirmModal.type === 'archive') {
        await archiveSpace(confirmModal.spaceId);
      } else if (confirmModal.type === 'delete') {
        await deleteSpace(confirmModal.spaceId);
      }

      // If user is currently viewing the archived/deleted space, redirect to spaces list
      if (isOnTargetSpace) {
        router.push(`/${tenant}/spaces`);
      }
    } catch (error) {
      console.error(`Failed to ${confirmModal.type} space:`, error);
      alert(`Failed to ${confirmModal.type} space. Please try again.`);
    }
  };

  if (!sidebarOpen) {
    return (
      <>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-center px-2.5 py-2 xs:py-2.5 rounded-xl transition-all duration-300 active:scale-95 ${
            isActive
              ? 'bg-sidebar-accent/80 text-sidebar-foreground border-2 border-brand-mid-pink/30'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground border-2 border-transparent hover:border-brand-mid-pink/20'
          }`}
        >
          <Layers
            className={`h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 shrink-0 transition-all duration-300 ${
              isActive ? 'text-brand-mid-pink' : 'text-brand-blue'
            }`}
          />
        </button>
        <CreateSpaceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-1">
        <div
          className={`w-full flex items-center justify-between px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-md ${
            isActive
              ? 'bg-sidebar-accent/80 border-l-4 border-brand-mid-pink'
              : 'border-l-4 border-transparent hover:border-brand-mid-pink/30'
          }`}
        >
          <span className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => setIsOpen(!isOpen)}
              onMouseEnter={() => setIsIconHovered(true)}
              onMouseLeave={() => setIsIconHovered(false)}
              className="p-1 -ml-1 rounded-lg hover:bg-sidebar-accent/50 transition-all duration-200 active:scale-95"
              title={isOpen ? 'Collapse Spaces' : 'Expand Spaces'}
            >
              {isIconHovered ? (
                isOpen ? (
                  <ChevronUp
                    className={`h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 shrink-0 transition-all duration-300 ${
                      isActive ? 'text-brand-mid-pink' : 'text-brand-blue'
                    }`}
                  />
                ) : (
                  <ChevronDown
                    className={`h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 shrink-0 transition-all duration-300 ${
                      isActive ? 'text-brand-mid-pink' : 'text-brand-blue'
                    }`}
                  />
                )
              ) : (
                <Layers
                  className={`h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 shrink-0 transition-all duration-300 ${
                    isActive ? 'text-brand-mid-pink' : 'text-brand-blue group-hover:text-brand-mid-pink'
                  }`}
                />
              )}
            </button>
            <span className="truncate ml-1 xs:ml-1.5 sm:ml-2">Spaces</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateClick}
              className="p-1 rounded-lg hover:bg-sidebar-accent/50 transition-colors active:scale-95"
              title="Create Space"
            >
              <Plus className="h-3.5 w-3.5 text-brand-blue hover:text-brand-mid-pink" />
            </button>
            <button
              ref={spacesTabMenuButtonRef}
              onClick={handleSpacesTabMenuClick}
              className="p-1 rounded-lg hover:bg-sidebar-accent/50 transition-colors active:scale-95"
              title="More Options"
            >
              <MoreHorizontal className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-brand-blue hover:text-brand-mid-pink transition-colors duration-300" />
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="space-y-2 animate-fadeIn pl-6 xs:pl-7 sm:pl-8">
            {isLoading ? (
              <div className="px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm text-gray-500 dark:text-gray-400">
                Loading spaces...
              </div>
            ) : spaces.length === 0 ? (
              <div className="px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm text-gray-500 dark:text-gray-400">
                No spaces yet. Create one!
              </div>
            ) : (
              <>
                {/* Recent Section - only show if there are recent spaces */}
                {recentSpacesData.length > 0 ? (
                  <>
                    <div className="px-2.5 xs:px-3 py-1 flex items-center gap-1.5">
                      <span className="text-[10px] xs:text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                        Recent
                      </span>
                    </div>
                    <div className="space-y-1">
                      {recentSpacesData.map((space) => {
                        const spaceHref = `/${tenant}/spaces/${space.slug}`;
                        const isSpaceActive = pathname === spaceHref;

                        // Check if user has permission to manage this space
                        const canManageSpace = space.currentUserRole === 'OWNER' || space.currentUserRole === 'ADMIN';

                        return (
                          <div key={space.id} className="relative group/space-item">
                            <Link
                              href={spaceHref}
                              onClick={() => trackSpaceAccess(space.id)}
                              className={`group flex items-center px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium rounded-xl transition-all duration-300 active:scale-95 ${
                                isSpaceActive
                                  ? 'bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white shadow-lg shadow-brand-mid-pink/25 scale-[1.02] border-2 border-brand-mid-pink/30'
                                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-[1.02] hover:shadow-md hover:border-brand-mid-pink/20 border-2 border-transparent'
                              }`}
                            >
                              <Layers
                                className={`h-4 w-4 shrink-0 mr-2 xs:mr-2.5 sm:mr-3 transition-all duration-300 ${
                                  isSpaceActive
                                    ? 'text-white'
                                    : 'text-brand-blue group-hover:text-brand-mid-pink'
                                } ${isSpaceActive ? 'scale-110' : 'group-hover:scale-110'}`}
                                aria-hidden="true"
                              />
                              <span className="truncate flex-1">{space.name}</span>
                            </Link>

                            {/* Space Menu Button - Only show if user can manage space */}
                            {canManageSpace && (
                              <button
                                ref={(el) => {
                                  if (el) spaceMenuRefs.current.set(space.id, el);
                                }}
                                onClick={(e) => handleSpaceMenuClick(e, space.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover/space-item:opacity-100 hover:bg-sidebar-accent/50 transition-all duration-200 active:scale-95"
                                title="Space options"
                              >
                                <MoreHorizontal className={`h-3.5 w-3.5 ${isSpaceActive ? 'text-white' : 'text-brand-blue hover:text-brand-mid-pink'}`} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* More Spaces button - only show if there are more spaces */}
                    {remainingSpaces.length > 0 && (
                      <>
                        <button
                          ref={moreSpacesButtonRef}
                          onClick={handleMoreSpacesClick}
                          className="w-full px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium text-brand-blue hover:text-brand-mid-pink hover:bg-sidebar-accent rounded-xl transition-all duration-300 active:scale-95 flex items-center gap-2"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>More Spaces ({remainingSpaces.length})</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                        </button>

                        {/* Modal Dropdown - Rendered via Portal */}
                        {mounted && showMoreSpacesModal && createPortal(
                          <div
                            ref={moreSpacesModalRef}
                            className="fixed bg-sidebar rounded-2xl shadow-2xl border border-sidebar-border z-[100] animate-fadeIn flex flex-col"
                            style={{
                              left: `${modalPosition.x}px`,
                              top: `${modalPosition.y}px`,
                              maxHeight: `${Math.min(500, window.innerHeight - modalPosition.y - 20)}px`,
                              minWidth: '240px',
                              maxWidth: '280px',
                            }}
                          >
                            {/* Modal Header */}
                            <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-accent rounded-t-2xl">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-brand-blue" />
                                <span className="text-sm font-semibold text-sidebar-foreground">
                                  More Spaces
                                </span>
                              </div>
                            </div>

                            {/* Spaces List */}
                            <div className="py-2 flex-1 overflow-y-auto custom-scrollbar">
                              {remainingSpaces.map((space) => {
                                const spaceHref = `/${tenant}/spaces/${space.slug}`;
                                const isSpaceActive = pathname === spaceHref;

                                return (
                                  <Link
                                    key={space.id}
                                    href={spaceHref}
                                    onClick={() => {
                                      trackSpaceAccess(space.id);
                                      setShowMoreSpacesModal(false);
                                    }}
                                    className={`group flex items-center gap-2 px-3 py-2.5 text-sm transition-all duration-200 mx-2 rounded-lg ${
                                      isSpaceActive
                                        ? 'bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white'
                                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                    }`}
                                  >
                                    <Layers
                                      className={`h-4 w-4 shrink-0 ${
                                        isSpaceActive ? 'text-white' : 'text-brand-blue group-hover:text-brand-mid-pink'
                                      }`}
                                    />
                                    <span className="truncate">{space.name}</span>
                                  </Link>
                                );
                              })}
                            </div>

                            {/* View All Spaces Button */}
                            <div className="px-3 py-3 border-t border-sidebar-border">
                              <Link
                                href={`/${tenant}/spaces`}
                                onClick={() => setShowMoreSpacesModal(false)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink rounded-lg transition-all duration-300 active:scale-95 shadow-lg shadow-brand-mid-pink/25"
                              >
                                <Grid3x3 className="h-4 w-4" />
                                <span>View All Spaces</span>
                              </Link>
                            </div>

                            {/* Arrow pointer */}
                            <div className="absolute left-0 top-3 transform -translate-x-1 w-2 h-2 bg-sidebar rotate-45 border-l border-b border-sidebar-border"></div>
                          </div>,
                          document.body
                        )}
                      </>
                    )}
                  </>
                ) : (
                  /* Show all spaces when there are no recent spaces */
                  <div className="space-y-1">
                    {spaces.map((space) => {
                      const spaceHref = `/${tenant}/spaces/${space.slug}`;
                      const isSpaceActive = pathname === spaceHref;

                      // Check if user has permission to manage this space
                      const canManageSpace = space.currentUserRole === 'OWNER' || space.currentUserRole === 'ADMIN';

                      return (
                        <div key={space.id} className="relative group/space-item">
                          <Link
                            href={spaceHref}
                            onClick={() => trackSpaceAccess(space.id)}
                            className={`group flex items-center px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium rounded-xl transition-all duration-300 active:scale-95 ${
                              isSpaceActive
                                ? 'bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white shadow-lg shadow-brand-mid-pink/25 scale-[1.02] border-2 border-brand-mid-pink/30'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-[1.02] hover:shadow-md hover:border-brand-mid-pink/20 border-2 border-transparent'
                            }`}
                          >
                            <Layers
                              className={`h-4 w-4 shrink-0 mr-2 xs:mr-2.5 sm:mr-3 transition-all duration-300 ${
                                isSpaceActive
                                  ? 'text-white'
                                  : 'text-brand-blue group-hover:text-brand-mid-pink'
                              } ${isSpaceActive ? 'scale-110' : 'group-hover:scale-110'}`}
                              aria-hidden="true"
                            />
                            <span className="truncate flex-1">{space.name}</span>
                          </Link>

                          {/* Space Menu Button - Only show if user can manage space */}
                          {canManageSpace && (
                            <button
                              ref={(el) => {
                                if (el) spaceMenuRefs.current.set(space.id, el);
                              }}
                              onClick={(e) => handleSpaceMenuClick(e, space.id)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover/space-item:opacity-100 hover:bg-sidebar-accent/50 transition-all duration-200 active:scale-95"
                              title="Space options"
                            >
                              <MoreHorizontal className={`h-3.5 w-3.5 ${isSpaceActive ? 'text-white' : 'text-brand-blue hover:text-brand-mid-pink'}`} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, spaceId: null })}
        onConfirm={handleConfirmAction}
        title={confirmModal.type === 'archive' ? 'Archive Space' : 'Delete Space'}
        message={
          confirmModal.type === 'archive'
            ? 'Are you sure you want to archive this space? It will be hidden from your workspace.'
            : 'Are you sure you want to delete this space? This action cannot be undone.'
        }
        confirmText={confirmModal.type === 'archive' ? 'Archive' : 'Delete'}
        variant={confirmModal.type === 'delete' ? 'danger' : 'warning'}
      />

      {/* Space Menu Modal - Rendered via Portal */}
      {mounted && spaceMenuOpen && createPortal(
        <div
          ref={spaceMenuModalRef}
          className="fixed bg-sidebar rounded-2xl shadow-2xl border border-sidebar-border z-[100] animate-fadeIn"
          style={{
            left: `${spaceMenuPosition.x}px`,
            top: `${spaceMenuPosition.y}px`,
            minWidth: '220px',
          }}
        >
          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                const space = spaces.find(s => s.id === spaceMenuOpen);
                if (space) {
                  setAddPeopleModal({ isOpen: true, spaceId: space.id, spaceName: space.name });
                }
                setSpaceMenuOpen(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
            >
              <UserPlus className="h-4 w-4 text-brand-blue" />
              <span>Add People</span>
            </button>

            <button
              onClick={() => {
                const space = spaces.find(s => s.id === spaceMenuOpen);
                if (space) {
                  router.push(`/${tenant}/spaces/${space.slug}/settings/details`);
                }
                setSpaceMenuOpen(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
            >
              <SettingsIcon className="h-4 w-4 text-brand-blue" />
              <span>Space Settings</span>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-sidebar-border my-1" />

          {/* Destructive Actions */}
          <div className="py-2">
            <button
              onClick={() => spaceMenuOpen && handleArchiveSpace(spaceMenuOpen)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
            >
              <Archive className="h-4 w-4 text-yellow-500" />
              <span>Archive Space</span>
            </button>

            <button
              onClick={() => spaceMenuOpen && handleDeleteSpace(spaceMenuOpen)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Space</span>
            </button>
          </div>

          {/* Arrow pointer */}
          <div className="absolute left-0 top-3 transform -translate-x-1 w-2 h-2 bg-sidebar rotate-45 border-l border-b border-sidebar-border"></div>
        </div>,
        document.body
      )}

      {/* Spaces Tab Menu Modal - Rendered via Portal */}
      {mounted && spacesTabMenuOpen && createPortal(
        <div
          ref={spacesTabMenuModalRef}
          className="fixed bg-sidebar rounded-2xl shadow-2xl border border-sidebar-border z-[100] animate-fadeIn"
          style={{
            left: `${spacesTabMenuPosition.x}px`,
            top: `${spacesTabMenuPosition.y}px`,
            minWidth: '200px',
          }}
        >
          {/* Menu Items */}
          <div className="py-2">
            <Link
              href={`/${tenant}/spaces`}
              onClick={() => setSpacesTabMenuOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
            >
              <SettingsIcon className="h-4 w-4 text-brand-blue" />
              <span>Manage Spaces</span>
            </Link>
          </div>

          {/* Arrow pointer */}
          <div className="absolute left-0 top-3 transform -translate-x-1 w-2 h-2 bg-sidebar rotate-45 border-l border-b border-sidebar-border"></div>
        </div>,
        document.body
      )}

      {/* Add People Modal */}
      {addPeopleModal.spaceId && addPeopleModal.spaceName && (
        <AddPeopleModal
          isOpen={addPeopleModal.isOpen}
          onClose={() => setAddPeopleModal({ isOpen: false, spaceId: null, spaceName: null })}
          spaceId={addPeopleModal.spaceId}
          spaceName={addPeopleModal.spaceName}
        />
      )}
    </>
  );
}
