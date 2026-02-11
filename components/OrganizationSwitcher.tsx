'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOrganization, type Organization } from '@/lib/hooks/useOrganization.query';
import { usePermissions } from '@/lib/hooks/usePermissions.query';
import Link from 'next/link';
import {
  ChevronDown,
  Building2,
  Users,
  Check,
  Plus,
  Crown,
  Shield,
  User,
  Loader2
} from 'lucide-react';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, loading, switchOrganization } = useOrganization();
  const { subscriptionInfo } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSwitch = async (organizationId: string, slug: string) => {
    if (organizationId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    await switchOrganization(organizationId, slug);
    setSwitching(false);
    setIsOpen(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return <Crown className="w-3 h-3 text-yellow-600 dark:text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-3 h-3 text-blue-600 dark:text-blue-500" />;
      case 'MANAGER':
        return <Users className="w-3 h-3 text-purple-600 dark:text-purple-500" />;
      default:
        return <User className="w-3 h-3 text-sidebar-foreground/50" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusUpper = status.toUpperCase();

    if (statusUpper === 'TRIAL') {
      return (
        <span className="text-[8px] xs:text-[9px] px-1 xs:px-1.5 py-0.5 rounded bg-blue-500/20 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30">
          Trial
        </span>
      );
    }

    if (statusUpper === 'ACTIVE') {
      return (
        <span className="text-[8px] xs:text-[9px] px-1 xs:px-1.5 py-0.5 rounded bg-green-500/20 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30">
          Active
        </span>
      );
    }

    if (statusUpper === 'PAST_DUE') {
      return (
        <span className="text-[8px] xs:text-[9px] px-1 xs:px-1.5 py-0.5 rounded bg-red-500/20 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30">
          Past Due
        </span>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2.5 bg-sidebar-accent backdrop-blur-sm rounded-2xl border border-sidebar-border">
        <Loader2 className="w-4 h-4 animate-spin text-[#EC67A1]" />
        <span className="text-sm text-sidebar-foreground">Loading...</span>
      </div>
    );
  }

  // Solo mode - no organization
  if (!currentOrganization && organizations.length === 0) {
    return (
      <Link
        href="/dashboard"
        className="flex items-center justify-between px-3 py-2.5 bg-sidebar-accent backdrop-blur-sm hover:bg-sidebar-accent/80 border-2 border-transparent hover:border-[#EC67A1]/30 rounded-2xl transition-all duration-200 group"
      >
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-[#5DC3F8] group-hover:text-[#EC67A1] transition-colors" />
          <span className="text-sm font-medium text-sidebar-foreground">
            Personal
          </span>
        </div>
        <Plus className="w-4 h-4 text-[#EC67A1]/70 group-hover:text-[#EC67A1] transition-colors" />
      </Link>
    );
  }

  return (
    <>
      {/* Organization Switcher Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={switching}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-sidebar-accent backdrop-blur-sm hover:bg-sidebar-accent/80 border-2 border-transparent hover:border-[#EC67A1]/20 rounded-2xl transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          {currentOrganization?.logoUrl ? (
            <img
              src={currentOrganization.logoUrl}
              alt={currentOrganization.name}
              className="w-5 h-5 rounded object-cover flex-shrink-0"
            />
          ) : (
            <Building2 className="w-4 h-4 text-[#5DC3F8] flex-shrink-0" />
          )}

          <div className="flex flex-col items-start min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 w-full">
              <span className="text-sm font-medium text-sidebar-foreground truncate">
                {currentOrganization?.name || 'Personal'}
              </span>
              {subscriptionInfo && getStatusBadge(subscriptionInfo.status)}
            </div>
            {subscriptionInfo && (
              <span className="text-[10px] text-sidebar-foreground/50">
                {subscriptionInfo.planDisplayName}
              </span>
            )}
          </div>
        </div>

        {switching ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#EC67A1] flex-shrink-0 ml-2" />
        ) : (
          <ChevronDown className={`w-4 h-4 text-[#EC67A1]/70 group-hover:text-[#EC67A1] transition-all duration-300 flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu - Using portal to escape sidebar overflow */}
      {isOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          data-dropdown-portal="organization-switcher"
          className="fixed w-72 bg-sidebar/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-sidebar-border z-[9999] animate-fadeIn"
          style={{
            top: buttonRef.current ? `${buttonRef.current.getBoundingClientRect().bottom + 8}px` : '0',
            left: buttonRef.current ? `${buttonRef.current.getBoundingClientRect().left}px` : '0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-accent">
            <p className="text-[10px] font-semibold text-sidebar-foreground uppercase tracking-wider">
              Switch Organization
            </p>
          </div>

          {/* Organizations List */}
          <div className="max-h-80 overflow-y-auto py-2 custom-scrollbar">
            {organizations.map((org: Organization) => {
              const isActive = org.id === currentOrganization?.id;

              return (
                <button
                  key={org.id}
                  onClick={() => handleSwitch(org.id, org.slug)}
                  disabled={switching}
                  className={`w-full text-left px-4 py-3 transition-all duration-200 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed rounded-xl mx-2 ${
                    isActive
                      ? 'bg-sidebar-accent border-2 border-[#EC67A1]/30'
                      : 'hover:bg-sidebar-accent border-2 border-transparent hover:border-[#EC67A1]/20'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-9 h-9 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-sm font-medium truncate ${
                          isActive
                            ? 'text-sidebar-foreground'
                            : 'text-sidebar-foreground'
                        }`}>
                          {org.name}
                        </span>
                        {getRoleIcon(org.role)}
                      </div>
                      <span className="text-[10px] text-sidebar-foreground/50 uppercase">
                        {org.role}
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <Check className="w-5 h-5 text-[#EC67A1] flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer - Create New Organization */}
          <div className="border-t border-sidebar-border p-2">
            <button
              onClick={() => {
                // Navigate to settings page to create organization
                if (currentOrganization?.slug) {
                  window.location.href = `/${currentOrganization.slug}/settings#organization`;
                } else {
                  window.location.href = '/dashboard';
                }
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#5DC3F8] hover:bg-[#5DC3F8]/10 rounded-xl transition-all duration-200 flex items-center space-x-2 group"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Create New Organization</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
