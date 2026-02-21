'use client';

import { useState } from 'react';
import { Plus, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreateSpaceModal } from './CreateSpaceModal';

interface SpacesDropdownProps {
  tenant: string;
  sidebarOpen: boolean;
}

// Static placeholder spaces for the dropdown
const STATIC_SPACES = [
  {
    id: 'space-1',
    name: 'Content Production',
    href: '/spaces/content-production',
  },
  {
    id: 'space-2',
    name: 'Influencer Ops',
    href: '/spaces/influencer-ops',
  },
  {
    id: 'space-3',
    name: 'Campaign Planning',
    href: '/spaces/campaign-planning',
  },
];

export function SpacesDropdown({ tenant, sidebarOpen }: SpacesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const pathname = usePathname();

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCreateModalOpen(true);
  };

  const isActive = pathname?.startsWith(`/${tenant}/spaces`);

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
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-xl transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-md ${
            isActive
              ? 'bg-sidebar-accent/80 border-l-4 border-brand-mid-pink'
              : 'border-l-4 border-transparent hover:border-brand-mid-pink/30'
          }`}
        >
          <span className="flex items-center flex-1 min-w-0">
            <Layers
              className={`h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 shrink-0 mr-2 xs:mr-2.5 sm:mr-3 transition-all duration-300 ${
                isActive ? 'text-brand-mid-pink' : 'text-brand-blue group-hover:text-brand-mid-pink'
              }`}
            />
            <span className="truncate">Spaces</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateClick}
              className="p-1 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
              title="Create Space"
            >
              <Plus className="h-3.5 w-3.5 text-brand-blue hover:text-brand-mid-pink" />
            </button>
            {isOpen ? (
              <ChevronUp className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-brand-mid-pink transition-transform duration-300" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-brand-blue transition-transform duration-300" />
            )}
          </div>
        </button>

        {isOpen && (
          <div className="space-y-1 animate-fadeIn pl-6 xs:pl-7 sm:pl-8">
            {STATIC_SPACES.map((space) => {
              const spaceHref = `/${tenant}${space.href}`;
              const isSpaceActive = pathname === spaceHref;

              return (
                <Link
                  key={space.id}
                  href={spaceHref}
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
                  <span className="truncate">{space.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </>
  );
}
